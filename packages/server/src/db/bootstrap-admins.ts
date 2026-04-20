import { eq } from 'drizzle-orm';
import { db } from './client.js';
import * as t from './schema.js';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Sets `account_role = admin` for emails listed in `BOOTSTRAP_ADMIN_EMAILS` (comma-separated).
 * Safe to run on every startup.
 */
export function ensureBootstrapAdmins(): void {
  const raw = process.env.BOOTSTRAP_ADMIN_EMAILS ?? '';
  const emails = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0) return;

  const ts = nowIso();
  for (const email of emails) {
    db.update(t.member)
      .set({
        accountRole: 'admin',
        updatedAt: ts,
      })
      .where(eq(t.member.email, email))
      .run();
  }
}

/** True when public self-registration is disabled (default: enabled). */
export function isPublicRegisterAllowed(): boolean {
  const v = process.env.ALLOW_PUBLIC_REGISTER;
  if (v === undefined || v === '') return true;
  return v !== 'false' && v !== '0';
}
