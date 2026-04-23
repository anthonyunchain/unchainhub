// Minimal iCal (RFC 5545) generator for a single shooting event.
// No dependency — the format is plain text.
//
// Behavior:
//   • If the shooting has a time ("HH:MM"), emit a timed event of 2h duration
//     using floating local time (no TZID). Apple / Google / Outlook all render
//     floating time at the stated wall-clock in the viewer's local timezone —
//     which is what we want since client + crew are on site together.
//   • If no time, emit an all-day event.
//
// The filename is derived from the title, safe for all filesystems.

function pad(n) {
  return String(n).padStart(2, '0');
}

function nowStampUtc() {
  const d = new Date();
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  );
}

function parseHHMM(str) {
  const m = /^(\d{1,2}):(\d{2})/.exec(str || '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

// Escape commas, semicolons, backslashes, and newlines per RFC 5545.
function escapeText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

// Fold lines longer than 75 octets per RFC 5545 §3.1.
function foldLine(line) {
  if (line.length <= 75) return line;
  const parts = [];
  let remaining = line;
  parts.push(remaining.slice(0, 75));
  remaining = remaining.slice(75);
  while (remaining.length > 74) {
    parts.push(' ' + remaining.slice(0, 74));
    remaining = remaining.slice(74);
  }
  if (remaining.length) parts.push(' ' + remaining);
  return parts.join('\r\n');
}

function safeFilename(str) {
  return (str || 'shooting')
    .toLowerCase()
    .replace(/[^\w\d-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'shooting';
}

/**
 * Build an .ics string for a single shooting.
 * @param {object} shooting - Row from `shootings` table (id, title, date, time, location, description, client_name)
 * @param {object} [opts]
 * @param {number} [opts.durationHours=2] - Duration when time is set
 * @param {string} [opts.extraDescription] - Appended to the DESCRIPTION (e.g. crew list)
 */
export function buildShootingIcs(shooting, opts = {}) {
  const { durationHours = 2, extraDescription } = opts;
  const { id, title, date, time, location, description, client_name } = shooting;

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date || '');
  if (!dateMatch) throw new Error('Shooting has no valid date');
  const [, y, m, d] = dateMatch;

  const parsedTime = parseHHMM(time);

  let dtStart, dtEnd;
  if (parsedTime) {
    const startLocal = `${y}${m}${d}T${pad(parsedTime.h)}${pad(parsedTime.min)}00`;
    const endHour = (parsedTime.h + durationHours) % 24;
    const dayRollover = parsedTime.h + durationHours >= 24;
    // If the event would cross midnight, bump to next day
    let endY = y, endM = m, endD = d;
    if (dayRollover) {
      const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + 1));
      endY = String(next.getUTCFullYear());
      endM = pad(next.getUTCMonth() + 1);
      endD = pad(next.getUTCDate());
    }
    const endLocal = `${endY}${endM}${endD}T${pad(endHour)}${pad(parsedTime.min)}00`;
    dtStart = `DTSTART:${startLocal}`;
    dtEnd = `DTEND:${endLocal}`;
  } else {
    // All-day event
    const next = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d) + 1));
    const endY = String(next.getUTCFullYear());
    const endM = pad(next.getUTCMonth() + 1);
    const endD = pad(next.getUTCDate());
    dtStart = `DTSTART;VALUE=DATE:${y}${m}${d}`;
    dtEnd = `DTEND;VALUE=DATE:${endY}${endM}${endD}`;
  }

  const descParts = [];
  if (client_name) descParts.push(`Client: ${client_name}`);
  if (description) descParts.push(description);
  if (extraDescription) descParts.push(extraDescription);
  const descriptionText = descParts.join('\n');

  const uid = `${id || crypto.randomUUID()}@unchainhub`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Unchain Studio//Shooting Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStampUtc()}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeText(title || 'Shooting')}`,
    location ? `LOCATION:${escapeText(location)}` : null,
    descriptionText ? `DESCRIPTION:${escapeText(descriptionText)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Trigger a browser download of the .ics for a shooting.
 */
export function downloadShootingIcs(shooting, opts) {
  const ics = buildShootingIcs(shooting, opts);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(shooting.title)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
