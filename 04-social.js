function renderMoments(){
  const wrap = document.getElementById('momentsList');
  if(!wrap) return;
  const myAvatar = profile.myAvatar && profile.myAvatar.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${profile.myAvatar}">` : (profile.myAvatar||'🙂');
  const myName = profile.myName || '我';
  const taAvatar = profile.avatar && profile.avatar.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${profile.avatar}">` : (profile.avatar||'🌙');
  wrap.innerHTML = momentsPosts.length ? momentsPosts.map(p=>{
    const isBot = p.authorType==='bot';
    const avatar = isBot ? taAvatar : myAvatar;
    const name = isBot ? chatSettings.companionName : myName;

    let autoInteractions = '';
    if(!isBot && (p.liked || p.commented)){
      autoInteractions = `<div class="moment-interactions">`;
      if(p.liked) autoInteractions += `<div class="moment-likes">❤️ ${chatSettings.companionName}</div>`;
      if(p.commented) autoInteractions += `<div class="moment-comment"><b style="color:var(--rouge);">${chatSettings.companionName}：</b>${p.comment}</div>`;
      autoInteractions += `</div>`;
    }

    const likeBtn = `<span class="moment-like-btn ${p.likedByUser?'active':''}" onclick="toggleMomentLike('${p.id}')">${p.likedByUser?'❤️':'🤍'} 赞</span>`;
    const likersLine = p.likedByUser ? `<div class="moment-likes" style="margin-top:6px;">❤️ ${myName}</div>` : '';

    const thread = (p.comments && p.comments.length)
      ? `<div class="moment-thread">${p.comments.map(c=>`<div class="moment-comment-line"><b style="color:${c.author==='user'?'var(--ink)':'var(--rouge)'};">${c.author==='user'?myName:chatSettings.companionName}：</b>${c.text}</div>`).join('')}</div>`
      : '';

    return `<div class="moment-post">
      <div class="moment-avatar">${avatar}</div>
      <div class="moment-body">
        <div class="moment-name">${name}</div>
        ${p.text?`<div class="moment-text">${p.text}</div>`:''}
        ${p.photo?`<img loading="lazy" decoding="async" class="moment-photo" src="${p.photo}">`:''}
        ${p.video?`<video class="moment-photo" src="${p.video}" controls></video>`:''}
        <div class="moment-meta">${new Date(p.time).toLocaleString('zh-CN')}</div>
        <div class="moment-actions">${likeBtn}</div>
        ${likersLine}
        ${autoInteractions}
        ${thread}
        <div class="moment-comment-input-row">
          <input type="text" id="momentCommentInput_${p.id}" placeholder="评论…" onkeydown="if(event.key==='Enter')addMomentComment('${p.id}')">
          <span onclick="addMomentComment('${p.id}')">发送</span>
        </div>
      </div>
    </div>`;
  }).join('') + (!pageState.momentsPosts.exhausted ? `<div class="load-more-bar" onclick="loadMoreMoments()">加载更早的朋友圈 ↓</div>` : '') : '<div class="empty-note">还没有发过朋友圈</div>';
}
async function loadMoreMoments(){
  const older = await loadOlderPage('momentsPosts', [...momentsPosts].reverse());
  if(!older.length) return;
  momentsPosts = [...momentsPosts, ...older.reverse()];
  renderMoments();
}

/* ============================================================
   LETTERS 写信 —— 我写信给TA没有次数/时间限制，TA的回信要等 10~24 小时（随机）
   ============================================================ */
async function sendLetter(){
  const text = document.getElementById('letterText').value.trim();
  if(!text) return;
  const hours = 8 + Math.random()*7; // 8~15 小时随机
  const scheduledReplyAt = Date.now() + hours*3600*1000;
  const letter = { id:uid(), from:'user', content:text, time:Date.now(), replied:false, replyContent:null, replyTime:null, scheduledReplyAt };
  letters.unshift(letter);
  await sSet('letters', letters);
  document.getElementById('letterText').value = '';
  renderLetters();
  scheduleLetterReply(letter.id, scheduledReplyAt - Date.now());
}
function scheduleLetterReply(id, delayMs){
  setTimeout(async ()=>{
    const l = letters.find(x=>x.id===id);
    if(!l || l.replied) return;
    const lineCount = 5 + Math.floor(Math.random()*5); // 一封回信随机 5~9 句字卡内容
    const lines = [];
    for(let i=0;i<lineCount;i++){ const c = getRandomCardText(); if(c) lines.push(c); }
    if(lines.length===0) return; // 字卡库是空的，先不生成回信
    l.replyContent = lines.join('\n');
    l.replyTime = Date.now();
    l.replied = true;
    await sSet('letters', letters);
    if(currentView==='letters'){ renderLetters(); }
    else{ letterUnread = true; await sSet('letter-unread', true); renderUnreadDots(); tryBgNotify(chatSettings.companionName+' 回信了', '点开查看回信'); }
  }, Math.max(0, delayMs));
}
function resumeLetterTimers(){
  letters.forEach(l=>{
    if(l.from==='user' && !l.replied && typeof l.scheduledReplyAt === 'number'){
      scheduleLetterReply(l.id, l.scheduledReplyAt - Date.now());
    }
  });
}
function renderLetters(){
  const wrap = document.getElementById('lettersList');
  if(!wrap) return;
  wrap.innerHTML = letters.length ? letters.map(l=>{
    const sentTime = new Date(l.time).toLocaleString('zh-CN');
    let replyBlock;
    if(l.replied){
      const replyTime = new Date(l.replyTime).toLocaleString('zh-CN');
      replyBlock = `<div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--rule);">
        <div style="font-size:11px;color:var(--ink-soft);">${chatSettings.companionName} 的回信 · ${replyTime}</div>
        <div style="font-size:13px;margin-top:6px;white-space:pre-line;">${l.replyContent}</div>
      </div>`;
    } else {
      const eta = new Date(l.scheduledReplyAt).toLocaleString('zh-CN');
      replyBlock = `<div style="margin-top:10px;font-size:12px;color:var(--ink-soft);">TA 还在写回信…大概 ${eta} 前会寄到</div>`;
    }
    return `<div class="box"><div style="font-size:11px;color:var(--ink-soft);">${sentTime}</div><div style="font-size:13px;margin-top:4px;white-space:pre-line;">${l.content}</div>${replyBlock}</div>`;
  }).join('') : '<div class="empty-note">还没有写过信，什么时候想写都可以</div>';
}
function renderInboxLetters(){
  const wrap = document.getElementById('inboxLettersList');
  if(!wrap) return;
  wrap.innerHTML = inboxLetters.length ? inboxLetters.map(l=>{
    const t = new Date(l.time).toLocaleString('zh-CN');
    let thread = '';
    // 我的回信
    if(l.userReply){
      const urt = new Date(l.userReplyTime).toLocaleString('zh-CN');
      thread += `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--rule);">
        <div style="font-size:11px;color:var(--ink-soft);">我的回信 · ${urt}</div>
        <div style="font-size:13px;margin-top:6px;white-space:pre-line;">${l.userReply}</div>
      </div>`;
    }
    // TA 对我回信的再回复
    if(l.botReplied && l.botReplyContent){
      const brt = new Date(l.botReplyTime).toLocaleString('zh-CN');
      thread += `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--rule);">
        <div style="font-size:11px;color:var(--rouge);">${chatSettings.companionName} 的再回信 · ${brt}</div>
        <div style="font-size:13px;margin-top:6px;white-space:pre-line;">${l.botReplyContent}</div>
      </div>`;
    } else if(l.userReply && !l.botReplied && l.scheduledBotReplyAt){
      const eta = new Date(l.scheduledBotReplyAt).toLocaleString('zh-CN');
      thread += `<div style="margin-top:10px;font-size:12px;color:var(--ink-soft);">TA 还在写回信…大概 ${eta} 前会寄到</div>`;
    }
    // 还没回过：显示输入框
    let replyForm = '';
    if(!l.userReply){
      replyForm = `<div style="margin-top:12px;padding-top:10px;border-top:1px dashed var(--rule);">
        <textarea id="inboxReply_${l.id}" placeholder="给这封信写回信…" style="min-height:72px;"></textarea>
        <div class="btn-row"><div class="btn" onclick="replyToInboxLetter('${l.id}')">寄出回信</div></div>
      </div>`;
    }
    return `<div class="box">
      <div style="font-size:11px;color:var(--rouge);">${chatSettings.companionName} · ${t}</div>
      <div style="font-size:13px;margin-top:6px;white-space:pre-line;">${l.content}</div>
      ${thread}${replyForm}
    </div>`;
  }).join('') : '<div class="empty-note">TA 还没有主动寄过信来，什么时候想写全看TA自己</div>';
}
async function replyToInboxLetter(id){
  const l = inboxLetters.find(x=>x.id===id);
  if(!l || l.userReply) return;
  const inp = document.getElementById('inboxReply_'+id);
  if(!inp) return;
  const text = inp.value.trim();
  if(!text) return;
  const hours = 10 + Math.random()*14; // 10~24 小时，和写信回信一致
  l.userReply = text;
  l.userReplyTime = Date.now();
  l.botReplied = false;
  l.botReplyContent = null;
  l.botReplyTime = null;
  l.scheduledBotReplyAt = Date.now() + hours*3600*1000;
  await sSet('inbox-letters', inboxLetters);
  renderInboxLetters();
  scheduleInboxLetterBotReply(l.id, l.scheduledBotReplyAt - Date.now());
}
function scheduleInboxLetterBotReply(id, delayMs){
  setTimeout(async ()=>{
    const l = inboxLetters.find(x=>x.id===id);
    if(!l || l.botReplied || !l.userReply) return;
    const lineCount = 2 + Math.floor(Math.random()*3);
    const lines = [];
    for(let i=0;i<lineCount;i++){ const c = getRandomCardText(); if(c) lines.push(c); }
    if(lines.length===0) return;
    l.botReplyContent = lines.join('\n');
    l.botReplyTime = Date.now();
    l.botReplied = true;
    await sSet('inbox-letters', inboxLetters);
    if(currentView==='inboxLetters'){ renderInboxLetters(); }
    else{ inboxLetterUnread = true; await sSet('inbox-letter-unread', true); renderUnreadDots(); tryBgNotify(chatSettings.companionName+' 回信了', '点开查看回信'); }
  }, Math.max(0, delayMs));
}
function resumeInboxLetterReplyTimers(){
  inboxLetters.forEach(l=>{
    if(l.userReply && !l.botReplied && typeof l.scheduledBotReplyAt === 'number'){
      scheduleInboxLetterBotReply(l.id, l.scheduledBotReplyAt - Date.now());
    }
  });
}

