import { readFileSync } from 'node:fs';
import { fork } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLatServerVersion } from '@lat.md/server';
import { analyzeMarkdownProject, } from '@lat.md/core/project-analysis';
import { getLocalVersion } from '../version.js';
import { toPosix } from '@lat.md/core/path';
import { buildStaticView, moveViewBuildOutput, removeViewBuildStaging, normalizeStaticViewBasePath, validateViewBuildOutput, } from './static-build.js';
import { SERVER_VIEW_SCHEMA_VERSION, } from './server-deployment.js';
const defaultDependencies = {
    analyzeMarkdownProject,
    buildStaticView,
    getLocalVersion,
    getLatServerVersion,
    getPackageVersion,
    buildSearchIndex: buildServerSearchIndex,
};
/** Wait for the index process to exit so native handles cannot lock staging. */
export function buildServerSearchIndex(latDir, project, cacheDir) {
    const sourceRuntime = import.meta.url.endsWith('.ts');
    const child = fork(new URL(sourceRuntime ? './server-index-worker.ts' : './server-index-worker.js', import.meta.url), [], {
        execArgv: sourceRuntime ? ['--import', 'tsx'] : [],
        serialization: 'advanced',
        stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    return new Promise((resolveIndex, reject) => {
        let stderr = '';
        let sendError = null;
        child.stderr.setEncoding('utf8');
        child.stderr.on('data', (chunk) => {
            stderr = (stderr + chunk).slice(-64_000);
        });
        child.once('error', reject);
        child.once('close', (code, signal) => {
            if (sendError)
                reject(sendError);
            else if (code === 0)
                resolveIndex();
            else {
                reject(new Error(`Server search indexing failed (${signal ?? code}): ${stderr.trim()}`));
            }
        });
        child.send({ latDir, project, cacheDir }, (error) => {
            if (error) {
                sendError = error;
                child.kill();
            }
        });
    });
}
function getPackageVersion(name) {
    let directory = dirname(fileURLToPath(import.meta.resolve(name)));
    while (true) {
        try {
            const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
            if (manifest.name === name && manifest.version)
                return manifest.version;
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        const parent = dirname(directory);
        if (parent === directory)
            break;
        directory = parent;
    }
    throw new Error(`Could not resolve package version: ${name}`);
}
function appModule() {
    return `import { createEmbedder } from '@lat.md/embed';
import minilm from '@lat.md/embed-minilm-fp16';
import express from 'express';
import { createServerViewApp } from 'lat.md/server';
const view = createServerViewApp({
  app: express(),
  manifestFile: new URL('./server-data/server.json', import.meta.url),
  indexFile: new URL('./server-data/search.db', import.meta.url),
  createSearchEngine: () => createEmbedder({ model: minilm }),
});
export const close = view.close;
export default view.app;
`;
}
function packageManifest(latVersion, serverVersion, runtimeVersions) {
    return `${JSON.stringify({
        name: 'lat-ui-server',
        private: true,
        type: 'module',
        scripts: { start: 'lat-ui-server app.mjs' },
        dependencies: {
            '@lat.md/embed': runtimeVersions.embed,
            '@lat.md/embed-minilm-fp16': runtimeVersions.model,
            '@lat.md/server': serverVersion,
            express: runtimeVersions.express,
            'lat.md': latVersion,
        },
    }, null, 2)}\n`;
}
/** Build immutable UI data plus the small portable Express search service. */
export async function buildServerView(ctx, requestedOutput, options = {}, dependencies = defaultDependencies) {
    const outputDir = resolve(ctx.projectRoot, requestedOutput);
    const basePath = normalizeStaticViewBasePath(options.basePath ?? '/');
    await validateViewBuildOutput(outputDir, ctx.projectRoot, 'Server', options.force);
    await mkdir(dirname(outputDir), { recursive: true });
    const stagingDir = await mkdtemp(join(dirname(outputDir), '.lat-server-staging-'));
    try {
        const publicDir = join(stagingDir, 'public');
        const dataDir = join(stagingDir, 'server-data');
        const staticResult = await dependencies.buildStaticView(ctx, publicDir, {
            ...options,
            basePath,
            searchApi: `${basePath}api/search`,
        });
        const project = await dependencies.analyzeMarkdownProject(ctx.latDir, ctx.projectRoot, { executor: 'auto' });
        await dependencies.buildSearchIndex(ctx.latDir, project, dataDir);
        const sections = project.sections.map(({ children: _children, ...section }) => ({
            ...section,
            documentPath: toPosix(relative(ctx.latDir, resolve(ctx.projectRoot, section.filePath))),
        }));
        const manifest = {
            version: SERVER_VIEW_SCHEMA_VERSION,
            basePath,
            sections,
        };
        await writeFile(join(dataDir, 'server.json'), `${JSON.stringify(manifest)}\n`);
        await writeFile(join(stagingDir, 'app.mjs'), appModule());
        await writeFile(join(stagingDir, 'package.json'), packageManifest(dependencies.getLocalVersion(), dependencies.getLatServerVersion(), {
            embed: dependencies.getPackageVersion('@lat.md/embed'),
            express: dependencies.getPackageVersion('express'),
            model: dependencies.getPackageVersion('@lat.md/embed-minilm-fp16'),
        }));
        if (options.force) {
            await rm(outputDir, { recursive: true, force: true });
        }
        await moveViewBuildOutput(stagingDir, outputDir);
        return { ...staticResult, outputDir };
    }
    catch (error) {
        await removeViewBuildStaging(stagingDir);
        throw error;
    }
}
