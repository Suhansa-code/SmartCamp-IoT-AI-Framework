/** Audit helper — every state-changing relief action is logged. */
import * as repository from '../../data/relief/relief.repository.js';

export async function audit(req, action, entityType, entityId, details) {
  const actor = req?.staff?.email || req?.donor?.email || 'anonymous';
  const actorRole = req?.staff?.role || (req?.donor ? 'DONOR' : null);
  return repository.logAudit({
    actor, actorRole, action, entityType,
    entityId: entityId == null ? null : String(entityId),
    details: details || null,
  });
}