/* ============================================================
   DIARY
   ============================================================ */
const DIARY_MOODS = ['😀','😊','🥰','😍','😌','🙂','🤔','🥲','😢','😭','😤','😡','😴','🤒','🥳','😎','🥺','😳','🫠','💔','💕','✨','🌸','☕','🌧️','☀️'];
let diaryUI = { year: new Date().getFullYear(), month: new Date().getMonth() };
function shiftDiaryMonth(delta){
  let y = diaryUI.year, m = diaryUI.month + delta;
  if(m < 0){ m = 11; y--; }
  if(m > 11){ m = 0; y++; }
  diaryUI.year = y; diaryUI.month = m;
  renderDiary();
}
function diaryKey(y,m,d){
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function diaryByDate(dateStr){
  return diaryEntries.filter(d=>d.date===dateStr);
}
function openDiaryDay(dateStr){
  const existing = diaryByDate(dateStr);
  const latest = existing[0];
  const curMood = latest ? latest.mood : '🙂';
  const moodOptions = DIARY_MOODS.map(m=>`<span class="chip diary-mood-chip" data-mood="${m}" onclick="selectDiaryMood(this)" style="font-size:20px;padding:6px 8px;${m===curMood?'background:var(--blush);border-color:var(--rouge);':''}">${m}</span>`).join('');
  openOverlay(`
    <div class="drawer-head"><h3>${dateStr}</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">今日心情</label>
    <div id="diaryMoodPicker" style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${moodOptions}</div>
    <input type="hidden" id="diaryMood" value="${curMood}">
    <label class="field">日记</label>
    <textarea id="diaryText" placeholder="写下这一天…" style="min-height:90px;"></textarea>
    <label class="field">今天吃了什么</label>
    <textarea id="diaryFood" placeholder="早餐 / 午餐 / 晚餐 / 零食…" style="min-height:56px;"></textarea>
    <div class="btn-row">
      <div class="btn" onclick="saveDiaryDay('${dateStr}')">保存</div>
      ${latest ? `<div class="btn outline" onclick="deleteDiary('${latest.id}')">删除</div>` : ''}
      <div class="btn outline" onclick="closeOverlay()">取消</div>
    </div>
  `);
  const ta = document.getElementById('diaryText');
  const food = document.getElementById('diaryFood');
  if(ta && latest) ta.value = latest.text || '';
  if(food && latest) food.value = latest.food || '';
}
function selectDiaryMood(el){
  document.querySelectorAll('.diary-mood-chip').forEach(c=>{ c.style.background=''; c.style.borderColor=''; });
  el.style.background = 'var(--blush)';
  el.style.borderColor = 'var(--rouge)';
  document.getElementById('diaryMood').value = el.dataset.mood;
}
async function saveDiaryDay(dateStr){
  const mood = document.getElementById('diaryMood').value || '🙂';
  const textVal = document.getElementById('diaryText').value.trim();
  const food = document.getElementById('diaryFood') ? document.getElementById('diaryFood').value.trim() : '';
  if(!textVal && !food){ alert('写点日记或记下吃了什么再保存吧'); return; }
  const existing = diaryByDate(dateStr);
  if(existing.length){
    existing[0].mood = mood;
    existing[0].text = textVal;
    existing[0].food = food;
  } else {
    diaryEntries.unshift({id:uid(), date: dateStr, mood, text: textVal, food});
  }
  await sSet('diary-entries', diaryEntries);
  closeOverlay();
  renderDiary();
}
async function addDiary(){ openDiaryDay(todayKey()); }
async function deleteDiary(id){
  diaryEntries = diaryEntries.filter(d=>d.id!==id);
  await sSet('diary-entries', diaryEntries);
  closeOverlay();
  renderDiary();
}
function renderDiary(){
  // 优先用陪伴记录里可见的日历，避免与隐藏主页面重复 id 抢元素
  const root = document.getElementById('companionBody') || document;
  const label = (root.querySelector && root.querySelector('#diaryMonthLabel')) || document.getElementById('diaryMonthLabel');
  if(label) label.textContent = `${diaryUI.year}年${diaryUI.month+1}月`;
  const grid = (root.querySelector && root.querySelector('#diaryCalendarGrid')) || document.getElementById('diaryCalendarGrid');
  if(!grid) return;
  const y = diaryUI.year, m = diaryUI.month;
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const today = todayKey();
  let html = '';
  for(let i=0;i<firstDow;i++) html += '<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const key = diaryKey(y,m,d);
    const entries = diaryByDate(key);
    const mood = entries[0] ? entries[0].mood : '';
    const isToday = key===today;
    const has = entries.length>0;
    html += `<div onclick="openDiaryDay('${key}')" style="
      aspect-ratio:1;border:1px solid ${isToday?'var(--rouge)':(has?'var(--ink)':'var(--rule)')};
      background:${has?'var(--blush)':(isToday?'var(--paper-2)':'var(--paper)')};
      border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;
      cursor:pointer;font-size:12px;padding:2px;">
      <div style="font-weight:${isToday?'700':'400'};">${d}</div>
      <div style="font-size:14px;line-height:1.1;min-height:16px;">${mood||''}</div>
    </div>`;
  }
  grid.innerHTML = html;
}

