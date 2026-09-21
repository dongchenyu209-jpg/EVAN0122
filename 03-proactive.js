function randomBetween(minMs, maxMs){ return minMs + Math.random()*(maxMs-minMs); }
function scheduleNextProactiveMsg(){
  if(proactiveMsgSettings.enabled === false){
    proactiveState.nextMsgAt = null;
    if(typeof _proactiveMsgTimer !== 'undefined' && _proactiveMsgTimer){ clearTimeout(_proactiveMsgTimer); _proactiveMsgTimer = null; }
    return;
  }
  // 单滑条：1～intervalMinutes（上限 120）分钟内随机
  const hi = Math.max(1, Math.min(120, Number(proactiveMsgSettings.intervalMinutes) || 60));
  proactiveState.nextMsgAt = Date.now() + randomBetween(1*60*1000, hi*60*1000);
}
function scheduleNextProactiveLetter(){
  proactiveState.nextLetterAt = Date.now() + randomBetween(1*3600*1000, 10*24*3600*1000);
}
function scheduleNextProactiveCall(){
  proactiveState.nextCallAt = Date.now() + randomBetween(5*60*1000, 4*24*3600*1000);
}
function ensureProactiveSchedule(){
  // 刷新重算：不接着上次剩余时间，每次启动都重新随机排程
  if(proactiveMsgSettings.enabled !== false){
    scheduleNextProactiveMsg();
  } else {
    proactiveState.nextMsgAt = null;
  }
  scheduleNextProactiveLetter();
  scheduleNextProactiveCall();
  scheduleNextProactiveMoment();
  sSet('proactive-state', proactiveState);
}

/* 不用轮询：按 next*At 直接 setTimeout */
let _proactiveMsgTimer = null;
let _proactiveLetterTimer = null;
let _proactiveCallTimer = null;
let _proactiveMomentTimer = null;

function armProactiveMsgTimer(){
  if(_proactiveMsgTimer){ clearTimeout(_proactiveMsgTimer); _proactiveMsgTimer = null; }
  if(proactiveMsgSettings.enabled === false){
    proactiveState.nextMsgAt = null;
    return;
  }
  if(!proactiveState.nextMsgAt){
    scheduleNextProactiveMsg();
    sSet('proactive-state', proactiveState);
  }
  const delay = Math.max(0, proactiveState.nextMsgAt - Date.now());
  _proactiveMsgTimer = setTimeout(()=>{
    _proactiveMsgTimer = null;
    if(proactiveMsgSettings.enabled === false) return;
    scheduleNextProactiveMsg();
    sSet('proactive-state', proactiveState);
    armProactiveMsgTimer();
    sendProactiveMessage();
  }, delay);
}
function armProactiveLetterTimer(){
  if(_proactiveLetterTimer){ clearTimeout(_proactiveLetterTimer); _proactiveLetterTimer = null; }
  if(!proactiveState.nextLetterAt){
    scheduleNextProactiveLetter();
    sSet('proactive-state', proactiveState);
  }
  const delay = Math.max(0, proactiveState.nextLetterAt - Date.now());
  _proactiveLetterTimer = setTimeout(async ()=>{
    _proactiveLetterTimer = null;
    scheduleNextProactiveLetter();
    await sSet('proactive-state', proactiveState);
    armProactiveLetterTimer();
    await sendProactiveLetter();
  }, delay);
}
function armProactiveCallTimer(){
  if(_proactiveCallTimer){ clearTimeout(_proactiveCallTimer); _proactiveCallTimer = null; }
  if(!proactiveState.nextCallAt){
    scheduleNextProactiveCall();
    sSet('proactive-state', proactiveState);
  }
  const delay = Math.max(0, proactiveState.nextCallAt - Date.now());
  _proactiveCallTimer = setTimeout(()=>{
    _proactiveCallTimer = null;
    scheduleNextProactiveCall();
    sSet('proactive-state', proactiveState);
    armProactiveCallTimer();
    if(!activeCall) receiveIncomingCall();
  }, delay);
}
function armProactiveMomentTimer(){
  if(_proactiveMomentTimer){ clearTimeout(_proactiveMomentTimer); _proactiveMomentTimer = null; }
  if(!proactiveState.nextMomentAt){
    scheduleNextProactiveMoment();
    sSet('proactive-state', proactiveState);
  }
  const delay = Math.max(0, proactiveState.nextMomentAt - Date.now());
  _proactiveMomentTimer = setTimeout(async ()=>{
    _proactiveMomentTimer = null;
    scheduleNextProactiveMoment();
    await sSet('proactive-state', proactiveState);
    armProactiveMomentTimer();
    await sendProactiveMoment();
  }, delay);
}
function armAllProactiveTimers(){
  armProactiveMsgTimer();
  armProactiveLetterTimer();
  armProactiveCallTimer();
  armProactiveMomentTimer();
}
/** 兼容旧调用：改为挂 setTimeout，不再轮询 */
async function checkProactive(){
  armAllProactiveTimers();
}

/* ============================================================
   前台补发检查：App 从后台切回前台时，setTimeout 可能已被浏览器
   冻结/丢弃而没有按时触发，这里主动比对 next*At 与当前时间，
   过期了就立刻补发，而不是干等一个可能已经失效的定时器。
   ============================================================ */
function checkProactiveDue(){
  const now = Date.now();
  if(proactiveMsgSettings.enabled !== false && proactiveState.nextMsgAt && proactiveState.nextMsgAt <= now){
    if(_proactiveMsgTimer){ clearTimeout(_proactiveMsgTimer); _proactiveMsgTimer = null; }
    scheduleNextProactiveMsg();
    sSet('proactive-state', proactiveState);
    armProactiveMsgTimer();
    sendProactiveMessage();
  }
  if(proactiveState.nextLetterAt && proactiveState.nextLetterAt <= now){
    if(_proactiveLetterTimer){ clearTimeout(_proactiveLetterTimer); _proactiveLetterTimer = null; }
    scheduleNextProactiveLetter();
    sSet('proactive-state', proactiveState);
    armProactiveLetterTimer();
    sendProactiveLetter();
  }
  if(proactiveState.nextCallAt && proactiveState.nextCallAt <= now){
    if(_proactiveCallTimer){ clearTimeout(_proactiveCallTimer); _proactiveCallTimer = null; }
    scheduleNextProactiveCall();
    sSet('proactive-state', proactiveState);
    armProactiveCallTimer();
    if(typeof activeCall === 'undefined' || !activeCall) receiveIncomingCall();
  }
  if(proactiveState.nextMomentAt && proactiveState.nextMomentAt <= now){
    if(_proactiveMomentTimer){ clearTimeout(_proactiveMomentTimer); _proactiveMomentTimer = null; }
    scheduleNextProactiveMoment();
    sSet('proactive-state', proactiveState);
    armProactiveMomentTimer();
    sendProactiveMoment();
  }
}
function sendProactiveMessage(){
  // 偶尔改成主动邀请一起听/学/睡，而不是普通消息
  if(typeof maybeBotInviteTogether === 'function' && Math.random() < 0.18){
    maybeBotInviteTogether();
    return;
  }
  showTyping(true);
  setTimeout(async ()=>{
    showTyping(false);
    const reply = pickReplyFor(''); // 停顿结束、真要发的这一刻才选字卡，跟手动触发的顺序保持一致
    if(!reply) return;
    const newMsg = {id:uid(), from:'bot', time:Date.now(), read:true, ...reply};
    chatMessages.push(newMsg);
    await recPut('chatMessages', newMsg);
    if(currentView==='chat'){ renderChat(); }
    else{ chatUnread = true; await sSet('chat-unread', true); renderUnreadDots(); tryBgNotify(chatSettings.companionName+' 发来消息', reply.content||'[消息]'); }
  }, getReplyDelayMs()); // 打字停顿走传讯设置里的"最快/最慢回复"区间，跟手动触发、平时回复用同一套，不影响 nextMsgAt 的随机调度
}
function triggerProactiveMessage(){
  showTyping(true);
  setTimeout(async ()=>{
    showTyping(false);
    const reply = pickReplyFor('');
    if(reply){
      const newMsg = { id:uid(), from:'bot', time:Date.now(), read:true, ...reply};
      chatMessages.push(newMsg);
      await recPut('chatMessages', newMsg);
      if(currentView==='chat'){ 
        renderChat(); 
      } else {
        chatUnread = true; 
        await sSet('chat-unread', true); 
        renderUnreadDots(); 
        tryBgNotify(chatSettings.companionName+' 发来消息', reply.content||'[消息]');
      }
    }
  }, getReplyDelayMs());
}async function sendProactiveLetter(){
  const lineCount = 5 + Math.floor(Math.random()*11);
  const lines = [];
  for(let i=0;i<lineCount;i++){ const c = getRandomCardText(); if(c) lines.push(c); }
  if(lines.length===0) return; // 字卡库是空的，先不主动写信
  inboxLetters.unshift({ id:uid(), from:'bot', content: lines.join('\n'), time:Date.now() });
  await sSet('inbox-letters', inboxLetters);
  if(currentView==='inboxLetters'){ renderInboxLetters(); }
  else{ inboxLetterUnread = true; await sSet('inbox-letter-unread', true); renderUnreadDots(); tryBgNotify(chatSettings.companionName+' 寄来一封信', '点开查看来信'); }
}

