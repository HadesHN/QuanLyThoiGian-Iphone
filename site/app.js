/* Thời gian của tôi - một ứng dụng web không máy chủ, không phụ thuộc thư viện. */
(() => {
'use strict';
const eventsApi = globalThis.PlannerEvents;
const STORAGE='gotino.timeplanner.v1';
let modalDirty=false;
const weekday=['CN','T2','T3','T4','T5','T6','T7'];
const areas=[['health','Sức khỏe'],['mind','Tinh thần'],['learning','Trí tuệ'],['finance','Tài chính'],['relationships','Quan hệ'],['family','Gia đình']];
const priorityNames={urgent:'Khẩn cấp',high:'Quan trọng',medium:'Bình thường',low:'Có thể chờ'};
const pageNames={dashboard:'Tổng quan',today:'Công việc hôm nay',calendar:'Lịch tháng & tuần',events:'Sự kiện',goals:'Mục tiêu năm – quý',habits:'Thói quen thành đạt',vision:'Định hướng cuộc đời',contacts:'Làm chủ mối quan hệ',finance:'Quản trị tài chính',notes:'Ghi chú sáng tạo',journal:'Tổng kết ngày',statistics:'Thống kê hiệu quả',settings:'Cài đặt & dữ liệu'};
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
function localDate(d=new Date()){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function fromDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s||'')?new Date(Number(s.slice(0,4)),Number(s.slice(5,7))-1,Number(s.slice(8,10))):new Date();}
function shiftDate(s,offset){const d=fromDate(s);d.setDate(d.getDate()+offset);return localDate(d);}
function niceDate(s){if(!s)return 'Chưa đặt ngày';const d=fromDate(s);return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;}
function monthLabel(date){return `Tháng ${date.getMonth()+1}, ${date.getFullYear()}`;}
function formatWeek(s){return `${weekday[fromDate(s).getDay()]}, ${niceDate(s)}`;}
function startOfWeek(s){const d=fromDate(s);d.setDate(d.getDate()-((d.getDay()+6)%7));return localDate(d);}
function firstOfMonth(date){return new Date(date.getFullYear(),date.getMonth(),1);}
function lastDay(date){return new Date(date.getFullYear(),date.getMonth()+1,0).getDate();}
function uid(){return ((typeof crypto !== 'undefined' && crypto.randomUUID)?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`);}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function int(v,min=0,max=10000){return Math.max(min,Math.min(max,Number.parseInt(v,10)||0));}
function pct(done,total){return total?Math.round(100*done/total):0;}
function dateRange(end,days){return Array.from({length:days},(_,i)=>shiftDate(end,i-days+1));}
function fresh(){return {version:3,events:[],tasks:[],goals:[],habits:[],contacts:[],transactions:[],notes:[],checks:{},reviews:{},focus:[],vision:{mission:'',why:'',identity:'',actions:'',legacy:'',areas:Object.fromEntries(areas.map(([id])=>[id,5]))},settings:{name:'',focusMinutes:25,theme:'light',dayStart:'08:00',notifications:false}};}
function normalize(raw){const d=fresh();if(!raw||typeof raw!=='object')return d;
 for(const k of ['tasks','goals','habits','focus','contacts','transactions','notes'])if(Array.isArray(raw[k]))d[k]=raw[k].slice(0,5000).filter(x=>x&&typeof x==='object');
 for(const k of ['checks','reviews','vision','settings'])if(raw[k]&&typeof raw[k]==='object'&&!Array.isArray(raw[k]))d[k]={...d[k],...raw[k]};
 if(Array.isArray(raw.events))d.events=raw.events.map(eventsApi.cleanEvent).filter(Boolean);
 d.vision.areas={...fresh().vision.areas,...(raw.vision?.areas||{})};return d;
}
// Android: SharedPreferences là nguồn lưu chính; tự chuyển dữ liệu localStorage cũ sang khi nâng cấp.
function readStored(){
 let oldData='';
 try{oldData=localStorage.getItem(STORAGE)||'';}catch(e){/* localStorage có thể bị chặn trên một số WebView */}
 if(window.AndroidApp && typeof window.AndroidApp.loadData==='function'){
  try{
   const nativeData=window.AndroidApp.loadData();
   if(nativeData)return nativeData;
   if(oldData && typeof window.AndroidApp.saveData==='function')window.AndroidApp.saveData(oldData);
  }catch(e){/* vẫn sử dụng bản lưu web cũ */}
 }
 return oldData;
}
let db;try{db=normalize(JSON.parse(readStored()));}catch{db=fresh();}
const ui={page:pageNames[location.hash.slice(1)]?location.hash.slice(1):'dashboard',date:localDate(),month:firstOfMonth(new Date()),habitMonth:firstOfMonth(new Date()),calendarMode:'month',taskFilter:'all',taskSearch:'',goalYear:new Date().getFullYear(),financeMonth:firstOfMonth(new Date()),contactQuery:'',noteId:'',noteMode:'text',noteStrokesDraft:[],statDays:30,focusMinutes:int(db.settings.focusMinutes,1,180)||25,focusRemaining:(int(db.settings.focusMinutes,1,180)||25)*60,focusEnd:null,focusRunning:false,focusTask:'',installPrompt:null};
// Chỉ xác nhận thành công khi cơ chế lưu đã ghi được dữ liệu.
function persist(next){
 try{
  const json=JSON.stringify(next);
  if(window.AndroidApp && typeof window.AndroidApp.saveData==='function'){
   if(window.AndroidApp.saveData(json)!==true)throw new Error('Không ghi được vào bộ nhớ Android');
   // Bản sao thứ hai để tương thích khi chuyển từ APK sang web và APK cũ.
   try{localStorage.setItem(STORAGE,json);}catch(e){}
  }else{
   localStorage.setItem(STORAGE,json);
   if(localStorage.getItem(STORAGE)!==json)throw new Error('Không xác minh được bản ghi localStorage');
  }
  db=next;
  return true;
 }catch(e){
  console.error('Lưu dữ liệu thất bại:',e);
  toast('Chưa lưu được! Dữ liệu nhập vẫn được giữ lại. Hãy kiểm tra bộ nhớ ứng dụng hoặc sao lưu dữ liệu.',true);
  return false;
 }
}
function save(){return persist(db);}
function toast(message,error=false){const node=document.createElement('div');node.className='toast';node.textContent=message;node.style.background=error?'#a55252':'';$('#toast-root').appendChild(node);setTimeout(()=>node.remove(),3200);}
function setPage(pg){if(!pageNames[pg])return;if(ui.page==='notes' && pg!=='notes')noteSave(true);ui.page=pg;location.hash=pg;$('#group-personal').open=['habits','vision'].includes(pg);$('#group-tools').open=['contacts','finance','notes'].includes(pg);$('#group-reports').open=['journal','statistics'].includes(pg);closeSidebar();render();window.scrollTo({top:0,behavior:'auto'});}
function openSidebar(){$('#sidebar').classList.add('open');$('#scrim').classList.add('open');}
function closeSidebar(){$('#sidebar').classList.remove('open');$('#scrim').classList.remove('open');}
function headings(title,desc,extra=''){return `<div class="page-heading"><div><div class="eyebrow">LÀM CHỦ THỜI GIAN CỦA BẠN</div><h1>${title}</h1><p>${desc}</p></div>${extra?`<div class="page-actions">${extra}</div>`:''}</div>`;}
function cardTitle(title,subtitle='',action=''){return `<div class="card-head"><div><h3 class="card-title">${title}</h3>${subtitle?`<div class="card-subtitle">${subtitle}</div>`:''}</div>${action}</div>`;}
function emptyState(title='Chưa có dữ liệu',text='Hãy thêm mục đầu tiên để bắt đầu.',button=''){return `<div class="empty"><span class="big">✳</span><strong>${title}</strong>${text}${button?`<div>${button}</div>`:''}</div>`;}
function percentBar(val){return `<div class="progress"><span style="width:${int(val,0,100)}%"></span></div>`;}
function compareTasks(a,b){const po={urgent:0,high:1,medium:2,low:3};return (a.status==='done')-(b.status==='done') || (po[a.priority]??2)-(po[b.priority]??2) || String(a.date||'').localeCompare(String(b.date||'')) || String(a.time||'').localeCompare(String(b.time||''));}
function taskTag(t){return `<span class="pill ${esc(t.priority||'medium')}">${priorityNames[t.priority]||'Bình thường'}</span>`;}
function taskRow(t,edit=true){return `<div class="task-row"><input class="task-check" type="checkbox" aria-label="Hoàn thành ${esc(t.title)}" data-check-task="${esc(t.id)}" ${t.status==='done'?'checked':''}><div class="task-details"><div class="task-name ${t.status==='done'?'done':''}">${esc(t.title)}</div><div class="task-meta">${taskTag(t)} <span>◷ ${esc(t.time||'Cả ngày')}</span><span>▦ ${niceDate(t.date)}</span>${t.goalId?`<span>◎ Có mục tiêu</span>`:''}</div></div>${edit?`<div class="task-actions"><button aria-label="Sửa" title="Sửa" data-action="edit-task" data-id="${esc(t.id)}">✎</button><button aria-label="Xóa" title="Xóa" data-action="delete-task" data-id="${esc(t.id)}">×</button></div>`:''}</div>`;}
function tasksOn(day){return db.tasks.filter(t=>t.date===day);}
function mainStats(){const day=localDate();const due=db.tasks.filter(t=>t.date<=day),completed=due.filter(t=>t.status==='done');const today=tasksOn(day);const high=db.tasks.filter(t=>t.status!=='done'&&['high','urgent'].includes(t.priority)).length;
const habitDone=db.habits.filter(h=>db.checks[h.id]?.[day]).length;return {today,completedToday:today.filter(t=>t.status==='done').length,due:due.length,done:completed.length,high,habits:habitDone,totalHabits:db.habits.length};}
function dashboard(){
 const s=mainStats(),today=localDate(),name=db.settings.name?.trim();
 const priority=db.tasks.filter(t=>t.status!=='done' && t.date<=today).sort(compareTasks);
 const goals=[...db.goals].sort((a,b)=>Number(b.year)-Number(a.year)).slice(0,2);
 const doneRate=pct(s.completedToday,s.today.length);
 return `${headings(name?`Chào ${esc(name)}`:'Tổng quan hôm nay',`Hôm nay ${formatWeek(today)} · Chọn việc quan trọng và hoàn thành từng bước.`,`<button class="secondary-btn" data-page="journal">Tổng kết ngày ↗</button>`)}
 <div class="dashboard-focus"><div><div class="eyebrow">VIỆC ƯU TIÊN</div><strong>${priority.length?esc(priority[0].title):'Chưa có việc ưu tiên'}</strong><p>${priority.length?`${priorityNames[priority[0].priority]||'Bình thường'} · ${niceDate(priority[0].date)}`:'Bạn có thể tạo việc mới để bắt đầu.'}</p></div><button class="primary-btn" data-action="new-task">＋ Thêm việc</button></div>
 <div class="stats-grid compact-stats"><div class="stat-card"><span class="stat-label">Việc hôm nay</span><div class="stat-value">${s.today.length}</div></div><div class="stat-card"><span class="stat-label">Đã hoàn thành</span><div class="stat-value">${s.completedToday}</div></div><div class="stat-card"><span class="stat-label">Tiến độ hôm nay</span><div class="stat-value">${doneRate}%</div></div><div class="stat-card"><span class="stat-label">Cần ưu tiên</span><div class="stat-value">${s.high}</div></div></div>
 <div class="two-cols dashboard-cols"><section class="card">${cardTitle('Danh sách hôm nay',`${s.completedToday}/${s.today.length} việc đã hoàn thành`,`<button class="section-link" data-page="today">Xem tất cả ↗</button>`)}${s.today.length?s.today.sort(compareTasks).slice(0,7).map(t=>taskRow(t)).join(''):emptyState('Chưa có việc hôm nay','Tạo một việc mới để bắt đầu.',`<button class="secondary-btn" data-action="new-task">＋ Thêm công việc</button>`)}</section>
 <section class="card">${cardTitle('Mục tiêu đang theo dõi','Tối đa 2 mục tiêu gần đây',`<button class="section-link" data-page="goals">Mở mục tiêu ↗</button>`)}${goals.length?goals.map(g=>renderGoalCompact(g)).join(''):emptyState('Chưa có mục tiêu','Thêm mục tiêu năm hoặc quý.',`<button class="secondary-btn" data-action="new-goal">＋ Thêm mục tiêu</button>`)}<div class="dashboard-links"><button class="ghost-btn" data-page="calendar">▦ Xem lịch</button><button class="ghost-btn" data-page="statistics">▥ Thống kê</button></div></section></div>
 ${dashboardEvents()}`;
}
function renderGoalCompact(g){const progress=goalPercent(g);return `<div class="goal-card ${progress>=100?'achieved':''}"><div class="goal-head"><div class="goal-title">${esc(g.title)}</div><span class="goal-category">${esc(goalScope(g))}</span></div><div class="goal-extra">${esc(areaLabel(g.area))}${g.due?` · Hạn ${niceDate(g.due)}`:''}</div><div class="goal-row">${percentBar(progress)}<strong>${progress}%</strong></div></div>`;}
function areaLabel(s){return areas.find(a=>a[0]===s)?.[1]||'Phát triển cá nhân';}
function goalScope(g){return g.scope==='quarter'?`Quý ${g.quarter}/${g.year}`:g.scope==='month'?`Tháng ${g.month}/${g.year}`:`Năm ${g.year}`;}
function goalPercent(g){return int(Math.round(Number(g.current||0)*100/Math.max(1,Number(g.target||100))),0,100);}
function todayPage(){const day=ui.date,all=tasksOn(day).sort(compareTasks),isToday=day===localDate(),done=all.filter(t=>t.status==='done').length,open=all.filter(t=>t.status!=='done'),overdue=db.tasks.filter(t=>t.date<localDate()&&t.status!=='done').sort(compareTasks);
return `${headings('Kế hoạch & hành động',`Một ngày tập trung: ${formatWeek(day)}. Tối đa 5 việc quan trọng là một khởi đầu tốt.`,`<button class="primary-btn" data-action="new-task">＋ Thêm công việc</button>`)}
<div class="filter-bar"><button class="secondary-btn" data-action="day-prev">‹ Hôm trước</button><input type="date" id="selected-day" class="input" value="${day}" aria-label="Chọn ngày" style="max-width:168px"><button class="secondary-btn" data-action="day-next">Hôm sau ›</button><button class="ghost-btn" data-action="day-today">Về hôm nay</button></div>
<div class="stats-grid"><div class="stat-card"><span class="stat-label">Kế hoạch</span><div class="stat-value">${all.length}</div><div class="stat-desc">Việc dự kiến thực hiện</div></div><div class="stat-card"><span class="stat-label">Đã hoàn thành</span><div class="stat-value">${done}</div><div class="stat-desc">${pct(done,all.length)}% kế hoạch</div></div><div class="stat-card"><span class="stat-label">Chưa hoàn thành</span><div class="stat-value">${open.length}</div><div class="stat-desc">Cần tiếp tục thực hiện</div></div><div class="stat-card"><span class="stat-label">Thời lượng dự kiến</span><div class="stat-value">${all.reduce((a,t)=>a+int(t.minutes,0,1440),0)}<small style="font-size:13px"> phút</small></div><div class="stat-desc">Tổng thời gian dự kiến</div></div></div>
<div class="two-cols"><section class="card">${cardTitle('Danh sách công việc',`${done}/${all.length} nhiệm vụ đã hoàn thành`, `<span class="badge-count">${pct(done,all.length)}% đã xong</span>`)}${percentBar(pct(done,all.length))}<div class="filter-bar" style="margin-top:18px"><button class="chip ${ui.taskFilter==='all'?'active':''}" data-action="filter-task" data-value="all">Tất cả</button><button class="chip ${ui.taskFilter==='todo'?'active':''}" data-action="filter-task" data-value="todo">Chưa xong</button><button class="chip ${ui.taskFilter==='done'?'active':''}" data-action="filter-task" data-value="done">Đã xong</button></div><div class="task-list">${all.filter(t=>ui.taskFilter==='all'||t.status===(ui.taskFilter==='done'?'done':'todo')).map(t=>taskRow(t)).join('')||emptyState('Không có công việc trong nhóm này','Bạn có thể bổ sung hoặc chọn bộ lọc khác.')}</div></section>
<section><div class="card">${cardTitle('Phiên tập trung','Làm từng việc một · ghi nhận thời gian thực tế')}<div class="focus-preset"><button class="${ui.focusMinutes===15?'active':''}" data-action="timer-preset" data-min="15">15 phút</button><button class="${ui.focusMinutes===25?'active':''}" data-action="timer-preset" data-min="25">25 phút</button><button class="${ui.focusMinutes===50?'active':''}" data-action="timer-preset" data-min="50">50 phút</button></div><select class="input" id="focus-task"><option value="">Không gắn với công việc</option>${db.tasks.filter(t=>t.status!=='done').map(t=>`<option value="${esc(t.id)}" ${ui.focusTask===t.id?'selected':''}>${esc(t.title)}</option>`).join('')}</select><div class="focus-timer" id="focus-clock">${clockText(ui.focusRemaining)}</div><div class="focus-controls"><button class="primary-btn" data-action="timer-toggle">${ui.focusRunning?'❚❚ Tạm dừng':'▶ Bắt đầu'}</button><button class="secondary-btn" data-action="timer-reset">↺ Đặt lại</button></div><p class="small-note" style="text-align:center;margin-top:19px">Chỉ ghi nhận phiên khi bộ đếm kết thúc. Không có thông báo khi trang đã đóng.</p></div>
${overdue.length?`<div class="card right-panel">${cardTitle('Việc quá hạn',`${overdue.length} công việc chưa hoàn thành`)}${overdue.slice(0,4).map(t=>taskRow(t)).join('')}</div>`:''}</section></div>
${isToday?`<div class="banner"><strong>Gợi ý cuối ngày:</strong> Đánh giá hiệu suất, điểm nổi bật và bài học tại mục <button class="section-link" data-page="journal">Tổng kết ngày →</button>.</div>`:''}`;
}
function clockText(seconds){const s=Math.max(0,seconds);return `${pad(Math.floor(s/60))}:${pad(s%60)}`;}
function calendarPage(){const m=ui.month,mode=ui.calendarMode,start=startOfWeek(ui.date),monthDays=lastDay(m);let content='';
if(mode==='month'){
 const first=firstOfMonth(m),offset=(first.getDay()+6)%7;
 let cells=['T2','T3','T4','T5','T6','T7','CN'].map(x=>`<div class="calendar-weekday">${x}</div>`).join('');
 for(let i=0;i<42;i++){
  const dt=new Date(m.getFullYear(),m.getMonth(),1+i-offset),s=localDate(dt),today=s===localDate(),selected=s===ui.date,items=tasksOn(s).sort(compareTasks);
  const eventCount=db.events.filter(event=>eventsApi.occursOn(event,s)).length;
  cells+=`<div class="calendar-day ${dt.getMonth()!==m.getMonth()?'outside':''} ${today?'today':''} ${selected?'selected':''}" data-action="pick-calendar-day" data-day="${s}" role="button" tabindex="0" aria-label="Ngày ${niceDate(s)}"><span class="day-num">${dt.getDate()}</span>${eventCount?`<span class="event-count" title="${eventCount} sự kiện">◆ ${eventCount}</span>`:''}${items.slice(0,3).map(t=>`<div class="event-chip ${t.status==='done'?'done':t.date<localDate()?'overdue':''}" title="${esc(t.title)}">${t.time?esc(t.time)+' ':''}${esc(t.title)}</div>`).join('')}${items.length>3?`<span class="day-more">+${items.length-3} việc khác</span>`:''}</div>`;
 }
 content=`<div class="calendar-grid">${cells}</div>`;
}else{
 content=`<div class="weekday-row">${Array.from({length:7},(_,i)=>{const day=shiftDate(start,i),tasks=tasksOn(day).sort(compareTasks), events=db.events.filter(event=>eventsApi.occursOn(event,day));return `<div class="weekday-col ${day===localDate()?'active':''}"><h4>${['Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy','Chủ nhật'][i]}<br><small>${niceDate(day)}</small></h4>${tasks.length?tasks.map(t=>`<div class="event-chip ${t.status==='done'?'done':''}" data-action="edit-task" data-id="${esc(t.id)}">${esc(t.title)}</div>`).join(''):events.length?'':'<span class="small-note">Chưa có lịch</span>'}${events.map(event=>`<button class="event-chip event-calendar-link" data-action="event-edit" data-id="${esc(event.id)}">◆ ${esc(event.time)} ${esc(event.title)}</button>`).join('')}<button class="ghost-btn" style="margin-top:12px" data-action="new-task" data-day="${day}">＋</button></div>`;}).join('')}</div>`;
}
const selected=tasksOn(ui.date).sort(compareTasks);
const selectedEvents=db.events.filter(event=>eventsApi.occursOn(event,ui.date));
return `${headings('Lịch làm việc', 'Đưa mục tiêu từ kế hoạch tháng thành lịch hành động từng ngày.', `<button class="primary-btn" data-action="new-task">＋ Thêm lịch</button>`)}
<section class="card"> <div class="calendar-heading"><div><div class="eyebrow">KẾ HOẠCH HÀNH ĐỘNG</div><h2 class="month-title">${mode==='week'?`Tuần ${niceDate(start)} – ${niceDate(shiftDate(start,6))}`:monthLabel(m)}</h2></div><div class="month-actions"><div class="toggle-tabs"><button class="${mode==='month'?'active':''}" data-action="calendar-mode" data-mode="month">Tháng</button><button class="${mode==='week'?'active':''}" data-action="calendar-mode" data-mode="week">Tuần</button></div><button class="icon-button" data-action="calendar-prev" aria-label="Tháng hoặc tuần trước">‹</button><button class="icon-button" data-action="calendar-next" aria-label="Tháng hoặc tuần sau">›</button><button class="secondary-btn" data-action="calendar-now">Hôm nay</button></div></div>${content}</section>
<div class="calendar-below two-cols"><section class="card">${cardTitle(`Kế hoạch ngày ${niceDate(ui.date)}`,`${selected.length} công việc dự kiến`,`<button class="section-link" data-action="new-task" data-day="${ui.date}">＋ Thêm cho ngày này</button>`)}${selected.length?selected.map(t=>taskRow(t)).join(''):emptyState('Ngày này chưa có lịch','Chọn thêm công việc để xây dựng kế hoạch.')}</section>
<section class="card">${cardTitle('Sự kiện ngày '+niceDate(ui.date),'',`<button class="section-link" data-action="event-new" data-day="${ui.date}">＋ Thêm sự kiện</button>`)}
${selectedEvents.length?selectedEvents.map(event=>`<div class="summary-line"><span>${esc(event.time)} · ${esc(event.title)}</span><button class="section-link" data-action="event-edit" data-id="${esc(event.id)}">Sửa</button></div>`).join(''):'<p class="small-note">Chưa có sự kiện trong ngày.</p>'}</section></div>
<div class="calendar-below"><section class="card">${cardTitle('Cách lập kế hoạch theo sách','Từ mục tiêu dài hạn đến hành động hôm nay')}<div class="timeline"><b>Mục tiêu năm</b><span>→</span><b>Quý</b><span>→</span><b>Tháng</b><span>→</span><b>Tuần</b><span>→</span><b>Ngày</b></div><p class="small-note">Đầu tháng: xác định các việc quan trọng. Đầu tuần: phân bổ nhiệm vụ theo từng ngày. Mỗi sáng: lựa chọn việc ưu tiên và ấn định giờ thực hiện.</p><button class="secondary-btn" data-page="goals" style="margin-top:13px">◎ Quản lý mục tiêu</button></section></div>`;
}
function goalsPage(){const year=ui.goalYear,items=db.goals.filter(g=>Number(g.year)===year),group={year:items.filter(g=>g.scope==='year'),quarter:items.filter(g=>g.scope==='quarter'),month:items.filter(g=>g.scope==='month')};
return `${headings('Mục tiêu năm – quý', 'Chọn 3–5 điều quan trọng, chia thành quý, tháng và những việc làm được.',`<button class="primary-btn" data-action="new-goal">＋ Thêm mục tiêu</button>`)}
<div class="banner"><strong>Nguyên tắc sách:</strong> Nêu mục tiêu rõ ràng, có con số đo lường, thời hạn và cam kết hành động. Chia mục tiêu năm thành bốn chặng quý, tiếp tục cụ thể hóa theo tháng.</div>
<div class="filter-bar"><button class="secondary-btn" data-action="goal-year-prev">‹ Năm trước</button><span class="badge-count" style="font-size:13px">${year}</span><button class="secondary-btn" data-action="goal-year-next">Năm sau ›</button><span class="small-note">${items.length} mục tiêu · ${items.filter(g=>goalPercent(g)>=100).length} hoàn thành</span></div>
<div class="goal-groups">${[['year','◎ Mục tiêu năm'],['quarter','◷ Mục tiêu quý'],['month','▦ Mục tiêu tháng']].map(([scope,title])=>`<div class="goal-group"><div class="card-head"><h3 class="card-title">${title}</h3><button class="section-link" data-action="new-goal" data-scope="${scope}">＋ Thêm</button></div>${group[scope].length?group[scope].sort((a,b)=>(Number(a.quarter||0)-Number(b.quarter||0))||(Number(a.month||0)-Number(b.month||0))).map(g=>`<div class="goal-card ${goalPercent(g)>=100?'achieved':''}"><div class="goal-head"><div class="goal-title">${esc(g.title)}</div><div class="two-button"><button class="goal-link" title="Sửa" data-action="edit-goal" data-id="${esc(g.id)}">✎</button><button class="goal-link" title="Xóa" data-action="delete-goal" data-id="${esc(g.id)}">×</button></div></div><div class="goal-extra">${esc(goalScope(g))} · ${esc(areaLabel(g.area))}</div><div class="goal-row">${percentBar(goalPercent(g))}<strong>${goalPercent(g)}%</strong></div><div class="goal-extra" style="margin-bottom:0">Tiến độ: ${Number(g.current||0)} / ${Number(g.target||100)} ${esc(g.unit||'đơn vị')}</div>${g.notes?`<p class="small-note">${esc(g.notes)}</p>`:''}</div>`).join(''):emptyState('Chưa có mục tiêu','Hãy xác định đích đến trước khi bắt đầu.')}</div>`).join('')}</div>
<div class="card right-panel">${cardTitle('Sứ mệnh & sự cân bằng','Mục tiêu tốt cần phục vụ các giá trị sống của bạn',`<button class="section-link" data-page="vision">Chỉnh sửa định hướng ↗</button>`)}<p class="small-note">${db.vision.mission?esc(db.vision.mission):'Hãy viết điều quan trọng nhất bạn muốn theo đuổi ở mục Định hướng cuộc đời.'}</p></div>`;
}
function habitDoneCount(h,dates){return dates.filter(d=>db.checks[h.id]?.[d]).length;}
function habitsPage(){const m=ui.habitMonth,n=lastDay(m),monthStart=localDate(firstOfMonth(m)),end=localDate(new Date(m.getFullYear(),m.getMonth(),n)),now=localDate(),validDays=Array.from({length:n},(_,i)=>localDate(new Date(m.getFullYear(),m.getMonth(),i+1))).filter(d=>d<=now);const total=db.habits.length?db.habits.reduce((sum,h)=>sum+habitDoneCount(h,validDays.filter(d=>d>=(h.created||'0000-00-00'))),0):0,expected=db.habits.reduce((sum,h)=>sum+validDays.filter(d=>d>=(h.created||'0000-00-00')).length,0);
const table=`<div class="habit-table-wrap"><table class="habit-table"><thead><tr><th>Thói quen</th>${Array.from({length:n},(_,i)=>`<th>${i+1}</th>`).join('')}<th>Đạt</th></tr></thead><tbody>${db.habits.map(h=>{const eligible=validDays.filter(d=>d>=(h.created||'0000-00-00')),done=habitDoneCount(h,eligible);return `<tr><td><div class="habit-name">${esc(h.name)}</div><div class="habit-sub">${esc(h.category||'Thói quen tích cực')} · <button class="section-link" data-action="edit-habit" data-id="${esc(h.id)}">Sửa</button> · <button class="section-link" data-action="delete-habit" data-id="${esc(h.id)}">Xóa</button></div></td>${Array.from({length:n},(_,i)=>{const d=localDate(new Date(m.getFullYear(),m.getMonth(),i+1)),checked=!!db.checks[h.id]?.[d];return `<td><button class="habit-check ${checked?'checked':''} ${d===now?'today':''}" data-action="toggle-habit" data-id="${esc(h.id)}" data-day="${d}" aria-label="${esc(h.name)} ngày ${niceDate(d)}" ${d>now||d<(h.created||'0000-00-00')?'disabled':''}>${checked?'✓':''}</button></td>`;}).join('')}<td><strong>${pct(done,eligible.length)}%</strong></td></tr>`;}).join('')}</tbody></table></div>`;
return `${headings('Thói quen thành đạt', 'Kiên trì thực hiện mỗi ngày — không phải làm thật nhiều mà làm đều đặn.',`<button class="primary-btn" data-action="new-habit">＋ Thêm thói quen</button>`)}
<div class="stats-grid"><div class="stat-card"><span class="stat-label">Thói quen đang theo dõi</span><div class="stat-value">${db.habits.length}</div><span class="stat-desc">Chủ động xây dựng hằng ngày</span></div><div class="stat-card"><span class="stat-label">Số lần hoàn thành trong tháng</span><div class="stat-value">${total}</div><span class="stat-desc">Lượt đánh dấu thực hiện</span></div><div class="stat-card"><span class="stat-label">Tỷ lệ duy trì</span><div class="stat-value">${pct(total,expected)}%</div><span class="stat-desc">Trên các ngày đã qua</span></div><div class="stat-card"><span class="stat-label">Thành tích hôm nay</span><div class="stat-value">${db.habits.filter(h=>db.checks[h.id]?.[now]).length}</div><span class="stat-desc">Thói quen hoàn thành hôm nay</span></div></div>
<section class="card">${cardTitle('Bảng theo dõi 31 ngày','Nhấn ô của một ngày đã qua để đánh dấu đã thực hiện',`<div class="month-actions"><button class="icon-button" data-action="habit-month-prev">‹</button><strong style="font-size:12px">${monthLabel(m)}</strong><button class="icon-button" data-action="habit-month-next">›</button></div>`)}${db.habits.length?table:emptyState('Chưa có thói quen để theo dõi','Tạo một thói quen nhỏ và bắt đầu thực hiện đều đặn.',`<button class="secondary-btn" data-action="new-habit">＋ Thêm thói quen</button>`)}</section>
<div class="two-cols right-panel"><section class="card">${cardTitle('Gợi ý thói quen từ sách','Các ví dụ trong phần “Thói quen thành đạt”')}<div class="data-list">${['Lập kế hoạch và tổng kết ngày','Đọc sách hoặc học một kỹ năng','Vận động và chăm sóc sức khỏe','Dành thời gian cho gia đình','Chia sẻ điều có ích cho người khác'].map((name,i)=>`<div class="summary-line"><span>${i+1}. ${name}</span><button class="section-link" data-action="quick-habit" data-name="${esc(name)}">＋</button></div>`).join('')}</div></section>
<section class="card">${cardTitle('Phương pháp “Đúng – Đủ – Đều”','Phát triển bền vững nhờ tính nhất quán')}<div class="timeline-item"><strong>Đúng</strong><p>Chọn thói quen phục vụ mục tiêu và giá trị quan trọng.</p></div><div class="timeline-item"><strong>Đủ</strong><p>Đặt mức thực hiện vừa sức, có thể kiểm chứng.</p></div><div class="timeline-item"><strong>Đều</strong><p>Đánh dấu mỗi ngày để nhìn thấy sự tiến bộ.</p></div></section></div>`;
}
function visionPage(){const v=db.vision;return `${headings('Định hướng cuộc đời','Phác họa con người bạn muốn trở thành và những giá trị bạn muốn tạo ra.')}
<div class="banner"><strong>Theo phần “Quyết định tương lai” của sách:</strong> Xây dựng sự cân bằng giữa sức khỏe, tinh thần, trí tuệ, tài chính, quan hệ và gia đình; liên kết mục tiêu với những giá trị đó.</div>
<form id="vision-form"><div class="two-cols"><section class="card">${cardTitle('Tầm nhìn & sứ mệnh','Viết lại mục đích và hình ảnh con người bạn hướng tới')}<div class="field" style="margin-bottom:15px"><label for="vision-mission">Sứ mệnh / Tôi muốn sống như thế nào?</label><textarea class="input" id="vision-mission" name="mission" rows="4" placeholder="Tôi muốn sống một cuộc đời...">${esc(v.mission)}</textarea></div><div class="field"><label for="vision-identity">Tôi quyết định trở thành người như thế nào?</label><textarea class="input" id="vision-identity" name="identity" rows="4" placeholder="Trong công việc, gia đình, cộng đồng...">${esc(v.identity)}</textarea></div></section>
<section class="card">${cardTitle('5 câu hỏi định hướng','Chuyển suy nghĩ thành mục đích và việc làm cụ thể')}<div class="field" style="margin-bottom:12px"><label for="vision-why">Tại sao cuộc sống của tôi có ý nghĩa?</label><textarea class="input" id="vision-why" name="why" rows="2">${esc(v.why)}</textarea></div><div class="field" style="margin-bottom:12px"><label for="vision-actions">Tôi cần làm những công việc gì để đạt điều mình muốn?</label><textarea class="input" id="vision-actions" name="actions" rows="2">${esc(v.actions)}</textarea></div><div class="field"><label for="vision-legacy">Tôi muốn để lại những giá trị tốt đẹp gì?</label><textarea class="input" id="vision-legacy" name="legacy" rows="2">${esc(v.legacy)}</textarea></div></section></div>
<section class="card">${cardTitle('Bánh xe cân bằng cuộc sống','Tự chấm từng lĩnh vực từ 1 (cần cải thiện) đến 10 (rất tốt)')}<div class="wheel-grid">${areas.map(([id,label])=>`<div class="wheel-item"><label for="area-${id}">${label}</label><input type="range" min="1" max="10" step="1" value="${int(v.areas[id],1,10)}" name="area_${id}" id="area-${id}" data-range-output="out-${id}"><output id="out-${id}">${int(v.areas[id],1,10)}/10</output></div>`).join('')}</div><div class="small-note" style="margin-top:15px">Điểm số là đánh giá chủ quan của bạn, không phải phép đo khoa học.</div><div class="form-actions"><button class="primary-btn" type="submit">✓ Lưu định hướng</button></div></section></form>`;}
function journalPage(){const day=ui.date,v=db.reviews[day]||{best:'',lesson:'',impression:'',mood:3,performance:3,bestHour:'',gratitude:''},all=tasksOn(day),done=all.filter(t=>t.status==='done').length;
return `${headings('Tổng kết cuối ngày','Tích lũy kinh nghiệm sau mỗi ngày làm việc.',`<button class="secondary-btn" data-action="review-today">Về hôm nay</button>`)}
<div class="filter-bar"><button class="secondary-btn" data-action="day-prev">‹</button><input type="date" id="selected-day" class="input" style="max-width:190px" value="${day}"><button class="secondary-btn" data-action="day-next">›</button></div>
<div class="two-cols"><section class="card">${cardTitle(`Kết quả ngày ${niceDate(day)}`,'Điều đã thực hiện được, dù chỉ là một tiến bộ nhỏ')}<div class="kpi-panel"><div class="donut" style="--percent:${pct(done,all.length)}%"><span>${pct(done,all.length)}%</span></div><div class="kpi-text"><strong>${done}/${all.length}</strong><small>công việc hoàn thành</small><div style="margin-top:13px">${percentBar(pct(done,all.length))}</div></div></div><div class="divider"></div><div class="task-list">${all.length?all.sort(compareTasks).map(t=>taskRow(t,false)).join(''):emptyState('Chưa có công việc trong ngày','Bạn có thể bổ sung trong phần Công việc hôm nay.')}</div></section>
<section class="card">${cardTitle('Ghi nhận và rút kinh nghiệm','Nhìn lại kết quả để cải thiện ngày hôm sau')}<form id="review-form"><input type="hidden" name="date" value="${day}"><div class="field" style="margin-bottom:14px"><label>Việc nào tôi làm tốt nhất? Vì sao?</label><textarea class="input" name="best" rows="3" placeholder="Điều khiến bạn tự hào hôm nay...">${esc(v.best)}</textarea></div><div class="field" style="margin-bottom:14px"><label>Bài học quan trọng nhất trong ngày?</label><textarea class="input" name="lesson" rows="3" placeholder="Điều sẽ làm tốt hơn vào ngày mai...">${esc(v.lesson)}</textarea></div><div class="field" style="margin-bottom:14px"><label>Ấn tượng / điều đáng nhớ / lời cảm ơn</label><textarea class="input" name="impression" rows="2">${esc(v.impression)}</textarea></div><div class="form-actions"><button class="primary-btn" type="submit">✓ Lưu tổng kết</button></div></form></section></div>
<section class="card"><form id="review-ratings"><input type="hidden" name="date" value="${day}">${cardTitle('Tự đánh giá hiệu quả & tinh thần','Chọn thang 1–5 và giờ làm việc tập trung nhất')}<div class="three-cols"><div><label class="rating-label">Hiệu quả làm việc</label><div class="rate-stars" data-stars="performance">${[1,2,3,4,5].map(n=>`<button type="button" class="${n<=int(v.performance,1,5)?'active':''}" data-action="review-rating" data-field="performance" data-value="${n}">★</button>`).join('')}</div></div><div><label class="rating-label">Mức độ yêu thích công việc</label><div class="rate-stars" data-stars="mood">${[1,2,3,4,5].map(n=>`<button type="button" class="${n<=int(v.mood,1,5)?'active':''}" data-action="review-rating" data-field="mood" data-value="${n}">♥</button>`).join('')}</div></div><div class="field"><label for="best-hour">Thời gian tập trung tốt nhất</label><select class="input" name="bestHour" id="best-hour"><option value="">Chưa đánh giá</option>${['05:00–08:00','08:00–11:00','11:00–14:00','14:00–17:00','17:00–20:00','20:00–23:00'].map(x=>`<option ${v.bestHour===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="form-actions"><button class="primary-btn" type="submit">✓ Lưu đánh giá</button></div></form></section>`;
}
function statsPage(){const days=ui.statDays,end=localDate(),dates=dateRange(end,days),start=dates[0],tasks=db.tasks.filter(t=>t.date>=start&&t.date<=end),done=tasks.filter(t=>t.status==='done'),missed=tasks.filter(t=>t.status!=='done'&&t.date<end),focus=db.focus.filter(f=>f.date>=start&&f.date<=end),minutes=focus.reduce((s,x)=>s+int(x.minutes,0,1440),0),habits=db.habits,expected=habits.reduce((s,h)=>s+dates.filter(d=>d>=h.created).length,0),habitHits=habits.reduce((s,h)=>s+dates.filter(d=>d>=h.created&&db.checks[h.id]?.[d]).length,0);
const sample=days===7?dates:dates.filter((_,i)=>i%Math.max(1,Math.floor(days/10))===0||i===dates.length-1),bars=sample.map(d=>{const t=tasksOn(d),n=t.filter(x=>x.status==='done').length;return `<div class="chart-col"><div class="chart-bars"><div class="chart-bar" style="height:${Math.max(4,Math.min(100,n*20))}%" title="${n} đã xong"></div></div><label>${pad(fromDate(d).getDate())}/${pad(fromDate(d).getMonth()+1)}</label></div>`;}).join('');
const byPriority=['urgent','high','medium','low'].map(k=>{const ts=tasks.filter(t=>t.priority===k);return `<tr><td>${priorityNames[k]}</td><td>${ts.length}</td><td>${ts.filter(t=>t.status==='done').length}</td><td class="metric">${pct(ts.filter(t=>t.status==='done').length,ts.length)}%</td></tr>`;}).join('');
return `${headings('Thống kê & cải tiến','Theo dõi năng suất thực tế và phát hiện những thói quen có ích.',`<div class="toggle-tabs"><button class="${days===7?'active':''}" data-action="stat-range" data-days="7">7 ngày</button><button class="${days===30?'active':''}" data-action="stat-range" data-days="30">30 ngày</button><button class="${days===90?'active':''}" data-action="stat-range" data-days="90">90 ngày</button></div>`)}
<div class="stats-grid"><div class="stat-card"><span class="stat-label">Tổng công việc</span><div class="stat-value">${tasks.length}</div><div class="stat-desc">Trong ${days} ngày qua</div></div><div class="stat-card"><span class="stat-label">Đã hoàn thành</span><div class="stat-value">${done.length}</div><div class="stat-desc">${pct(done.length,tasks.length)}% kế hoạch</div></div><div class="stat-card"><span class="stat-label">Việc quá hạn</span><div class="stat-value">${missed.length}</div><div class="stat-desc">Chưa hoàn thành trước hôm nay</div></div><div class="stat-card"><span class="stat-label">Thời gian tập trung</span><div class="stat-value">${Math.floor(minutes/60)}<small style="font-size:13px">g ${minutes%60}p</small></div><div class="stat-desc">${focus.length} phiên đã kết thúc</div></div></div>
<div class="two-cols"><section class="card">${cardTitle('Nhịp độ hoàn thành công việc','Số lượng công việc hoàn thành theo ngày')}<div class="mini-chart" style="height:205px">${bars}</div></section>
<section class="card">${cardTitle('Tỷ lệ hoàn thành',`Trên ${tasks.length} công việc trong giai đoạn`)}<div class="kpi-panel"><div class="donut" style="--percent:${pct(done.length,tasks.length)}%"><span>${pct(done.length,tasks.length)}%</span></div><div class="kpi-text"><strong>${done.length}</strong><small>đã thực hiện</small><hr class="divider"><strong>${tasks.length-done.length}</strong><small>chưa hoàn thành</small></div></div><div class="divider"></div><div class="summary-line"><span>Duy trì thói quen</span><strong>${pct(habitHits,expected)}%</strong></div><div class="summary-line"><span>Phiên tập trung đã xong</span><strong>${focus.length}</strong></div></section></div>
<div class="two-cols"><section class="card">${cardTitle('Hiệu quả theo mức ưu tiên','Xác định nhóm việc đang bị trì hoãn')}<table class="metrics-table"><thead><tr><th>Ưu tiên</th><th>Được giao</th><th>Đã xong</th><th>Tỷ lệ</th></tr></thead><tbody>${byPriority}</tbody></table></section>
<section class="card">${cardTitle('Tổng kết theo ngày','Điểm tự đánh giá dựa trên nhật ký cá nhân')}<div class="data-list">${Object.entries(db.reviews).filter(([d])=>d>=start&&d<=end).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,7).map(([d,r])=>`<div class="summary-line"><span>${niceDate(d)}</span><strong>★ ${int(r.performance,1,5)}/5 · ♥ ${int(r.mood,1,5)}/5</strong></div>`).join('')||emptyState('Chưa có nhật ký trong giai đoạn','Viết tổng kết để nhận ra tiến bộ.')}</div></section></div>`;
}
function settingsPage(){const s=db.settings;return `${headings('Cài đặt & dữ liệu','Điều chỉnh cách làm việc, bảo toàn dữ liệu và cài đặt như một ứng dụng.')}
<div class="two-cols"><section class="card">${cardTitle('Tùy chỉnh trải nghiệm','Các thiết lập áp dụng cho thiết bị này')}<form id="settings-form"><div class="field" style="margin-bottom:16px"><label for="user-name">Tên hiển thị</label><input class="input" name="name" id="user-name" value="${esc(s.name)}" placeholder="Ví dụ: Hoàng"></div><div class="field" style="margin-bottom:16px"><label>Giờ bắt đầu ngày làm việc</label><input class="input" type="time" name="dayStart" value="${esc(s.dayStart||'08:00')}"></div><div class="field" style="margin-bottom:16px"><label>Thời lượng tập trung mặc định (phút)</label><input class="input" type="number" name="focusMinutes" min="1" max="180" value="${int(s.focusMinutes,1,180)}"></div><div class="field" style="margin-bottom:16px"><label>Giao diện</label><select class="input" name="theme"><option value="light" ${s.theme!=='dark'?'selected':''}>Sáng</option><option value="dark" ${s.theme==='dark'?'selected':''}>Tối</option></select></div><div class="form-actions"><button class="primary-btn" type="submit">✓ Lưu cài đặt</button></div></form></section>
<section class="card">${cardTitle('Sao lưu & khôi phục','Không bị phụ thuộc tài khoản hay máy chủ')}<div class="data-list"><div class="data-item"><span>↓</span><div><strong>Tải bản sao lưu JSON</strong><small>Toàn bộ mục tiêu, công việc, nhật ký, thói quen</small></div><div class="backup-actions"><button class="secondary-btn" data-action="backup">Tải JSON</button><button class="secondary-btn" data-action="share-backup">Chia sẻ</button></div></div><div class="data-item"><span>↑</span><div><strong>Nhập bản sao lưu JSON</strong><small>Thay thế dữ liệu trên thiết bị hiện tại</small></div><button class="secondary-btn" data-action="restore">Nhập</button></div><div class="data-item"><span>▤</span><div><strong>Xuất danh sách công việc CSV</strong><small>Mở bằng Excel</small></div><button class="secondary-btn" data-action="csv">Xuất</button></div><div class="data-item"><span>✷</span><div><strong>Dữ liệu mẫu dùng thử</strong><small>Tạo việc, mục tiêu, thói quen ví dụ</small></div><button class="secondary-btn" data-action="demo">Thử</button></div></div><input type="file" id="restore-file" accept="application/json,.json" class="hidden"><div class="privacy" style="margin-top:18px"><strong>Lưu ý bảo mật:</strong> Ứng dụng hiện lưu dữ liệu vào bộ nhớ trình duyệt (localStorage), không mã hóa và không có đăng nhập/đồng bộ. Tránh nhập bí mật nhà nước, dữ liệu liên hệ/tài chính nhạy cảm hoặc mật khẩu. Việc xóa dữ liệu trình duyệt có thể làm mất sổ tay nếu chưa sao lưu.</div></section></div>
<div class="two-cols"><section class="card">${cardTitle('Ứng dụng trên điện thoại','Sử dụng ngoại tuyến sau khi mở thành công qua HTTPS')}<p class="small-note">Trên iPhone: Safari → Chia sẻ → Thêm vào Màn hình chính. Trên Android/Chrome: Cài đặt ứng dụng hoặc Thêm vào màn hình chính.</p><button class="secondary-btn" data-action="install">⊕ Cài ứng dụng (nếu được hỗ trợ)</button><p class="small-note" style="margin-top:10px">Dữ liệu chỉ nằm trong trình duyệt đang dùng; cài app ở trình duyệt khác sẽ không tự mang dữ liệu sang.</p></section>
<section class="card">${cardTitle('Xóa dữ liệu','Thao tác không thể hoàn tác nếu chưa sao lưu')}<p class="small-note">Xóa tất cả dữ liệu công việc, mối quan hệ, thu–chi, ghi chú, nhật ký và các thiết lập.</p><button class="danger-btn" data-action="reset-data">Xóa toàn bộ dữ liệu</button></section></div>`;}
function field(label,body,full=false){return `<div class="field ${full?'full':''}"><label>${label}</label>${body}</div>`;}
function options(values,selected){return values.map(([key,label])=>`<option value="${esc(key)}" ${String(key)===String(selected)?'selected':''}>${esc(label)}</option>`).join('');}
function modal(title,body){modalDirty=false;$('#modal-root').innerHTML=`<div class="modal-backdrop" id="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-top"><h2>${esc(title)}</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Đóng">×</button></div><div class="modal-body">${body}</div></div></div>`;setTimeout(()=>$('#modal-root .input')?.focus(),50);}
function closeModal(force=false){
 if(!force && modalDirty && !confirm('Nội dung đang nhập chưa được lưu. Bạn muốn đóng và bỏ thay đổi?'))return false;
 $('#modal-root').innerHTML='';modalDirty=false;return true;
}
function taskModal(id='',day=''){const t=db.tasks.find(x=>x.id===id)||{title:'',date:day||(['today','calendar'].includes(ui.page)?ui.date:localDate()),time:'',minutes:30,priority:'medium',category:'Công việc',status:'todo',goalId:'',notes:''};
modal(id?'Chỉnh sửa công việc':'Thêm công việc mới',`<form id="task-form" novalidate><input type="hidden" name="id" value="${esc(id)}"><div class="field-grid">
${field('Tên công việc *',`<input class="input" name="title" required maxlength="200" value="${esc(t.title)}" placeholder="Ví dụ: Hoàn thành báo cáo tuần" autofocus>`,true)}
${field('Ngày thực hiện',`<input type="date" name="date" required class="input" value="${esc(t.date)}">`)}
${field('Giờ bắt đầu',`<input type="time" name="time" class="input" value="${esc(t.time)}">`)}
${field('Thời gian dự kiến (phút)',`<input type="number" min="0" max="1440" name="minutes" class="input" value="${int(t.minutes,0,1440)}">`)}
${field('Mức độ ưu tiên',`<select class="input" name="priority">${options(Object.entries(priorityNames),t.priority)}</select>`)}
${field('Nhóm việc',`<select class="input" name="category">${options([['Công việc','Công việc'],['Cá nhân','Cá nhân'],['Gia đình','Gia đình'],['Học tập','Học tập'],['Sức khỏe','Sức khỏe'],['Khác','Khác']],t.category)}</select>`)}
${field('Trạng thái',`<select class="input" name="status">${options([['todo','Chưa hoàn thành'],['done','Đã hoàn thành']],t.status)}</select>`)}
${field('Gắn với mục tiêu',`<select class="input" name="goalId"><option value="">Không gắn mục tiêu</option>${db.goals.map(g=>`<option value="${esc(g.id)}" ${t.goalId===g.id?'selected':''}>${esc(g.title)}</option>`).join('')}</select>`)}
${field('Ghi chú / kết quả mong đợi',`<textarea class="input" rows="3" name="notes" maxlength="2000">${esc(t.notes||'')}</textarea>`,true)}</div><div class="form-actions"><button type="button" class="secondary-btn" data-action="close-modal">Hủy</button><button class="primary-btn" type="button" data-action="save-task">✓ Lưu công việc</button></div></form>`);}
function goalModal(id='',scope='year'){const now=new Date(),g=db.goals.find(x=>x.id===id)||{title:'',scope,year:ui.goalYear,quarter:Math.floor(now.getMonth()/3)+1,month:now.getMonth()+1,area:'learning',target:100,current:0,unit:'%',due:'',notes:''};
modal(id?'Chỉnh sửa mục tiêu':'Đặt mục tiêu mới',`<form id="goal-form"><input type="hidden" name="id" value="${esc(id)}"><div class="field-grid">
${field('Mục tiêu cụ thể *',`<input class="input" name="title" required maxlength="200" value="${esc(g.title)}" placeholder="Ví dụ: Hoàn thành chứng chỉ bảo mật" >`,true)}
${field('Cấp mục tiêu',`<select class="input" name="scope">${options([['year','Năm'],['quarter','Quý'],['month','Tháng']],g.scope)}</select>`)}
${field('Năm',`<input class="input" name="year" type="number" min="2000" max="2100" value="${int(g.year,2000,2100)}" required>`)}
${field('Quý (nếu có)',`<select class="input" name="quarter">${options([[1,'Quý 1'],[2,'Quý 2'],[3,'Quý 3'],[4,'Quý 4']],g.quarter)}</select>`)}
${field('Tháng (nếu có)',`<select class="input" name="month">${options(Array.from({length:12},(_,i)=>[i+1,`Tháng ${i+1}`]),g.month)}</select>`)}
${field('Lĩnh vực',`<select class="input" name="area">${options(areas,g.area)}</select>`)}
${field('Giá trị đích cần đạt *',`<input class="input" name="target" type="number" min="1" max="1000000000" step="any" value="${Number(g.target||100)}" required>`)}
${field('Đã thực hiện',`<input class="input" name="current" type="number" min="0" max="1000000000" step="any" value="${Number(g.current||0)}">`)}
${field('Đơn vị (VD: bài học, giờ, %)',`<input class="input" name="unit" maxlength="30" value="${esc(g.unit||'')}">`)}
${field('Hạn hoàn thành',`<input class="input" name="due" type="date" value="${esc(g.due||'')}">`)}
${field('Lý do / cam kết / bước hành động',`<textarea class="input" name="notes" rows="3" maxlength="2000">${esc(g.notes||'')}</textarea>`,true)}</div><div class="form-actions"><button class="secondary-btn" type="button" data-action="close-modal">Hủy</button><button type="submit" class="primary-btn">✓ Lưu mục tiêu</button></div></form>`);}
function habitModal(id='',suggested=''){const h=db.habits.find(x=>x.id===id)||{name:suggested,category:'Phát triển bản thân',created:localDate(),detail:''};
modal(id?'Chỉnh sửa thói quen':'Thêm thói quen thành đạt',`<form id="habit-form"><input type="hidden" name="id" value="${esc(id)}"><div class="field-grid">
${field('Tên thói quen *',`<input class="input" name="name" maxlength="150" required value="${esc(h.name)}" placeholder="Ví dụ: Đọc sách 20 phút mỗi ngày">`,true)}
${field('Lĩnh vực',`<select class="input" name="category">${options([['Phát triển bản thân','Phát triển bản thân'],['Công việc','Công việc'],['Sức khỏe','Sức khỏe'],['Gia đình','Gia đình'],['Tài chính','Tài chính'],['Học tập','Học tập']],h.category)}</select>`)}
${field('Ngày bắt đầu',`<input type="date" class="input" name="created" value="${esc(h.created)}" required>`)}
${field('Tiêu chuẩn hoàn thành (tùy chọn)',`<textarea class="input" name="detail" rows="3" maxlength="500" placeholder="Ví dụ: Hoàn thành ít nhất 20 phút">${esc(h.detail||'')}</textarea>`,true)}</div><div class="form-actions"><button class="secondary-btn" type="button" data-action="close-modal">Hủy</button><button class="primary-btn" type="submit">✓ Lưu thói quen</button></div></form>`);}
function doForm(form){const vals=Object.fromEntries(new FormData(form).entries());
if(form.getAttribute('id')==='task-form'){
 const title=(vals.title||'').trim();if(!title){toast('Vui lòng nhập tên công việc.',true);form.querySelector('[name=title]')?.focus();return;}
 const old=db.tasks.find(t=>t.id===vals.id);const v={id:old?.id||uid(),title:title.slice(0,200),date:vals.date||localDate(),time:vals.time||'',minutes:int(vals.minutes,0,1440),priority:Object.keys(priorityNames).includes(vals.priority)?vals.priority:'medium',category:vals.category||'Công việc',status:vals.status==='done'?'done':'todo',goalId:vals.goalId||'',notes:(vals.notes||'').slice(0,2000),created:old?.created||new Date().toISOString(),completedAt:vals.status==='done'?(old?.completedAt||new Date().toISOString()):''};
 const tasks=old?db.tasks.map(t=>t.id===old.id?v:t):[...db.tasks,v];
 if(!persist({...db,tasks}))return; // Không đóng form hoặc báo đã lưu nếu ghi thất bại.
 closeModal(true);render();toast(old?'Đã cập nhật và lưu công việc.':'Đã thêm và lưu công việc.');
}else if(form.getAttribute('id')==='goal-form'){
 const title=(vals.title||'').trim(),target=Number(vals.target);if(!title||!Number.isFinite(target)||target<=0){toast('Vui lòng nhập tên mục tiêu và giá trị đích hợp lệ.',true);return;}
 const old=db.goals.find(g=>g.id===vals.id),v={id:old?.id||uid(),title:title.slice(0,200),scope:['year','quarter','month'].includes(vals.scope)?vals.scope:'year',year:int(vals.year,2000,2100),quarter:int(vals.quarter,1,4),month:int(vals.month,1,12),area:vals.area,target:Math.min(1e9,target),current:Math.min(1e9,Math.max(0,Number(vals.current)||0)),unit:(vals.unit||'').slice(0,30),due:vals.due||'',notes:(vals.notes||'').slice(0,2000)};
 if(old)Object.assign(old,v);else db.goals.push(v);ui.goalYear=v.year;save();closeModal(true);render();toast('Đã lưu mục tiêu.');
}else if(form.getAttribute('id')==='habit-form'){
 const name=(vals.name||'').trim();if(!name)return;
 const old=db.habits.find(h=>h.id===vals.id),v={id:old?.id||uid(),name:name.slice(0,150),category:vals.category||'Phát triển bản thân',created:vals.created||localDate(),detail:(vals.detail||'').slice(0,500)};
 if(old)Object.assign(old,v);else db.habits.push(v);save();closeModal(true);render();toast('Đã lưu thói quen.');
}else if(form.getAttribute('id')==='vision-form'){
 for(const k of ['mission','why','identity','actions','legacy'])db.vision[k]=(vals[k]||'').slice(0,5000);
 for(const [id] of areas)db.vision.areas[id]=int(vals['area_'+id],1,10);save();toast('Đã lưu định hướng cuộc đời.');
}else if(form.getAttribute('id')==='review-form'){
 const d=vals.date,old=db.reviews[d]||{};db.reviews[d]={...old,best:(vals.best||'').slice(0,5000),lesson:(vals.lesson||'').slice(0,5000),impression:(vals.impression||'').slice(0,5000),updatedAt:new Date().toISOString()};save();toast('Đã lưu tổng kết ngày.');
}else if(form.getAttribute('id')==='review-ratings'){
 const d=vals.date,old=db.reviews[d]||{};db.reviews[d]={...old,bestHour:vals.bestHour||'',mood:int(old.mood||3,1,5),performance:int(old.performance||3,1,5),updatedAt:new Date().toISOString()};save();toast('Đã lưu đánh giá.');
}else if(form.getAttribute('id')==='settings-form'){
 db.settings.name=(vals.name||'').slice(0,70);db.settings.dayStart=vals.dayStart||'08:00';db.settings.theme=vals.theme==='dark'?'dark':'light';db.settings.focusMinutes=int(vals.focusMinutes,1,180);ui.focusMinutes=db.settings.focusMinutes;if(!ui.focusRunning)ui.focusRemaining=ui.focusMinutes*60;save();render();toast('Đã lưu cài đặt.');
}}
function download(text,filename,type){if(window.AndroidApp && typeof window.AndroidApp.saveTextFile==='function'){window.AndroidApp.saveTextFile(text,filename,type);return;}const blob=new Blob([text],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
function backupFile(){return {text:JSON.stringify({exportedAt:new Date().toISOString(),app:'thoi-gian-gotino',data:db},null,2),name:`sao-luu-thoi-gian-${localDate()}.json`};}
function shareBackup(){
 const {text,name}=backupFile();
 try{
  if(typeof navigator.share==='function' && typeof navigator.canShare==='function' && typeof File==='function'){
   const file=new File([text],name,{type:'application/json'});
   if(navigator.canShare({files:[file]})){
    navigator.share({files:[file],title:'Sao lưu Thời Gian Của Tôi'}).catch(err=>{
     if(err?.name!=='AbortError'){download(text,name,'application/json');toast('Đã chuyển sang tải JSON.');}
    });
    return;
   }
  }
 }catch(err){console.warn('Không mở được chia sẻ:',err);}
 download(text,name,'application/json');toast('Thiết bị không hỗ trợ chia sẻ tệp; đã tải JSON.');
}
function csvSafe(s){let value=String(s??'');if(/^[\s]*[=+@\-]/.test(value))value="'"+value;return `"${value.replace(/"/g,'""')}"`;}
function exportCsv(){const rows=[['ID','Công việc','Ngày','Giờ','Thời lượng (phút)','Ưu tiên','Trạng thái','Nhóm','Ghi chú'],...db.tasks.map(t=>[t.id,t.title,t.date,t.time,t.minutes,priorityNames[t.priority],t.status==='done'?'Hoàn thành':'Chưa hoàn thành',t.category,t.notes])];const csv='\ufeff'+rows.map(row=>row.map(csvSafe).join(',')).join('\r\n');download(csv,`cong-viec-${localDate()}.csv`,'text/csv;charset=utf-8');toast('Đã xuất danh sách CSV.');}
function insertDemo(){if(db.tasks.length||db.goals.length||db.habits.length){if(!confirm('Dữ liệu minh họa sẽ được thêm vào dữ liệu hiện tại. Tiếp tục?'))return;}
const today=localDate(),year=new Date().getFullYear(),g1=uid(),g2=uid();db.goals.push({id:g1,title:'Hoàn thành chương trình học chuyên môn',scope:'year',year,quarter:1,month:1,area:'learning',target:100,current:45,unit:'%',due:`${year}-12-20`,notes:'Dành mỗi tuần 3 buổi học và thực hành.'},{id:g2,title:'Duy trì tập luyện thể dục',scope:'quarter',year,quarter:Math.floor(new Date().getMonth()/3)+1,month:new Date().getMonth()+1,area:'health',target:36,current:12,unit:'buổi',due:'',notes:'Tập 3 buổi/tuần.'});
[['Lập kế hoạch các việc ưu tiên', '08:00','high','todo',g1],['Đọc tài liệu chuyên môn 30 phút','09:00','medium','todo',g1],['Hoàn thành nội dung cần xử lý','14:00','urgent','done',''],['Vận động và chăm sóc sức khỏe','17:30','medium','todo',g2]].forEach(([title,time,priority,status,goalId])=>db.tasks.push({id:uid(),title,date:today,time,minutes:30,priority,status,goalId,category:'Cá nhân',notes:'Dữ liệu minh họa',created:new Date().toISOString()}));
for(const name of ['Lập kế hoạch & tổng kết hằng ngày','Đọc sách 20 phút','Vận động 30 phút']){const id=uid();db.habits.push({id,name,category:'Phát triển bản thân',created:shiftDate(today,-6),detail:'Dữ liệu minh họa'});db.checks[id]={};for(let i=1;i<=6;i++)if(i%3!==0)db.checks[id][shiftDate(today,-i)]=true;}
save();render();toast('Đã tạo dữ liệu minh họa.');}
// === SỔ TAY MỞ RỘNG: làm chủ mối quan hệ, thu-chi và ghi chú sáng tạo ===
const contactGroups=[['Gia đình','Gia đình'],['Bạn bè','Bạn bè'],['Đồng nghiệp','Đồng nghiệp'],['Đối tác','Đối tác'],['Khác','Khác']];
const financeGroups=[['Lương','Lương'],['Thưởng','Thưởng'],['Kinh doanh','Kinh doanh'],['Ăn uống','Ăn uống'],['Sinh hoạt','Sinh hoạt'],['Gia đình','Gia đình'],['Di chuyển','Di chuyển'],['Sức khỏe','Sức khỏe'],['Học tập','Học tập'],['Tiết kiệm','Tiết kiệm'],['Khác','Khác']];
const papers=[['grid','Giấy ô ly'],['lined','Giấy kẻ ngang'],['blank','Giấy trắng tinh']];
function formatMoney(n){return new Intl.NumberFormat('vi-VN',{maximumFractionDigits:0}).format(Number(n)||0)+' đ';}
function amount(v){const n=Number(v);return Number.isFinite(n)?Math.min(1e12,Math.max(0,Math.round(n))):0;}
function contactRows(){const q=(ui.contactQuery||'').trim().toLocaleLowerCase('vi');const list=db.contacts.filter(x=>[x.name,x.group,x.phone,x.email,x.job,x.organization,x.notes].some(v=>String(v||'').toLocaleLowerCase('vi').includes(q))).sort((a,b)=>String(a.name).localeCompare(String(b.name),'vi'));return list.length?list.map(c=>`<article class="data-item contact-item"><span class="avatar">${esc((c.name||'?').trim().charAt(0).toUpperCase())}</span><div><strong>${esc(c.name)}</strong><small>${esc(c.group||'Khác')}${c.organization?' · '+esc(c.organization):''}</small><div class="contact-detail">${c.phone?`<span>☎ ${esc(c.phone)}</span>`:''}${c.email?`<span>✉ ${esc(c.email)}</span>`:''}${c.nextContact?`<span>⏰ Liên hệ: ${niceDate(c.nextContact)}</span>`:''}</div>${c.notes?`<div class="small-note">${esc(c.notes)}</div>`:''}</div><div class="item-buttons"><button class="section-link" data-action="edit-contact" data-id="${esc(c.id)}">Sửa</button><button class="section-link" data-action="delete-contact" data-id="${esc(c.id)}">Xóa</button></div></article>`).join(''):emptyState('Không có mối quan hệ phù hợp','Thêm liên hệ mới hoặc thay đổi từ khóa tìm kiếm.');}
function contactsPage(){const due=db.contacts.filter(c=>c.nextContact&&c.nextContact<=localDate()).length;return `${headings('Làm chủ mối quan hệ','Lưu thông tin liên hệ, ghi nhớ những lần gặp gỡ và lịch kết nối.',`<button class="primary-btn" data-action="new-contact">＋ Thêm liên hệ</button>`)}<div class="stats-grid"><div class="stat-card"><span class="stat-label">Số người liên hệ</span><div class="stat-value">${db.contacts.length}</div></div><div class="stat-card"><span class="stat-label">Cần liên hệ</span><div class="stat-value">${due}</div><div class="stat-desc">Đến hạn hoặc quá hạn</div></div></div><section class="card">${cardTitle('Danh bạ mối quan hệ','Tìm kiếm theo tên, điện thoại, nhóm hoặc đơn vị')}<div class="filter-bar"><input id="contact-search" class="input" aria-label="Tìm kiếm mối quan hệ" placeholder="Tìm tên, nhóm, điện thoại..." value="${esc(ui.contactQuery)}"></div><div id="contact-results" class="data-list">${contactRows()}</div></section><div class="banner"><strong>Gợi ý sử dụng:</strong> Ghi lại điều cần nhớ, thời điểm đã kết nối và kế hoạch hỏi thăm tiếp theo. Dữ liệu cá nhân chỉ nằm trên thiết bị, không đưa thông tin nhạy cảm lên máy dùng chung.</div>`;}
function contactModal(id=''){const c=db.contacts.find(x=>x.id===id)||{};modal(id?'Chỉnh sửa mối quan hệ':'Thêm mối quan hệ',`<form id="contact-form"><input type="hidden" name="id" value="${esc(id)}"><div class="field-grid">${field('Họ và tên *',`<input class="input" name="name" required maxlength="150" value="${esc(c.name||'')}" placeholder="Họ tên liên hệ">`,true)}${field('Nhóm mối quan hệ',`<select class="input" name="group">${options(contactGroups,c.group||'Bạn bè')}</select>`)}${field('Quan hệ / vai trò',`<input class="input" name="relation" maxlength="100" value="${esc(c.relation||'')}" placeholder="Ví dụ: Bạn học, đồng nghiệp">`)}${field('Điện thoại',`<input class="input" type="tel" name="phone" maxlength="45" value="${esc(c.phone||'')}">`)}${field('Email',`<input class="input" type="email" name="email" maxlength="150" value="${esc(c.email||'')}">`)}${field('Đơn vị / nơi làm việc',`<input class="input" name="organization" maxlength="150" value="${esc(c.organization||'')}">`)}${field('Nghề nghiệp / chức danh',`<input class="input" name="job" maxlength="120" value="${esc(c.job||'')}">`)}${field('Ngày sinh (nếu biết)',`<input class="input" type="date" name="birthday" value="${esc(c.birthday||'')}">`)}${field('Địa chỉ',`<input class="input" name="address" maxlength="250" value="${esc(c.address||'')}">`,true)}${field('Ngày liên hệ gần nhất',`<input class="input" type="date" name="lastContact" value="${esc(c.lastContact||'')}">`)}${field('Ngày dự kiến liên hệ',`<input class="input" type="date" name="nextContact" value="${esc(c.nextContact||'')}">`)}${field('Thông tin cần nhớ / ghi chú',`<textarea class="input" name="notes" rows="4" maxlength="2000">${esc(c.notes||'')}</textarea>`,true)}</div><div class="form-actions"><button type="button" class="secondary-btn" data-action="close-modal">Hủy</button><button type="button" class="primary-btn" data-action="save-contact">✓ Lưu liên hệ</button></div></form>`);}
function financeReport(){const end=ui.financeMonth,from=`${end.getFullYear()}-${pad(end.getMonth()+1)}`,list=db.transactions.filter(x=>(x.date||'').startsWith(from)),totalIn=list.reduce((n,x)=>n+amount(x.income),0),totalOut=list.reduce((n,x)=>n+amount(x.expense),0);return {list,totalIn,totalOut,balance:totalIn-totalOut};}
function financePage(){const m=ui.financeMonth,r=financeReport(),allIn=db.transactions.reduce((n,x)=>n+amount(x.income),0),allOut=db.transactions.reduce((n,x)=>n+amount(x.expense),0);const byCategory={};for(const x of r.list){const k=x.category||'Khác';byCategory[k]=(byCategory[k]||0)+amount(x.expense);}
const recent=Array.from({length:6},(_,i)=>{const d=new Date(m.getFullYear(),m.getMonth()-5+i,1),key=`${d.getFullYear()}-${pad(d.getMonth()+1)}`,items=db.transactions.filter(x=>x.date?.startsWith(key));return {label:`T${d.getMonth()+1}`,income:items.reduce((n,x)=>n+amount(x.income),0),expense:items.reduce((n,x)=>n+amount(x.expense),0)};});const max=Math.max(1,...recent.flatMap(x=>[x.income,x.expense]));
return `${headings('Quản trị tài chính cá nhân','Theo dõi từng hoạt động thu – chi và xem kết quả hàng tháng.',`<div class="page-actions"><button class="secondary-btn" data-action="export-finance">↓ CSV tài chính</button><button class="primary-btn" data-action="new-transaction">＋ Ghi thu / chi</button></div>`)}<div class="filter-bar"><button class="secondary-btn" data-action="finance-prev">‹ Tháng trước</button><strong>${monthLabel(m)}</strong><button class="secondary-btn" data-action="finance-next">Tháng sau ›</button><button class="secondary-btn" data-action="finance-now">Tháng này</button></div><div class="stats-grid"><div class="stat-card"><span class="stat-label">Tổng thu tháng</span><div class="stat-value money-in">${formatMoney(r.totalIn)}</div></div><div class="stat-card"><span class="stat-label">Tổng chi tháng</span><div class="stat-value money-out">${formatMoney(r.totalOut)}</div></div><div class="stat-card"><span class="stat-label">Chênh lệch thu – chi</span><div class="stat-value ${r.balance>=0?'money-in':'money-out'}">${formatMoney(r.balance)}</div></div><div class="stat-card"><span class="stat-label">Tích lũy theo sổ</span><div class="stat-value ${allIn-allOut>=0?'money-in':'money-out'}">${formatMoney(allIn-allOut)}</div><div class="stat-desc">Toàn bộ giao dịch đã ghi</div></div></div><section class="card">${cardTitle('Sổ thu – chi',`${r.list.length} hoạt động trong ${monthLabel(m)}`)}<div class="table-scroll"><table class="metrics-table"><thead><tr><th>Ngày</th><th>Hoạt động</th><th>Loại</th><th class="right">Thu</th><th class="right">Chi</th><th>Ghi chú</th><th></th></tr></thead><tbody>${r.list.sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(x=>`<tr><td>${niceDate(x.date)}</td><td><strong>${esc(x.activity)}</strong></td><td>${esc(x.category||'Khác')}</td><td class="right money-in">${amount(x.income)?formatMoney(x.income):'—'}</td><td class="right money-out">${amount(x.expense)?formatMoney(x.expense):'—'}</td><td>${esc(x.notes||'')}</td><td class="item-buttons"><button class="section-link" data-action="edit-transaction" data-id="${esc(x.id)}">Sửa</button><button class="section-link" data-action="delete-transaction" data-id="${esc(x.id)}">Xóa</button></td></tr>`).join('')||'<tr><td colspan="7">Chưa có khoản thu – chi nào trong tháng.</td></tr>'}</tbody></table></div></section><div class="two-cols right-panel"><section class="card">${cardTitle('Báo cáo 6 tháng','So sánh tổng thu và chi trong từng tháng')}<div class="finance-chart">${recent.map(x=>`<div class="finance-chart-col"><div class="finance-bars"><span class="finance-bar income" style="height:${Math.max(2,x.income/max*100)}%" title="Thu ${formatMoney(x.income)}"></span><span class="finance-bar expense" style="height:${Math.max(2,x.expense/max*100)}%" title="Chi ${formatMoney(x.expense)}"></span></div><small>${x.label}</small></div>`).join('')}</div><div class="chart-legend"><span class="legend-dot income"></span> Thu <span class="legend-dot expense"></span> Chi</div></section><section class="card">${cardTitle('Cơ cấu chi theo hoạt động','Các nhóm chi tiêu của tháng đang chọn')}<div class="data-list">${Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([k,n])=>`<div class="summary-line"><span>${esc(k)}</span><strong>${formatMoney(n)} · ${pct(n,r.totalOut)}%</strong></div>`).join('')||emptyState('Chưa có khoản chi','Nhập giao dịch để xem báo cáo.')}</div><div class="divider"></div><div class="summary-line"><span>Kết quả thu – chi từ đầu sổ</span><strong>${formatMoney(allIn-allOut)}</strong></div></section></div><div class="banner">Sổ thu – chi giúp bạn theo dõi dòng tiền đã ghi, không tự kết nối ngân hàng và không thay thế báo cáo kế toán chính thức.</div>`;}
function transactionModal(id=''){const x=db.transactions.find(v=>v.id===id)||{date:localDate(),category:'Sinh hoạt',income:'',expense:''};modal(id?'Sửa khoản thu – chi':'Ghi thu – chi',`<form id="transaction-form"><input type="hidden" name="id" value="${esc(id)}"><div class="field-grid">${field('Ngày *',`<input type="date" name="date" class="input" required value="${esc(x.date)}">`)}${field('Nhóm hoạt động',`<select class="input" name="category">${options(financeGroups,x.category||'Khác')}</select>`)}${field('Hoạt động *',`<input class="input" name="activity" maxlength="200" required value="${esc(x.activity||'')}" placeholder="Ví dụ: Mua sắm, nhận lương">`,true)}${field('Thu (VNĐ)',`<input class="input" name="income" type="number" inputmode="decimal" min="0" step="1" value="${x.income??''}" placeholder="0">`)}${field('Chi (VNĐ)',`<input class="input" name="expense" type="number" inputmode="decimal" min="0" step="1" value="${x.expense??''}" placeholder="0">`)}${field('Ghi chú',`<textarea class="input" name="notes" rows="3" maxlength="2000">${esc(x.notes||'')}</textarea>`,true)}</div><div class="form-actions"><button class="secondary-btn" type="button" data-action="close-modal">Hủy</button><button class="primary-btn" type="button" data-action="save-transaction">✓ Lưu thu / chi</button></div></form>`);}
function notesPage(){if(!ui.noteId && db.notes.length)ui.noteId=db.notes[0].id;const x=db.notes.find(n=>n.id===ui.noteId),paper=x?.paper||'grid';return `${headings('Ghi chú sáng tạo','Sổ tay ba kiểu giấy: ô ly, kẻ ngang hoặc trắng tinh; viết chữ và vẽ tay.',`<button class="primary-btn" data-action="new-note">＋ Trang ghi chú</button>`)}<div class="notes-layout"><section class="card notes-list">${cardTitle('Sổ trang ghi chú',`${db.notes.length} trang đã tạo`)}<div class="data-list">${db.notes.map(n=>`<button type="button" class="note-tab ${n.id===ui.noteId?'active':''}" data-action="select-note" data-id="${esc(n.id)}"><strong>${esc(n.title||'Trang chưa đặt tên')}</strong><small>${niceDate(n.date)} · ${papers.find(p=>p[0]===n.paper)?.[1]||'Giấy ô ly'}</small></button>`).join('')||emptyState('Sổ chưa có trang','Bấm Trang ghi chú để bắt đầu.')}</div></section>${x?`<section class="card note-main"><div class="note-tools"><div><label class="sr-only" for="note-title">Tiêu đề ghi chú</label><input class="input" id="note-title" value="${esc(x.title||'')}" maxlength="150" placeholder="Tiêu đề trang ghi chú"></div><label class="sr-only" for="note-paper">Kiểu giấy</label><select class="input" id="note-paper">${options(papers,paper)}</select><div class="toggle-tabs"><button type="button" class="${ui.noteMode==='text'?'active':''}" data-action="note-mode" data-value="text">⌨ Viết chữ</button><button type="button" class="${ui.noteMode==='draw'?'active':''}" data-action="note-mode" data-value="draw">✎ Vẽ tay</button></div><button class="secondary-btn" data-action="note-undo">↶ Lùi nét</button><button class="secondary-btn" data-action="note-clear">Xóa nét vẽ</button><button class="primary-btn" data-action="save-note">✓ Lưu trang</button><button class="danger-btn" data-action="delete-note" data-id="${esc(x.id)}">Xóa trang</button></div><div class="paper-sheet paper-${esc(paper)} ${ui.noteMode==='draw'?'drawing-mode':'typing-mode'}" id="note-sheet"><textarea id="note-content" aria-label="Nội dung ghi chú" maxlength="50000" spellcheck="false" placeholder="Viết ý tưởng, vẽ sơ đồ, suy nghĩ sáng tạo...">${esc(x.content||'')}</textarea><canvas id="note-canvas" width="960" height="1280" aria-label="Vùng vẽ tay"></canvas></div><p class="help">Chế độ Viết chữ: nhập trực tiếp trên giấy. Chế độ Vẽ tay: dùng chuột hoặc ngón tay để phác thảo. Nội dung tự lưu sau khi ngừng gõ và khi nhấc bút; có thể bấm Lưu trang.</p><div id="note-save-status" class="help">Đã mở trang ghi chú</div></section>`:'<section class="card">'+emptyState('Chưa có trang ghi chú','Chọn tạo trang để viết hoặc vẽ trên nền giấy yêu thích.',`<button class="primary-btn" data-action="new-note">＋ Tạo trang</button>` )+'</section>'}</div>`;}
let noteTimer=null;let activeStroke=null;
function selectedNote(){return db.notes.find(n=>n.id===ui.noteId);}
function noteSave(silent=false){const x=selectedNote(),title=$('#note-title'),content=$('#note-content'),paper=$('#note-paper');if(!x||!title||!content||!paper)return false;const v={...x,title:title.value.trim().slice(0,150)||'Trang ghi chú',paper:papers.some(p=>p[0]===paper.value)?paper.value:'grid',content:content.value.slice(0,50000),strokes:ui.noteStrokesDraft.map(st=>({color:st.color,width:st.width,points:st.points}))};const ok=persist({...db,notes:db.notes.map(n=>n.id===x.id?v:n)});const status=$('#note-save-status');if(status)status.textContent=ok?`Đã lưu lúc ${new Date().toLocaleTimeString('vi-VN')}`:'Lưu thất bại – hãy sao lưu hoặc kiểm tra bộ nhớ';if(ok&&!silent)toast('Đã lưu trang ghi chú.');return ok;}
function scheduleNoteSave(){if(noteTimer)clearTimeout(noteTimer);noteTimer=setTimeout(()=>{noteTimer=null;if(ui.page==='notes')noteSave(true);},700);}
function drawStroke(ctx,st){const pts=st.points||[];if(!pts.length)return;ctx.strokeStyle=st.color||'#23564a';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=st.width||2.7;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);if(pts.length===1){ctx.arc(pts[0][0],pts[0][1],ctx.lineWidth/2,0,Math.PI*2);ctx.fill();return;}for(const pt of pts.slice(1))ctx.lineTo(pt[0],pt[1]);ctx.stroke();}
function repaintNote(){const canvas=$('#note-canvas');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);for(const st of ui.noteStrokesDraft)drawStroke(ctx,st);if(activeStroke)drawStroke(ctx,activeStroke);}
function initNoteCanvas(){const x=selectedNote();ui.noteStrokesDraft=Array.isArray(x?.strokes)?JSON.parse(JSON.stringify(x.strokes)):[];repaintNote();const canvas=$('#note-canvas');if(!canvas)return;canvas.addEventListener('pointerdown',e=>{if(ui.noteMode!=='draw')return;e.preventDefault();canvas.setPointerCapture(e.pointerId);const pt=notePoint(e,canvas);activeStroke={color:'#23564a',width:2.7,points:[pt]};repaintNote();});canvas.addEventListener('pointermove',e=>{if(!activeStroke)return;e.preventDefault();if(activeStroke.points.length>=2500)return;activeStroke.points.push(notePoint(e,canvas));repaintNote();});const end=e=>{if(!activeStroke)return;activeStroke.points.push(notePoint(e,canvas));if(ui.noteStrokesDraft.length<300)ui.noteStrokesDraft.push(activeStroke);activeStroke=null;repaintNote();scheduleNoteSave();};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);}
function notePoint(e,canvas){const box=canvas.getBoundingClientRect();return [Math.round((e.clientX-box.left)/Math.max(box.width,1)*canvas.width),Math.round((e.clientY-box.top)/Math.max(box.height,1)*canvas.height)];}
function exportFinance(){const rows=[['Ngày','Hoạt động','Nhóm','Thu','Chi','Ghi chú'],...[...db.transactions].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(x=>[x.date,x.activity,x.category,amount(x.income),amount(x.expense),x.notes])];const csv='\ufeff'+rows.map(row=>row.map(csvSafe).join(',')).join('\r\n');download(csv,`so-thu-chi-${localDate()}.csv`,'text/csv;charset=utf-8');toast('Đã xuất báo cáo tài chính CSV.');}
function handleExtraForm(form){const vals=Object.fromEntries(new FormData(form).entries());
 if(form.getAttribute('id')==='contact-form'){const name=(vals.name||'').trim();if(!name){toast('Nhập họ tên người liên hệ.',true);form.querySelector('[name=name]')?.focus();return;}const old=db.contacts.find(x=>x.id===vals.id),v={id:old?.id||uid(),name:name.slice(0,150),group:vals.group||'Khác',relation:(vals.relation||'').slice(0,100),phone:(vals.phone||'').slice(0,45),email:(vals.email||'').slice(0,150),organization:(vals.organization||'').slice(0,150),job:(vals.job||'').slice(0,120),birthday:vals.birthday||'',address:(vals.address||'').slice(0,250),lastContact:vals.lastContact||'',nextContact:vals.nextContact||'',notes:(vals.notes||'').slice(0,2000)};if(!persist({...db,contacts:old?db.contacts.map(x=>x.id===old.id?v:x):[...db.contacts,v]}))return;closeModal(true);render();toast('Đã lưu mối quan hệ.');
 }else if(form.getAttribute('id')==='transaction-form'){const activity=(vals.activity||'').trim(),inc=amount(vals.income),exp=amount(vals.expense);if(!activity){toast('Hãy nhập hoạt động thu – chi.',true);form.querySelector('[name=activity]')?.focus();return;}if(!inc&&!exp){toast('Hãy nhập số tiền Thu hoặc Chi lớn hơn 0.',true);return;}if(inc&&exp){toast('Một dòng chỉ ghi Thu hoặc Chi, không nhập đồng thời hai khoản.',true);return;}const old=db.transactions.find(x=>x.id===vals.id),v={id:old?.id||uid(),date:vals.date||localDate(),activity:activity.slice(0,200),category:vals.category||'Khác',income:inc,expense:exp,notes:(vals.notes||'').slice(0,2000)};if(!persist({...db,transactions:old?db.transactions.map(x=>x.id===old.id?v:x):[...db.transactions,v]}))return;ui.financeMonth=firstOfMonth(fromDate(v.date));closeModal(true);render();toast('Đã ghi thu – chi.');}
}
function doExtraAction(action,node){const id=node.dataset.id;
 switch(action){
 case 'save-task':{const form=$('#task-form');if(form)doForm(form);return true;}
 case 'new-contact':contactModal();return true;
 case 'edit-contact':contactModal(id);return true;
 case 'save-contact':{const f=$('#contact-form');if(f)handleExtraForm(f);return true;}
 case 'delete-contact':{if(confirm('Xóa mối quan hệ này?')){if(persist({...db,contacts:db.contacts.filter(x=>x.id!==id)})){render();toast('Đã xóa liên hệ.');}}return true;}
 case 'new-transaction':transactionModal();return true;
 case 'edit-transaction':transactionModal(id);return true;
 case 'save-transaction':{const f=$('#transaction-form');if(f)handleExtraForm(f);return true;}
 case 'delete-transaction':{if(confirm('Xóa dòng thu – chi này?')){if(persist({...db,transactions:db.transactions.filter(x=>x.id!==id)})){render();toast('Đã xóa giao dịch.');}}return true;}
 case 'finance-prev':ui.financeMonth=new Date(ui.financeMonth.getFullYear(),ui.financeMonth.getMonth()-1,1);render();return true;
 case 'finance-next':ui.financeMonth=new Date(ui.financeMonth.getFullYear(),ui.financeMonth.getMonth()+1,1);render();return true;
 case 'finance-now':ui.financeMonth=firstOfMonth(new Date());render();return true;
 case 'export-finance':exportFinance();return true;
 case 'new-note':{noteSave(true);const n={id:uid(),date:localDate(),title:`Ghi chú ${niceDate(localDate())}`,paper:'grid',content:'',strokes:[]};if(persist({...db,notes:[n,...db.notes]})){ui.noteId=n.id;ui.noteMode='text';render();toast('Đã tạo trang mới.');}return true;}
 case 'select-note':noteSave(true);ui.noteId=id;ui.noteMode='text';render();return true;
 case 'delete-note':if(confirm('Xóa trang ghi chú này?')){const next=db.notes.filter(n=>n.id!==id);if(persist({...db,notes:next})){ui.noteId=next[0]?.id||'';ui.noteMode='text';render();}}return true;
 case 'note-mode':ui.noteMode=node.dataset.value==='draw'?'draw':'text';$('#note-sheet')?.classList.toggle('drawing-mode',ui.noteMode==='draw');$('#note-sheet')?.classList.toggle('typing-mode',ui.noteMode==='text');$$('[data-action="note-mode"]').forEach(b=>b.classList.toggle('active',b.dataset.value===ui.noteMode));return true;
 case 'note-undo':if(ui.noteStrokesDraft.length){ui.noteStrokesDraft.pop();repaintNote();scheduleNoteSave();}return true;
 case 'note-clear':if(ui.noteStrokesDraft.length&&confirm('Xóa tất cả nét vẽ của trang này?')){ui.noteStrokesDraft=[];repaintNote();scheduleNoteSave();}return true;
 case 'save-note':noteSave();return true;
 }return false;
}

const eventPriorityRank = {critical: 0, important: 1, normal: 2};
let eventView = 'upcoming';
let eventPriority = 'all';
let webReminderCursor = Date.now() - eventsApi.lookback;

function eventEntries() {
 const today = localDate();
 return db.events.map(event => ({event, date: eventsApi.nextOccurrence(event)})).filter(row => row.date)
  .map(row => ({...row, state: row.event.done ? 'done' : localDate(row.date) < today ? 'overdue' : 'upcoming'}))
  .sort((a, b) => localDate(a.date).localeCompare(localDate(b.date)) ||
   eventPriorityRank[a.event.priority] - eventPriorityRank[b.event.priority] || a.date - b.date);
}

function eventLine({event, date, state}) {
 const id = esc(event.id);
 const reminder = event.reminders.map(n => n === 0 ? 'Đúng ngày' : 'Trước ' + n + ' ngày').join(' · ');
 return `<article class="planner-event">
  <div class="planner-event-date"><strong>${pad(date.getDate())}/${pad(date.getMonth()+1)}</strong><small>${date.getFullYear()}</small></div>
  <div class="planner-event-info">
   <h3>${esc(event.title)}</h3>
   <div class="planner-event-tags"><span>${eventsApi.categories[event.category]}</span><span class="event-level level-${event.priority}">${eventsApi.levels[event.priority]}</span>${state==='overdue' ? '<span class="event-level level-critical">Quá hạn</span>' : ''}</div>
   <div class="small-note">${esc(event.time)}${event.repeat==='yearly'?' · Hằng năm':''}${event.location?' · '+esc(event.location):''}</div>
   ${reminder ? `<div class="small-note">${reminder}</div>` : ''}
   ${event.notes ? `<p class="event-notes">${esc(event.notes)}</p>` : ''}
  </div>
  <div class="planner-event-actions">
   <button class="secondary-btn" data-action="event-edit" data-id="${id}">Sửa</button>
   <button class="secondary-btn" data-action="event-export" data-id="${id}">Xuất lịch (.ics)</button>
   ${event.repeat==='once' ? `<button class="secondary-btn" data-action="event-toggle" data-id="${id}">${event.done ? 'Mở lại' : 'Đã xử lý'}</button>` : ''}
   <button class="ghost-btn" data-action="event-delete" data-id="${id}">Xóa</button>
  </div></article>`;
}

function eventsPage() {
 const entries = eventEntries();
 const rows = entries.filter(({state, event}) => state === eventView && (eventPriority === 'all' || event.priority === eventPriority));
 const native = window.AndroidApp;
 const androidStatus = typeof native?.eventNotificationStatus === 'function' ? native.eventNotificationStatus() : '';
 const reminderNotice = androidStatus
  ? `<div class="event-notice"><span>${androidStatus==='enabled'?'Đã bật thông báo sự kiện trên Android.':'Hãy bật thông báo để nhận nhắc khi đã đóng ứng dụng.'}</span>
    ${androidStatus==='enabled'?'':'<button class="secondary-btn" data-action="event-enable">Bật thông báo Android</button>'}</div>`
  : `<div class="event-notice"><span>Web nhắc khi ứng dụng đang mở. Trên iPhone, dùng <strong>Xuất lịch (.ics)</strong>, nhập vào Lịch Apple và kiểm tra cảnh báo để nhận nhắc khi đã đóng ứng dụng.</span></div>`;
 return `${headings('Sự kiện', 'Sinh nhật, ngày giỗ, hạn giấy tờ và lịch gia đình.', '<button class="primary-btn" data-action="event-new">＋ Thêm sự kiện</button>')}
  ${reminderNotice}
  <div class="event-toolbar">
   <div class="toggle-tabs" aria-label="Trạng thái sự kiện">${[['upcoming','Sắp tới'],['overdue','Quá hạn'],['done','Đã xử lý']].map(([key,label]) => `<button class="${key===eventView?'active':''}" aria-pressed="${key===eventView}" data-action="event-view" data-value="${key}">${label} · ${entries.filter(row=>row.state===key).length}</button>`).join('')}</div>
   <select class="input" id="event-priority" aria-label="Lọc theo mức độ">${options([['all','Mọi mức độ'], ...Object.entries(eventsApi.levels)],eventPriority)}</select>
  </div>
  <div class="planner-events">${rows.length ? rows.map(eventLine).join('') : `<section class="card">${emptyState('Chưa có sự kiện trong mục này','')}</section>`}</div>`;
}

function dashboardEvents() {
 const entries = eventEntries().filter(row => row.state === 'upcoming');
 return `<section class="card event-dashboard">${cardTitle('Sự kiện sắp tới','', '<button class="section-link" data-page="events">Xem sự kiện ↗</button>')}
  ${entries.length ? entries.slice(0,3).map(({event,date})=>`<div class="summary-line"><span>${esc(event.title)}</span><strong>${niceDate(localDate(date))}</strong></div>`).join('') : '<button class="secondary-btn" data-action="event-new">＋ Thêm sự kiện</button>'}
 </section>`;
}

function eventModal(event, day) {
 const item = event || {id:'',title:'',date:day||localDate(),time:'09:00',category:'other',priority:'normal',repeat:'once',reminders:[7,1,0]};
 modal(event ? 'Sửa sự kiện' : 'Thêm sự kiện', `<form id="event-form">
  <input type="hidden" name="eventId" value="${esc(item.id)}">
  <div class="field-grid">
   <label class="field full"><span>Tên sự kiện *</span><input class="input" name="title" required maxlength="160" value="${esc(item.title)}"></label>
   <label class="field"><span>Loại sự kiện</span><select class="input" name="category">${options(Object.entries(eventsApi.categories), item.category)}</select></label>
   <label class="field"><span>Mức độ</span><select class="input" name="priority">${options(Object.entries(eventsApi.levels), item.priority)}</select></label>
   <label class="field"><span>Ngày dương lịch *</span><input class="input" type="date" name="date" required min="1900-01-01" max="9999-12-31" value="${esc(item.date)}"></label>
   <label class="field"><span>Giờ sự kiện và giờ nhắc *</span><input class="input" type="time" name="time" required value="${esc(item.time)}"></label>
   <label class="field"><span>Lặp lại</span><select class="input" name="repeat">${options([['once','Một lần'],['yearly','Hằng năm theo dương lịch']],item.repeat)}</select></label>
   <label class="field"><span>Địa điểm</span><input class="input" name="location" maxlength="200" value="${esc(item.location)}"></label>
   <fieldset class="event-alert-options full"><legend>Ngày nhắc</legend>
    ${eventsApi.reminderDays.map(n=>`<label><input type="checkbox" class="checkbox" name="reminder" value="${n}" ${item.reminders.includes(n)?'checked':''}> ${n===0?'Đúng ngày':n+' ngày trước'}</label>`).join('')}
   </fieldset>
   <label class="field full"><span>Ghi chú</span><textarea class="input" name="notes" rows="3" maxlength="2000">${esc(item.notes)}</textarea></label>
  </div>
  <div class="form-actions"><button type="button" class="secondary-btn" data-action="close-modal">Hủy</button><button type="submit" class="primary-btn">Lưu sự kiện</button></div>
 </form>`);
}

function saveEvent(form) {
 const values = new FormData(form);
 const old = db.events.find(event => event.id === values.get('eventId'));
 const reminders = values.getAll('reminder').map(Number);
 const sameSchedule = old && old.date === values.get('date') && old.time === values.get('time') &&
  old.repeat === values.get('repeat') && old.reminders.length === reminders.length &&
  reminders.every(day=>old.reminders.includes(day));
 const event = eventsApi.cleanEvent({
  ...Object.fromEntries(values.entries()), id: old?.id || uid(), done: old?.done, reminders,
  reminderSince: sameSchedule ? old.reminderSince : Date.now()
 });
 if (!event) {
  toast('Hãy kiểm tra tên, ngày và giờ của sự kiện.', true);
  return;
 }
 const events = old ? db.events.map(item => item.id === old.id ? event : item) : [...db.events, event];
 if (!persist({...db, events})) return;
 closeModal(true);
 eventPriority = 'all';
 eventView = event.done ? 'done' : event.repeat === 'once' && event.date < localDate() ? 'overdue' : 'upcoming';
 setPage('events');
 toast('Đã lưu sự kiện.');
}

function exportEvent(event) {
 const text = eventsApi.calendarFile(event);
 if (!text) return;
 if (window.AndroidApp) {
  download(text, 'su-kien.ics', 'text/calendar');
  return;
 }
 const file = typeof File === 'function' ? new File([text],'su-kien.ics',{type:'text/calendar'}) : null;
 if (file && typeof navigator.share === 'function' && navigator.canShare?.({files:[file]})) {
  navigator.share({files:[file]}).catch(error => {
   if (error.name !== 'AbortError') toast('Chưa chia sẻ được. Hãy thử lại.', true);
  });
 } else {
  download(text, 'su-kien.ics', 'text/calendar');
 }
}

function eventAction(action, node) {
 if (action === 'event-new') { eventModal(null,node.dataset.day); return; }
 if (action === 'event-enable') { window.AndroidApp?.enableEventNotifications(); return; }
 if (action === 'event-view') { eventView = node.dataset.value; render(); return; }
 const event = db.events.find(item => item.id === node.dataset.id);
 if (!event) return;
 switch (action) {
 case 'event-edit': eventModal(event); break;
 case 'event-export': exportEvent(event); break;
 case 'event-delete':
  if (confirm('Xóa sự kiện này?') && persist({...db, events:db.events.filter(item=>item.id!==event.id)})) render();
  break;
 case 'event-toggle':
  if (event.repeat === 'once' && persist({...db, events:db.events.map(item=>item.id===event.id ? {...item,done:!item.done,reminderSince:Date.now()} : item)})) render();
  break;
 }
}

function checkWebEventReminders() {
 if (typeof window.AndroidApp?.eventNotificationStatus === 'function' || document.hidden) return;
 const now = Date.now();
 const key = STORAGE + '.event-reminder-cursor';
 try { webReminderCursor = Math.max(webReminderCursor, Number(localStorage.getItem(key)) || 0); } catch {}
 const due = eventsApi.dueReminders(db.events, Math.min(webReminderCursor,now),now);
 webReminderCursor = now;
 try { localStorage.setItem(key,String(now)); } catch {}
 if (due.length === 1) toast(`Nhắc sự kiện: ${due[0].event.title} · ${niceDate(localDate(due[0].date))}`);
 if (due.length > 1) toast(`Có ${due.length} sự kiện đến giờ nhắc. Mở mục Sự kiện để xem.`);
}

function doAction(node){const action=node.dataset.action,id=node.dataset.id,day=node.dataset.day;
if(action.startsWith('event-')){eventAction(action,node);return;}
if(doExtraAction(action,node))return;
switch(action){
 case 'new-task':taskModal('',day);break;case 'edit-task':taskModal(id);break;case 'delete-task':if(confirm('Xóa công việc này?')){db.tasks=db.tasks.filter(x=>x.id!==id);save();render();toast('Đã xóa công việc.');}break;
 case 'new-goal':goalModal('',node.dataset.scope||'year');break;case 'edit-goal':goalModal(id);break;case 'delete-goal':if(confirm('Xóa mục tiêu? Các công việc liên kết sẽ không bị xóa.')){db.goals=db.goals.filter(x=>x.id!==id);db.tasks.forEach(t=>{if(t.goalId===id)t.goalId='';});save();render();}break;
 case 'new-habit':habitModal();break;case 'edit-habit':habitModal(id);break;case 'quick-habit':habitModal('',node.dataset.name||'');break;case 'delete-habit':if(confirm('Xóa thói quen và lịch sử đánh dấu?')){db.habits=db.habits.filter(x=>x.id!==id);delete db.checks[id];save();render();}break;
 case 'toggle-habit':{const h=db.habits.find(x=>x.id===id);if(!h||day>localDate()||day<h.created)return;db.checks[id]??={};db.checks[id][day]=!db.checks[id][day];if(!db.checks[id][day])delete db.checks[id][day];save();render();break;}
 case 'close-modal':closeModal();break;
 case 'day-prev':ui.date=shiftDate(ui.date,-1);render();break;case 'day-next':ui.date=shiftDate(ui.date,1);render();break;case 'day-today':case 'review-today':ui.date=localDate();render();break;
 case 'filter-task':ui.taskFilter=node.dataset.value;render();break;
 case 'calendar-mode':ui.calendarMode=node.dataset.mode;render();break;case 'calendar-prev':if(ui.calendarMode==='week'){ui.date=shiftDate(ui.date,-7);ui.month=firstOfMonth(fromDate(ui.date));}else ui.month=new Date(ui.month.getFullYear(),ui.month.getMonth()-1,1);render();break;
 case 'calendar-next':if(ui.calendarMode==='week'){ui.date=shiftDate(ui.date,7);ui.month=firstOfMonth(fromDate(ui.date));}else ui.month=new Date(ui.month.getFullYear(),ui.month.getMonth()+1,1);render();break;
 case 'calendar-now':ui.date=localDate();ui.month=firstOfMonth(new Date());render();break;
 case 'pick-calendar-day':ui.date=day;render();break;
 case 'goal-year-prev':ui.goalYear--;render();break;case 'goal-year-next':ui.goalYear++;render();break;
 case 'habit-month-prev':ui.habitMonth=new Date(ui.habitMonth.getFullYear(),ui.habitMonth.getMonth()-1,1);render();break;
 case 'habit-month-next':ui.habitMonth=new Date(ui.habitMonth.getFullYear(),ui.habitMonth.getMonth()+1,1);render();break;
 case 'stat-range':ui.statDays=int(node.dataset.days,7,90);render();break;
 case 'review-rating':{const v=int(node.dataset.value,1,5),field=node.dataset.field;if(!['performance','mood'].includes(field))return;db.reviews[ui.date]??={};db.reviews[ui.date][field]=v;save();$$(`[data-stars="${field}"] button`).forEach(b=>b.classList.toggle('active',Number(b.dataset.value)<=v));break;}
 case 'timer-preset':if(ui.focusRunning){toast('Hãy tạm dừng phiên trước khi đổi thời lượng.');return;}ui.focusMinutes=int(node.dataset.min,1,180);ui.focusRemaining=ui.focusMinutes*60;render();break;
 case 'timer-toggle':if(ui.focusRunning){ui.focusRemaining=Math.max(0,Math.ceil((ui.focusEnd-Date.now())/1000));ui.focusRunning=false;ui.focusEnd=null;}else{ui.focusTask=$('#focus-task')?.value||'';ui.focusEnd=Date.now()+ui.focusRemaining*1000;ui.focusRunning=true;}render();break;
 case 'timer-reset':ui.focusRunning=false;ui.focusEnd=null;ui.focusRemaining=ui.focusMinutes*60;render();break;
 case 'backup':{const {text,name}=backupFile();download(text,name,'application/json');toast('Đã tải bản sao lưu JSON.');break;}
  case 'share-backup':shareBackup();break;
 case 'restore':$('#restore-file')?.click();break;
 case 'csv':exportCsv();break;
 case 'demo':insertDemo();break;
 case 'reset-data':if(confirm('Thao tác này XÓA TOÀN BỘ dữ liệu đang lưu ở trình duyệt. Bạn đã sao lưu chưa?')&&confirm('Xác nhận lần cuối: Xóa dữ liệu không thể hoàn tác.')){if(!persist(fresh()))break;ui.page='dashboard';setPage('dashboard');toast('Đã làm mới dữ liệu.');}break;
 case 'install':if(window.AndroidApp){toast('Đây đã là ứng dụng Android cài trên điện thoại.');break;}if(ui.installPrompt){ui.installPrompt.prompt();ui.installPrompt.userChoice.finally(()=>{ui.installPrompt=null;});}else toast('Trên iPhone: Safari → Chia sẻ → Thêm vào Màn hình chính. Trên Android: mở menu trình duyệt → Cài ứng dụng.');break;
 }
}
function render(){document.body.classList.toggle('dark',db.settings.theme==='dark');$('#breadcrumb').textContent=pageNames[ui.page]||'Tổng quan';$$('[data-page]',$('#sidebar')).forEach(n=>n.classList.toggle('active',n.dataset.page===ui.page));if(['habits','vision'].includes(ui.page))$('#group-personal').open=true;if(['contacts','finance','notes'].includes(ui.page))$('#group-tools').open=true;if(['journal','statistics'].includes(ui.page))$('#group-reports').open=true;
const renderer={dashboard,today:todayPage,calendar:calendarPage,events:eventsPage,goals:goalsPage,habits:habitsPage,vision:visionPage,contacts:contactsPage,finance:financePage,notes:notesPage,journal:journalPage,statistics:statsPage,settings:settingsPage};
$('#app').innerHTML=(renderer[ui.page]||dashboard)();$('#live-date').textContent=niceDate(localDate());if(ui.page==='notes')initNoteCanvas();}
function timerTick(){if(!ui.focusRunning||!ui.focusEnd)return;ui.focusRemaining=Math.max(0,Math.ceil((ui.focusEnd-Date.now())/1000));const face=$('#focus-clock');if(face)face.textContent=clockText(ui.focusRemaining);
if(ui.focusRemaining===0){ui.focusRunning=false;ui.focusEnd=null;db.focus.push({id:uid(),date:localDate(),minutes:ui.focusMinutes,taskId:ui.focusTask||'',timestamp:new Date().toISOString()});save();toast(`Đã hoàn thành phiên tập trung ${ui.focusMinutes} phút!`);if(typeof Notification !== 'undefined' && Notification.permission==='granted')new Notification('Hoàn thành phiên tập trung',{body:`Bạn đã hoàn thành ${ui.focusMinutes} phút làm việc.`});ui.focusRemaining=ui.focusMinutes*60;render();}}
function handleImport(file){if(!file)return;if(file.size>5*1024*1024){toast('Tệp JSON vượt quá 5 MB.',true);return;}const reader=new FileReader();reader.onload=()=>{try{const content=JSON.parse(reader.result);if(content.app!=='thoi-gian-gotino'||!content.data||!Array.isArray(content.data.tasks)){toast('Không phải bản sao lưu hợp lệ của chương trình.',true);return;}if(!confirm('Nhập dữ liệu sẽ thay thế toàn bộ dữ liệu hiện có trên thiết bị. Tiếp tục?'))return;if(!persist(normalize(content.data)))return;render();toast('Khôi phục bản sao lưu thành công.');}catch{toast('Không đọc được tệp sao lưu.',true);}};reader.readAsText(file);}
function bindEvents(){document.addEventListener('click',e=>{if(e.target.id==='modal-backdrop'){return;}const nav=e.target.closest('[data-page]');if(nav){setPage(nav.dataset.page);return;}const action=e.target.closest('[data-action]');if(action){doAction(action);return;}});
document.addEventListener('change',e=>{if(e.target.id==='event-priority'){eventPriority=e.target.value;render();return;}if(e.target.id==='note-paper'){const sheet=$('#note-sheet');if(sheet){sheet.classList.remove('paper-grid','paper-lined','paper-blank');sheet.classList.add('paper-'+e.target.value);}scheduleNoteSave();return;}if(e.target.closest('#modal-root form'))modalDirty=true;if(e.target.matches('[data-check-task]')){const t=db.tasks.find(x=>x.id===e.target.dataset.checkTask);if(t){t.status=e.target.checked?'done':'todo';t.completedAt=e.target.checked?new Date().toISOString():'';save();render();}return;}
if(e.target.id==='selected-day'){if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){ui.date=e.target.value;render();}return;}
if(e.target.id==='focus-task'){ui.focusTask=e.target.value;return;}
if(e.target.id==='restore-file'){handleImport(e.target.files[0]);e.target.value='';return;}});
document.addEventListener('input',e=>{if(e.target.closest('#modal-root form'))modalDirty=true;if(e.target.id==='contact-search'){ui.contactQuery=e.target.value;const node=$('#contact-results');if(node)node.innerHTML=contactRows();return;}if(['note-title','note-content'].includes(e.target.id)){scheduleNoteSave();return;}const out=e.target.dataset.rangeOutput;if(out){const node=document.getElementById(out);if(node)node.textContent=`${e.target.value}/10`;}});
document.addEventListener('submit',e=>{if(e.target.getAttribute('id')==='event-form'){e.preventDefault();saveEvent(e.target);return;}if(['task-form','goal-form','habit-form','vision-form','review-form','review-ratings','settings-form','contact-form','transaction-form'].includes(e.target.getAttribute('id'))){e.preventDefault();if(['contact-form','transaction-form'].includes(e.target.getAttribute('id')))handleExtraForm(e.target);else doForm(e.target);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();if((e.key==='Enter'||e.key===' ')&&e.target.matches('.calendar-day[role="button"]')){e.preventDefault();doAction(e.target);}});
$('#menu-btn').addEventListener('click',openSidebar);$('#scrim').addEventListener('click',closeSidebar);
window.addEventListener('hashchange',()=>{const newPage=location.hash.slice(1);if(pageNames[newPage]&&newPage!==ui.page){if(ui.page==='notes')noteSave(true);ui.page=newPage;render();}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();ui.installPrompt=e;});}
function boot(){bindEvents();render();setInterval(timerTick,500);
 checkWebEventReminders();
 setInterval(checkWebEventReminders,15000);
 document.addEventListener('visibilitychange',checkWebEventReminders);
 window.addEventListener('eventpermissionchange',()=>{if(ui.page==='events'&&!$('#modal-backdrop'))render();});
if(!window.AndroidApp && 'serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>{});}
boot();
})();