/* ============================================================
   SETTINGS
   ============================================================ */
document.addEventListener('DOMContentLoaded', ()=>{});
function fillSettingsForm(){
  if(typeof applyBgSettingsUI==='function') applyBgSettingsUI();
  document.getElementById('setName').value = profile.name;
  document.getElementById('setMyName').value = profile.myName || '';
  document.getElementById('setStatus').value = profile.status;
  const isImg = profile.avatar && profile.avatar.startsWith('data:');
  document.getElementById('setAvatar').value = isImg ? '' : (profile.avatar||'');
  const prev = document.getElementById('avatarPreviewSettings');
  prev.innerHTML = isImg
    ? `<div style="display:flex;align-items:center;gap:10px;"><img loading="lazy" decoding="async" src="${profile.avatar}" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:1.5px solid var(--ink);"><span class="btn outline" style="padding:6px 10px;font-size:11px;" onclick="clearAvatarImage()">改用 Emoji</span></div>`
    : '';
}
async function clearAvatarImage(){
  profile.avatar = '🌙';
  await sSet('profile', profile);
  renderHomeProfile();
  fillSettingsForm();
}
const _origGo = go;
go = function(name){ _origGo(name); if(name==='settings') fillSettingsForm(); if(name==='companion'){ loadCompanionData().then(()=>{ _compTab='todo'; switchCompanionTab('todo'); }); } };

async function saveProfile(){
  profile.name = document.getElementById('setName').value.trim() || profile.name;
  profile.myName = document.getElementById('setMyName').value.trim() || profile.myName || '我';
  profile.status = document.getElementById('setStatus').value.trim() || profile.status;
  const av = document.getElementById('setAvatar').value.trim();
  if(av) profile.avatar = av;
  await sSet('profile', profile);
  if(!chatSettings.companionName || chatSettings.companionName==='陆沉'){ /* keep independent */ }
  renderHomeProfile();
  alert('已保存');
}
async function resetAll(){
  if(!confirm('确定要清空全部数据吗？这个操作无法撤销。')) return;
  const keys = ['profile','chat-settings','chat-messages','cards-data','ledger-entries','period-entries','diary-entries','theme-settings','moments-posts','letters','inbox-letters','call-logs','proactive-state','chat-unread','letter-unread','inbox-letter-unread','moments-unread','life-photos','status-pool','today-status','today-status-history','custom-bubble-css','rec-store-migrated-v2','moyu-state','proactive-msg-settings','moment-interact-settings','splice-cards-enabled'];
  for(const k of keys){
    try{ if(hasCloudStorage()) await window.storage.delete(k, false); }catch(e){}
    try{ localStorage.removeItem('EVAN:'+k); }catch(e){}
  }
  for(const store of REC_STORES){
    try{ await recClear(store); }catch(e){}
  }
  location.reload();
}

/* ---- 导出/导入备份：不依赖自动保存是否生效，随时手动存一份到你自己的手机里 ---- */
async function exportBackup(){
  // 聊天记录/朋友圈/生活照片现在按需分页加载，内存里未必是完整历史，导出时单独整体读一次
  const [fullChat, fullMoments, fullPhotos] = await Promise.all([
    recGetAll('chatMessages'), recGetAll('momentsPosts'), recGetAll('lifePhotos')
  ]);
  const data = {
    profile, chatSettings, chatMessages: fullChat, cardsData, ledgerEntries, periodEntries,
    diaryEntries, momentsPosts: fullMoments, letters, inboxLetters, callLogs, themeSettings, proactiveState,
    lifePhotos: fullPhotos, statusPool, todayStatus, todayStatusHistory, customBubbleCSS, moyuState, proactiveMsgSettings, momentInteractSettings, spliceCardsEnabled,
    exportedAt: Date.now()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'EVAN-backup-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
}
function onImportBackupFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    let data;
    try{ data = JSON.parse(reader.result); }
    catch(err){ alert('这个备份文件解析失败，请确认是本网页导出的备份文件。'); return; }
    if(!confirm('导入备份会覆盖当前所有数据，确定要恢复吗？')) return;
    profile = data.profile || profile;
    chatSettings = data.chatSettings || chatSettings;
    const importedChat = data.chatMessages || [];
    cardsData = data.cardsData || {groups:{}};
    ledgerEntries = data.ledgerEntries || [];
    periodEntries = data.periodEntries || [];
    diaryEntries = data.diaryEntries || [];
    const importedMoments = data.momentsPosts || [];
    letters = data.letters || [];
    inboxLetters = data.inboxLetters || [];
    callLogs = data.callLogs || [];
    themeSettings = data.themeSettings || themeSettings;
    proactiveState = data.proactiveState || { nextMsgAt:null, nextLetterAt:null, nextCallAt:null, nextMomentAt:null, nextCareAt:null };
    const importedPhotos = data.lifePhotos || [];
    statusPool = data.statusPool || [];
    todayStatus = data.todayStatus || null;
    todayStatusHistory = data.todayStatusHistory || [];
    customBubbleCSS = data.customBubbleCSS || '';
    moyuState = data.moyuState || moyuState;
    proactiveMsgSettings = data.proactiveMsgSettings || proactiveMsgSettings;
    momentInteractSettings = data.momentInteractSettings || momentInteractSettings;
    if(typeof data.spliceCardsEnabled === 'boolean') spliceCardsEnabled = data.spliceCardsEnabled;
    await sSet('profile', profile);
    await sSet('chat-settings', chatSettings);
    await sSet('cards-data', cardsData);
    await sSet('ledger-entries', ledgerEntries);
    await sSet('period-entries', periodEntries);
    await sSet('diary-entries', diaryEntries);
    await sSet('letters', letters);
    await sSet('inbox-letters', inboxLetters);
    await sSet('call-logs', callLogs);
    await sSet('theme-settings', themeSettings);
    await sSet('proactive-state', proactiveState);
    await sSet('status-pool', statusPool);
    await sSet('today-status', todayStatus);
    await sSet('today-status-history', todayStatusHistory);
    await sSet('custom-bubble-css', customBubbleCSS);
            await sSet('moyu-state', moyuState);
    await sSet('proactive-msg-settings', proactiveMsgSettings);
    await sSet('moment-interact-settings', momentInteractSettings);
    await sSet('splice-cards-enabled', spliceCardsEnabled);
    // 恢复到各自专用的逐条记录表：先清空旧的，再把备份里的全部记录整体写进去
    await recClear('chatMessages'); await recPutMany('chatMessages', importedChat.map((m,i)=> m.time?m:{...m,time:Date.now()-(importedChat.length-i)}));
    await recClear('momentsPosts'); await recPutMany('momentsPosts', importedMoments.map((p,i)=> p.time?p:{...p,time:Date.now()-i}));
    await recClear('lifePhotos'); await recPutMany('lifePhotos', importedPhotos.map((p,i)=> ({...p,time:p.time||(Date.now()-i)})));
    pageState = { chatMessages:{exhausted:false}, momentsPosts:{exhausted:false}, lifePhotos:{exhausted:false} };
    chatMessages = await loadInitialPage('chatMessages');
    momentsPosts = await loadInitialPage('momentsPosts');
    lifePhotos = await loadInitialPage('lifePhotos');
    applyTheme();
    applyCustomBubbleCSSToPage();
    renderHomeProfile(); renderChat(); renderCardsView(); renderLedger(); renderPeriod();
    renderDiary(); renderBeautify(); renderMoments(); renderLetters();
    renderInboxLetters(); renderCallLog(); renderLifePhotos(); renderTodayStatusHome();
    resumeLetterTimers();
    resumeInboxLetterReplyTimers();
    resumeMoyuSchedule();
    renderMoyuHome();
        alert('恢复完成');
  };
  reader.readAsText(f, 'utf-8');
}