/* ============================================================
   发网页链接：粘贴链接 → 预览（iframe直接套，能不能显示看目标网站自己的安全策略）→ 发送到聊天，
   变成一条可点开重新预览的消息卡片。不额外解析B站/抖音这些具体平台，统一通用嵌入，简单可靠。
   ============================================================ */
function openWebLinkComposer(){
  openOverlay(`
    <div class="drawer-head"><h3>发送网页链接</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <input type="text" id="wlUrlInput" placeholder="粘贴链接（B站/抖音/任意网页）…">
    <div class="btn-row"><div class="btn outline" onclick="previewWebLink()">👁 预览</div></div>
    <div id="wlPreviewArea"></div>
    <div style="font-size:12px;color:var(--ink-soft,#999);margin:8px 0;">提示：部分网站可能因安全限制无法嵌入，可尝试发送后查看</div>
    <div class="btn-row"><div class="btn" onclick="sendWebLinkToChat()">📤 发送到聊天</div></div>
  `);
}
function previewWebLink(){
  const raw = (document.getElementById('wlUrlInput').value||'').trim();
  const area = document.getElementById('wlPreviewArea');
  if(!/^https?:\/\//i.test(raw)){ area.innerHTML = '<div style="padding:8px 2px;color:var(--ink-soft,#999);font-size:13px;">先粘贴一个完整链接（要带 http/https）～</div>'; return; }
  area.innerHTML = `<div style="position:relative;padding-top:56.25%;border-radius:12px;overflow:hidden;background:#000;margin-top:8px;">
    <iframe src="${raw}" frameborder="0" allowfullscreen style="position:absolute;top:0;left:0;width:100%;height:100%;"></iframe>
  </div>`;
}
async function sendWebLinkToChat(){
  const input = document.getElementById('wlUrlInput');
  const raw = input ? input.value.trim() : '';
  if(!/^https?:\/\//i.test(raw)){ alert('先粘贴一个完整链接（要带 http/https）～'); return; }
  closeOverlay();
  const msg = { id:uid(), from:'user', type:'weblink', content:raw, time:Date.now(), collapsed:false };
  chatMessages.push(msg);
  await recPut('chatMessages', msg);
  renderChat();
  handleIncomingForBot('');
}
function getUrlHost(url){
  try{ return new URL(url).hostname; }catch(e){ return url; }
}
async function toggleWebLinkCollapse(id){
  const m = chatMessages.find(x=>x.id===id);
  if(!m) return;
  const currentlyCollapsed = m.collapsed !== undefined ? m.collapsed : true;
  m.collapsed = !currentlyCollapsed;
  await recPut('chatMessages', m);
  renderChat(true);
}


/* ============================================================
   小动作：拍一拍 / 戳一戳 / 贴一贴 / 抱一抱……可以直接选一个发过去
   ============================================================ */
const QUICK_ACTIONS = [
  { key:'pat', emoji:'👋', label:'拍一拍', verb:'拍了拍' },
  { key:'poke', emoji:'👉', label:'戳一戳', verb:'戳了戳' },
  { key:'stick', emoji:'🧲', label:'贴一贴', verb:'贴了贴' },
  { key:'hug', emoji:'🤗', label:'抱一抱', verb:'抱了抱' }
];
function openGesturePicker(){
  openOverlay(`
    <div class="drawer-head"><h3>发送小动作</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <div class="btn-row">
      ${QUICK_ACTIONS.map(a=>`<div class="btn outline" onclick="sendGesture('${a.key}')">${a.emoji} ${a.label}</div>`).join('')}
    </div>
  `);
}
async function sendGesture(key){
  const action = QUICK_ACTIONS.find(a=>a.key===key) || QUICK_ACTIONS[0];
  closeOverlay();
  const gestureMsg = { id:uid(), from:'system', type:'gesture', content:`你${action.verb} ${chatSettings.companionName}`, time:Date.now() };
  chatMessages.push(gestureMsg);
  await recPut('chatMessages', gestureMsg);
  renderChat();
  // 统一走已读不回 + 传讯设置里的回复延迟区间，跟普通消息回复用同一套逻辑
  handleIncomingForBot('');
}

/* ============================================================
   通话：TA可以主动打给我，我也可以主动打给TA，纯随机不设区间
   ============================================================ */
function startOutgoingCall(){
  if(activeCall) return;
  activeCall = { direction:'out', status:'ringing', muted:false, camOn:true };
  showCallOverlay();
  document.getElementById('callStatusLabel').textContent = '视频呼叫中…';
  document.getElementById('callTimerLabel').classList.add('hidden');
  document.getElementById('callActions').innerHTML = `<div class="call-btn hangup" onclick="endCall('cancelled')">✕</div>`;
  activeCall.ringTimeout = setTimeout(()=>{
    if(!activeCall || activeCall.status!=='ringing') return;
    if(Math.random() < 0.85){ connectCall(); } else { endCall('missed_by_them'); }
  }, 1200 + Math.random()*3000);
}
function receiveIncomingCall(){
  if(activeCall || currentView==='calls' && document.hidden) return;
  activeCall = { direction:'in', status:'ringing', muted:false, camOn:true };
  showCallOverlay();
  document.getElementById('callStatusLabel').textContent = '视频来电…';
  document.getElementById('callTimerLabel').classList.add('hidden');
  document.getElementById('callActions').innerHTML = `
    <div class="call-btn decline" onclick="endCall('declined')">✕</div>
    <div class="call-btn accept" onclick="connectCall()">✓</div>`;
  activeCall.missedTimeout = setTimeout(()=>{
    if(activeCall && activeCall.status==='ringing'){ endCall('missed'); }
  }, 20000);
  if(typeof tryBgNotify==='function') tryBgNotify(chatSettings.companionName+' 的视频来电', '点开接听');
}
function connectCall(){
  if(!activeCall) return;
  clearTimeout(activeCall.missedTimeout);
  clearTimeout(activeCall.ringTimeout);
  activeCall.status = 'connected';
  activeCall.startTime = Date.now();
  document.getElementById('callStatusLabel').textContent = '视频通话中';
  document.getElementById('callTimerLabel').classList.remove('hidden');
  document.getElementById('callActions').innerHTML = `
    <div class="call-btn-sm" id="muteBtn" onclick="toggleMute()">🎤</div>
    <div class="call-btn hangup" onclick="endCall('completed')">✕</div>
    <div class="call-btn-sm" id="camBtn" onclick="toggleCamera()">📷</div>`;
  activeCall.timerInterval = setInterval(updateCallTimer, 1000);
  updateCallTimer();
}
function toggleMute(){
  if(!activeCall) return;
  activeCall.muted = !activeCall.muted;
  const btn = document.getElementById('muteBtn');
  if(btn){ btn.textContent = activeCall.muted ? '🔇' : '🎤'; btn.classList.toggle('on', activeCall.muted); }
}
function toggleCamera(){
  if(!activeCall) return;
  activeCall.camOn = !activeCall.camOn;
  const btn = document.getElementById('camBtn');
  if(btn){ btn.textContent = activeCall.camOn ? '📷' : '🚫'; btn.classList.toggle('on', !activeCall.camOn); }
  const pip = document.getElementById('callSelfPip');
  if(pip) pip.classList.toggle('cam-off', !activeCall.camOn);
}
function updateCallTimer(){
  if(!activeCall || !activeCall.startTime) return;
  const sec = Math.floor((Date.now()-activeCall.startTime)/1000);
  const m = String(Math.floor(sec/60)).padStart(2,'0');
  const s = String(sec%60).padStart(2,'0');
  const el = document.getElementById('callTimerLabel');
  if(el) el.textContent = m+':'+s;
  updateCallBubbleText();
}
function minimizeCall(){
  if(!activeCall) return;
  document.getElementById('callOverlay').classList.add('hidden');
  document.getElementById('callBubble').classList.remove('hidden');
  updateCallBubbleText();
}
function restoreCall(){
  if(!activeCall) return;
  document.getElementById('callBubble').classList.add('hidden');
  document.getElementById('callOverlay').classList.remove('hidden');
}
function updateCallBubbleText(){
  const el = document.getElementById('callBubbleText');
  if(!el || !activeCall) return;
  if(activeCall.status==='connected'){
    const sec = Math.floor((Date.now()-activeCall.startTime)/1000);
    const m = String(Math.floor(sec/60)).padStart(2,'0');
    const s = String(sec%60).padStart(2,'0');
    el.textContent = `${chatSettings.companionName} · 视频通话中 ${m}:${s}`;
  } else {
    el.textContent = `${chatSettings.companionName} · ${activeCall.direction==='in' ? '视频来电中…' : '呼叫中…'}`;
  }
}
async function endCall(reason){
  if(!activeCall) return;
  clearTimeout(activeCall.missedTimeout);
  clearTimeout(activeCall.ringTimeout);
  clearInterval(activeCall.timerInterval);
  const duration = activeCall.startTime ? Math.floor((Date.now()-activeCall.startTime)/1000) : 0;
  let status = 'completed';
  if(reason==='missed' || reason==='missed_by_them') status = 'missed';
  if(reason==='declined') status = 'declined';
  if(reason==='cancelled') status = activeCall.status==='connected' ? 'completed' : 'missed';
  callLogs.unshift({ id:uid(), direction:activeCall.direction, status, duration, time:Date.now() });
  await sSet('call-logs', callLogs);
  renderCallLog();
  hideCallOverlay();
  activeCall = null;
}
function showCallOverlay(){
  const box = document.getElementById('callAvatarBox');
  const theirPic = profile.avatar && profile.avatar.startsWith('data:') ? profile.avatar : null;
  box.innerHTML = theirPic ? `<img loading="lazy" decoding="async" src="${theirPic}">` : (profile.avatar||'🌙');
  const bg = document.getElementById('callVideoBg');
  if(bg) bg.style.backgroundImage = theirPic ? `url('${theirPic}')` : 'none';
  const pip = document.getElementById('callSelfPip');
  if(pip){
    pip.classList.remove('cam-off');
    const myPic = profile.myAvatar && profile.myAvatar.startsWith('data:') ? profile.myAvatar : null;
    pip.innerHTML = myPic ? `<img loading="lazy" decoding="async" src="${myPic}">` : (profile.myAvatar||'🙂');
  }
  document.getElementById('callNameLabel').textContent = chatSettings.companionName;
  document.getElementById('callOverlay').classList.remove('hidden');
  document.getElementById('callBubble').classList.add('hidden');
}
function hideCallOverlay(){
  document.getElementById('callOverlay').classList.add('hidden');
  document.getElementById('callBubble').classList.add('hidden');
}
function formatCallDuration(sec){
  const m = Math.floor(sec/60), s = sec%60;
  return `视频通话 ${m}分${s}秒`;
}
function renderCallLog(){
  const wrap = document.getElementById('callLogList');
  if(!wrap) return;
  wrap.innerHTML = callLogs.length ? callLogs.map(c=>{
    const icon = c.direction==='in' ? '📹' : '📹';
    const label = c.direction==='in' ? (chatSettings.companionName+' 的视频来电') : '视频呼出';
    const statusText = c.status==='completed' ? formatCallDuration(c.duration) : (c.status==='missed' ? '未接' : '已拒接');
    const color = c.status==='completed' ? 'var(--ink-soft)' : 'var(--rouge)';
    return `<div class="list-item"><div>${icon} ${label}<div class="meta" style="color:${color};">${statusText} · ${formatMsgTime(c.time)}</div></div></div>`;
  }).join('') : '<div class="empty-note">还没有通话记录</div>';
}

/* ---- chat settings drawer ---- */
function openChatSettings(){
  openOverlay(`
    <div class="drawer-head"><h3>传讯设置</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">梦角名字</label>
    <input type="text" id="csName" value="${chatSettings.companionName}">
    <label class="field">最快回复：<span id="csDelayMinVal">${chatSettings.delayMin}</span> 分钟</label>
    <input type="range" min="1" max="5" step="1" value="${Math.min(5, Math.max(1, chatSettings.delayMin||1))}" oninput="document.getElementById('csDelayMinVal').textContent=this.value" id="csDelayMin" style="width:100%;">
    <label class="field">最慢回复：<span id="csDelayMaxVal">${chatSettings.delayMax}</span> 分钟</label>
    <input type="range" min="1" max="5" step="1" value="${Math.min(5, Math.max(1, chatSettings.delayMax||5))}" oninput="document.getElementById('csDelayMaxVal').textContent=this.value" id="csDelayMax" style="width:100%;">
    <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">1～5 分钟。每次回复会在这个区间里随机挑一个时间</div>
    <div class="switch-row">
      <span>已读不回<div style="font-size:10.5px;color:var(--ink-soft);font-weight:400;">开启后每条消息有 30% 几率已读不回，不是每次都不回</div></span>
      <div class="switch ${chatSettings.readNoReply?'on':''}" id="csReadNoReply" onclick="this.classList.toggle('on')"><div class="dot"></div></div>
    </div>
    <div class="switch-row">
      <span>允许发送红包<div style="font-size:10.5px;color:var(--ink-soft);font-weight:400;">开启后 TA 有机会随机给你发红包；关闭后不会自动发红包</div></span>
      <div class="switch ${chatSettings.redPacketEnabled?'on':''}" id="csRedPacketEnabled" onclick="this.classList.toggle('on')"><div class="dot"></div></div>
    </div>
    <div class="box-title" style="margin-top:14px;">节奏</div>
    <div class="switch-row">
      <span>主动发消息给我</span>
      <div class="switch ${proactiveMsgSettings.enabled!==false?'on':''}" id="csProEnabled" onclick="this.classList.toggle('on')"><div class="dot"></div></div>
    </div>
    <label class="field">间隔：<span id="csProIntervalVal">${Math.min(120, proactiveMsgSettings.intervalMinutes||60)}</span> 分钟</label>
    <input type="range" min="1" max="120" step="1" value="${Math.min(120, Math.max(1, proactiveMsgSettings.intervalMinutes||60))}" oninput="document.getElementById('csProIntervalVal').textContent=this.value" id="csProInterval" style="width:100%;">
    <div style="font-size:11px;color:var(--ink-soft);margin-top:2px;">在 1 分钟～该值之间随机挑时间主动发（1～120 分钟）</div>
    <div class="box-title" style="margin-top:14px;">朋友圈互动</div>
    <div style="font-size:11px;color:var(--ink-soft);margin-bottom:6px;">你发朋友圈后，TA 点赞 / 评论的概率；以及你评论后 TA 回复的概率。0% 从不，100% 必做。</div>
    <label class="field">点赞概率：<span id="csLikeProbVal">${momentInteractSettings.likeProb||60}</span>%</label>
    <input type="range" min="0" max="100" step="1" value="${Math.min(100, momentInteractSettings.likeProb||60)}" oninput="document.getElementById('csLikeProbVal').textContent=this.value" id="csLikeProb" style="width:100%;">
    <label class="field">评论概率：<span id="csCommentProbVal">${momentInteractSettings.commentProb||60}</span>%</label>
    <input type="range" min="0" max="100" step="1" value="${Math.min(100, momentInteractSettings.commentProb||60)}" oninput="document.getElementById('csCommentProbVal').textContent=this.value" id="csCommentProb" style="width:100%;">
    <label class="field">回评论概率：<span id="csReplyProbVal">${momentInteractSettings.replyProb||60}</span>%</label>
    <input type="range" min="0" max="100" step="1" value="${Math.min(100, momentInteractSettings.replyProb||60)}" oninput="document.getElementById('csReplyProbVal').textContent=this.value" id="csReplyProb" style="width:100%;">
    <label class="field">主动发朋友圈最短：<span id="csMomMinDaysVal">${momentInteractSettings.minDays||1}</span> 天</label>
    <input type="range" min="1" max="30" step="1" value="${Math.min(30, momentInteractSettings.minDays||1)}" oninput="document.getElementById('csMomMinDaysVal').textContent=this.value" id="csMomMinDays" style="width:100%;">
    <label class="field">主动发朋友圈最长：<span id="csMomMaxDaysVal">${momentInteractSettings.maxDays||15}</span> 天</label>
    <input type="range" min="1" max="30" step="1" value="${Math.min(30, momentInteractSettings.maxDays||15)}" oninput="document.getElementById('csMomMaxDaysVal').textContent=this.value" id="csMomMaxDays" style="width:100%;">
    <div style="font-size:11px;color:var(--ink-soft);margin-top:2px;">在最短～最长天数之间纯随机挑时间发朋友圈，发完再排下一次，可多次触发</div>
    <div class="box-title" style="margin-top:14px;">拼字卡</div>
    <div class="switch-row">
      <span>拼字卡<div style="font-size:10.5px;color:var(--ink-soft);font-weight:400;">开启后有机会随机把 2~4 张字卡拼在一起发，不是每条都拼</div></span>
      <div class="switch ${spliceCardsEnabled?'on':''}" id="csSpliceCards" onclick="this.classList.toggle('on')"><div class="dot"></div></div>
    </div>
    <div class="box-title" style="margin-top:14px;">摸鱼记录</div>
    <div class="switch-row">
      <span>主动向我汇报工作</span>
      <div class="switch ${moyuState.enabled?'on':''}" id="csMoyuEnabled" onclick="this.classList.toggle('on')"><div class="dot"></div></div>
    </div>
    <div class="switch-row">
      <span>是否显示具体信息</span>
      <div class="switch ${moyuState.showDetails!==false?'on':''}" id="csMoyuDetails" onclick="this.classList.toggle('on')"><div class="dot"></div></div>
    </div>
    <div class="btn-row" style="margin-top:8px;"><div class="btn outline" onclick="closeOverlay(); openMoyuManagePanel();">🐟 管理摸鱼活动 / 工作地点</div></div>
    <div class="box-title" style="margin-top:14px;">聊天背景</div>
    <div class="btn-row">
      <div class="btn outline" onclick="document.getElementById('chatBgFileInput').click()">🖼 更换背景图</div>
      <div class="btn outline" onclick="clearChatBackground()">恢复默认</div>
    </div>
    <input type="file" id="chatBgFileInput" accept="image/*" class="hidden" onchange="onChatBgFile(event)">
    <div class="box-title" style="margin-top:14px;">表情包 / 贴纸</div>
    <div id="stickerManageList">${renderStickerChips()}</div>
    <label class="field">批量添加 Emoji（直接粘贴一串，比如 😀😁🥰😴）</label>
    <div style="display:flex;gap:6px;">
      <input type="text" id="bulkEmojiInput" placeholder="😀😁🥰😴…">
      <div class="btn outline" style="padding:8px 12px;white-space:nowrap;" onclick="addBulkEmojiStickers()">添加</div>
    </div>
    <div class="btn-row">
      <div class="btn outline" onclick="document.getElementById('stickerFileInput').click()">🖼 批量上传图片贴纸</div>
    </div>
    <input type="file" id="stickerFileInput" accept="image/*" multiple class="hidden" onchange="onStickerFile(event)">
    <div class="btn-row" style="margin-top:16px;">
      <div class="btn" onclick="saveChatSettings()">保存设置</div>
    </div>
  `);
}
function renderStickerChips(){
  if(chatSettings.stickers.length===0) return '<div class="empty-note">还没有表情包</div>';
  return chatSettings.stickers.map(s=>{
    const disp = s.type==='emoji' ? s.value : `<img loading="lazy" decoding="async" src="${s.value}" style="width:20px;height:20px;vertical-align:middle;">`;
    return `<span class="chip">${disp}<span class="x" onclick="removeSticker('${s.id}')">✕</span></span>`;
  }).join('');
}
async function removeSticker(id){
  chatSettings.stickers = chatSettings.stickers.filter(s=>s.id!==id);
  await sSet('chat-settings', chatSettings);
  document.getElementById('stickerManageList').innerHTML = renderStickerChips();
}
function addBulkEmojiStickers(){
  const inp = document.getElementById('bulkEmojiInput');
  const raw = inp.value.trim();
  if(!raw) return;
  const chars = Array.from(raw).filter(c=> c.trim().length>0);
  chars.forEach(c=> chatSettings.stickers.push({id:uid(), type:'emoji', value:c}));
  inp.value = '';
  sSet('chat-settings', chatSettings);
  document.getElementById('stickerManageList').innerHTML = renderStickerChips();
}
function onStickerFile(e){
  const files = Array.from(e.target.files || []);
  if(files.length===0) return;
  let remaining = files.length;
  files.forEach(f=>{
    const reader = new FileReader();
    reader.onload = async ()=>{
      const compressed = await compressImage(reader.result, 500);
      chatSettings.stickers.push({id:uid(), type:'image', value:compressed});
      remaining--;
      if(remaining===0){
        await sSet('chat-settings', chatSettings);
        document.getElementById('stickerManageList').innerHTML = renderStickerChips();
      }
    };
    reader.readAsDataURL(f);
  });
}
async function saveChatSettings(){
  chatSettings.companionName = document.getElementById('csName').value.trim() || chatSettings.companionName;
  let dMin = Math.max(1, Math.min(5, parseInt(document.getElementById('csDelayMin').value,10) || 1));
  let dMax = Math.max(1, Math.min(5, parseInt(document.getElementById('csDelayMax').value,10) || 5));
  chatSettings.delayMin = Math.min(dMin, dMax);
  chatSettings.delayMax = Math.max(dMin, dMax);
  delete chatSettings.delayUnit;
  chatSettings.readNoReply = document.getElementById('csReadNoReply').classList.contains('on');
  chatSettings.redPacketEnabled = document.getElementById('csRedPacketEnabled').classList.contains('on');
  await sSet('chat-settings', chatSettings);
  proactiveMsgSettings.enabled = document.getElementById('csProEnabled').classList.contains('on');
  proactiveMsgSettings.intervalMinutes = Math.max(1, Math.min(120, parseInt(document.getElementById('csProInterval').value,10) || 60));
  delete proactiveMsgSettings.minMinutes;
  delete proactiveMsgSettings.maxMinutes;
  await sSet('proactive-msg-settings', proactiveMsgSettings);
  scheduleNextProactiveMsg();
  await sSet('proactive-state', proactiveState);
  if(typeof armProactiveMsgTimer === 'function') armProactiveMsgTimer();
  momentInteractSettings.likeProb = Math.max(0, Math.min(100, parseInt(document.getElementById('csLikeProb').value,10) || 0));
  momentInteractSettings.commentProb = Math.max(0, Math.min(100, parseInt(document.getElementById('csCommentProb').value,10) || 0));
  momentInteractSettings.replyProb = Math.max(0, Math.min(100, parseInt(document.getElementById('csReplyProb').value,10) || 0));
  const mdMin = Math.max(1, Math.min(30, parseInt(document.getElementById('csMomMinDays').value,10) || 1));
  const mdMax = Math.max(1, Math.min(30, parseInt(document.getElementById('csMomMaxDays').value,10) || 15));
  momentInteractSettings.minDays = Math.min(mdMin, mdMax);
  momentInteractSettings.maxDays = Math.max(mdMin, mdMax);
  await sSet('moment-interact-settings', momentInteractSettings);
  // 区间变了就按新区间重排下一次主动发朋友圈
  scheduleNextProactiveMoment();
  await sSet('proactive-state', proactiveState);
  if(typeof armProactiveMomentTimer === 'function') armProactiveMomentTimer();
  spliceCardsEnabled = document.getElementById('csSpliceCards').classList.contains('on');
  await sSet('splice-cards-enabled', spliceCardsEnabled);
  const wasEnabled = moyuState.enabled;
  moyuState.enabled = document.getElementById('csMoyuEnabled').classList.contains('on');
  moyuState.showDetails = document.getElementById('csMoyuDetails').classList.contains('on');
  if(moyuState.enabled){
    if(!wasEnabled || !moyuState.nextAt) scheduleNextMoyu();
    if(!moyuState.currentSession) await startMoyuSession();
  } else {
    moyuState.nextAt = null;
  }
  await sSet('moyu-state', moyuState);
  renderChat(); renderHomeProfile(); renderMoyuHome();
  closeOverlay();
}
function onChatBgFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    chatSettings.background = await compressImage(reader.result, 1000);
    await sSet('chat-settings', chatSettings);
    applyChatBackground();
  };
  reader.readAsDataURL(f);
}
async function clearChatBackground(){
  chatSettings.background = null;
  await sSet('chat-settings', chatSettings);
  applyChatBackground();
}
function hexToRgba(hex, alpha){
  hex = (hex||'#F3EEE3').trim().replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const r = parseInt(hex.substring(0,2),16) || 243;
  const g = parseInt(hex.substring(2,4),16) || 238;
  const b = parseInt(hex.substring(4,6),16) || 227;
  return `rgba(${r},${g},${b},${alpha})`;
}
function applyChatBackground(){
  // 传讯页独立背景（轻微模糊，文字保持清晰）
  const view = document.getElementById('view-chat');
  const msgs = document.getElementById('chatMsgs');
  if(chatSettings.background){
    if(view){
      view.style.setProperty('--chat-bg-image', `url(${chatSettings.background})`);
      view.style.backgroundImage = 'none';
      view.style.backgroundColor = 'transparent';
    }
    if(msgs) msgs.style.backgroundImage = 'none';
  } else {
    if(view){
      view.style.removeProperty('--chat-bg-image');
      view.style.backgroundImage = '';
      view.style.backgroundColor = '';
    }
    if(msgs) msgs.style.backgroundImage = 'none';
  }
}

