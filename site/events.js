/* Date, recurrence and calendar export for personal events. */
(function (root) {
  'use strict';
  const categories = {
    birthday: 'Sinh nhật', memorial: 'Ngày giỗ', inspection: 'Đăng kiểm xe',
    license: 'Đổi bằng lái xe', wedding: 'Đám cưới', travel: 'Du lịch gia đình', other: 'Khác'
  };
  const levels = {critical: 'Rất quan trọng', important: 'Quan trọng', normal: 'Bình thường'};
  const reminderDays = [30, 14, 7, 3, 1, 0];
  const lookback = 24 * 60 * 60 * 1000;
  const pad = n => String(n).padStart(2, '0');

  function dateKey(date) {
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function occurrence(date, time = '09:00', year = Number(date.slice(0, 4))) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
    const [, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    if (year < 1900 || year > 9999) return null;
    const result = new Date(year, month - 1, day, hours, minutes);
    // A yearly recurrence on 29 February occurs only in leap years.
    return result.getMonth() === month - 1 && result.getDate() === day ? result : null;
  }

  function cleanEvent(value) {
    if (!value || typeof value.id !== 'string' || typeof value.title !== 'string' ||
        typeof value.date !== 'string' || !value.title.trim() || !occurrence(value.date, value.time)) return null;
    return {
      id: value.id.slice(0, 120), title: value.title.trim().slice(0, 160),
      date: value.date, time: value.time || '09:00',
      category: Object.prototype.hasOwnProperty.call(categories, value.category) ? value.category : 'other',
      priority: Object.prototype.hasOwnProperty.call(levels, value.priority) ? value.priority : 'normal',
      repeat: value.repeat === 'yearly' ? 'yearly' : 'once',
      reminders: reminderDays.filter(day => Array.isArray(value.reminders) && value.reminders.includes(day)),
      location: typeof value.location === 'string' ? value.location.trim().slice(0, 200) : '',
      notes: typeof value.notes === 'string' ? value.notes.trim().slice(0, 2000) : '',
      done: value.repeat !== 'yearly' && value.done === true,
      reminderSince: Number.isSafeInteger(value.reminderSince) ? Math.max(0, value.reminderSince) : 0
    };
  }

  function nextOccurrence(event, from = new Date()) {
    const first = occurrence(event.date, event.time);
    if (event.repeat !== 'yearly' || !first || dateKey(first) >= dateKey(from)) return first;
    for (let year = from.getFullYear(); year <= from.getFullYear() + 8; year++) {
      const date = occurrence(event.date, event.time, year);
      if (date && dateKey(date) >= dateKey(from)) return date;
    }
    return null;
  }

  function occursOn(event, day) {
    if (event.done || day < event.date) return false;
    return day === event.date || (event.repeat === 'yearly' && day.slice(4) === event.date.slice(4));
  }

  function dueReminders(events, since, now = Date.now()) {
    const start = Math.max(since, now - lookback);
    const year = new Date(now).getFullYear();
    const due = [];
    for (const event of events) {
      if (event.done || !event.reminders.length) continue;
      const firstYear = Number(event.date.slice(0, 4));
      const years = event.repeat === 'yearly' ? [year - 1, year, year + 1].filter(y => y >= firstYear) : [firstYear];
      let latest = null;
      for (const y of years) {
        const date = occurrence(event.date, event.time, y);
        if (!date) continue;
        for (const days of event.reminders) {
          const trigger = new Date(date);
          trigger.setDate(trigger.getDate() - days);
          const at = trigger.getTime();
          if (at > start && at >= event.reminderSince && at <= now && (!latest || at > latest.at)) {
            latest = {event, date, at, days};
          }
        }
      }
      if (latest) due.push(latest);
    }
    return due.sort((a, b) => a.at - b.at);
  }

  function calendarFile(event, now = new Date()) {
    const escape = text => text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const start = nextOccurrence(event, now);
    if (!start) return '';
    const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Thoi Gian Cua Toi//Events//VI',
      'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      'UID:' + escape(event.id.replace(/[\r\n]/g, '')) + '@thoi-gian-cua-toi',
      'DTSTAMP:' + stamp, 'DTSTART:' + dateKey(start).replace(/-/g, '') + 'T' + event.time.replace(':', '') + '00',
      'SUMMARY:' + escape(event.title)
    ];
    if (event.location) lines.push('LOCATION:' + escape(event.location));
    if (event.notes) lines.push('DESCRIPTION:' + escape(event.notes));
    if (event.repeat === 'yearly') lines.push('RRULE:FREQ=YEARLY');
    for (const days of event.reminders) {
      lines.push('BEGIN:VALARM', 'TRIGGER:' + (days ? '-P' + days + 'D' : 'PT0S'),
        'ACTION:DISPLAY', 'DESCRIPTION:' + escape(event.title), 'END:VALARM');
    }
    lines.push('END:VEVENT', 'END:VCALENDAR');
    const encoder = new TextEncoder();
    return lines.map(line => {
      let bytes = 0;
      let result = '';
      for (const char of line) {
        const size = encoder.encode(char).length;
        if (bytes + size > 75) {
          result += '\r\n ';
          bytes = 1;
        }
        result += char;
        bytes += size;
      }
      return result;
    }).join('\r\n') + '\r\n';
  }

  const api = {categories, levels, reminderDays, lookback, dateKey, occurrence, cleanEvent, nextOccurrence,
    occursOn, dueReminders, calendarFile};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PlannerEvents = api;
})(globalThis);
