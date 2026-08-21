/** All date maths is on plain YYYY-MM-DD strings in UTC — no timezone drift, no Date parsing surprises. */

export const ISO = /^\d{4}-\d{2}-\d{2}$/;

export const todayISO = (): string => new Date().toISOString().slice(0, 10);

/** Midnight UTC for a YYYY-MM-DD string. */
export const utc = (iso: string): number => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

export const daysBetween = (from: string, to: string): number =>
  Math.round((utc(to) - utc(from)) / 86_400_000);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "4 Feb 2027" */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso || !ISO.test(iso)) return '—';
  return `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
}

/** "14–18 Jun 2027", "31 May – 4 Jun 2027", or "Dates not announced". */
export function fmtRange(start: string | null, end: string | null): string {
  if (!start || !end) return 'Dates not announced';
  if (start === end) return fmtDate(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  if (sameMonth) return `${+start.slice(8, 10)}–${+end.slice(8, 10)} ${MONTHS[+end.slice(5, 7) - 1]} ${end.slice(0, 4)}`;
  if (sameYear) return `${+start.slice(8, 10)} ${MONTHS[+start.slice(5, 7) - 1]} – ${fmtDate(end)}`;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

/** "in 86 days" / "tomorrow" / "today" / "closed 12 days ago" */
export function relative(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return 'closed yesterday';
  return `closed ${Math.abs(days)} days ago`;
}

/** "Feb 2027" */
export const fmtMonth = (year: number, monthIndex: number): string => `${MONTHS[monthIndex]} ${year}`;

export const addMonths = (year: number, monthIndex: number, n: number): [number, number] => {
  const total = year * 12 + monthIndex + n;
  return [Math.floor(total / 12), total % 12];
};