/* ============================================================
   BEAUTIFY / THEME
   ============================================================ */
function renderBeautify(){
  const wrap = document.getElementById('accentSwatches');
  if(wrap) wrap.innerHTML = ACCENTS.map(c=>`<div class="swatch" style="background:${c};" onclick="setAccent('${c}')"></div>`).join('');
  // 纸张颜色色块已彻底移除
  const cssInput = document.getElementById('bubbleCssInput');
  if(cssInput) cssInput.value = customBubbleCSS || '';
  // 同步文字颜色输入框
  const curInk = themeSettings.inkColor || '#2A241F';
  const picker = document.getElementById('inkColorPicker');
  const text = document.getElementById('inkColorText');
  if(picker) picker.value = (curInk.startsWith('#') && curInk.length<=7) ? curInk : '#2A241F';
  if(text) text.value = curInk;
  // 同步副字体 / 名字颜色
  const curName = themeSettings.nameColor || '#2A241F';
  const np = document.getElementById('nameColorPicker');
  const nt = document.getElementById('nameColorText');
  if(np) np.value = (curName.startsWith('#') && curName.length<=7) ? curName : '#2A241F';
  if(nt) nt.value = themeSettings.nameColor || '';
  updateFontPreviews();
}
async function setAccent(c){
  themeSettings.accent = c; await sSet('theme-settings', themeSettings); applyTheme();
}
async function setPaperStyle(style){
  themeSettings.paperStyle = style; await sSet('theme-settings', themeSettings); applyTheme();
}
async function setBodyFont(key){
  themeSettings.bodyFont = key; await sSet('theme-settings', themeSettings); applyTheme(); updateFontPreviews();
}
async function setSecondaryFont(key){
  themeSettings.secondaryFont = key; await sSet('theme-settings', themeSettings); applyTheme(); updateFontPreviews();
}
function updateFontPreviews(){
  const bodyPrev = document.getElementById('bodyFontPreview');
  const secPrev = document.getElementById('secondaryFontPreview');
  if(bodyPrev){
    bodyPrev.style.fontFamily = FONT_MAP[themeSettings.bodyFont] || FONT_MAP.sans;
    bodyPrev.style.color = themeSettings.inkColor || '';
  }
  if(secPrev){
    secPrev.style.fontFamily = FONT_MAP[themeSettings.secondaryFont] || FONT_MAP.serif;
    secPrev.style.color = themeSettings.nameColor || themeSettings.inkColor || '';
  }
  // 同步颜色预览框
  const inkPrev = document.getElementById('inkColorPreview');
  const namePrev = document.getElementById('nameColorPreview');
  if(inkPrev) inkPrev.style.color = themeSettings.inkColor || getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#2A241F';
  if(namePrev) namePrev.style.color = themeSettings.nameColor || themeSettings.inkColor || getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#2A241F';
}
function previewInkColor(val){
  const el = document.getElementById('inkColorPreview');
  const bodyPrev = document.getElementById('bodyFontPreview');
  const c = (val || '').trim() || '#2A241F';
  if(el) el.style.color = c;
  if(bodyPrev) bodyPrev.style.color = c;
  // 同步 color picker 如果是合法 hex
  const picker = document.getElementById('inkColorPicker');
  if(picker && /^#[0-9A-Fa-f]{6}$/.test(c)) picker.value = c;
}
function previewNameColor(val){
  const el = document.getElementById('nameColorPreview');
  const secPrev = document.getElementById('secondaryFontPreview');
  const c = (val || '').trim() || '#2A241F';
  if(el) el.style.color = c;
  if(secPrev) secPrev.style.color = c;
  const picker = document.getElementById('nameColorPicker');
  if(picker && /^#[0-9A-Fa-f]{6}$/.test(c)) picker.value = c;
}
async function setInkColor(){
  const text = document.getElementById('inkColorText');
  const val = (text && text.value || '').trim();
  themeSettings.inkColor = val;
  await sSet('theme-settings', themeSettings);
  applyTheme();
  updateFontPreviews();
  renderBeautify();
}
async function resetInkColor(){
  themeSettings.inkColor = '';
  await sSet('theme-settings', themeSettings);
  applyTheme();
  updateFontPreviews();
  renderBeautify();
}
async function setNameColor(){
  const text = document.getElementById('nameColorText');
  const val = (text && text.value || '').trim();
  themeSettings.nameColor = val;
  await sSet('theme-settings', themeSettings);
  applyTheme();
  updateFontPreviews();
  renderBeautify();
}
async function resetNameColor(){
  themeSettings.nameColor = '';
  await sSet('theme-settings', themeSettings);
  applyTheme();
  updateFontPreviews();
  renderBeautify();
}
async function resetAppearance(){
  themeSettings = { accent:'#9C2F3B', paperStyle:'grid', bodyFont:'sans', secondaryFont:'serif', inkColor:'', nameColor:'', customBg:'', customBgImage:'', annivBg:'', annivBgImage:'' };
  customBubbleCSS = '';
  await sSet('theme-settings', themeSettings);
  await sSet('custom-bubble-css', customBubbleCSS);
  applyTheme(); applyCustomBubbleCSSToPage(); renderBeautify();
}
function applyTheme(){
  document.documentElement.style.setProperty('--rouge', themeSettings.accent);
  document.documentElement.style.setProperty('--rouge-deep', themeSettings.accent);
  document.documentElement.style.setProperty('--font-body', FONT_MAP[themeSettings.bodyFont] || FONT_MAP.sans);
  document.documentElement.style.setProperty('--font-secondary', FONT_MAP[themeSettings.secondaryFont] || FONT_MAP.serif);
  // 正文颜色
  if(themeSettings.inkColor){
    document.documentElement.style.setProperty('--ink', themeSettings.inkColor);
    document.documentElement.style.setProperty('--ink-soft', themeSettings.inkColor);
  } else {
    document.documentElement.style.removeProperty('--ink');
    document.documentElement.style.removeProperty('--ink-soft');
  }
  // 名字 / 状态颜色
  if(themeSettings.nameColor){
    document.documentElement.style.setProperty('--name-color', themeSettings.nameColor);
  } else {
    document.documentElement.style.removeProperty('--name-color');
  }
  // 不再应用「纸张颜色」预设（lavender/blush/sky 等），避免整页出现紫色/彩色纯色填充；
  // 始终回退到 CSS :root 默认 cream。
  // 自定义背景图 / 自定义纯色背景 功能完整保留。
  document.documentElement.style.removeProperty('--paper');
  document.documentElement.style.removeProperty('--paper-2');
  document.body.classList.remove('paper-plain','paper-dot');
  if(themeSettings.paperStyle==='plain') document.body.classList.add('paper-plain');
  if(themeSettings.paperStyle==='dot') document.body.classList.add('paper-dot');
  // 页面背景：优先图片（1px 轻微模糊），其次自定义纯色
  if(themeSettings.customBgImage){
    document.body.style.setProperty('--page-bg-image', 'url(' + themeSettings.customBgImage + ')');
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = 'transparent';
  } else if(themeSettings.customBg){
    document.body.style.removeProperty('--page-bg-image');
    document.body.style.backgroundImage = 'none';
    document.body.style.backgroundColor = themeSettings.customBg;
  } else {
    document.body.style.removeProperty('--page-bg-image');
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '';
  }
  const ac = document.querySelector('.anniv-card');
  if(ac){
    // 先清掉旧的内联样式，再按优先级重设
    ac.removeAttribute('style');
    if(themeSettings.annivBgImage){
      ac.style.backgroundImage = 'url(' + themeSettings.annivBgImage + ')';
      ac.style.backgroundSize = 'cover';
      ac.style.backgroundPosition = 'center';
      ac.style.backgroundColor = 'transparent';
    } else if(themeSettings.annivBg){
      ac.style.background = themeSettings.annivBg;
    }
  }
  applyChatBackground();
}

/* ---- 气泡自定义 CSS：粘贴现成皮肤代码，自动套用到 .message-received / .message-sent ---- */
async function applyCustomBubbleCSS(){
  const val = document.getElementById('bubbleCssInput').value;
  customBubbleCSS = val;
  await sSet('custom-bubble-css', customBubbleCSS);
  applyCustomBubbleCSSToPage();
}
async function clearCustomBubbleCSS(){
  customBubbleCSS = '';
  const el = document.getElementById('bubbleCssInput');
  if(el) el.value = '';
  await sSet('custom-bubble-css', customBubbleCSS);
  applyCustomBubbleCSSToPage();
}
function applyCustomBubbleCSSToPage(){
  let styleEl = document.getElementById('customBubbleStyleTag');
  if(!styleEl){
    styleEl = document.createElement('style');
    styleEl.id = 'customBubbleStyleTag';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = customBubbleCSS || '';
}

/* ============================================================
   摸鱼小记：活动 / 地点字卡 + 随机时间线（当前班次 + 历史）
   ============================================================ */
function renderMoyuHome(){
  const el = document.getElementById('moyuLatestText');
  if(!el) return;
  // 首页只展示系统实际生成的最新摸鱼记录；没有记录时显示占位文案（与参考图一致）。
  const sess = moyuState.currentSession;
  const latest = sess && sess.records && sess.records.length
    ? sess.records[sess.records.length-1]
    : null;
  if(latest && latest.text){
    el.textContent = latest.text;
    el.style.color = '';
  } else {
    el.textContent = '[暂无记录]';
    el.style.color = 'var(--ink-soft)';
  }
}
function pickMoyuActivity(){
  const acts = moyuState.activities || [];
  if(!acts.length) return null;
  return acts[Math.floor(Math.random()*acts.length)];
}
function pickMoyuLocation(){
  const locs = moyuState.locations || [];
  if(!locs.length) return '未知地点';
  return locs[Math.floor(Math.random()*locs.length)];
}
function formatDurationShort(ms){
  const h = Math.floor(ms/3600000);
  const m = Math.floor((ms%3600000)/60000);
  if(h<=0) return m + '分钟';
  if(m<=0) return h + 'h';
  return h + 'h';
}
function formatRemain(ms){
  if(ms <= 0) return '已下班';
  const h = Math.floor(ms/3600000);
  const m = Math.floor((ms%3600000)/60000);
  if(h>0) return '剩余工作时间 ' + h + '小时' + m + '分钟';
  return '剩余工作时间 ' + m + '分钟';
}
function scheduleNextMoyu(){
  // 纯随机：5 分钟 ~ 3 天，什么时候想摸就什么时候摸
  moyuState.nextAt = Date.now() + randomBetween(5*60*1000, 3*24*3600*1000);
}
async function startMoyuSession(){
  if(!moyuState.enabled) return;
  const hasActs = (moyuState.activities||[]).length > 0;
  const hasLocs = (moyuState.locations||[]).length > 0;
  if(!hasActs && !hasLocs) return;
  // 先把上一班归档
  if(moyuState.currentSession){
    if(!moyuState.history) moyuState.history = [];
    moyuState.history.unshift(moyuState.currentSession);
    if(moyuState.history.length > 30) moyuState.history = moyuState.history.slice(0,30);
  }
  const workMs = randomBetween(2*3600*1000, 8*3600*1000); // 2~8 小时一班
  moyuState.currentSession = {
    id: uid(),
    location: pickMoyuLocation(),
    startTime: Date.now(),
    workMs,
    records: []
  };
  // 开班先记一条活动
  const first = pickMoyuActivity();
  if(first){
    moyuState.currentSession.records.push({ id:uid(), text:first, time: Date.now() });
  }
  scheduleNextMoyu();
  await sSet('moyu-state', moyuState);
  renderMoyuHome();
}
async function generateMoyuRecord(){
  if(!moyuState.enabled) return;
  if(!(moyuState.activities||[]).length && !(moyuState.locations||[]).length){
    scheduleNextMoyu();
    await sSet('moyu-state', moyuState);
    return;
  }
  if(!moyuState.currentSession){
    await startMoyuSession();
    return;
  }
  const sess = moyuState.currentSession;
  const elapsed = Date.now() - sess.startTime;
  // 下班了就开新班
  if(elapsed >= sess.workMs){
    await startMoyuSession();
    return;
  }
  const text = pickMoyuActivity();
  if(text){
    sess.records.push({ id:uid(), text, time: Date.now() });
    if(sess.records.length > 40) sess.records = sess.records.slice(-40);
  }
  scheduleNextMoyu();
  await sSet('moyu-state', moyuState);
  renderMoyuHome();
  if(document.getElementById('moyuNoteBody')) renderMoyuNotePanelBody();
}
function resumeMoyuSchedule(){
  if(!moyuState.enabled) return;
  if(!moyuState.currentSession){
    // 有字卡才自动开班
    if((moyuState.activities||[]).length || (moyuState.locations||[]).length){
      startMoyuSession();
    }
    return;
  }
  if(!moyuState.nextAt){ scheduleNextMoyu(); sSet('moyu-state', moyuState); }
}
async function checkMoyuTick(){
  if(!moyuState.enabled) return;
  if(moyuState.nextAt && Date.now() >= moyuState.nextAt){
    await generateMoyuRecord();
  } else if(!moyuState.nextAt){
    scheduleNextMoyu();
    await sSet('moyu-state', moyuState);
  }
}

function openMoyuNotePanel(){
  openOverlay(`
    <div class="drawer-head"><h3>🐟 摸鱼小记</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <div class="btn-row" style="margin-bottom:10px;">
      <div class="btn" id="moyuTabCurrent" onclick="switchMoyuNoteTab('current')">🕐 当前</div>
      <div class="btn outline" id="moyuTabHistory" onclick="switchMoyuNoteTab('history')">☰ 记录</div>
      <div class="btn outline" onclick="closeOverlay(); openMoyuManagePanel();">管理字卡</div>
    </div>
    <div id="moyuNoteBody"></div>
  `);
  switchMoyuNoteTab('current');
}
function switchMoyuNoteTab(tab){
  const curBtn = document.getElementById('moyuTabCurrent');
  const hisBtn = document.getElementById('moyuTabHistory');
  if(curBtn){ curBtn.className = 'btn' + (tab==='current'?'':' outline'); }
  if(hisBtn){ hisBtn.className = 'btn' + (tab==='history'?'':' outline'); }
  renderMoyuNotePanelBody(tab);
}
function renderSessionCard(sess, isCurrent){
  if(!sess) return '';
  const show = moyuState.showDetails !== false;
  const dateStr = new Date(sess.startTime).toLocaleDateString('zh-CN');
  const remain = isCurrent ? (sess.workMs - (Date.now()-sess.startTime)) : 0;
  const badge = formatDurationShort(sess.workMs);
  let recordsHtml = '';
  if(show){
    const list = (sess.records||[]).slice().reverse();
    if(!list.length){
      recordsHtml = '<div class="empty-note" style="padding:12px 0;">这一班还没有活动记录</div>';
    } else {
      recordsHtml = list.map(r=>{
        const t = new Date(r.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
        return `<div style="border:1px solid var(--rule);background:var(--glass-bg);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);padding:10px 12px;margin-top:8px;border-radius:2px;">
          <div style="font-size:11px;color:var(--ink-soft);">🕐 ${t}</div>
          <div style="margin-top:4px;font-size:13.5px;">${r.text}</div>
        </div>`;
      }).join('');
    }
  } else {
    recordsHtml = `<div style="margin-top:10px;padding:12px;border:1px dashed var(--rule);color:var(--ink-soft);font-size:12.5px;text-align:center;">具体信息已隐藏</div>`;
  }
  return `<div class="box" style="margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-family:'Noto Serif SC',serif;font-weight:700;font-size:15px;">📍 ${sess.location||'未知地点'}</div>
      <span class="stamp-tag" style="transform:none;">🕐 ${badge}</span>
    </div>
    <div style="font-size:11.5px;color:var(--ink-soft);margin-top:6px;">📅 ${dateStr}</div>
    ${isCurrent ? `<div style="margin-top:10px;padding:8px 10px;background:var(--blush);border:1px solid var(--rule);font-size:12.5px;text-align:center;">⏳ ${formatRemain(remain)}</div>` : ''}
    ${recordsHtml}
  </div>`;
}
function renderMoyuNotePanelBody(tab){
  const body = document.getElementById('moyuNoteBody');
  if(!body) return;
  if(tab===undefined) tab = 'current';
  if(!moyuState.enabled){
    body.innerHTML = `<div class="empty-note">摸鱼记录尚未开启<br><span style="font-size:11.5px;">请在「传讯 → 设置」里打开「主动向我汇报工作」</span></div>
      <div class="btn-row" style="margin-top:12px;"><div class="btn" onclick="closeOverlay(); openChatSettings();">去传讯设置</div></div>`;
    return;
  }
  const emptyCards = !(moyuState.activities||[]).length && !(moyuState.locations||[]).length;
  if(emptyCards){
    body.innerHTML = `<div class="empty-note">还没有摸鱼活动 / 工作地点字卡<br><span style="font-size:11.5px;">先去管理里添加，系统才会自动生成记录</span></div>
      <div class="btn-row" style="margin-top:12px;"><div class="btn" onclick="closeOverlay(); openMoyuManagePanel();">去添加字卡</div></div>`;
    return;
  }
  if(tab==='current'){
    if(!moyuState.currentSession){
      body.innerHTML = `<div class="empty-note">暂无当前摸鱼记录</div>
        <div class="btn-row"><div class="btn outline" onclick="startMoyuSession().then(()=>renderMoyuNotePanelBody('current'))">开始一班</div></div>`;
    } else {
      body.innerHTML = `<div style="text-align:center;margin-bottom:8px;"><span class="stamp-tag">当前摸鱼记录</span></div>
        ${renderSessionCard(moyuState.currentSession, true)}
        <div class="btn-row"><div class="btn outline" onclick="generateMoyuRecord()">立即摸一条</div></div>`;
    }
  } else {
    const hist = moyuState.history || [];
    if(!hist.length){
      body.innerHTML = '<div class="empty-note">还没有历史班次</div>';
    } else {
      body.innerHTML = hist.map(s=>renderSessionCard(s, false)).join('') +
        `<div class="btn-row" style="margin-top:10px;"><div class="btn outline" onclick="clearMoyuHistory()">清空历史</div></div>`;
    }
  }
}
async function clearMoyuHistory(){
  if(!confirm('确定清空全部历史摸鱼记录吗？')) return;
  moyuState.history = [];
  await sSet('moyu-state', moyuState);
  renderMoyuNotePanelBody('history');
}

let _moyuManageTab = 'activities';
function openMoyuManagePanel(){
  _moyuManageTab = 'activities';
  openOverlay(`
    <div class="drawer-head"><h3>🐟 摸鱼管理</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <div class="btn-row" style="margin-bottom:10px;">
      <div class="btn" id="moyuMTabAct" onclick="switchMoyuManageTab('activities')">摸鱼活动</div>
      <div class="btn outline" id="moyuMTabLoc" onclick="switchMoyuManageTab('locations')">工作地点</div>
    </div>
    <div id="moyuManageBody"></div>
  `);
  renderMoyuManageBody();
}
function switchMoyuManageTab(tab){
  _moyuManageTab = tab;
  const a = document.getElementById('moyuMTabAct');
  const l = document.getElementById('moyuMTabLoc');
  if(a) a.className = 'btn' + (tab==='activities'?'':' outline');
  if(l) l.className = 'btn' + (tab==='locations'?'':' outline');
  renderMoyuManageBody();
}
function renderMoyuManageBody(){
  const body = document.getElementById('moyuManageBody');
  if(!body) return;
  const isAct = _moyuManageTab === 'activities';
  const list = isAct ? (moyuState.activities||[]) : (moyuState.locations||[]);
  const label = isAct ? '摸鱼活动' : '工作地点';
  body.innerHTML = `
    <div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:8px;">当前「${label}」共 ${list.length} 条。</div>
    <label class="field">批量添加（每行一条）</label>
    <textarea id="moyuBulkInput" placeholder="${isAct ? '超市扫荡&#10;陪你&#10;边工作边想你' : '天行&#10;花店&#10;咖啡馆'}" style="min-height:80px;"></textarea>
    <div class="btn-row">
      <div class="btn" onclick="addMoyuBulk()">添加</div>
      <div class="btn outline" onclick="document.getElementById('moyuFileInput').click()">📁 导入文件</div>
    </div>
    <input type="file" id="moyuFileInput" accept=".txt,.json" class="hidden" onchange="onMoyuFile(event)">
    <div style="margin-top:12px;">
      ${list.length ? list.map((t,i)=>`<span class="card-pill">${t}<span class="del" style="margin-left:6px;" onclick="deleteMoyuItem(${i})">✕</span></span>`).join('') : '<div class="empty-note">列表空空如也</div>'}
    </div>
    <div class="btn-row" style="margin-top:14px;">
      <input type="text" id="moyuSingleInput" placeholder="单条新增…" style="flex:1;">
      <div class="btn outline" style="padding:8px 12px;" onclick="addMoyuSingle()">＋ 新增</div>
    </div>
  `;
}
async function addMoyuBulk(){
  const raw = document.getElementById('moyuBulkInput');
  if(!raw) return;
  const lines = raw.value.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return;
  const key = _moyuManageTab === 'activities' ? 'activities' : 'locations';
  if(!moyuState[key]) moyuState[key] = [];
  lines.forEach(l=>{ if(!moyuState[key].includes(l)) moyuState[key].push(l); });
  raw.value = '';
  await sSet('moyu-state', moyuState);
  renderMoyuManageBody();
}
async function addMoyuSingle(){
  const inp = document.getElementById('moyuSingleInput');
  if(!inp) return;
  const val = inp.value.trim();
  if(!val) return;
  const key = _moyuManageTab === 'activities' ? 'activities' : 'locations';
  if(!moyuState[key]) moyuState[key] = [];
  if(!moyuState[key].includes(val)) moyuState[key].push(val);
  inp.value = '';
  await sSet('moyu-state', moyuState);
  renderMoyuManageBody();
}
async function deleteMoyuItem(i){
  const key = _moyuManageTab === 'activities' ? 'activities' : 'locations';
  if(!moyuState[key]) return;
  moyuState[key].splice(i, 1);
  await sSet('moyu-state', moyuState);
  renderMoyuManageBody();
}
function onMoyuFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    let lines = [];
    try{
      const parsed = JSON.parse(reader.result);
      if(Array.isArray(parsed)) lines = parsed.map(x=> typeof x==='string'?x:(x&&(x.text||x.content||''))).filter(Boolean);
      else if(parsed && typeof parsed==='object'){
        const arr = parsed.items || parsed.list || parsed.cards || parsed[_moyuManageTab] || [];
        if(Array.isArray(arr)) lines = arr.map(x=> typeof x==='string'?x:(x&&(x.text||x.content||''))).filter(Boolean);
      }
    }catch(err){
      lines = String(reader.result).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    }
    if(!lines.length){ alert('没有识别到内容'); return; }
    const key = _moyuManageTab === 'activities' ? 'activities' : 'locations';
    if(!moyuState[key]) moyuState[key] = [];
    lines.forEach(l=>{ if(!moyuState[key].includes(l)) moyuState[key].push(l); });
    await sSet('moyu-state', moyuState);
    renderMoyuManageBody();
  };
  reader.readAsText(f, 'utf-8');
}

/* ============================================================
   OVERLAY HELPERS
   ============================================================ */
function openOverlay(html){
  const root = document.getElementById('overlayRoot');
  root.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeOverlay()"><div class="drawer">${html}</div></div>`;
}
function closeOverlay(){ document.getElementById('overlayRoot').innerHTML=''; }

/* ============================================================
   COMPANION 陪伴记录：待办 / 习惯 / 纪念日 / 月经
   ============================================================ */
let companionTodos = [];
let companionHabits = [];
let companionAnnivs = [];
let _compTab = 'todo';

async function loadCompanionData(){
  companionTodos = await sGet('companion-todos', []);
  companionHabits = await sGet('companion-habits', []);
  companionAnnivs = await sGet('companion-annivs', []);
}
function switchCompanionTab(tab){
  _compTab = tab;
  const map = {todo:'compTabTodo', habit:'compTabHabit', diary:'compTabDiary', anniv:'compTabAnniv', period:'compTabPeriod'};
  Object.keys(map).forEach(t=>{
    const el = document.getElementById(map[t]);
    if(el) el.className = 'btn' + (t===tab ? '' : ' outline');
  });
  renderCompanionBody();
}
function renderCompanionBody(){
  const body = document.getElementById('companionBody');
  if(!body) return;
  if(_compTab === 'todo'){
    body.innerHTML = `
      <div class="box">
        <div class="box-title">待办事项</div>
        <div id="compTodoList"></div>
        <div class="pet-add-row" style="margin-top:10px;">
          <input type="text" id="compTodoInput" placeholder="添加待办…">
          <div class="go-btn" onclick="addCompanionTodo()">+添加</div>
        </div>
      </div>`;
    const list = document.getElementById('compTodoList');
    if(!companionTodos.length) list.innerHTML = '<div class="empty-note">还没有待办事项</div>';
    else list.innerHTML = companionTodos.map((t,i)=>`
      <div class="pet-task-item">
        <div class="pet-check ${t.done?'on':''}" onclick="toggleCompanionTodo(${i})"></div>
        <span class="${t.done?'done':''}">${t.text}</span>
        <span class="pet-task-del" onclick="delCompanionTodo(${i})">删除</span>
      </div>`).join('');
  } else if(_compTab === 'habit'){
    body.innerHTML = `
      <div class="box">
        <div class="box-title">习惯打卡</div>
        <div id="compHabitList"></div>
        <div class="pet-add-row" style="margin-top:10px;">
          <input type="text" id="compHabitInput" placeholder="添加习惯…">
          <div class="go-btn" onclick="addCompanionHabit()">+添加</div>
        </div>
      </div>`;
    const list = document.getElementById('compHabitList');
    if(!companionHabits.length) list.innerHTML = '<div class="empty-note">还没有习惯</div>';
    else list.innerHTML = companionHabits.map((h,i)=>`
      <div class="pet-task-item">
        <div class="pet-check ${h.doneToday?'on':''}" onclick="toggleCompanionHabit(${i})"></div>
        <span>${h.text}</span>
        <span class="pet-task-del" onclick="delCompanionHabit(${i})">删除</span>
      </div>`).join('');
  } else if(_compTab === 'anniv'){
    body.innerHTML = `
      <div class="box">
        <div class="box-title">纪念日列表</div>
        <div id="compAnnivList"></div>
        <label class="field">名称</label>
        <input type="text" id="compAnnivName" placeholder="例如：在一起纪念日">
        <label class="field">日期</label>
        <input type="date" id="compAnnivDate">
        <div class="btn-row"><div class="btn" onclick="addCompanionAnniv()">添加纪念日</div></div>
      </div>`;
    const list = document.getElementById('compAnnivList');
    if(!companionAnnivs.length) list.innerHTML = '<div class="empty-note">还没有额外纪念日（首页置顶的在一起天数单独设置）</div>';
    else list.innerHTML = companionAnnivs.map((a,i)=>{
      const d = new Date(a.date);
      const days = Math.floor((Date.now()-d.getTime())/86400000);
      return `<div class="list-item"><div><b>${a.name}</b><div class="meta">${a.date} · 已过 ${days} 天</div></div><span class="del" onclick="delCompanionAnniv(${i})">✕</span></div>`;
    }).join('');
  } else if(_compTab === 'diary'){
    body.innerHTML = `
      <div class="box" style="padding:12px 10px;">
        <div style="display:flex;align-items:center;justify-content:center;gap:18px;margin-bottom:10px;">
          <span class="icon-btn" style="width:32px;height:32px;font-size:14px;" onclick="shiftDiaryMonth(-1)">‹</span>
          <span id="diaryMonthLabel" style="font-family:'Noto Serif SC',serif;font-weight:700;font-size:15px;">—</span>
          <span class="icon-btn" style="width:32px;height:32px;font-size:14px;" onclick="shiftDiaryMonth(1)">›</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;font-size:11px;color:var(--ink-soft);margin-bottom:4px;">
          <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
        </div>
        <div id="diaryCalendarGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;"></div>
      </div>
      <p style="font-size:12px;color:var(--ink-soft);text-align:center;margin:10px 0 0;">点某一天，写下心情、日记和今天吃了什么</p>`;
    renderDiary();
  } else if(_compTab === 'period'){
    body.innerHTML = `
      <div class="box">
        <div class="box-title">月经记录与预测</div>
        <div id="periodList"></div>
        <div id="periodPredict" style="margin:10px 0;font-size:13px;color:var(--ink-soft);"></div>
        <label class="field">记录开始日期</label>
        <input type="date" id="periodDate">
        <div class="btn-row"><div class="btn" onclick="addPeriod()">添加记录</div></div>
      </div>`;
    renderPeriod();
  }
}
async function addCompanionTodo(){
  const inp = document.getElementById('compTodoInput');
  const val = (inp&&inp.value||'').trim(); if(!val) return;
  companionTodos.push({id:uid(), text:val, done:false});
  await sSet('companion-todos', companionTodos);
  renderCompanionBody();
}
async function toggleCompanionTodo(i){
  companionTodos[i].done = !companionTodos[i].done;
  await sSet('companion-todos', companionTodos);
  renderCompanionBody();
}
async function delCompanionTodo(i){
  companionTodos.splice(i,1);
  await sSet('companion-todos', companionTodos);
  renderCompanionBody();
}
async function addCompanionHabit(){
  const inp = document.getElementById('compHabitInput');
  const val = (inp&&inp.value||'').trim(); if(!val) return;
  companionHabits.push({id:uid(), text:val, doneToday:false});
  await sSet('companion-habits', companionHabits);
  renderCompanionBody();
}
async function toggleCompanionHabit(i){
  companionHabits[i].doneToday = !companionHabits[i].doneToday;
  await sSet('companion-habits', companionHabits);
  renderCompanionBody();
}
async function delCompanionHabit(i){
  companionHabits.splice(i,1);
  await sSet('companion-habits', companionHabits);
  renderCompanionBody();
}
async function addCompanionAnniv(){
  const name = (document.getElementById('compAnnivName')||{}).value||''.trim();
  const date = (document.getElementById('compAnnivDate')||{}).value;
  if(!name || !date){ alert('请填写名称和日期'); return; }
  companionAnnivs.push({id:uid(), name, date});
  await sSet('companion-annivs', companionAnnivs);
  renderCompanionBody();
}
async function delCompanionAnniv(i){
  companionAnnivs.splice(i,1);
  await sSet('companion-annivs', companionAnnivs);
  renderCompanionBody();
}



async function editAnnivCardBg(){
  const cur = themeSettings.annivBg || '#F5E6D3';
  openOverlay(`
    <div class="drawer-head"><h3>纪念日卡片背景</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">颜色</label>
    <div style="display:flex;gap:10px;align-items:center;">
      <input type="color" id="annivBgColorPicker" value="${cur.startsWith('#')&&cur.length<=7?cur:'#F5E6D3'}" style="width:48px;height:36px;border:1px solid var(--ink);padding:0;">
      <input type="text" id="annivBgColorText" value="${cur}" placeholder="#F5E6D3 或 linear-gradient(...)" style="flex:1;">
    </div>
    <div class="btn-row" style="margin-top:14px;">
      <div class="btn" onclick="confirmAnnivBgColor()">应用</div>
      <div class="btn outline" onclick="document.getElementById('annivBgColorText').value='';confirmAnnivBgColor();">清除颜色</div>
    </div>
  `);
  const picker = document.getElementById('annivBgColorPicker');
  const text = document.getElementById('annivBgColorText');
  if(picker && text){
    picker.oninput = ()=>{ text.value = picker.value; };
  }
}
async function confirmAnnivBgColor(){
  const text = document.getElementById('annivBgColorText');
  themeSettings.annivBg = (text && text.value || '').trim();
  await sSet('theme-settings', themeSettings);
  applyTheme();
  closeOverlay();
}
async function editCustomBg(){
  const cur = themeSettings.customBg || '#F3EEE3';
  openOverlay(`
    <div class="drawer-head"><h3>自定义背景颜色</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">颜色</label>
    <div style="display:flex;gap:10px;align-items:center;">
      <input type="color" id="customBgColorPicker" value="${cur.startsWith('#')&&cur.length<=7?cur:'#F3EEE3'}" style="width:48px;height:36px;border:1px solid var(--ink);padding:0;">
      <input type="text" id="customBgColorText" value="${cur}" placeholder="#F3EEE3 或留空" style="flex:1;">
    </div>
    <div class="btn-row" style="margin-top:14px;">
      <div class="btn" onclick="confirmCustomBgColor()">应用</div>
      <div class="btn outline" onclick="document.getElementById('customBgColorText').value='';confirmCustomBgColor();">清除颜色</div>
    </div>
  `);
  const picker = document.getElementById('customBgColorPicker');
  const text = document.getElementById('customBgColorText');
  if(picker && text){
    picker.oninput = ()=>{ text.value = picker.value; };
  }
}
async function confirmCustomBgColor(){
  const text = document.getElementById('customBgColorText');
  themeSettings.customBg = (text && text.value || '').trim();
  await sSet('theme-settings', themeSettings);
  applyTheme();
  closeOverlay();
}
async function onCustomBgImage(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    themeSettings.customBgImage = await compressImage(reader.result, 1400); // 背景图铺满全屏，压缩上限比头像类图片宽一些，避免糊
    await sSet('theme-settings', themeSettings);
    applyTheme();
    alert('背景图已应用');
  };
  reader.readAsDataURL(f);
  e.target.value = '';
}
async function clearCustomBg(){
  themeSettings.customBg = '';
  themeSettings.customBgImage = '';
  await sSet('theme-settings', themeSettings);
  applyTheme();
}
async function onAnnivBgImage(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    themeSettings.annivBgImage = await compressImage(reader.result, 1400); // 同样压缩，避免原图直接存进 IndexedDB
    await sSet('theme-settings', themeSettings);
    applyTheme();
    alert('纪念日卡片背景图已应用');
  };
  reader.readAsDataURL(f);
  e.target.value = '';
}
async function clearAnnivCardBg(){
  themeSettings.annivBg = '';
  themeSettings.annivBgImage = '';
  await sSet('theme-settings', themeSettings);
  applyTheme();
}



