/**
 * MQTT topic names consumed by the Education domain (PAGES alert sync).
 * Kept in the data layer so services never hard-code wire-level constants.
 */

export const ALERT_SYNC_TOPICS = [
  'smartcamp/alerts/generated',
  'smartcamp/data/children/sync',
  'smartcamp/data/sessions/sync',
];
