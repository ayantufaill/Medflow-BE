/**
 * Maps a numeric procedure status code (OpenDental ProcStatus) to a human-readable label.
 */
export const mapProcedureStatusToText = (status?: number | null): string => {
  switch (status) {
    case 1: return 'Completed';
    case 2: return 'Treatment Planned';
    case 3: return 'Existing Current';
    case 4: return 'Existing Other';
    case 5: return 'Referred Out';
    case 6: return 'Deleted';
    case 7: return 'Condition';
    default: return 'Unknown';
  }
};

/**
 * Normalizes a list of medication/supplement rows to a consistent shape,
 * filling in missing fields with safe defaults.
 */
export const normalizeMedicalHistoryRows = (rows: any[] = []) =>
  rows.map((row, index) => ({
    id: row?.id ?? String(index + 1),
    drug: typeof row?.drug === 'string' ? row.drug : '',
    dosage: typeof row?.dosage === 'string' ? row.dosage : '',
    purpose: typeof row?.purpose === 'string' ? row.purpose : '',
  }));

/**
 * Normalizes dental history personal-history section rows to a consistent shape.
 */
export const normalizeDentalHistorySections = (rows: any[] = []) =>
  rows.map((row, index) => ({
    id: row?.id ?? `section-${index + 1}`,
    number: row?.number ?? index + 1,
    question: typeof row?.question === 'string' ? row.question : '',
    answer: typeof row?.answer === 'string' ? row.answer : '',
    scale:
      typeof row?.scale === 'string' || typeof row?.scale === 'number'
        ? String(row.scale)
        : '',
    note: typeof row?.note === 'string' ? row.note : '',
    additionalInfo: typeof row?.additionalInfo === 'string' ? row.additionalInfo : '',
  }));

/**
 * Converts a list of dated items into a sorted, deduplicated array of
 * { date, label } visit-date objects (ascending order).
 */
export const buildVisitDates = (
  items: Array<{ date?: string | Date | null }>
): Array<{ date: string; label: string }> => {
  const unique = Array.from(
    new Set(
      items
        .map((item) => item?.date)
        .filter((d): d is string | Date => Boolean(d))
        .map((d) => new Date(d).toISOString().split('T')[0])
    )
  ).filter((d): d is string => typeof d === 'string' && d.length > 0);

  return unique
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((date) => ({
      date,
      label: new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      }),
    }));
};