/* ---- card picker (send from 字卡库 directly in chat) ---- */
function openCardPicker(){
  const groups = Object.keys(cardsData.groups||{});
  if(groups.length===0){
    openOverlay(`<div class="drawer-head"><h3>字卡库是空的</h3><span class="close-x" onclick="closeOverlay()">✕</span></div><div class="empty-note">去「字卡」页面导入或添加一些字卡吧。</div>`);
    return;
  }
  openOverlay(`
    <div class="drawer-head"><h3>选择字卡发送</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    ${groups.map(g=>`<div class="group-block"><div class="group-name"><span>${g}</span></div>${cardsData.groups[g].map(c=>`<span class="card-pill" onclick="sendCardText('${escAttr(c)}')">${c}</span>`).join('')}</div>`).join('')}
  `);
}
async function sendCardText(text){
  const msg = {id:uid(), from:'user', type:'text', content:text, time:Date.now(), read:false};
  if(quoteTarget){ msg.quoteOf = quoteTarget; clearQuoteTarget(); }
  chatMessages.push(msg);
  await recPut('chatMessages', msg);
  renderChat(); closeOverlay();
  handleIncomingForBot(text);
}

/* ---- sticker picker (user sends a sticker) ---- */
function openStickerPicker(){
  if(chatSettings.stickers.length===0){
    openOverlay(`<div class="drawer-head"><h3>还没有表情包</h3><span class="close-x" onclick="closeOverlay()">✕</span></div><div class="empty-note">先去传讯设置里添加表情包吧。</div>`);
    return;
  }
  openOverlay(`
    <div class="drawer-head"><h3>发送表情包</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <div>${chatSettings.stickers.map(s=>{
      const disp = s.type==='emoji' ? `<span style="font-size:30px;">${s.value}</span>` : `<img loading="lazy" decoding="async" src="${s.value}" style="width:44px;height:44px;object-fit:contain;">`;
      return `<span class="chip" style="padding:8px;" onclick='sendStickerMsg(${JSON.stringify(s.value)})'>${disp}</span>`;
    }).join('')}</div>
  `);
}
async function sendStickerMsg(value){
  const msg = {id:uid(), from:'user', type:'sticker', content:value, time:Date.now(), read:false};
  if(quoteTarget){ msg.quoteOf = quoteTarget; clearQuoteTarget(); }
  chatMessages.push(msg);
  await recPut('chatMessages', msg);
  renderChat(); closeOverlay();
  handleIncomingForBot('[表情]');
}

