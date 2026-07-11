/**
 * Frontend mirror of backend/src/config/plz-ranges.constants.ts — keep in
 * sync. Backend re-validates on submit regardless, so drift here is a UX
 * inconsistency risk, not a data-integrity one. See the backend file for
 * the full rationale on why this is a 2-digit-prefix check, not a full
 * street-level PLZ database.
 */

const VALID_PLZ_PREFIX_RANGE: [number, number] = [1, 99];
const KNOWN_INVALID_PLZ = new Set<string>(['99999']);

export function isValidGermanPlzFormat(plz: string): boolean {
  return /^\d{5}$/.test(plz);
}

export function isValidGermanPlzRange(plz: string): boolean {
  if (!isValidGermanPlzFormat(plz)) return false;
  if (KNOWN_INVALID_PLZ.has(plz)) return false;
  const prefix = parseInt(plz.slice(0, 2), 10);
  return prefix >= VALID_PLZ_PREFIX_RANGE[0] && prefix <= VALID_PLZ_PREFIX_RANGE[1];
}
