/**
 * Fields that must never leave the Pi on a person record.
 *
 * mqtt_password is a live broker credential; publishing it over the very
 * broker it authenticates against would hand it to anyone subscribed.
 */
const SENSITIVE_PERSON_FIELDS = ['mqtt_password'];

/**
 * Copy of a person row safe to publish. Returns the input unchanged if it is
 * not an object, so callers can pass a possibly-missing row without guarding.
 */
export function redactPerson(person) {
  if (!person || typeof person !== 'object') return person;
  const clean = { ...person };
  for (const field of SENSITIVE_PERSON_FIELDS) delete clean[field];
  return clean;
}

export { SENSITIVE_PERSON_FIELDS };