/* ---- 红包：我可以发给梦角，梦角也会随机发给我（见 pickReplyFor） ---- */
function openSendRedPacket(){
  openOverlay(`
    <div class="drawer-head"><h3>发红包</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">金额</label>
    <input type="number" id="rpAmount" placeholder="0.00">
    <label class="field">留言</label>
    <input type="text" id="rpNote" placeholder="恭喜发财" value="恭喜发财">
    <div class="btn-row"><div class="btn rouge" onclick="sendRedPacket()">塞进对方口袋</div></div>
  `);
}
async function sendRedPacket(){
  const amount = parseFloat(document.getElementById('rpAmount').value);
  const note = document.getElementById('rpNote').value.trim() || '恭喜发财';
  if(isNaN(amount) || amount<=0){ alert('请输入金额'); return; }
  const msg = {id:uid(), from:'user', type:'redpacket', amount, note, opened:true, time:Date.now(), read:false};
  if(quoteTarget){ msg.quoteOf = quoteTarget; clearQuoteTarget(); }
  chatMessages.push(msg);
  await recPut('chatMessages', msg);
  renderChat(); closeOverlay();
  handleIncomingForBot('[红包]');
}

/* ---- 梦向问卷：写问题 + 选项，发送给TA，TA在自定义1~23小时内随机选一个回复 ---- */
function openQuestionnaireComposer(){
  openOverlay(`
    <div class="drawer-head"><h3>📋 梦向问卷</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <p style="font-size:12px;color:var(--ink-soft);margin:0 0 10px;">写一个问题，给出几个选项。发送后 TA 会在你设定的时间范围内随机选一个选项回复你。</p>
    <label class="field">问题</label>
    <textarea id="qQuestion" placeholder="例如：今天想吃什么？" style="min-height:60px;"></textarea>
    <label class="field">选项（至少 2 个，每行一个）</label>
    <textarea id="qOptions" placeholder="每行一个选项，例如：&#10;奶茶&#10;咖啡&#10;果汁" style="min-height:90px;"></textarea>
    <label class="field">最快回复：<span id="qMinHVal">1</span> 小时</label>
    <input type="range" min="1" max="23" step="1" value="1" id="qMinH" oninput="document.getElementById('qMinHVal').textContent=this.value; syncQMax()" style="width:100%;">
    <label class="field">最慢回复：<span id="qMaxHVal">12</span> 小时</label>
    <input type="range" min="1" max="23" step="1" value="12" id="qMaxH" oninput="document.getElementById('qMaxHVal').textContent=this.value; syncQMin()" style="width:100%;">
    <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;">在最短～最长小时数之间纯随机挑一个时间点回复（1～23 小时）</div>
    <div class="btn-row" style="margin-top:14px;"><div class="btn rouge" onclick="sendQuestionnaire()">发送问卷</div></div>
  `);
}
function syncQMax(){
  const minEl = document.getElementById('qMinH');
  const maxEl = document.getElementById('qMaxH');
  if(!minEl || !maxEl) return;
  if(parseInt(maxEl.value,10) < parseInt(minEl.value,10)){
    maxEl.value = minEl.value;
    document.getElementById('qMaxHVal').textContent = maxEl.value;
  }
}
function syncQMin(){
  const minEl = document.getElementById('qMinH');
  const maxEl = document.getElementById('qMaxH');
  if(!minEl || !maxEl) return;
  if(parseInt(minEl.value,10) > parseInt(maxEl.value,10)){
    minEl.value = maxEl.value;
    document.getElementById('qMinHVal').textContent = minEl.value;
  }
}
async function sendQuestionnaire(){
  const qEl = document.getElementById('qQuestion');
  const oEl = document.getElementById('qOptions');
  const question = (qEl && qEl.value || '').trim();
  const options = (oEl && oEl.value || '').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(!question){ alert('请填写问题'); return; }
  if(options.length < 2){ alert('至少需要 2 个选项'); return; }
  let minH = parseInt((document.getElementById('qMinH')||{}).value,10) || 1;
  let maxH = parseInt((document.getElementById('qMaxH')||{}).value,10) || 12;
  minH = Math.max(1, Math.min(23, minH));
  maxH = Math.max(minH, Math.min(23, maxH));
  const delayMs = randomBetween(minH * 3600 * 1000, maxH * 3600 * 1000);
  const scheduledReplyAt = Date.now() + delayMs;
  const msg = {
    id: uid(),
    from: 'user',
    type: 'questionnaire',
    question,
    options,
    time: Date.now(),
    read: false,
    answered: false,
    chosenOption: null,
    answerTime: null,
    scheduledReplyAt,
    minH, maxH
  };
  if(quoteTarget){ msg.quoteOf = quoteTarget; clearQuoteTarget(); }
  chatMessages.push(msg);
  await recPut('chatMessages', msg);
  renderChat();
  closeOverlay();
}
async function checkQuestionnaireReplies(){
  const now = Date.now();
  let changed = false;
  for(const m of chatMessages){
    if(m.type !== 'questionnaire' || m.answered || !m.scheduledReplyAt) continue;
    if(m.scheduledReplyAt > now) continue;
    const opts = m.options || [];
    if(!opts.length) continue;
    const chosen = opts[Math.floor(Math.random() * opts.length)];
    m.answered = true;
    m.chosenOption = chosen;
    m.answerTime = Date.now();
    m.read = true;
    await recPut('chatMessages', m);
    const replyText = `我选了「${chosen}」`;
    const replyMsg = {
      id: uid(),
      from: 'bot',
      type: 'text',
      content: replyText,
      time: Date.now(),
      read: true,
      quoteOf: { id: m.id, from: 'user', preview: '[问卷] ' + (m.question||'').slice(0,30) }
    };
    chatMessages.push(replyMsg);
    await recPut('chatMessages', replyMsg);
    changed = true;
  }
  if(changed){
    if(currentView === 'chat'){ renderChat(); }
    else { chatUnread = true; await sSet('chat-unread', true); renderUnreadDots(); tryBgNotify(chatSettings.companionName+' 发来消息', '[消息]'); }
  }
}

