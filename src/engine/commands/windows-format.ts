// Numbers and dates the way an en-US Windows formats them: .NET's standard
// numeric formats (N2, F1, D4, P0, X), custom date formats (yyyy-MM-dd
// HH:mm, dddd), Get-Date's long form, and the dates a user types
// (2029-11-20, 11/20/2029 2:00 AM).
// Sources (Microsoft Learn): "Standard numeric format strings"
// (https://learn.microsoft.com/dotnet/standard/base-types/standard-numeric-format-strings),
// "Custom date and time format strings"
// (https://learn.microsoft.com/dotnet/standard/base-types/custom-date-and-time-format-strings).

import { text } from '../powershell';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const two = (n: number) => String(n).padStart(2, '0');

/** A number with a standard format (N2: 1,234.50; F1; D4; P0; X). */
export function formatValue(v: unknown, spec: string): string {
  const m = /^([NFDPXCnfdpxc])(\d*)$/.exec(spec.trim());
  const n = typeof v === 'number' ? v : Number(text(v));
  if (!m || Number.isNaN(n)) return text(v);
  const digits = m[2] === '' ? undefined : Number(m[2]);
  switch (m[1].toUpperCase()) {
    case 'N':
      return n.toLocaleString('en-US', { minimumFractionDigits: digits ?? 2, maximumFractionDigits: digits ?? 2 });
    case 'F':
      return n.toFixed(digits ?? 2);
    case 'D':
      return String(Math.trunc(n)).padStart(digits ?? 0, '0');
    case 'P':
      return `${(n * 100).toLocaleString('en-US', { minimumFractionDigits: digits ?? 2, maximumFractionDigits: digits ?? 2 })} %`;
    case 'X': {
      const h = (Math.trunc(n) >>> 0).toString(16).padStart(digits ?? 0, '0');
      return m[1] === 'x' ? h : h.toUpperCase();
    }
    case 'C':
      return `$${n.toLocaleString('en-US', { minimumFractionDigits: digits ?? 2, maximumFractionDigits: digits ?? 2 })}`;
  }
  return text(v);
}

/** A date with a custom format (yyyy-MM-dd HH:mm:ss, dddd, MMM d), or a standard one (d, g, s, u). */
export function formatDate(ms: number, format: string): string {
  const d = new Date(ms);
  const h = d.getUTCHours();
  const standard: Record<string, string> = { d: 'M/d/yyyy', D: 'dddd, MMMM d, yyyy', g: 'M/d/yyyy h:mm tt', G: 'M/d/yyyy h:mm:ss tt', s: "yyyy-MM-dd'T'HH:mm:ss", t: 'h:mm tt', T: 'h:mm:ss tt', u: "yyyy-MM-dd HH:mm:ss'Z'", f: 'dddd, MMMM d, yyyy h:mm tt', F: 'dddd, MMMM d, yyyy h:mm:ss tt' };
  const pattern = standard[format] ?? format;
  const tokens: Record<string, () => string> = {
    yyyy: () => String(d.getUTCFullYear()),
    yy: () => two(d.getUTCFullYear() % 100),
    MMMM: () => MONTHS[d.getUTCMonth()],
    MMM: () => MONTHS[d.getUTCMonth()].slice(0, 3),
    MM: () => two(d.getUTCMonth() + 1),
    M: () => String(d.getUTCMonth() + 1),
    dddd: () => DAYS[d.getUTCDay()],
    ddd: () => DAYS[d.getUTCDay()].slice(0, 3),
    dd: () => two(d.getUTCDate()),
    d: () => String(d.getUTCDate()),
    HH: () => two(h),
    H: () => String(h),
    hh: () => two(h % 12 || 12),
    h: () => String(h % 12 || 12),
    mm: () => two(d.getUTCMinutes()),
    m: () => String(d.getUTCMinutes()),
    ss: () => two(d.getUTCSeconds()),
    s: () => String(d.getUTCSeconds()),
    tt: () => (h < 12 ? 'AM' : 'PM'),
    fff: () => String(d.getUTCMilliseconds()).padStart(3, '0'),
  };
  return pattern.replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|tt|fff/g, (t, quoted) => (quoted !== undefined ? quoted : tokens[t]()));
}

/** Get-Date's long form: Tuesday, November 20, 2029 2:00:00 AM. */
export const longDateTime = (ms: number) => formatDate(ms, 'dddd, MMMM d, yyyy h:mm:ss tt');

/** A date typed by the user: 2029-11-20, 2029-11-20 02:00[:00], 11/20/2029 [2:00[:00] [AM]]; null if not one. */
export function parseDate(t: string): number | null {
  const s = t.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?Z?$/.exec(s);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(s);
  if (m) {
    let h = +(m[4] ?? 0);
    if (m[7]?.toUpperCase() === 'PM' && h < 12) h += 12;
    if (m[7]?.toUpperCase() === 'AM' && h === 12) h = 0;
    return Date.UTC(+m[3], +m[1] - 1, +m[2], h, +(m[5] ?? 0), +(m[6] ?? 0));
  }
  return null;
}
