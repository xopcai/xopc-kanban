import { HttpError } from './httpError.js';
import type { Actor } from '../types/actor.js';

/** Blocks workspace guests from mutating data. Agents are always allowed to write. */
export function assertAccountCanWrite(actor: Actor): void {
  if (actor.type === 'agent') return;
  if (actor.accountRole === 'guest') {
    throw new HttpError('Read-only account', 403);
  }
}