/* ============================================================
   LEDGER
   ============================================================ */
let ledgerUI = { year: new Date().getFullYear(), month: new Date().getMonth(), tab: 'expense' };
function shiftLedgerMonth(delta){
  let y = ledgerUI.year, m = ledgerUI.month + delta;
  if(m < 0){ m = 11; y--; }
  if(m > 11){ m = 0; y++; }
  ledgerUI.year = y; ledgerUI.month = m;
  renderLedger();
}
function setLedgerTab(tab){
  ledgerUI.tab = tab;
  renderLedger();
}
function ledgerMonthEntries(){
  const y = ledgerUI.year, m = ledgerUI.month;
  return ledgerEntries.filter(e=>{
    const d = new Date(e.date + 'T00:00:00');
    return d.getFullYear()===y && d.getMonth()===m;
  });
}
function openLedgerAddSheet(presetType){
  const type = presetType || (ledgerUI.tab==='income' ? 'income' : 'expense');
  const today = new Date().toISOString().slice(0,10);
  openOverlay(`
    <div class="drawer-head"><h3>添加记录</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">日期</label><input type="date" id="ledgerDate" value="${today}">
    <label class="field">类型</label>
    <select id="ledgerType"><option value="expense" ${type==='expense'?'selected':''}>支出</option><option value="income" ${type==='income'?'selected':''}>收入</option></select>
    <label class="field">金额</label><input type="number" id="ledgerAmount" placeholder="0.00" step="0.01">
    <label class="field">备注</label><input type="text" id="ledgerNote" placeholder="例如：奶茶">
    <label class="field">标签（可选）</label><input type="text" id="ledgerTag" placeholder="例如：餐饮 / 交通">
    <div class="btn-row"><div class="btn rouge" onclick="addLedger()">保存</div><div class="btn outline" onclick="closeOverlay()">取消</div></div>
  `);
}
async function addLedger(){
  const date = document.getElementById('ledgerDate').value;
  const type = document.getElementById('ledgerType').value;
  const amount = parseFloat(document.getElementById('ledgerAmount').value);
  const note = document.getElementById('ledgerNote').value.trim();
  const tag = (document.getElementById('ledgerTag')||{}).value ? document.getElementById('ledgerTag').value.trim() : '';
  if(!date || isNaN(amount) || amount<=0){ alert('请填写日期和正确金额'); return; }
  ledgerEntries.unshift({id:uid(), date, type, amount, note, tag});
  await sSet('ledger-entries', ledgerEntries);
  closeOverlay();
  renderLedger();
}
async function deleteLedger(id){
  ledgerEntries = ledgerEntries.filter(e=>e.id!==id);
  await sSet('ledger-entries', ledgerEntries); renderLedger();
}
function renderLedger(){
  const label = document.getElementById('ledgerMonthLabel');
  if(label) label.textContent = `${ledgerUI.year}年${ledgerUI.month+1}月`;
  ['expense','income','stats','tags'].forEach(t=>{
    const el = document.getElementById('ledgerTab-'+t);
    if(el) el.className = 'btn' + (ledgerUI.tab===t ? '' : ' outline');
    if(el) el.style.padding = '6px 12px';
    if(el) el.style.fontSize = '12px';
  });
  const monthItems = ledgerMonthEntries();
  const expense = monthItems.filter(e=>e.type==='expense').reduce((s,e)=>s+e.amount,0);
  const income = monthItems.filter(e=>e.type==='income').reduce((s,e)=>s+e.amount,0);
  const balance = income - expense;
  const se = document.getElementById('ledgerSumExpense');
  const si = document.getElementById('ledgerSumIncome');
  const sb = document.getElementById('ledgerSumBalance');
  if(se) se.textContent = '¥'+expense.toFixed(2);
  if(si) si.textContent = '¥'+income.toFixed(2);
  if(sb){ sb.textContent = '¥'+balance.toFixed(2); sb.style.color = balance>=0 ? '#3B6B5E' : 'var(--rouge)'; }

  const wrap = document.getElementById('ledgerList');
  if(!wrap) return;
  const tab = ledgerUI.tab;
  if(tab==='stats'){
    const byTag = {};
    monthItems.forEach(e=>{
      const k = e.tag || (e.type==='income'?'收入':'未分类');
      if(!byTag[k]) byTag[k] = {expense:0, income:0};
      byTag[k][e.type] += e.amount;
    });
    const rows = Object.keys(byTag).map(k=>{
      const t = byTag[k];
      return `<div class="list-item"><div><b>${k}</b><div class="meta">支出 ¥${t.expense.toFixed(2)} · 收入 ¥${t.income.toFixed(2)}</div></div></div>`;
    });
    wrap.innerHTML = rows.length ? rows.join('') : '<div class="empty-note">本月暂无统计数据</div>';
    return;
  }
  if(tab==='tags'){
    const tags = {};
    ledgerEntries.forEach(e=>{ if(e.tag) tags[e.tag] = (tags[e.tag]||0)+1; });
    const keys = Object.keys(tags);
    wrap.innerHTML = keys.length
      ? keys.map(t=>`<div class="list-item"><div>🏷 ${t}<div class="meta">共 ${tags[t]} 笔</div></div></div>`).join('')
      : '<div class="empty-note">还没有标签，添加记录时可填写</div>';
    return;
  }
  const list = monthItems.filter(e=> e.type === tab).sort((a,b)=> b.date.localeCompare(a.date) || (b.id>a.id?1:-1));
  if(!list.length){
    wrap.innerHTML = `<div class="empty-note" style="padding:36px 12px;">
      <div style="font-size:40px;opacity:.35;margin-bottom:8px;">🧾</div>
      暂无${tab==='expense'?'支出':'收入'}记录<br><span style="font-size:11.5px;">点击下方按钮添加记录</span>
    </div>`;
    return;
  }
  wrap.innerHTML = list.map(e=>`
    <div class="list-item"><div>
      <b style="color:${e.type==='income'?'#3B6B5E':'var(--rouge)'}">${e.type==='income'?'+':'-'}¥${Number(e.amount).toFixed(2)}</b>
      <div class="meta">${e.date}${e.tag?' · '+e.tag:''}${e.note?' · '+e.note:''}</div>
    </div><span class="del" onclick="deleteLedger('${e.id}')">✕</span></div>`).join('');
}

