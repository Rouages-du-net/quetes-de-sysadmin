// A daily reminder the player adds to their own calendar: an iCalendar file
// (RFC 5545) made in the browser, downloaded, opened with any calendar app.
// Nothing is sent and the site keeps nothing: the calendar app does the
// reminding. Reference: https://www.rfc-editor.org/rfc/rfc5545
//
// The time is a "floating" local time (DTSTART without a time zone, RFC 5545
// 3.3.5, form #1): the event happens at that time on the wall clock wherever
// the player is, and stays there when the clocks change. A TZID would need a
// VTIMEZONE component with the zone's rules (RFC 5545 3.6.5, "MUST" for each
// TZID), which a browser can't write faithfully; a time in UTC would move
// by an hour twice a year. Apple Calendar, Google Calendar, Outlook and
// Thunderbird import a floating time as the calendar's own local time.
// The UID is stable: importing the file again (another time chosen) updates
// the same event in the calendars that honour it, rather than adding one.

export interface ReminderOptions {
  /** HH:MM, 24-hour, the player's local time. */
  time: string;
  /** YYYY-MM-DD: the first day (today, from the interface). */
  start: string;
  /** Now, given by the interface (DTSTAMP, in UTC). */
  now: Date;
  /** The language: the UID's, so that each language's file updates its own event. */
  language: string;
  /** The game's address. */
  url: string;
  /** The event's title, its description, and the alert's text (already translated). */
  title: string;
  description: string;
  alarm: string;
}

/** A time of day HH:MM (24-hour), or null. */
export function readTime(time: string): { hours: number; minutes: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  return m ? { hours: Number(m[1]), minutes: Number(m[2]) } : null;
}

/** TEXT values: backslash, semicolon, comma and new lines escaped (RFC 5545 3.3.11). */
export const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** A content line folded at 75 octets, the next ones starting with a space (RFC 5545 3.1), never inside a UTF-8 character. */
export function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    // The first line holds 75 octets; the next ones 74, after their leading space.
    if (size + n > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** The .ics file's text (CRLF line endings), or null for a time that isn't one. */
export function reminderIcs(o: ReminderOptions): string | null {
  const t = readTime(o.time);
  if (!t || !/^\d{4}-\d{2}-\d{2}$/.test(o.start)) return null;
  const start = `${o.start.replace(/-/g, '')}T${String(t.hours).padStart(2, '0')}${String(t.minutes).padStart(2, '0')}00`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Les rouages du net//Sysadmin Quests//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:daily-reminder-${o.language.replace(/[^\w-]/g, '')}@sysadmin.rouages.net`,
    `DTSTAMP:${utc(o.now)}`,
    `DTSTART:${start}`,
    'DURATION:PT15M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${icsText(o.title)}`,
    `DESCRIPTION:${icsText(o.description)}`,
    `URL:${o.url}`,
    // Free time: the reminder doesn't block the player's agenda.
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0M',
    `DESCRIPTION:${icsText(o.alarm)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
