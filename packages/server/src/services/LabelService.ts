import { asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../db/client.js';
import * as t from '../db/schema.js';

export class LabelService {
  async list(): Promise<{ id: string; name: string; color: string }[]> {
    const rows = await db.select().from(t.label).orderBy(asc(t.label.name));
    return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }));
  }

  async create(input: { name: string; color: string }): Promise<{
    id: string;
    name: string;
    color: string;
  }> {
    const id = nanoid();
    await db.insert(t.label).values({
      id,
      name: input.name.trim(),
      color: input.color,
    });
    return { id, name: input.name.trim(), color: input.color };
  }
}

export const labelService = new LabelService();
