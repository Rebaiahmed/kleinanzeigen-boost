/**
 * Lightweight German PLZ (postal code) validation.
 *
 * Deliberately NOT a full ~8,200-entry street-level PLZ database — the goal
 * here is to catch obviously-fake input (00000, 99999, sequential typos
 * like 11111), not verify a code maps to a real street. Germany's PLZ space
 * is allocated by Deutsche Post in a 1-digit "postal zone" system
 * (0 = Saxony/Thuringia east, 1 = Berlin/Brandenburg, 2 = Hamburg/SH/
 * Bremen/north Niedersachsen, 3 = Niedersachsen/Sachsen-Anhalt, 4 = NRW
 * north, 5 = NRW south/RLP north, 6 = Hessen/RLP south/Saarland,
 * 7 = Baden-Württemberg, 8 = Bayern south, 9 = Bayern north/Thüringen
 * east), and the entire 01xxx–99998 range is allocated with very few
 * genuine gaps at 2-digit-prefix granularity. Two known-invalid boundary
 * cases are excluded explicitly below.
 *
 * Maintainer note: if a real PLZ is ever reported as wrongly rejected,
 * widen the range/exclusion here rather than switching to a full dataset —
 * starting permissive and tightening is lower-risk than starting overly
 * strict and blocking real users.
 */

// Valid German PLZ 2-digit leading-prefix range (inclusive). "00" is never
// issued as a PLZ prefix, so the valid range starts at 01.
const VALID_PLZ_PREFIX_RANGE: [number, number] = [1, 99];

// Specific 5-digit codes that are never issued despite falling inside the
// valid prefix range above (well-documented boundary case).
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
