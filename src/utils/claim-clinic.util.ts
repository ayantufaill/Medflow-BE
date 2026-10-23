/** Resolve ownership only when every source line names the same real clinic.
 * Do not guess from the current UI branch or a patient's home clinic: treatment
 * can take place at another branch. Mixed or incomplete ownership stays unknown.
 */
export function claimClinicFromLines(clinics: Array<bigint | null | undefined>): bigint | null {
  if (!clinics.length || clinics.some(id => id == null || id <= 0n)) return null;
  const ids = new Set(clinics);
  return ids.size === 1 ? clinics[0]! : null;
}
