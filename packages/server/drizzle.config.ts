import { defineConfig } from 'drizzle-kit';

/**
 * - `pnpm db:generate` — diff `schema.ts` → new `000N_*.sql` + snapshot (use after schema changes).
 * - `pnpm db:push` — apply schema directly to a dev DB (no migration files); use sparingly.
 * Server startup always runs `migrate()` so an empty SQLite file gets the full baseline.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? './data/xopc.db',
  },
});
