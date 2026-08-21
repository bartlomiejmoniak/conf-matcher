import type { VenueView } from './types';

/** A one-event .ics as a data URL for the next deadline. No library. */
export function icsHref(v: VenueView): string | null {
  if (!v.nextDeadline) return null;
  const d = v.nextDeadline.effectiveDate.replace(/-/g, '');
  const next = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8) + 1))
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Confgraph//EN',
    'BEGIN:VEVENT',
    `UID:${v.id}-${v.nextDeadline.stage.replace(/\s+/g, '-').toLowerCase()}@confgraph`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc(`${v.name} — ${v.nextDeadline.stage}`)}`,
    `DESCRIPTION:${esc(
      [
        `${v.fullName}`,
        `${v.nextDeadline.stage} deadline ${v.nextDeadline.effectiveDate} (${v.nextDeadline.timezone ?? 'AoE'})`,
        v.links?.cfp ? `CFP: ${v.links.cfp}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join('\r\n'))}`;
}
