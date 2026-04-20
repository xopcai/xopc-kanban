import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveDbPath(): string {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv && !fromEnv.startsWith('file:')) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }
  if (fromEnv?.startsWith('file:')) {
    return fileURLToPath(new URL(fromEnv));
  }
  return path.resolve(process.cwd(), 'data/xopc.db');
}

const dbPath = resolveDbPath();
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

/** Applies `src/db/migrations/*.sql` (baseline + future deltas). Empty DB → full schema. */
const migrationsFolder = path.join(__dirname, 'migrations');
migrate(db, { migrationsFolder });