/* ============================================================
   PERIOD
   ============================================================ */
async function addPeriod(){
  const root = document.getElementById('companionBody') || document;
  const dateEl = (root.querySelector && root.querySelector('#periodDate')) || document.getElementById('periodDate');
  const date = dateEl && dateEl.value;
  if(!date) return;
  periodEntries.push({id:uid(), date});
  periodEntries.sort((a,b)=> new Date(a.date)-new Date(b.date));
  await sSet('period-entries', periodEntries);
  renderPeriod();
}
async function deletePeriod(id){
  periodEntries = periodEntries.filter(e=>e.id!==id);
  await sSet('period-entries', periodEntries); renderPeriod();
}
function renderPeriod(){
  const root = document.getElementById('companionBody') || document;
  const wrap = (root.querySelector && root.querySelector('#periodList')) || document.getElementById('periodList');
  if(!wrap) return;
  wrap.innerHTML = periodEntries.length ? [...periodEntries].reverse().map(e=>`
    <div class="list-item"><div>${e.date}</div><span class="del" onclick="deletePeriod('${e.id}')">✕</span></div>`).join('')
    : '<div class="empty-note">还没有记录</div>';
  const predictBox = (root.querySelector && root.querySelector('#periodPredict')) || document.getElementById('periodPredict');
  if(!predictBox) return;
  if(periodEntries.length < 1){ predictBox.textContent = '记录至少一次开始日期后即可预测'; return; }
  let avgCycle = 28;
  if(periodEntries.length >= 2){
    const diffs=[];
    for(let i=1;i<periodEntries.length;i++){ diffs.push((new Date(periodEntries[i].date)-new Date(periodEntries[i-1].date))/86400000); }
    avgCycle = Math.round(diffs.reduce((a,b)=>a+b,0)/diffs.length);
  }
  const last = new Date(periodEntries[periodEntries.length-1].date);
  const next = new Date(last.getTime() + avgCycle*86400000);
  predictBox.innerHTML = `平均周期约 <b>${avgCycle}</b> 天，预测下次开始日期：<b style="color:var(--rouge)">${next.toISOString().slice(0,10)}</b>`;
}

