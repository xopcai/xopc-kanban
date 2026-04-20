import { sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from './client.js';
import * as t from './schema.js';

export function seedLabelsIfEmpty(): void {
  const row = db
    .select({ c: sql<number>`count(*)`.mapWith(Number) })
    .from(t.label)
    .get();
  if ((row?.c ?? 0) > 0) return;

  const seeds = [
    { name: 'bug', color: '#ef4444' },
    { name: 'feature', color: '#2563eb' },
    { name: 'chore', color: '#86868b' },
  ];
  for (const s of seeds) {
    db.insert(t.label).values({
      id: nanoid(),
      name: s.name,
      color: s.color,
    });
  }
}
