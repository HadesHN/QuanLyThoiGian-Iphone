/** Non-browser smoke tests for task storage, safe modal interaction and migration. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8')
  .replace(/\bboot\(\);\s*\}\)\(\);\s*$/, 'globalThis.__test = { doForm, handleExtraForm, taskModal, closeModal, getDb:()=>db }; boot();\n})();');

function createApp({ native = true, legacy = '' } = {}) {
  const map = new Map();
  if (legacy) map.set('gotino.timeplanner.v1', legacy);
  let stored = '';
  let canSave = true;
  const listeners = new Map();
  const nodes = new Map();
  const getNode = (key) => {
    if (!nodes.has(key)) nodes.set(key, {
      innerHTML: '', textContent: '', value: '',
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      addEventListener() {}, querySelectorAll: () => [], appendChild(el) { this.lastToast = el.textContent; },
      focus() {},
      get open() { return this._open || false; }, set open(v) { this._open = v; },
    });
    return nodes.get(key);
  };
  const document = {
    querySelector: (selector) => selector === '#modal-root .input' ? null : getNode(selector),
    querySelectorAll: () => [],
    createElement: () => ({ textContent: '', style: {}, className: '', remove() {} }),
    body: getNode('body'),
    addEventListener: (name, handler) => listeners.set(name, handler),
  };
  const AndroidApp = native ? {
    loadData: () => stored,
    saveData: (json) => { if (!canSave) return false; stored = json; return true; },
  } : undefined;
  const context = {
    PlannerEvents: require('../site/events.js'),
    document, window: { AndroidApp, addEventListener() {}, scrollTo() {} },
    location: { hash: '#dashboard', protocol: 'file:' },
    localStorage: { getItem(k) { return map.get(k) || null; }, setItem(k,v) { map.set(k,v); } },
    confirm: () => true,
    setTimeout() {}, setInterval() {},
    FormData: class {
      constructor(form) { this.vals = form.vals; }
      entries() { return Object.entries(this.vals); }
      get(name) { return this.vals[name] ?? null; }
      getAll(name) { return this.vals[name] ?? []; }
    },
    console: { ...console, error: () => {} },
    navigator: {},
    Date,
    Math,
    crypto: { randomUUID: () => `test-${Math.random().toString(36).slice(2)}` }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.ok(context.__test, 'test exports are injected');
  return {
    api: context.__test, context, listeners, getNode,
    get stored() { return stored; },
    get legacy() { return map.get('gotino.timeplanner.v1'); },
    set canSave(v) { canSave = v; },
  };
}
const task = (title) => ({id:'', title, date:'2026-11-14', time:'09:00',minutes:'30',priority:'high', category:'Công việc',status:'todo',goalId:'',notes:''});
const form = (vals, formId='task-form') => ({id:formId, getAttribute:(attr)=>attr==='id'?formId:null, vals, querySelector:()=>({focus(){}})});

// Native persist: save, reload, update, rollback on failures.
const app = createApp();
app.api.taskModal();
assert.ok(app.getNode('#modal-root').innerHTML.includes('task-form'));
app.listeners.get('click')({target:{id:'modal-backdrop'}});
assert.ok(app.getNode('#modal-root').innerHTML.includes('task-form'), 'click outside preserves modal');
app.api.doForm(form(task('Việc mới của tôi')));
assert.equal(app.api.getDb().tasks.length,1);
assert.equal(app.api.getDb().tasks[0].title,'Việc mới của tôi');
assert.equal(JSON.parse(app.stored).tasks.length,1);
assert.equal(app.getNode('#modal-root').innerHTML,'', 'success closes modal');
const originalId = app.api.getDb().tasks[0].id;
app.api.doForm(form({...task('Việc đã chỉnh sửa'),id:originalId}));
assert.equal(app.api.getDb().tasks.length,1,'edit must not create a duplicate');
assert.equal(app.api.getDb().tasks[0].title,'Việc đã chỉnh sửa');
const appReload = createApp({legacy:app.stored});
assert.equal(appReload.api.getDb().tasks.length,1,'legacy data restored');
assert.equal(JSON.parse(appReload.stored).tasks.length,1,'migrate previous web data to native');
app.api.taskModal();
app.canSave=false;
app.api.doForm(form(task('Việc phải giữ trên form')));
assert.equal(app.api.getDb().tasks.length,1, 'failed save leaves DB unchanged');
assert.ok(app.getNode('#modal-root').innerHTML.includes('task-form'), 'failed save keeps form open');
assert.equal(JSON.parse(app.stored).tasks.length,1);

// Explicit close after an edited field must obtain confirmation.
app.listeners.get('input')({target:{closest:(selector) => selector==='#modal-root form' ? {} : null, dataset:{}}});
app.context.confirm=()=>false;
assert.equal(app.api.closeModal(),false);
assert.ok(app.getNode('#modal-root').innerHTML.includes('task-form'), 'cancelled confirmation retains draft');

// Browser storage fallback (GitHub Pages / local hosting).
const browserApp = createApp({native:false});
browserApp.api.taskModal();
browserApp.api.doForm(form(task('Việc trên web')));
assert.equal(JSON.parse(browserApp.legacy).tasks[0].title,'Việc trên web');
browserApp.api.taskModal();
browserApp.context.localStorage.setItem=()=>{throw new Error('Storage quota exceeded');};
browserApp.api.doForm(form(task('Việc chưa lưu vì bộ nhớ hết')));
assert.equal(browserApp.api.getDb().tasks.length,1,'failed browser storage must not update task list');
assert.ok(browserApp.getNode('#modal-root').innerHTML.includes('task-form'));
// Tình huống Safari: input[name=id] có thể che khuất form.id. Mã nguồn phải đọc getAttribute('id').
app.canSave=true;
const contact = {id:'',name:'Bạn Nguyễn',group:'Bạn bè',phone:'0909999999',relation:'Bạn cũ'};
app.api.handleExtraForm(form(contact,'contact-form'));
assert.equal(app.api.getDb().contacts.length,1, 'new contact must persist');
assert.equal(JSON.parse(app.stored).contacts[0].name,contact.name);
app.api.handleExtraForm(form({id:'',date:'2026-11-14',activity:'Thu nhập cá nhân',category:'Lương',income:'12000000',expense:'',notes:''},'transaction-form'));
assert.equal(app.api.getDb().transactions.length,1);
assert.equal(JSON.parse(app.stored).transactions[0].income,12000000);
const rawData = JSON.parse(app.stored);
assert.ok(Array.isArray(rawData.notes) && Array.isArray(rawData.contacts) && Array.isArray(rawData.transactions));
console.log('OK: task save form-id collision, add/edit, contact, finance, modal, rollback, old data migration.');

// Exercise the normal event handlers and reopen from a saved copy.
const planner = createApp({native:false,legacy:browserApp.legacy});
function clickEvent(action, dataset = {}) {
  planner.listeners.get('click')({target:{closest:selector=>selector==='[data-action]'?{dataset:{action,...dataset}}:null}});
}
function submitEvent(values) {
  planner.listeners.get('submit')({target:form(values,'event-form'),preventDefault(){}});
}
clickEvent('event-new');
assert.match(planner.getNode('#modal-root').innerHTML, /Lưu sự kiện/);
const date = '2099-01-31';
submitEvent({eventId:'',title:'Đăng kiểm xe',date,time:'09:00',category:'inspection',priority:'critical',repeat:'once',reminder:['30','7']});
assert.equal(planner.getNode('#modal-root').innerHTML,'');
const saved = JSON.parse(planner.legacy);
assert.equal(saved.events.length,1);
assert.equal(saved.tasks[0].title,'Việc trên web');
const id = saved.events[0].id;
assert.match(planner.getNode('#app').innerHTML,/Đăng kiểm xe/);
submitEvent({...saved.events[0],eventId:id,title:'Đăng kiểm xe gia đình',reminder:['30','7']});
assert.equal(planner.api.getDb().events[0].reminderSince,saved.events[0].reminderSince);
assert.equal(planner.api.getDb().events.length,1);
const reopened = createApp({native:false,legacy:planner.legacy});
assert.equal(reopened.api.getDb().events[0].title,'Đăng kiểm xe gia đình');
clickEvent('event-toggle',{id});
assert.equal(JSON.parse(planner.legacy).events[0].done,true);
clickEvent('event-delete',{id});
assert.deepEqual(JSON.parse(planner.legacy).events,[]);
planner.context.localStorage.setItem=()=>{throw new Error('Storage unavailable');};
clickEvent('event-new');
submitEvent({eventId:'',title:'Cần giữ bản nháp',date,time:'09:00',reminder:['0']});
assert.match(planner.getNode('#modal-root').innerHTML,/Lưu sự kiện/);
console.log('OK: event UI handlers, reload, edit, completion, deletion, legacy data and save failure');
