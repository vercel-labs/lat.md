import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseSourceSymbols,
  resolveSourceSymbol,
} from '@lat.md/core/source-parser';
import { checkMd } from '@lat.md/core/cli/check';
import { scanCodeRefs } from '@lat.md/core/code-refs';

const source = `@MainActor
public class Greeter {
  let prefix = "Hi", suffix = "!"
  var value: Int { get { 1 } set {} }
  init(name: String) {}
  deinit {}
  func greet(_ name: String) -> String { let local = 1; return name }
  subscript(index: Int) -> Int { index }
  struct Nested { var x: Int }
}
protocol Named {
  var name: String { get }
  func greet()
  associatedtype Item
}
struct Box<T> { var value: T }
actor Store { func save() {} }
enum Color { case red, green; case rgb(Int, Int, Int) }
extension Box where T: Equatable { func matches() {} }
extension Greeter.Nested { func nestedMethod() {} }
typealias ID = String
let (a, b) = (1, 2)
func top() { func hidden() {} }
func \`repeat\`() {}
`;

describe('Swift source links', () => {
  // @lat: [[tests/swift-source-parser#Swift Source Links#Extracts declarations and members]]
  it('extracts Swift types, members and extensions without leaking local declarations', async () => {
    const symbols = await parseSourceSymbols('app.swift', source);
    expect(
      symbols.map((s) => (s.parent ? `${s.parent}#${s.name}` : s.name)),
    ).toEqual([
      'Greeter',
      'Greeter#prefix',
      'Greeter#suffix',
      'Greeter#value',
      'Greeter#init',
      'Greeter#deinit',
      'Greeter#greet',
      'Greeter#subscript',
      'Nested',
      'Greeter#Nested',
      'Nested#x',
      'Named',
      'Named#name',
      'Named#greet',
      'Named#Item',
      'Box',
      'Box#value',
      'Store',
      'Store#save',
      'Color',
      'Color#red',
      'Color#green',
      'Color#rgb',
      'Box#matches',
      'Nested#nestedMethod',
      'ID',
      'a',
      'b',
      'top',
      'repeat',
    ]);
    expect(symbols[0]).toMatchObject({
      startLine: 1,
      endLine: 10,
      signature: 'public class Greeter {',
    });
    expect(symbols.find((s) => s.name === 'prefix')).toMatchObject({
      kind: 'const',
      startLine: 3,
      endLine: 3,
    });
    expect(symbols.find((s) => s.name === 'matches')).toMatchObject({
      kind: 'method',
      parent: 'Box',
      startLine: 19,
      endLine: 19,
    });
  });

  // @lat: [[tests/swift-source-parser#Swift Source Links#Validates links and scans code mentions]]
  it('validates Swift wiki links, reports missing members, resolves ranges and scans mentions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lat-swift-'));
    try {
      const latDir = join(root, 'lat.md');
      await mkdir(latDir);
      await writeFile(
        join(root, 'app.swift'),
        source + '\n// @' + 'lat: [[docs#Swift]]\n',
      );
      await writeFile(
        join(latDir, 'docs.md'),
        '# Swift\n\nSee [[app.swift#Greeter#greet]], [[app.swift#Box#matches]], and [[app.swift#repeat]].\n',
      );
      expect((await checkMd(latDir)).errors).toEqual([]);
      expect(
        await resolveSourceSymbol('app.swift', 'Greeter#greet', root),
      ).toMatchObject({
        found: true,
        symbols: expect.arrayContaining([
          expect.objectContaining({
            name: 'greet',
            parent: 'Greeter',
            startLine: 7,
            endLine: 7,
          }),
        ]),
      });
      const { refs } = await scanCodeRefs(root);
      expect(refs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ file: 'app.swift', target: 'docs#Swift' }),
        ]),
      );
      await writeFile(
        join(latDir, 'docs.md'),
        '# Swift\n\nSee [[app.swift#Greeter#missing]].\n',
      );
      expect((await checkMd(latDir)).errors).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