/* ============================================================
   RECIPE
   ============================================================ */
/* ---------- 宠物：奇遇 / 照看 可折叠 ---------- */

/* ============================================================
   MOMENTS 朋友圈
   ============================================================ */
function openMomentComposer(){
  momentDraftMedia = null;
  openOverlay(`
    <div class="drawer-head"><h3>发一条朋友圈</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <textarea id="momentText" placeholder="分享点什么…" style="min-height:90px;"></textarea>
    <div id="momentMediaPreview"></div>
    <input type="file" id="momentMediaInput" accept="image/*,video/*" class="hidden" onchange="onMomentMedia(event)">
    <div class="btn-row">
      <div class="btn outline" onclick="document.getElementById('momentMediaInput').click()">📎 配图 / 视频</div>
      <div class="btn" onclick="postMoment()">发布</div>
    </div>
  `);
}
function onMomentMedia(e){
  const f = e.target.files[0]; if(!f) return;
  const isVideo = f.type.startsWith('video/');
  const reader = new FileReader();
  reader.onload = async ()=>{
    const src = isVideo ? reader.result : await compressImage(reader.result, 1000);
    momentDraftMedia = { type: isVideo?'video':'image', src };
    const prev = document.getElementById('momentMediaPreview');
    if(!prev) return;
    const inner = isVideo
      ? `<video src="${momentDraftMedia.src}" style="width:100%;border-radius:4px;" controls></video>`
      : `<img loading="lazy" decoding="async" src="${momentDraftMedia.src}" style="width:100%;border-radius:4px;">`;
    prev.innerHTML = `<div style="position:relative;margin-top:8px;">${inner}
       <span class="del" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.5);color:#fff;border-radius:50%;padding:2px 7px;" onclick="clearMomentMedia()">✕</span></div>`;
  };
  reader.readAsDataURL(f);
}
function clearMomentMedia(){
  momentDraftMedia = null;
  const prev = document.getElementById('momentMediaPreview');
  if(prev) prev.innerHTML = '';
}
async function postMoment(){
  const textEl = document.getElementById('momentText');
  const text = textEl ? textEl.value.trim() : '';
  const media = momentDraftMedia;
  if(!text && !media){ alert('写点什么或配张图/视频吧'); return; }
  const post = {
    id:uid(), authorType:'user', text, time:Date.now(),
    photo: media && media.type==='image' ? media.src : null,
    video: media && media.type==='video' ? media.src : null,
    liked:false, comment:null, commented:false, likedByUser:false, comments:[]
  };
  momentsPosts.unshift(post);
  await recPut('momentsPosts', post);
  momentDraftMedia = null;
  closeOverlay();
  renderMoments();
  // 按传讯设置里的概率决定会不会点赞、会不会评论；只有「会」才登记时间，到期必执行
  if(Math.random() < ((momentInteractSettings.likeProb||60)/100)){
    await addMomentEvent('like', post.id, 'like');
  }
  if(Math.random() < ((momentInteractSettings.commentProb||60)/100)){
    await addMomentEvent('comment', post.id, 'comment');
  }
}
/* ---- 朋友圈"待触发事件"：先决定要不要互动，再随机「什么时候」；
   存时间戳靠轮询检查（跟写信/主动消息同一套思路），不用超长 setTimeout ---- */
