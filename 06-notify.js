/* ============================================================
   后台消息通知 + 后台保活
   ============================================================ */
let bgSettings = { notify:false, sound:true, keepAlive:false, temp:0.8 };
let keepAliveAudio = null;

async function loadBgSettings(){
  bgSettings = await sGet('bg-settings', bgSettings);
  tarotModelOn = !!(await sGet('tarot-model-on', false));
  applyBgSettingsUI();
}
function applyBgSettingsUI(){
  const n = document.getElementById('swBgNotify');
  const s = document.getElementById('swMsgSound');
  const k = document.getElementById('swKeepAlive');
  const t = document.getElementById('aiTempSlider');
  const swAI = document.getElementById('swTarotAI');
  const epEl = document.getElementById('tarotApiEndpoint');
  const keyEl = document.getElementById('tarotApiKey');
  const modelEl = document.getElementById('tarotApiModel');
  if(n) n.classList.toggle('on', !!bgSettings.notify);
  if(s) s.classList.toggle('on', bgSettings.sound!==false);
  if(k) k.classList.toggle('on', !!bgSettings.keepAlive);
  if(t){ t.value = bgSettings.temp||0.8; const lab=document.getElementById('tempValueLabel'); if(lab) lab.textContent = t.value; }
  if(swAI) swAI.classList.toggle('on', !!tarotModelOn);
  if(epEl && !epEl.value) epEl.value = bgSettings.aiEndpoint || '';
  if(keyEl && !keyEl.value) keyEl.value = bgSettings.aiKey || '';
  if(modelEl && !modelEl.value) modelEl.value = bgSettings.aiModel || '';
  updateModelStatusLabel();
  if(bgSettings.keepAlive) startKeepAlive(); else stopKeepAlive();
}
async function saveBgSettings(){
  const t = document.getElementById('aiTempSlider');
  if(t) bgSettings.temp = parseFloat(t.value)||0.8;
  const epEl = document.getElementById('tarotApiEndpoint');
  const keyEl = document.getElementById('tarotApiKey');
  const modelEl = document.getElementById('tarotApiModel');
  if(epEl) bgSettings.aiEndpoint = epEl.value.trim();
  if(keyEl) bgSettings.aiKey = keyEl.value.trim();
  if(modelEl) bgSettings.aiModel = modelEl.value.trim();
  await sSet('bg-settings', bgSettings);
  const lab = document.getElementById('savedConfigLabel');
  if(lab) lab.textContent = '已保存 · 温度 '+bgSettings.temp + (bgSettings.aiEndpoint ? ' · 已填接口' : ' · 未填接口');
  updateModelStatusLabel();
}
function toggleBgNotify(el){
  el.classList.toggle('on');
  bgSettings.notify = el.classList.contains('on');
  saveBgSettings();
  if(bgSettings.notify && 'Notification' in window && Notification.permission==='default') Notification.requestPermission();
}
function toggleMsgSound(el){
  el.classList.toggle('on');
  bgSettings.sound = el.classList.contains('on');
  saveBgSettings();
}
function toggleKeepAlive(el){
  el.classList.toggle('on');
  bgSettings.keepAlive = el.classList.contains('on');
  saveBgSettings();
  if(bgSettings.keepAlive) startKeepAlive(); else stopKeepAlive();
}
function startKeepAlive(){
  if(keepAliveAudio && keepAliveAudio.el){
    try{ keepAliveAudio.el.play().catch(function(){}); }catch(e){}
    return;
  }
  try{
    const a = document.createElement('audio');
    a.src = 'assets/keepalive.wav';
    a.loop = true;
    a.preload = 'auto';
    a.setAttribute('playsinline', '');
    a.setAttribute('webkit-playsinline', '');
    a.volume = 0.04;
    a.play().catch(function(err){ console.warn('keepalive play blocked', err); });
    keepAliveAudio = { el: a };
    keepAliveAudio.resumeTimer = setInterval(function(){
      if(!keepAliveAudio || !keepAliveAudio.el) return;
      if(keepAliveAudio.el.paused){
        keepAliveAudio.el.play().catch(function(){});
      }
    }, 12000);
    if(!keepAliveAudio._resumeBound){
      const resumeOnce = function(){
        if(keepAliveAudio && keepAliveAudio.el){
          keepAliveAudio.el.play().catch(function(){});
        }
      };
      document.addEventListener('visibilitychange', resumeOnce);
      document.addEventListener('touchstart', resumeOnce, { passive:true });
      document.addEventListener('click', resumeOnce);
      keepAliveAudio._resumeBound = true;
    }
  }catch(e){ console.warn('keepAlive fail', e); }
}
function stopKeepAlive(){
  if(!keepAliveAudio) return;
  try{
    if(keepAliveAudio.resumeTimer) clearInterval(keepAliveAudio.resumeTimer);
    if(keepAliveAudio.el){
      keepAliveAudio.el.pause();
      keepAliveAudio.el.removeAttribute('src');
      keepAliveAudio.el.load();
    }
  }catch(e){}
  keepAliveAudio = null;
}
/* 消息提示音：优先播放本地 wav，失败再回退到短促蜂鸣 */
let _notifyAudio = null;
function getNotifyAudio(){
  if(!_notifyAudio){
    _notifyAudio = new Audio((typeof NOTIFY_SOUND_URL!=='undefined'?NOTIFY_SOUND_URL:'assets/notify.wav'));
    _notifyAudio.preload = 'auto';
    _notifyAudio.volume = 0.7;
  }
  return _notifyAudio;
}
function playTestSound(){
  try{
    const a = getNotifyAudio();
    a.currentTime = 0;
    const p = a.play();
    if(p && typeof p.catch === 'function'){
      p.catch(function(){
        // 自动播放被拦截或文件失败时，回退 oscillator
        try{
          const ctx = new (window.AudioContext||window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = 880; g.gain.value = 0.08;
          o.connect(g); g.connect(ctx.destination);
          o.start(); setTimeout(function(){ o.stop(); ctx.close(); }, 180);
        }catch(e2){ console.warn('playTestSound fallback fail', e2); }
      });
    }
  }catch(e){
    try{
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880; g.gain.value = 0.08;
      o.connect(g); g.connect(ctx.destination);
      o.start(); setTimeout(function(){ o.stop(); ctx.close(); }, 180);
    }catch(e2){ alert('无法播放测试音'); }
  }
}
function tryBgNotify(title, body){
  // 消息提示音：独立于系统通知权限，只要开关开着就响（前台后台都响）
  if(bgSettings.sound !== false) playTestSound();
  // 系统通知：开启「后台消息通知」且已授权时，页面在后台才弹系统通知（避免前台重复打扰）
  if(bgSettings.notify && 'Notification' in window){
    if(Notification.permission === 'granted'){
      if(document.visibilityState !== 'visible'){
        try{
          new Notification(title||'新消息', {
            body: body||'',
            silent: true, // 系统通知静音，我们自己播 wav，避免双重响
            icon: undefined,
            tag: 'love-diary-msg'
          });
        }catch(e){}
      }
    } else if(Notification.permission === 'default' && bgSettings.notify){
      // 已开开关但还没授权时，下次有机会再请求
    }
  }
}


/* ============================================================
   聊天功能面板 + 一起听 / 学 / 睡
   ============================================================ */
let togetherState = {
  music: { active:false, playlist:[], playlistName:'', index:0, playing:false, progress:0, duration:180, timer:null, inviter:null, accepted:false },
  study: { active:false, inviter:null, accepted:false, note:'' },
  sleep: { active:false, inviter:null, accepted:false, note:'' }
};
