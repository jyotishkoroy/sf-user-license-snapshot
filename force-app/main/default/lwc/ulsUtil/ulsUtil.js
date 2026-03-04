export const CSV_EOL = '
';

export function clamp(n, min, max) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

export function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
}

export function toCsv(headers, rows, mapper) {
  const out = [];
  out.push(headers.map(csvCell).join(','));
  (rows || []).forEach(r => {
    const vals = mapper(r) || [];
    out.push(vals.map(csvCell).join(','));
  });
  return out.join(CSV_EOL);
}

function csvCell(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function sortBy(arr, key, dir) {
  const m = dir === 'asc' ? 1 : -1;
  return [...(arr || [])].sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * m;
    if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * m;
    return String(av ?? '').localeCompare(String(bv ?? '')) * m;
  });
}

export function containsAny(row, fields, term) {
  const t = String(term || '').trim().toLowerCase();
  if (!t) return true;
  return (fields || []).some(f => String(row?.[f] ?? '').toLowerCase().includes(t));
}

export function buildSparkPoints(values) {
  const vals = (values || []).map(v => Number(v) || 0);
  if (!vals.length) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = (max - min) || 1;

  const w = 120;
  const h = 28;
  const step = vals.length === 1 ? w : (w / (vals.length - 1));

  return vals.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
