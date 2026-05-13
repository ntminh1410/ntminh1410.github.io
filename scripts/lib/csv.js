import Papa from 'papaparse';

/**
 * Parse CSV text into array of objects keyed by header row.
 * Empty cells become empty string (never null).
 */
export function parseCsv(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transform: v => (v == null ? '' : String(v).trim()),
  });
  if (result.errors.length) {
    const fatal = result.errors.filter(e => e.type === 'Quotes' || e.type === 'FieldMismatch');
    if (fatal.length) {
      console.warn('[csv] non-fatal parse warnings:', fatal.slice(0, 3));
    }
  }
  return result.data.filter(row => Object.values(row).some(v => v !== ''));
}

/**
 * Parse a key/value sheet (header row: key,value,notes) into a flat object.
 * Used for the Settings tab.
 */
export function parseKv(rows) {
  const kv = {};
  for (const row of rows) {
    if (row.key) kv[row.key] = row.value || '';
  }
  return kv;
}

/**
 * Cast string flags to real booleans. Accepts TRUE/true/1/yes.
 */
export function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v || '').toLowerCase().trim();
  return s === 'true' || s === '1' || s === 'yes';
}

/**
 * Sort by sort_order (numeric, ascending). Empty/NaN sort to end then by publish_date desc.
 */
export function sortByOrder(items, dateField = 'publish_date') {
  return [...items].sort((a, b) => {
    const ao = Number(a.sort_order);
    const bo = Number(b.sort_order);
    const aHas = !Number.isNaN(ao) && a.sort_order !== '';
    const bHas = !Number.isNaN(bo) && b.sort_order !== '';
    if (aHas && bHas) return ao - bo;
    if (aHas) return -1;
    if (bHas) return 1;
    // fall through to date desc
    return String(b[dateField] || '').localeCompare(String(a[dateField] || ''));
  });
}