async function addMomentEvent(type, postId, action){
  // like / comment：1~48小时，模拟"过一阵子才刷到"（调用方已先按设置概率决定要不要）
  // commentReply：1分钟~12小时；调用方已先按设置概率决定要不要回
  const range = type==='commentReply'
    ? [1*60*1000, 12*3600*1000]
    : [1*3600*1000, 48*3600*1000];
  momentEvents.push({
    id:uid(), type, postId,
    action: action || (type==='like'?'like': type==='comment'?'comment': null),
    dueAt: Date.now() + randomBetween(range[0], range[1])
  });
  await sSet('moment-events', momentEvents);
}
async function checkMomentEvents(){
  if(!momentEvents.length) return;
  const now = Date.now();
  const due = momentEvents.filter(e=> e.dueAt <= now);
  if(!due.length) return;
  momentEvents = momentEvents.filter(e=> e.dueAt > now);
  let changed = false;
  for(const e of due){
    const post = momentsPosts.find(p=>p.id===e.postId);
    if(!post) continue; // 帖子不在当前已加载分页里，跳过（多为很久以前的旧帖）
    if(e.type==='reaction' || e.type==='like' || e.type==='comment'){
      // 进队时已决定要互动，到期必执行（不再二次抛硬币）
      const doLike = e.action==='like' || e.type==='like' || (e.type==='reaction' && !e.action);
      const doComment = e.action==='comment' || e.type==='comment';
      if(doLike) post.liked = true;
      if(doComment){
        const c = getRandomCardText();
        if(c){ post.comment = c; post.commented = true; }
      }
      await recPut('momentsPosts', post);
      changed = true;
    } else if(e.type==='commentReply'){
      const reply = getRandomCardText();
      if(reply){
        if(!post.comments) post.comments = [];
        post.comments.push({ author:'bot', text:reply, time:Date.now() });
        await recPut('momentsPosts', post);
        changed = true;
      }
    }
  }
  await sSet('moment-events', momentEvents);
  if(changed && currentView==='moments'){ renderMoments(); }
}

/* ---- TA 也会自己挑内容、随机什么时候发朋友圈 ---- */
function scheduleNextProactiveMoment(){
  // 纯随机：从现在起 1～15 天之间任意挑一个时间点，哪一天触发不预先定好
  // （跟写信 scheduleNextProactiveLetter / 打电话 scheduleNextProactiveCall 同一套思路）
  const mdLo = Math.max(1, Math.min(30, Math.min(momentInteractSettings.minDays||1, momentInteractSettings.maxDays||15)));
  const mdHi = Math.max(mdLo, Math.min(30, Math.max(momentInteractSettings.minDays||1, momentInteractSettings.maxDays||15)));
  proactiveState.nextMomentAt = Date.now() + randomBetween(mdLo*24*3600*1000, mdHi*24*3600*1000);
}
async function sendProactiveMoment(){
  const lineCount = 1 + Math.floor(Math.random()*2);
  const lines = [];
  for(let i=0;i<lineCount;i++){ const c = getRandomCardText(); if(c) lines.push(c); }
  if(lines.length===0) return;
  const post = {
    id:uid(), authorType:'bot', text: lines.join('　'), photo:null, time:Date.now(),
    liked:false, comment:null, commented:false, likedByUser:false, comments:[]
  };
  momentsPosts.unshift(post);
  await recPut('momentsPosts', post);
  if(currentView==='moments'){ renderMoments(); }
  else{ momentsUnread = true; await sSet('moments-unread', true); renderUnreadDots(); tryBgNotify(chatSettings.companionName+' 发了一条动态', post.text||''); }
}

/* ---- 点赞：我可以赞任何一条，TA 对我发的也可能会赞 ---- */
async function toggleMomentLike(id){
  const post = momentsPosts.find(p=>p.id===id); if(!post) return;
  post.likedByUser = !post.likedByUser;
  await recPut('momentsPosts', post);
  renderMoments();
}
/* ---- 评论：我可以评论任何一条，TA 要不要回是纯随机的 ---- */
async function addMomentComment(id){
  const input = document.getElementById('momentCommentInput_'+id);
  if(!input) return;
  const text = input.value.trim();
  if(!text) return;
  const post = momentsPosts.find(p=>p.id===id); if(!post) return;
  if(!post.comments) post.comments = [];
  post.comments.push({ author:'user', text, time:Date.now() });
  input.value = '';
  await recPut('momentsPosts', post);
  renderMoments();
  if(Math.random() < ((momentInteractSettings.replyProb||60)/100)){
    await addMomentEvent('commentReply', post.id);
  }
}
