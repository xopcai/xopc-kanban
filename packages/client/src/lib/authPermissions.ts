import type { AuthUser } from '../store/authStore';

/** Guests are read-only; agents can use the API as today. */
export function isWritableAuthUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  if (user.typ === 'agent') return true;
  return user.accountRole !== 'guest';
}
