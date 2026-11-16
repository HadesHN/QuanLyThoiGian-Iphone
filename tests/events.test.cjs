const assert = require('node:assert/strict');
const events = require('../site/events.js');
const sample = events.cleanEvent({
  id:'birthday-one', title:'Sinh nhật, bà; nội', date:'2024-02-29', time:'09:00',
  category:'birthday', priority:'important', repeat:'yearly', reminders:[30,7,1,0,7],
  location:'Hà Nội', notes:'Dòng 1\nDòng 2'
});
assert.deepEqual(sample.reminders,[30,7,1,0]);
assert.equal(events.cleanEvent({...sample,date:'2026-02-29'}),null);
assert.equal(events.dateKey(events.nextOccurrence(sample,new Date(2025,2,1))), '2028-02-29');
assert.equal(events.occursOn(sample,'2028-02-29'),true);
assert.equal(events.occursOn(sample,'2020-02-29'),false);
assert.equal(events.occursOn({...sample,done:true},'2028-02-29'),false);

const event = {...sample,date:'2026-01-03',reminderSince:0};
const before = new Date(2026,11,27,8,59).getTime();
const now = new Date(2026,11,27,9,1).getTime();
assert.equal(events.dueReminders([event],before,now)[0].days,7);
assert.equal(events.dueReminders([event],now,now).length,0);
assert.equal(events.dueReminders([{...event,reminderSince:now}],before,now).length,0);
assert.equal(events.dueReminders([{...event,done:true}],before,now).length,0);
const ics = events.calendarFile({...sample,title:sample.title.repeat(5)},new Date(2026,10,16));
assert.ok(ics.includes('DTSTART:20280229T090000\r\n'));
assert.ok(ics.includes('RRULE:FREQ=YEARLY\r\n'));
assert.ok(ics.includes('TRIGGER:-P30D\r\n'));
assert.ok(ics.includes('TRIGGER:PT0S\r\n'));
assert.ok(ics.includes('DESCRIPTION:Dòng 1\\nDòng 2'));
assert.ok(ics.replace(/\r\n /g,'').includes('SUMMARY:Sinh nhật\\, bà\\; nội'));
assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line) <= 75));
console.log('OK: event recurrence, due window, 29 February, and iCalendar alerts');
