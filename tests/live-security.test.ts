import { afterEach, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request, type IncomingMessage } from 'node:http';
import { plainStyler } from '@lat.md/core/context';
import { startViewServer, type ViewServer } from '../src/view/server.js';
import { trustedLiveRequest } from '../src/view/request-security.js';

let root: string | undefined;
let server: ViewServer | undefined;
afterEach(async () => {
  await server?.close();
  server = undefined;
  if (root) await rm(root, { recursive: true, force: true });
  root = undefined;
});

function get(
  url: string,
  headers: Record<string, string> = {},
  method = 'GET',
) {
  return new Promise<{
    status: number;
    headers: IncomingMessage['headers'];
    body: string;
  }>((resolve, reject) => {
    const req = request(url, { headers, method }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () =>
        resolve({ status: res.statusCode!, headers: res.headers, body }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

// @lat: [[view/specs#Live request and resource isolation]]
it('rejects rebinding and cross-origin requests while isolating active resource documents', async () => {
  root = await mkdtemp(join(tmpdir(), 'lat-live-security-'));
  const latDir = join(root, 'lat.md');
  await mkdir(latDir);
  const document = '# Project\n\nOriginal content.\n';
  await writeFile(join(latDir, 'lat.md'), document);
  await writeFile(
    join(latDir, 'attack.html'),
    '<script src="/resources/attack.js"></script>',
  );
  await writeFile(
    join(latDir, 'attack.js'),
    'fetch("/api/document", {method:"PATCH"})',
  );
  await writeFile(
    join(latDir, 'image.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
  );
  server = await startViewServer(
    { projectRoot: root, latDir, mode: 'cli', styler: plainStyler },
    { port: 0, watch: false, git: false },
  );
  const authority = new URL(server.url).host;
  expect((await get(server.url + 'api/index')).status).toBe(200);
  expect(
    (
      await get(server.url + 'api/index', {
        Host: `evil.example:${new URL(server.url).port}`,
      })
    ).status,
  ).toBe(403);
  expect(
    (await get(server.url + 'api/index', { Host: 'localhost:1' })).status,
  ).toBe(403);
  expect(
    (
      await get(server.url + 'api/index', {
        Host: `localhost:${new URL(server.url).port}`,
      })
    ).status,
  ).toBe(200);
  for (const Origin of ['https://evil.example', 'null', 'http://localhost:1'])
    expect(
      (await get(server.url + 'api/document', { Origin }, 'PATCH')).status,
    ).toBe(403);
  const sameOrigin = await get(
    server.url + 'api/document',
    { Origin: `http://${authority}` },
    'PATCH',
  );
  expect(sameOrigin.status).not.toBe(403); // Reaches normal body validation.
  expect(await readFile(join(latDir, 'lat.md'), 'utf8')).toBe(document);
  for (const file of ['attack.html', 'attack.js', 'image.svg']) {
    const result = await get(server.url + 'resources/' + file);
    expect(result.status).toBe(200);
    expect(result.headers['content-security-policy']).toContain(
      "sandbox; default-src 'none'",
    );
    expect(result.headers['content-security-policy']).not.toContain(
      'allow-scripts',
    );
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    if (file === 'image.svg')
      expect(result.headers['content-disposition']).toBeUndefined();
    else expect(result.headers['content-disposition']).toBe('attachment');
  }
});

it('allows explicitly configured and IPv6 listener authorities without trusting forwarding headers', () => {
  const req = (host: string) =>
    ({
      headers: { host },
      socket: { localPort: 4242 },
      method: 'GET',
      url: '/',
    }) as IncomingMessage;
  expect(trustedLiveRequest(req('[::1]:4242'), '::1')).toBe(true);
  expect(trustedLiveRequest(req('docs.example:4242'), 'docs.example')).toBe(
    true,
  );
  expect(trustedLiveRequest(req('evil.example:4242'), 'docs.example')).toBe(
    false,
  );
  expect(
    trustedLiveRequest(
      {
        ...req('evil.example:4242'),
        headers: {
          host: 'evil.example:4242',
          'x-forwarded-host': 'localhost:4242',
        },
      } as unknown as IncomingMessage,
      '127.0.0.1',
    ),
  ).toBe(false);
});
