import { describe, expect, it } from 'vitest';
import { parseSourceSymbols } from '@lat.md/core/source-parser';
import { checkMd } from '@lat.md/core/cli/check';
import { fileURLToPath } from 'node:url';

describe('PHP source parser', () => {
  // @lat: [[tests/php-source-parser#PHP Source Parser#Traverses namespaces and conditional declarations]]
  it('finds declarations in namespaces and control flow without leaking anonymous members', async () => {
    const symbols = await parseSourceSymbols(
      'scopes.php',
      `<?php
namespace App {
  const TOP = 1;
  interface Contract { public function run(): void; }
  trait Logs { protected function log(): void {} }
  enum Status { case Ready; }
  class Example { public function run(): void {} }
  if (!function_exists('helper')) { function helper() {} }
  elseif (false) { function alternative() {} }
  else { function fallback() {} }
  switch (1) { case 1: function choice() {} break; default: function other() {} }
  while (false) { function inWhile() {} }
  do { function inDo() {} } while (false);
  for (;;) { function inFor() {} break; }
  foreach ([] as $item) { function inForeach() {} }
  try { function inTry() {} } catch (\\Exception $e) { function inCatch() {} }
  finally { function inFinally() {} }
  $closure = function () { $local = 1; };
  $anonymous = new class { public function hidden() {} public const HIDDEN = 1; };
}
namespace { function globalHelper() {} }
`,
    );
    expect(
      symbols.map((s) => (s.parent ? `${s.parent}#${s.name}` : s.name)),
    ).toEqual([
      'TOP',
      'Contract',
      'Contract#run',
      'Logs',
      'Logs#log',
      'Status',
      'Status#Ready',
      'Example',
      'Example#run',
      'helper',
      'alternative',
      'fallback',
      'choice',
      'other',
      'inWhile',
      'inDo',
      'inFor',
      'inForeach',
      'inTry',
      'inCatch',
      'inFinally',
      'globalHelper',
    ]);
    expect(
      (
        await parseSourceSymbols(
          'declare.php',
          '<?php declare(ticks=1) { function tick() {} }',
        )
      ).map((s) => s.name),
    ).toEqual(['tick']);
  });

  // @lat: [[tests/php-source-parser#PHP Source Parser#Extracts promotion from syntax nodes]]
  it('handles promoted types, references, attributes and untyped properties without matching strings or comments', async () => {
    const symbols = await parseSourceSymbols(
      'promotion.php',
      `<?php
class Example {
  public function __CONSTRUCT(
    public $untyped,
    protected readonly string $typed,
    private string &$reference,
    public ?string $nullable,
    public int|string $union,
    public A&B $intersection,
    #[SensitiveParameter] public string $attributed,
    public string $default = 'public string $phantom',
    /* public string $comment */ string $ordinary = 'private int $fake',
  ) {}
}
`,
    );
    expect(
      symbols.filter((s) => s.kind === 'variable').map((s) => s.name),
    ).toEqual([
      'untyped',
      'typed',
      'reference',
      'nullable',
      'union',
      'intersection',
      'attributed',
      'default',
    ]);
    expect(symbols.find((s) => s.name === 'reference')).toMatchObject({
      parent: 'Example',
      startLine: 6,
      endLine: 6,
      signature: 'private string &$reference,',
    });
  });

  // @lat: [[tests/php-source-parser#PHP Source Parser#Preserves complete declaration ranges]]
  it('includes modifiers, attributes and property hooks in ranges with declaration signatures', async () => {
    const source = `<?php
#[Entity]
readonly class Example {
  #[Column]
  protected string
    $first,
    $second;
  public const string
    FIRST = 'a',
    SECOND = 'b';
  #[Action]
  public function run(): void {}
  public string $name {
    get => 'name';
  }
  public private(set) string $other;
}
`;
    const symbols = await parseSourceSymbols('ranges.php', source);
    const expected = [
      ['Example', 2, 17, 'readonly class Example {'],
      ['first', 4, 7, 'protected string'],
      ['second', 4, 7, 'protected string'],
      ['FIRST', 8, 10, 'public const string'],
      ['SECOND', 8, 10, 'public const string'],
      ['run', 11, 12, 'public function run(): void {}'],
      ['name', 13, 15, 'public string $name {'],
      ['other', 16, 16, 'public private(set) string $other;'],
    ];
    expect(
      symbols.map((s) => [s.name, s.startLine, s.endLine, s.signature]),
    ).toEqual(expected);
  });

  // @lat: [[tests/php-source-parser#PHP Source Parser#Validates PHP source links end to end]]
  it('resolves core PHP declarations and reports missing members through check md', async () => {
    const latDir = fileURLToPath(
      new URL('./cases/source-ref-php/lat.md', import.meta.url),
    );
    const { errors } = await checkMd(latDir);
    expect(errors).toHaveLength(1);
    expect(errors[0].target).toBe('app/Example.php#Example#missing');
    expect(errors[0].message).toContain('missing');
  });

  // @lat: [[tests/php-source-parser#PHP Source Parser#Extracts PHP declarations and members]]
  it('extracts PHP declarations and members with unqualified names', async () => {
    const symbols = await parseSourceSymbols(
      'app/Example.php',
      `<?php
namespace App;

const TOP_LEVEL = 1;
function helper() { return true; }

interface Contract { public function run(): void; }
trait Logs { protected function log(): void {} }
enum Status: string {
    case Ready = 'ready';
    public function ok(): bool { return true; }
}
class Example {
    public const VERSION = 1;
    private string $value;
    public function verifyKey(string $key): bool { return true; }
    public function __construct(private int $id) {}
}
`,
    );

    expect(
      symbols.map(({ name, kind, parent }) => ({ name, kind, parent })),
    ).toEqual([
      { name: 'TOP_LEVEL', kind: 'const', parent: undefined },
      { name: 'helper', kind: 'function', parent: undefined },
      { name: 'Contract', kind: 'interface', parent: undefined },
      { name: 'run', kind: 'method', parent: 'Contract' },
      { name: 'Logs', kind: 'interface', parent: undefined },
      { name: 'log', kind: 'method', parent: 'Logs' },
      { name: 'Status', kind: 'class', parent: undefined },
      { name: 'Ready', kind: 'const', parent: 'Status' },
      { name: 'ok', kind: 'method', parent: 'Status' },
      { name: 'Example', kind: 'class', parent: undefined },
      { name: 'VERSION', kind: 'const', parent: 'Example' },
      { name: 'value', kind: 'variable', parent: 'Example' },
      { name: 'verifyKey', kind: 'method', parent: 'Example' },
      { name: '__construct', kind: 'method', parent: 'Example' },
      { name: 'id', kind: 'variable', parent: 'Example' },
    ]);
  });

  // @lat: [[tests/php-source-parser#PHP Source Parser#Tolerates Blade PHP templates]]
  it('tolerates Blade PHP templates', async () => {
    await expect(
      parseSourceSymbols(
        'resources/views/example.blade.php',
        '<div>{{ $name }}</div>\n{{-- Blade comment --}}\n',
      ),
    ).resolves.toEqual([]);
  });
});
