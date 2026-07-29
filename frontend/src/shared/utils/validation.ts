/** RFC-lite email format check — good enough for CRM/HR contact fields. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when `value` looks like a real email address. Callers should treat "" as valid (optional field). */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}