/* ============================================================
   缺失函数补全：头像 / 情侣照片 / 搜索
   ============================================================ */
async function onAvatarFile(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      profile.avatar = await compressImage(reader.result, 400);
      await sSet('profile', profile);
      renderHomeProfile();
      if(typeof fillSettingsForm === 'function') fillSettingsForm();
      alert('头像已更新');
    }catch(err){ console.error(err); alert('头像上传失败'); }
  };
  reader.readAsDataURL(f);
  e.target.value = '';
}
async function onPhotoUpload(e){
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      profile.photo = await compressImage(reader.result, 900);
      await sSet('profile', profile);
      renderHomeProfile();
      alert('照片已更新');
    }catch(err){ console.error(err); alert('照片上传失败'); }
  };
  reader.readAsDataURL(f);
  e.target.value = '';
}
async function doSearch(){
  const inp = document.getElementById('searchInput');
  const box = document.getElementById('searchResults');
  if(!inp || !box) return;
  const q = (inp.value || '').trim();
  if(!q){ box.innerHTML = '<div class="empty-note" style="padding:8px 0;">输入关键词后搜索</div>'; return; }
  box.innerHTML = '<div style="padding:8px 0;color:var(--ink-soft);font-size:12.5px;">搜索中…</div>';
  try{
    const allChat = await recGetAll('chatMessages');
    const hits = [];
    allChat.forEach(m=>{
      if(m.type==='text' && m.content && m.content.includes(q)){
        const who = m.from==='user' ? (profile.myName||'我') : (chatSettings.companionName||'TA');
        const preview = m.content.length>48 ? m.content.slice(0,48)+'…' : m.content;
        hits.push({who, preview, time:m.time});
      }
    });
    // also search diary
    (diaryEntries||[]).forEach(d=>{
      const text = ((d.text||'')+' '+(d.food||'')).trim();
      if(text.includes(q)){
        hits.push({who:'日记 '+d.date, preview: text.slice(0,48), time:0});
      }
    });
    if(!hits.length){
      box.innerHTML = '<div class="empty-note" style="padding:8px 0;">没有找到相关回忆</div>';
      return;
    }
    box.innerHTML = hits.slice(0,40).map(h=>
      `<div class="hit"><b>${h.who}</b>：${h.preview}</div>`
    ).join('') + (hits.length>40?`<div style="font-size:11px;color:var(--ink-soft);padding:6px 0;">仅显示前40条</div>`:'');
  }catch(err){
    console.error(err);
    box.innerHTML = '<div class="empty-note">搜索失败</div>';
  }
}


/* ============================================================
   TAROT 正规经典牌阵 + 模型解读（原文件风格）
   ============================================================ */
