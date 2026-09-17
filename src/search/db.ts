import { connect } from '@tursodatabase/database';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { acquireSearchAccess } from './lock.js';

export const INDEX_FILE = 'search.db';
export const CREATE_PASSAGE_FTS =
  "CREATE INDEX IF NOT EXISTS chunks_fts ON lexical_chunks USING fts(body,heading,path) WITH (tokenizer='whitespace',weights='body=1.0,heading=2.0,path=0.5')";
export function hasIndex(cacheDir: string): boolean {
  return existsSync(join(cacheDir, INDEX_FILE));
}

/** Small SQL adapter; callers never depend on a libSQL connection. */
export class SearchDb {
  private connection: ReturnType<typeof connect> | undefined;
  private release: (() => Promise<void>) | undefined;
  constructor(
    readonly path: string,
    private readonly published = false,
  ) {}
  private get() {
    return (this.connection ??= this.connect());
  }
  private async connect() {
    // Turso 0.7.2 FTS needs writable connections and exclusive process access.
    if (this.published)
      this.release = await acquireSearchAccess(dirname(this.path), 'exclusive');
    try {
      return await connect(this.path, {
        experimental: ['index_method'],
        timeout: 10000,
      });
    } catch (error) {
      await this.release?.();
      this.release = undefined;
      throw error;
    }
  }
  async execute(
    statement: string | { sql: string; args?: any[] },
  ): Promise<{ rows: any[] }> {
    const { sql, args = [] } =
      typeof statement === 'string' ? { sql: statement } : statement;
    const db = await this.get();
    const prepared = await db.prepare(sql);
    try {
      return { rows: await prepared.all(...args) };
    } finally {
      prepared.close();
    }
  }
  async close() {
    try {
      if (this.connection) {
        const db = await this.connection;
        try {
          // Leave a self-contained file for incremental copies and publication.
          if (this.published) await this.checkpoint();
        } finally {
          await db.close();
        }
      }
    } finally {
      this.connection = undefined;
      const release = this.release;
      this.release = undefined;
      await release?.();
    }
  }
  async checkpoint() {
    await this.execute('PRAGMA wal_checkpoint(TRUNCATE)');
  }
}

export function openDb(
  latDir: string,
  requestedCacheDir?: string,
  published = false,
): SearchDb {
  const cacheDir = requestedCacheDir ?? join(latDir, '.cache');
  mkdirSync(cacheDir, { recursive: true });
  return new SearchDb(join(cacheDir, INDEX_FILE), published);
}
export async function ensureMeta(db: SearchDb): Promise<void> {
  await db.execute(
    'CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  );
}
export async function getStoredModel(db: SearchDb): Promise<string | null> {
  const rows = await db.execute(
    "SELECT value FROM meta WHERE key='embedding_model'",
  );
  return rows.rows[0]?.value ?? null;
}
export async function setStoredModel(
  db: SearchDb,
  value: string,
): Promise<void> {
  await db.execute({
    sql: 'INSERT OR REPLACE INTO meta VALUES (?,?)',
    args: ['embedding_model', value],
  });
}
export async function ensureSectionsSchema(
  db: SearchDb,
  _dimensions: number,
): Promise<void> {
  for (const sql of [
    'CREATE TABLE IF NOT EXISTS sections (id TEXT PRIMARY KEY, file TEXT NOT NULL, heading TEXT NOT NULL, content TEXT NOT NULL, content_hash TEXT NOT NULL, parent_id TEXT, start_line INTEGER, end_line INTEGER)',
    'CREATE TABLE IF NOT EXISTS embeddings (hash TEXT PRIMARY KEY, embedding BLOB NOT NULL)',
    'CREATE TABLE IF NOT EXISTS chunks (id INTEGER PRIMARY KEY, source_id TEXT UNIQUE NOT NULL, section_id TEXT NOT NULL, ordinal INTEGER NOT NULL, type TEXT NOT NULL, spans TEXT NOT NULL, body TEXT NOT NULL, heading TEXT NOT NULL, path TEXT NOT NULL, input_hash TEXT NOT NULL)',
    'CREATE INDEX IF NOT EXISTS chunks_section ON chunks(section_id)',
    'CREATE TABLE IF NOT EXISTS lexical_chunks (id INTEGER PRIMARY KEY, body TEXT NOT NULL, heading TEXT NOT NULL, path TEXT NOT NULL)',
    'CREATE TABLE IF NOT EXISTS identifiers (token TEXT NOT NULL, chunk_id INTEGER NOT NULL, PRIMARY KEY(token,chunk_id))',
  ])
    await db.execute(sql);
  const oldIndex = (
    await db.execute(
      "SELECT tbl_name FROM sqlite_master WHERE name='chunks_fts'",
    )
  ).rows[0];
  if (oldIndex?.tbl_name === 'chunks')
    await db.execute('DROP INDEX chunks_fts');
  await db.execute(CREATE_PASSAGE_FTS);
}
export async function dropSections(db: SearchDb): Promise<void> {
  for (const name of [
    'identifiers',
    'lexical_chunks',
    'chunks',
    'embeddings',
    'sections',
  ])
    await db.execute(`DROP TABLE IF EXISTS ${name}`);
}
export async function closeDb(db: SearchDb): Promise<void> {
  await db.close();
}
