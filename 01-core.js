/* ================= IndexedDB ================= */

const DB_NAME = "EVAN_DB";
const STORE_NAME = "kv";
// 聊天记录 / 朋友圈 / 生活照片：这三类数据体积最大、会无限增长（尤其带图片），
// 单独开专门的表，一条记录一行存，不再是"整个数组打包成一坨"存储。
const REC_STORES = ["chatMessages","momentsPosts","lifePhotos"];
const DB_VERSION = 2;

let _db = null;

let _dbOpenPromise = null;
async function openDB(){
    if(_db) return _db;
    if(_dbOpenPromise) return _dbOpenPromise; // 避免同一时间好几个读写调用各自重复开一次连接

    _dbOpenPromise = new Promise((resolve,reject)=>{
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = ()=>{
            const db=req.result;
            if(!db.objectStoreNames.contains(STORE_NAME)){
                db.createObjectStore(STORE_NAME);
            }
            REC_STORES.forEach(name=>{
                if(!db.objectStoreNames.contains(name)){
                    const s = db.createObjectStore(name, {keyPath:'id'});
                    s.createIndex('time','time',{unique:false});
                }
            });
        };

        req.onsuccess=()=>{
            _db=req.result;
            resolve(_db);
        };

        req.onerror=()=>{
            _dbOpenPromise = null; // 这次没开成，别把失败结果缓存住，下次还能重新尝试
            reject(req.error);
        };

        req.onblocked=()=>{
            _dbOpenPromise = null;
            reject(new Error('indexeddb blocked'));
        };
    });
    return _dbOpenPromise;
}

async function idbGet(key){
    const db=await openDB();

    return new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,"readonly");
        const store=tx.objectStore(STORE_NAME);

        const req=store.get(key);

        req.onsuccess=()=>resolve(req.result);

        req.onerror=()=>reject(req.error);
    });
}

async function idbSet(key,value){
    const db=await openDB();

    return new Promise((resolve,reject)=>{
        const tx=db.transaction(STORE_NAME,"readwrite");
        const store=tx.objectStore(STORE_NAME);

        store.put(value,key);

        tx.oncomplete=()=>resolve();

        tx.onerror=()=>reject(tx.error);
    });
}

/* ============================================================
   逐条记录存储（chatMessages / momentsPosts / lifePhotos 专用）
   ------------------------------------------------------------
   旧问题：这几类数据以前是"整个数组序列化成一个大 JSON 字符串"整坨存取的——
   哪怕只是新发一条消息，也要把全部历史（包括里面所有的图片）重新
   JSON.stringify 一遍再整体写入 IndexedDB；数据越攒越多，每次读写都越来越慢，
   严重时启动要先把这一整坨解析完才能进主页，数据一大甚至直接卡死进不去。
   新方案：这三类各自有独立的 IndexedDB 表，一条记录是表里独立的一行，
   新增/修改/删除只动那一条，不会牵动其余记录；打开 App 时也只按需加载
   最近一批，更早的历史翻页/点"加载更多"时才去读，从根上解决越用越卡的问题。
   ============================================================ */
async function recPut(storeName, item){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
        const tx = db.transaction(storeName,'readwrite');
        tx.objectStore(storeName).put(item);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
    });
}
async function recPutMany(storeName, items){
    if(!items || !items.length) return;
    const db = await openDB();
    return new Promise((resolve,reject)=>{
        const tx = db.transaction(storeName,'readwrite');
        const store = tx.objectStore(storeName);
        items.forEach(it=>store.put(it));
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
    });
}
async function recDelete(storeName, id){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
        const tx = db.transaction(storeName,'readwrite');
        tx.objectStore(storeName).delete(id);
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
    });
}
async function recClear(storeName){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
        const tx = db.transaction(storeName,'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete=()=>resolve();
        tx.onerror=()=>reject(tx.error);
    });
}
// 按时间取一页：不传 beforeTime 取"最新一页"；传入 beforeTime 取"比它更早"的一页（翻页用）。
// 返回结果按时间从旧到新排好，方便直接拼进现有数组渲染。
async function recGetPage(storeName, limit, beforeTime){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
        const tx = db.transaction(storeName,'readonly');
        const idx = tx.objectStore(storeName).index('time');
        const range = (beforeTime!=null) ? IDBKeyRange.upperBound(beforeTime, true) : null;
        const req = idx.openCursor(range, 'prev');
        const out = [];
        req.onsuccess = (e)=>{
            const cursor = e.target.result;
            if(cursor && out.length < limit){
                out.push(cursor.value);
                cursor.continue();
            } else {
                resolve(out.reverse());
            }
        };
        req.onerror=()=>reject(req.error);
    });
}
async function recGetAll(storeName){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
        const tx = db.transaction(storeName,'readonly');
        const req = tx.objectStore(storeName).index('time').getAll();
        req.onsuccess=()=>resolve(req.result);
        req.onerror=()=>reject(req.error);
    });
}

/* ---- 分页状态 + 通用的"首次加载一页 / 再加载更早一页" ---- */
const PAGE_SIZE = { chatMessages:60, momentsPosts:20, lifePhotos:30 };
let pageState = {
  chatMessages: { exhausted:false },
  momentsPosts: { exhausted:false },
  lifePhotos: { exhausted:false }
};
async function loadInitialPage(storeName){
  const items = await recGetPage(storeName, PAGE_SIZE[storeName]);
  pageState[storeName].exhausted = items.length < PAGE_SIZE[storeName];
  return items;
}
// arr 必须是"按时间从旧到新"排好序的当前已加载数组，返回更早的一批（同样从旧到新排好）
async function loadOlderPage(storeName, arr){
  const st = pageState[storeName];
  if(st.exhausted || !arr.length) return [];
  const oldestTime = arr[0].time;
  const older = await recGetPage(storeName, PAGE_SIZE[storeName], oldestTime);
  st.exhausted = older.length < PAGE_SIZE[storeName];
  return older;
}

/* ---- 一次性迁移：把旧版"整坨 JSON"数据拆成逐条记录，只需要跑一次 ---- */
async function migrateToRecordStores(){
  const done = await sGet('rec-store-migrated-v2', false);
  if(done) return;
  try{
    const oldChat = await sGet('chat-messages', null);
    if(Array.isArray(oldChat) && oldChat.length){
      await recPutMany('chatMessages', oldChat.map((m,i)=> m.time ? m : {...m, time: Date.now() - (oldChat.length - i)}));
    }
    const oldMoments = await sGet('moments-posts', null);
    if(Array.isArray(oldMoments) && oldMoments.length){
      await recPutMany('momentsPosts', oldMoments.map((p,i)=> p.time ? p : {...p, time: Date.now() - i}));
    }
    const oldPhotos = await sGet('life-photos', null);
    if(Array.isArray(oldPhotos) && oldPhotos.length){
      await recPutMany('lifePhotos', oldPhotos.map((p,i)=> ({...p, time: p.time || (Date.now() - i)})));
    }
    // 迁移完成后把旧的整坨清空、回收空间——记录已经安全地在专用表里了
    await sSet('chat-messages', []);
    await sSet('moments-posts', []);
    await sSet('life-photos', []);
  }catch(e){
    console.warn('迁移到逐条存储失败，下次打开会自动重试', e);
    return; // 不标记完成，下次启动再试一次
  }
  await sSet('rec-store-migrated-v2', true);
}

/* ============================================================
   STORAGE HELPERS
   ============================================================ */
let storageFailCount = 0;
function hasCloudStorage(){ return typeof window.storage !== 'undefined' && window.storage !== null; }
// ---- 云端写入排队：同一时刻只发一个 window.storage.set 请求，请求之间留出间隔，
//      避免启动时好几个模块几乎同时存档而撞上服务端的限流(rate limit)。
//      命中限流会自动等一下重试（最多3次），不会像以前那样立刻报错刷屏。
let _cloudWriteQueue = Promise.resolve();
function queueCloudWrite(fn){
  const run = _cloudWriteQueue.then(async ()=>{
    const result = await fn();
    await new Promise(r=>setTimeout(r, 250)); // 请求间隔，给限流窗口留出余量
    return result;
  });
  _cloudWriteQueue = run.catch(()=>{}); // 前一个失败也不能卡住队列
  return run;
}
function isRateLimitError(e){
  const msg = (e && e.message) ? e.message : String(e||'');
  return /rate limit/i.test(msg);
}
async function sGet(key, fallback){
  if(hasCloudStorage()){
    try{
      const r = await window.storage.get(key, false);
      if(r) return JSON.parse(r.value);
    }catch(e){ /* 云端这次读取失败，往下走本地兜底 */ }
  }

try{
    const raw = await idbGet('EVAN:'+key);
    if(raw !== undefined && raw !== null){
        return JSON.parse(raw);
    }
}catch(e){
    // IndexedDB 失败，再尝试 localStorage
    try{
        const raw = localStorage.getItem('EVAN:'+key);
        if(raw !== null) return JSON.parse(raw);
    }catch(e){}
}  return fallback;
}
async function sSet(key, obj){
  let cloudOk = false;
  if(hasCloudStorage()){
    const payload = JSON.stringify(obj);
    for(let attempt=0; attempt<3 && !cloudOk; attempt++){
      try{
        await queueCloudWrite(()=> window.storage.set(key, payload, false));
        cloudOk = true;
        storageFailCount = 0;
      }catch(e){
        if(isRateLimitError(e) && attempt<2){
          // 命中限流：安静地等一下再重试，不刷警告
          await new Promise(r=>setTimeout(r, 600 * (attempt+1)));
          continue;
        }
        storageFailCount++;
        console.warn('cloud storage set failed (第'+storageFailCount+'次)', key, e);
      }
    }
  }
  if(!cloudOk){
    // 云端这次没存上（不代表以后也存不上，下次还会再试），先落到本地兜底
    let idbOk = false;
    try{
      await idbSet('EVAN:'+key, JSON.stringify(obj));
      idbOk = true;
    }catch(e){
      console.warn("IndexedDB 保存失败，改用 localStorage 兜底", e);
    }
    if(!idbOk){
      // 只有 IndexedDB 也失败了，才退到 localStorage（避免每次都重复写一份大数据占用它的几MB配额）
      try{
        localStorage.setItem('EVAN:'+key, JSON.stringify(obj));
        idbOk = true; // localStorage 兜底成功了，也算存上了
      }catch(e){
        console.warn("localStorage 保存也失败了", e);
      }
    }
    setSaveStatus(idbOk ? 'saved' : 'error');
    return;
  }
  setSaveStatus('saved');
}
let _saveToastTimer = null;
function setSaveStatus(state){
  const el = document.getElementById('saveToast');
  if(!el) return;
  clearTimeout(_saveToastTimer);

  if(state==='error'){
    el.textContent = '存储暂时波动，建议偶尔导出备份';
    el.classList.add('warn');
    el.classList.add('show');
    _saveToastTimer = setTimeout(()=>{ 
      el.classList.remove('show'); 
    }, 2000);
  } else {
    // 保存成功不弹提示，安安静静存就行
    el.classList.remove('show');
    el.classList.remove('warn');
  }
}
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }

/* ============================================================
   STATE
   ============================================================ */
let profile = { name:'陆沉', status:'', avatar:'🌙', photo:null, myName:'我', myAvatar:'🙂', myBio:'', momentsCover:null, anniversaryDate:null };
let chatSettings = { companionName:'陆沉', delayMin:1, delayMax:5, readNoReply:false, redPacketEnabled:false, background:null, stickers:[
  {id:'e1', type:'emoji', value:'🌙'}, {id:'e2', type:'emoji', value:'☕'}, {id:'e3', type:'emoji', value:'📖'}
]};
let chatMessages = [];
let cardsData = { groups:{} };
let ledgerEntries = [];
let periodEntries = [];
let diaryEntries = [];
let momentsPosts = [];
let momentEvents = []; // 朋友圈"待触发事件"队列（点赞/评论、回评论），持久化存储，靠轮询检查而非setTimeout，防止长延迟跨设备/跨刷新失效
let momentDraftMedia = null;
let letters = [];
let inboxLetters = [];
let callLogs = [];
let activeCall = null;
let quoteTarget = null;
let proactiveState = { nextMsgAt:null, nextLetterAt:null, nextCallAt:null, nextMomentAt:null, nextCareAt:null };
let chatUnread = false;
let letterUnread = false;
let inboxLetterUnread = false;
let momentsUnread = false;
let lifePhotos = [];
let statusPool = [];
let todayStatus = null;
let todayStatusHistory = [];
// 摸鱼：活动/地点字卡 + 自动生成的时间线记录
let moyuState = {
  enabled: false,
  showDetails: true,   // 是否显示具体信息
  activities: [],      // 摸鱼活动
  locations: [],       // 工作地点
  // 当前这一班：地点 + 上班时长 + 活动时间线
  currentSession: null, // { id, location, startTime, workMs, records:[{id,text,time}] }
  history: [],          // 已结束的班次
  nextAt: null
};
// 主动消息：开关 + 最短/最长分钟区间随机
let proactiveMsgSettings = { enabled: true, intervalMinutes: 60 }; // 单滑条 1~120，在 1～该值分钟内随机
// 朋友圈互动概率（0~100）与主动发朋友圈天数区间，均可在传讯设置里调节
let momentInteractSettings = { likeProb: 60, commentProb: 60, replyProb: 60, minDays: 1, maxDays: 15 };
// 拼字卡：开启后回复会随机把多张字卡拼成一段再发
let spliceCardsEnabled = false;
let currentView = 'home';
let themeSettings = { accent:'#9C2F3B', paperStyle:'grid', bodyFont:'sans', secondaryFont:'serif', inkColor:'', nameColor:'', customBg:'', customBgImage:'', annivBg:'', annivBgImage:'' };
let customBubbleCSS = '';
let pendingReplyTimer = null;
let lastGroupUsed = null, lastCardUsed = {};

const ACCENTS = ['#9C2F3B','#B08A2E','#3B6B5E','#4C5B8A','#7A4E8C','#2A241F'];
const FONT_MAP = {
  sans: "'Noto Sans SC', sans-serif",
  serif: "'Noto Serif SC', serif",
  hand: "'Ma Shan Zheng', cursive"
};

/* ============================================================
   INIT
   ============================================================ */
async function init(){
  // ---- 阶段 1：只拿首页必需数据，尽快首屏 ----
  profile = await sGet('profile', profile);
  if(!profile.myName) profile.myName = '我';
  if(!profile.myAvatar) profile.myAvatar = '🙂';
  if(profile.momentsCover === undefined) profile.momentsCover = null;
  try {
    themeSettings = await sGet('theme-settings', themeSettings);
  } catch(e) {}
  if(!themeSettings.customBg) themeSettings.customBg = '';
  if(!themeSettings.customBgImage) themeSettings.customBgImage = '';
  if(!themeSettings.annivBg) themeSettings.annivBg = '';
  if(!themeSettings.annivBgImage) themeSettings.annivBgImage = '';
  if(themeSettings.inkColor === undefined) themeSettings.inkColor = '';
  if(!themeSettings.secondaryFont) themeSettings.secondaryFont = 'serif';
  if(themeSettings.nameColor === undefined) themeSettings.nameColor = '';
  try { customBubbleCSS = await sGet('custom-bubble-css', ''); } catch(e) {}
  applyTheme();
  applyCustomBubbleCSSToPage();
  renderHomeProfile();
  // 让出一帧给浏览器先画首页，避免存储全读完才出画面
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  // ---- 阶段 2：其余数据并行加载 ----
  chatSettings = await sGet('chat-settings', chatSettings);
  if(typeof chatSettings.delayMin !== 'number') chatSettings.delayMin = 1;
  if(typeof chatSettings.delayMax !== 'number') chatSettings.delayMax = 5;
  chatSettings.delayMin = Math.max(1, Math.min(5, Math.round(chatSettings.delayMin)));
  chatSettings.delayMax = Math.max(chatSettings.delayMin, Math.min(5, Math.round(chatSettings.delayMax)));
  delete chatSettings.delayUnit;
  if(typeof chatSettings.redPacketEnabled !== 'boolean') chatSettings.redPacketEnabled = false;

  await migrateToRecordStores();

  const [
    _chatMessages, _cardsData, _ledgerEntries, _periodEntries, _diaryEntries,
    _momentsPosts, _momentEvents, _letters, _inboxLetters, _callLogs,
    _proactiveState, _chatUnread, _letterUnread, _inboxLetterUnread, _momentsUnread,
    _lifePhotos, _statusPool, _todayStatus, _todayStatusHistory, _moyuState,
    _proactiveMsgSettings, _momentInteractSettings, _spliceCardsEnabled
  ] = await Promise.all([
    loadInitialPage('chatMessages'),
    sGet('cards-data', {groups:{}}),
    sGet('ledger-entries', []),
    sGet('period-entries', []),
    sGet('diary-entries', []),
    loadInitialPage('momentsPosts'),
    sGet('moment-events', []),
    sGet('letters', []),
    sGet('inbox-letters', []),
    sGet('call-logs', []),
    sGet('proactive-state', { nextMsgAt:null, nextLetterAt:null, nextCallAt:null, nextMomentAt:null, nextCareAt:null }),
    sGet('chat-unread', false),
    sGet('letter-unread', false),
    sGet('inbox-letter-unread', false),
    sGet('moments-unread', false),
    loadInitialPage('lifePhotos'),
    sGet('status-pool', []),
    sGet('today-status', null),
    sGet('today-status-history', []),
    sGet('moyu-state', moyuState),
    sGet('proactive-msg-settings', proactiveMsgSettings),
    sGet('moment-interact-settings', momentInteractSettings),
    sGet('splice-cards-enabled', false)
  ]);
  chatMessages = _chatMessages;
  cardsData = _cardsData;
  ledgerEntries = _ledgerEntries;
  periodEntries = _periodEntries;
  diaryEntries = _diaryEntries;
  momentsPosts = _momentsPosts;
  momentEvents = _momentEvents;
  letters = _letters;
  inboxLetters = _inboxLetters;
  callLogs = _callLogs;
  proactiveState = _proactiveState;
  chatUnread = _chatUnread;
  letterUnread = _letterUnread;
  inboxLetterUnread = _inboxLetterUnread;
  momentsUnread = _momentsUnread;
  lifePhotos = _lifePhotos;
  statusPool = _statusPool;
  todayStatus = _todayStatus;
  todayStatusHistory = _todayStatusHistory || [];
  moyuState = _moyuState;
  proactiveMsgSettings = _proactiveMsgSettings;
  momentInteractSettings = _momentInteractSettings;
  spliceCardsEnabled = !!_spliceCardsEnabled;

  await loadCompanionData();

  // 兼容旧数据：写信/来信混在一起
  const legacyBotLetters = letters.filter(l=>l.from==='bot');
  if(legacyBotLetters.length){
    inboxLetters = [...legacyBotLetters, ...inboxLetters].sort((a,b)=> b.time-a.time);
    letters = letters.filter(l=>l.from!=='bot');
    sSet('letters', letters);
    sSet('inbox-letters', inboxLetters);
  }

  // moyu / proactiveMsg / momentInteract 规范化（与原先一致，精简写法）
  if(!Array.isArray(moyuState.activities)) moyuState.activities = [];
  if(!Array.isArray(moyuState.locations)) moyuState.locations = [];
  if(!Array.isArray(moyuState.history)) moyuState.history = [];
  if(typeof moyuState.showDetails !== 'boolean') moyuState.showDetails = true;
  if(typeof moyuState.enabled !== 'boolean') moyuState.enabled = false;
  if(Array.isArray(moyuState.records) && moyuState.records.length && !moyuState.currentSession){
    moyuState.currentSession = {
      id: uid(), location: '未知地点', startTime: moyuState.records[moyuState.records.length-1].time,
      workMs: 4*3600*1000, records: moyuState.records.slice().reverse()
    };
    delete moyuState.records;
  }
  {
    let iv = Number(proactiveMsgSettings.intervalMinutes);
    if(!Number.isFinite(iv)){
      const oldMax = Number(proactiveMsgSettings.maxMinutes);
      iv = Number.isFinite(oldMax) ? oldMax : 60;
    }
    proactiveMsgSettings.intervalMinutes = Math.max(1, Math.min(120, Math.round(iv)));
    delete proactiveMsgSettings.minMinutes;
    delete proactiveMsgSettings.maxMinutes;
  }
  if(typeof proactiveMsgSettings.enabled !== 'boolean') proactiveMsgSettings.enabled = true;
  if(typeof momentInteractSettings.likeProb !== 'number') momentInteractSettings.likeProb = 60;
  if(typeof momentInteractSettings.commentProb !== 'number') momentInteractSettings.commentProb = 60;
  if(typeof momentInteractSettings.replyProb !== 'number') momentInteractSettings.replyProb = 60;
  if(typeof momentInteractSettings.minDays !== 'number') momentInteractSettings.minDays = 1;
  if(typeof momentInteractSettings.maxDays !== 'number') momentInteractSettings.maxDays = 15;
  momentInteractSettings.likeProb = Math.max(0, Math.min(100, momentInteractSettings.likeProb));
  momentInteractSettings.commentProb = Math.max(0, Math.min(100, momentInteractSettings.commentProb));
  momentInteractSettings.replyProb = Math.max(0, Math.min(100, momentInteractSettings.replyProb));
  momentInteractSettings.minDays = Math.max(1, Math.min(30, momentInteractSettings.minDays));
  momentInteractSettings.maxDays = Math.max(momentInteractSettings.minDays, Math.min(30, momentInteractSettings.maxDays));

  // 首页轻量补渲染
  renderTodayStatusHome();
  renderMoyuHome();
  renderUnreadDots();

  // ---- 阶段 3：延后挂定时器 / 回信恢复，不挡首屏 ----
  const defer = (fn) => {
    if(typeof requestIdleCallback === 'function') requestIdleCallback(() => { try{ fn(); }catch(e){ console.warn(e); } }, { timeout: 2000 });
    else setTimeout(() => { try{ fn(); }catch(e){ console.warn(e); } }, 0);
  };
  defer(() => {
    resumeLetterTimers();
    resumeInboxLetterReplyTimers();
    ensureProactiveSchedule();
    armAllProactiveTimers();
    checkMomentEvents();
    checkQuestionnaireReplies();
    resumeMoyuSchedule();
    if(!hasReplyScheduled()) maybeScheduleFromHistory();
  });
  setInterval(checkMomentEvents, 20000);
  setInterval(checkMoyuTick, 20000);
  setInterval(checkQuestionnaireReplies, 20000);
  const periodEl = document.getElementById('periodDate');
  if(periodEl) try{ periodEl.valueAsDate = new Date(); }catch(e){}
}

/* ============================================================
   NAV
   ============================================================ */
const VIEW_TITLES = { home:'EVAN', chat:'传讯', cards:'字卡', ledger:'记账', period:'月经', companion:'陪伴记录', settings:'设置', diary:'日记', beautify:'美化', moments:'朋友圈', letters:'写信', inboxLetters:'来信', calls:'通话', tarot:'塔罗', 'tarot-draw':'抽牌' };
function go(name){
  if(name==='beautify') name = 'settings'; // 美化已并入设置
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  const target = document.getElementById('view-'+name);
  if(!target){ console.warn('view not found:', name); go('home'); return; }
  target.classList.remove('hidden');
  const bn = document.getElementById('bnTitle');
  if(bn) bn.textContent = VIEW_TITLES[name] || 'EVAN';
  currentView = name;
  // 传讯全屏：隐藏底部导航
  const bottomNav = document.querySelector('.bottom-nav');
  if(bottomNav) bottomNav.style.display = (name==='chat') ? 'none' : '';
  if(name==='chat'){
    // 之前只清了红点、没重新渲染：主动消息在你不在聊天页时已经 push 进 chatMessages 并存库了，
    // 但界面还是旧的，得手动刷新页面才会显示——这也是导致视频通话被刷新中断的原因。
    renderChat();
    scrollChatBottom();
    if(chatUnread){ chatUnread=false; sSet('chat-unread', false); renderUnreadDots(); }
  }
  if(name==='cards'){ renderCardsView(); }
  if(name==='period'){ renderPeriod(); }
  if(name==='companion'){ renderCompanionBody(); }
  if(name==='calls'){ renderCallLog(); }
  if(name==='lifephotos'){ renderLifePhotos(); }
  if(name==='chat'){
    // 之前只清了红点、没重新渲染：主动消息在你不在聊天页时已经 push 进 chatMessages 并存库了，
    // 但界面还是旧的，得手动刷新页面才会显示。
    renderChat();
    scrollChatBottom();
    if(chatUnread){chatUnread=false; sSet('chat-unread', false); renderUnreadDots(); }
  }
  if(name==='letters'){
    renderLetters();
    if(letterUnread){ letterUnread=false; sSet('letter-unread', false); renderUnreadDots(); }
  }
  if(name==='inboxLetters'){
    renderInboxLetters();
    if(inboxLetterUnread){ inboxLetterUnread=false; sSet('inbox-letter-unread', false); renderUnreadDots(); }
  }
  if(name==='moments'){
    renderMoments();
    if(momentsUnread){ momentsUnread=false; sSet('moments-unread', false); renderUnreadDots(); }
  }
  if(name==='ledger'){ renderLedger(); }
  if(name==='diary'){ renderDiary(); }
  if(name==='settings'){ renderBeautify(); if(typeof fillSettingsForm==='function') fillSettingsForm(); }
}
function renderUnreadDots(){
  const cd = document.getElementById('chatDot'); if(cd) cd.classList.toggle('hidden', !chatUnread);
  const ld = document.getElementById('letterDot'); if(ld) ld.classList.toggle('hidden', !letterUnread);
  const ild = document.getElementById('inboxLetterDot'); if(ild) ild.classList.toggle('hidden', !inboxLetterUnread);
  const md = document.getElementById('momentsDot'); if(md) md.classList.toggle('hidden', !momentsUnread);
}

/* ============================================================
   HOME / PROFILE
   ============================================================ */
function renderHomeProfile(){
  const nameHero = document.getElementById('pNameHero');
  if(nameHero) nameHero.textContent = profile.name;
  const caption = document.getElementById('polaroidCaption');
  if(caption) caption.textContent = profile.status || '';
  const ph = document.getElementById('polaroidPh');
  if(ph) ph.innerHTML = profile.photo ? `<img loading="lazy" decoding="async" src="${profile.photo}">` : '';
  document.getElementById('chatCName').textContent = chatSettings.companionName;
  document.getElementById('chatTitle').textContent = '传讯 · '+chatSettings.companionName;
  const chatAvatarEl = document.getElementById('chatAvatarBox');
  if(chatAvatarEl) chatAvatarEl.innerHTML = profile.avatar && profile.avatar.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${profile.avatar}">` : (profile.avatar||'🌙');
  renderMomentsHeader();
  renderAnniversary();
}
/* ---- 纪念日：头像跟朋友圈/传讯用的是同一份数据，改一处三处都会同步 ---- */
function renderAnniversary(){
  const mineEl = document.getElementById('annivMyAvatar');
  if(mineEl) mineEl.innerHTML = profile.myAvatar && profile.myAvatar.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${profile.myAvatar}">` : (profile.myAvatar||'');
  const theirEl = document.getElementById('annivTheirAvatar');
  if(theirEl) theirEl.innerHTML = profile.avatar && profile.avatar.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${profile.avatar}">` : (profile.avatar||'');
  const theirNameEl = document.getElementById('annivTheirName');
  if(theirNameEl) theirNameEl.textContent = profile.name;
  const myNameEl = document.getElementById('annivMyName');
  if(myNameEl) myNameEl.textContent = profile.myName || '我';
  const daysEl = document.getElementById('annivDaysText');
  if(!daysEl) return;
  if(!profile.anniversaryDate){ daysEl.textContent = '？'; return; }
  const start = new Date(profile.anniversaryDate+'T00:00:00');
  const now = new Date();
  const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((nowMid - startMid) / 86400000) + 1;
  daysEl.textContent = days > 0 ? days : '？';
}
/* ---- 名字：跟朋友圈/传讯/设置页用的是同一份 profile.name / profile.myName，这里改一处，别处都会同步 ---- */
function editTheirName(){
  openOverlay(`
    <div class="drawer-head"><h3>修改TA的名字</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">名字</label>
    <input type="text" id="editNameInput" value="${(profile.name||'').replace(/"/g,'&quot;')}" maxlength="20">
    <div class="btn-row"><div class="btn" onclick="confirmEditTheirName()">保存</div></div>
  `);
  setTimeout(()=>{ const el=document.getElementById('editNameInput'); if(el){ el.focus(); el.select(); } }, 50);
}
async function confirmEditTheirName(){
  const el = document.getElementById('editNameInput');
  const trimmed = (el && el.value || '').trim();
  if(!trimmed){ alert('名字不能为空'); return; }
  profile.name = trimmed;
  await sSet('profile', profile);
  renderHomeProfile();
  closeOverlay();
}
function editMyName(){
  openOverlay(`
    <div class="drawer-head"><h3>修改我的名字</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <p style="font-size:12px;color:var(--ink-soft);margin:0 0 8px;">会同步到朋友圈、传讯等所有地方</p>
    <label class="field">我的昵称</label>
    <input type="text" id="editMyNameInput" value="${(profile.myName||'我').replace(/"/g,'&quot;')}" maxlength="20">
    <div class="btn-row"><div class="btn" onclick="confirmEditMyName()">保存</div></div>
  `);
  setTimeout(()=>{ const el=document.getElementById('editMyNameInput'); if(el){ el.focus(); el.select(); } }, 50);
}
async function confirmEditMyName(){
  const el = document.getElementById('editMyNameInput');
  const trimmed = (el && el.value || '').trim();
  if(!trimmed){ alert('名字不能为空'); return; }
  profile.myName = trimmed;
  await sSet('profile', profile);
  renderHomeProfile();
  closeOverlay();
}
async function editAnniversaryDate(){
  openOverlay(`
    <div class="drawer-head"><h3>设置纪念日</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">从哪天开始算"在一起"</label>
    <input type="date" id="annivDateInput" value="${profile.anniversaryDate||''}">
    <div class="btn-row"><div class="btn" onclick="saveAnniversaryDate()">保存</div></div>
  `);
}
async function saveAnniversaryDate(){
  const val = document.getElementById('annivDateInput').value;
  if(!val) return;
  profile.anniversaryDate = val;
  await sSet('profile', profile);
  renderAnniversary();
  closeOverlay();
}
function editPolaroidCaption(){
  openOverlay(`
    <div class="drawer-head"><h3>修改这句话</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">文案</label>
    <textarea id="editCaptionInput" style="min-height:72px;">${(profile.status||'').replace(/</g,'&lt;')}</textarea>
    <div class="btn-row"><div class="btn" onclick="confirmEditCaption()">保存</div></div>
  `);
  setTimeout(()=>{ const el=document.getElementById('editCaptionInput'); if(el) el.focus(); }, 50);
}
async function confirmEditCaption(){
  const el = document.getElementById('editCaptionInput');
  profile.status = (el && el.value || '').trim();
  await sSet('profile', profile);
  renderHomeProfile();
  closeOverlay();
}
function renderMomentsHeader(){
  const cover = document.getElementById('momentsCover');
  if(cover) cover.style.backgroundImage = profile.momentsCover ? `url(${profile.momentsCover})` : '';
  const av = document.getElementById('momentsAvatarBox');
  if(av) av.innerHTML = profile.myAvatar && profile.myAvatar.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${profile.myAvatar}">` : (profile.myAvatar||'🙂');
  const nm = document.getElementById('momentsNameLabel');
  if(nm) nm.textContent = profile.myName || '我';
  const bio = document.getElementById('momentsBioLabel');
  if(bio) bio.textContent = profile.myBio || '点这里写一句签名';
}
async function editMomentsBio(){
  openOverlay(`
    <div class="drawer-head"><h3>写一句签名</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">签名</label>
    <textarea id="editBioInput" style="min-height:72px;">${(profile.myBio||'').replace(/</g,'&lt;')}</textarea>
    <div class="btn-row"><div class="btn" onclick="confirmEditBio()">保存</div></div>
  `);
  setTimeout(()=>{ const el=document.getElementById('editBioInput'); if(el) el.focus(); }, 50);
}
async function confirmEditBio(){
  const el = document.getElementById('editBioInput');
  profile.myBio = (el && el.value || '').trim();
  await sSet('profile', profile);
  renderMomentsHeader();
  closeOverlay();
}
function searchMoments(){
  const q = document.getElementById('momentsSearchInput').value.trim();
  if(!q) { renderMoments(); return; }
  const wrap = document.getElementById('momentsList');
  const hits = momentsPosts.filter(p => (p.text||'').includes(q));
  wrap.innerHTML = hits.length
    ? hits.map(p=>`<div class="box"><div style="font-size:12.5px;color:var(--ink-soft);">${new Date(p.time).toLocaleString('zh-CN')}</div><div style="font-size:13.5px;margin-top:4px;">${p.text||''}</div></div>`).join('')
    : '<div class="empty-note">没有找到相关的朋友圈</div>';
}
function onMomentsCoverFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    profile.momentsCover = await compressImage(reader.result, 1000);
    await sSet('profile', profile);
    renderMomentsHeader();
  };
  reader.readAsDataURL(f);
}
function onMyAvatarFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    profile.myAvatar = await compressImage(reader.result, 400);
    await sSet('profile', profile);
    renderMomentsHeader();
    renderMoments();
    renderAnniversary();
  };
  reader.readAsDataURL(f);
}

/* ============================================================
   生活照片
   ============================================================ */
function onLifePhotoFile(e){
  const files = Array.from(e.target.files || []);
  if(files.length===0) return;
  let remaining = files.length;

  files.forEach(f=>{
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const compressed = await compressImage(ev.target.result, 800); // 压缩处理
      if(compressed){
        const photo = { id:uid(), src: compressed, time: Date.now() };
        lifePhotos.unshift(photo);
        await recPut('lifePhotos', photo);
      }
      remaining--;
      if(remaining===0){
        renderLifePhotos();
      }
    };
    reader.onerror = () => { // 读取失败也别让整批添加卡住
      remaining--;
      if(remaining===0){
        renderLifePhotos();
      }
    };
    reader.readAsDataURL(f);
  });
}async function deleteLifePhoto(id){
  lifePhotos = lifePhotos.filter(p=>p.id!==id);
  await recDelete('lifePhotos', id);
  renderLifePhotos();
}
async function loadMoreLifePhotos(){
  const older = await loadOlderPage('lifePhotos', [...lifePhotos].reverse());
  if(!older.length) return;
  lifePhotos = [...lifePhotos, ...older.reverse()];
  renderLifePhotos();
}
function renderLifePhotos(){
  const wrap = document.getElementById('lifePhotoGrid');
  if(!wrap) return;
  const moreBtn = !pageState.lifePhotos.exhausted ? `<div class="load-more-bar" onclick="loadMoreLifePhotos()">加载更早的照片 ↓</div>` : '';
  wrap.innerHTML = lifePhotos.length
    ? lifePhotos.map(p=>
        `<div class="ph-item"><img loading="lazy" decoding="async" src="${p.src}"><div class="del" onclick="deleteLifePhoto('${p.id}')">✕</div></div>`
      ).join('') + moreBtn
    : '<div class="empty-note">还没有照片，点下面加一张吧</div>';
}
// ==================== 图片压缩函数 ====================
async function compressImage(dataUrl, maxWidth = 800) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > maxWidth) {
        height = Math.round(height * maxWidth / width);
        width = maxWidth;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve(null); // 解码失败（例如手机相册里的特殊格式照片）时别让整批添加卡死，跳过这张
    img.src = dataUrl;
  });
}
// ==================== 结束 ====================
/* ============================================================
   今日状态：自由导入一批状态，一天内随机时机自动换一个显示
   ------------------------------------------------------------
   不用 setInterval 定时触发——App 切到后台时定时器会被系统暂停（跟之前
   主动消息打字指示器踩过的坑一样），定时器到点了也不会真的执行。
   改成"记录下次该变的时间点，每次有机会渲染时顺便检查一下有没有到点"，
   这样哪怕 App 被搁置很久，一打开就能立刻补上该有的变化。
   ============================================================ */
function todayKey(){
  const d = new Date();
  return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
}
function pickRandomStatusText(){
  return statusPool[Math.floor(Math.random()*statusPool.length)];
}
function nextStatusChangeDelay(){
  const minH = 1, maxH = 24; // 1~24小时之间随机一个间隔
  return (minH + Math.random()*(maxH-minH)) * 3600 * 1000;
}
function pruneStatusHistoryToToday(){
  const key = todayKey();
  todayStatusHistory = todayStatusHistory.filter(h=>h.date===key);
}
function recordStatusHistory(text){
  pruneStatusHistoryToToday();
  todayStatusHistory.push({ date: todayKey(), text, time: Date.now() });
  sSet('today-status-history', todayStatusHistory);
}
function ensureTodayStatus(){
  const key = todayKey();
  const due = !todayStatus || todayStatus.date !== key || !todayStatus.nextChangeAt || Date.now() >= todayStatus.nextChangeAt;
  if(due){
    if(statusPool.length > 0){
      todayStatus = { date:key, text: pickRandomStatusText(), nextChangeAt: Date.now() + nextStatusChangeDelay() };
      sSet('today-status', todayStatus);
      recordStatusHistory(todayStatus.text);
    } else {
      todayStatus = null;
    }
  }
}
function renderTodayStatusHome(){
  const el = document.getElementById('todayStatusText');
  if(!el) return;
  if(todayStatus && todayStatus.text){
    el.textContent = todayStatus.text;
    el.style.color = '';
  } else {
    el.textContent = '[未设置状态]';
    el.style.color = 'var(--ink-soft)';
  }
}

function openTodayStatusPanel(){
  openOverlay(`
    <div class="drawer-head"><h3>今日状态</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <div style="font-size:16px;font-weight:700;color:var(--rouge);margin-bottom:10px;">${todayStatus ? todayStatus.text : '暂无状态，先导入一些吧'}</div>
    <div class="btn-row">
      ${todayStatus ? `<div class="btn outline" onclick="rerollTodayStatus()">🎲 换一个</div>` : ''}
      <div class="btn outline" onclick="openTodayStatusHistoryPanel()">📋 今日状态记录</div>
    </div>
    <div class="box-title" style="margin-top:16px;">状态库（共 ${statusPool.length} 条）</div>
    <label class="field">批量导入（每行一条，比如：想你了 / 有点累 / 元气满满）</label>
    <textarea id="statusBulkInput" placeholder="想你了&#10;有点累&#10;元气满满"></textarea>
    <div class="btn-row">
      <div class="btn outline" onclick="importStatusBulk()">导入这些</div>
      <div class="btn outline" onclick="document.getElementById('statusFileInput').click()">📁 导入文件</div>
    </div>
    <input type="file" id="statusFileInput" accept=".txt,.json" class="hidden" onchange="onStatusFile(event)">
    <div id="statusPoolList" style="margin-top:10px;">${renderStatusChips()}</div>
  `);
}
function renderStatusHistoryList(){
  pruneStatusHistoryToToday();
  if(todayStatusHistory.length===0) return '<div class="empty-note">今天还没有状态变化记录</div>';
  return [...todayStatusHistory].reverse().map(h=>{
    const t = new Date(h.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
    return `<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--rule);"><span style="color:var(--ink-soft);font-size:13px;flex-shrink:0;">${t}</span><span style="text-align:right;">${h.text}</span></div>`;
  }).join('');
}
function openTodayStatusHistoryPanel(){
  openOverlay(`
    <div class="drawer-head"><h3>今日状态记录</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <div id="statusHistoryList">${renderStatusHistoryList()}</div>
  `);
}
function renderStatusChips(){
  if(statusPool.length===0) return '<div class="empty-note">还没有状态，先导入一些</div>';
  return statusPool.map((s,i)=>`<span class="card-pill">${s}<span class="del" style="margin-left:6px;" onclick="deleteStatus(${i})">✕</span></span>`).join('');
}
async function importStatusBulk(){
  const raw = document.getElementById('statusBulkInput').value;
  const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(lines.length===0) return;
  lines.forEach(l=>{ if(!statusPool.includes(l)) statusPool.push(l); });
  await sSet('status-pool', statusPool);
  document.getElementById('statusBulkInput').value = '';
  const listEl = document.getElementById('statusPoolList');
  if(listEl) listEl.innerHTML = renderStatusChips();
  ensureTodayStatus();
  renderTodayStatusHome();
}
function onStatusFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    let lines = [];
    try{
      const parsed = JSON.parse(reader.result);
      if(Array.isArray(parsed)) lines = parsed.filter(x=>typeof x==='string');
    }catch(err){
      lines = reader.result.split('\n').map(l=>l.trim()).filter(Boolean);
    }
    lines.forEach(l=>{ if(!statusPool.includes(l)) statusPool.push(l); });
    await sSet('status-pool', statusPool);
    const listEl = document.getElementById('statusPoolList');
    if(listEl) listEl.innerHTML = renderStatusChips();
    ensureTodayStatus();
    renderTodayStatusHome();
  };
  reader.readAsText(f, 'utf-8');
}
async function deleteStatus(i){
  statusPool.splice(i,1);
  await sSet('status-pool', statusPool);
  const listEl = document.getElementById('statusPoolList');
  if(listEl) listEl.innerHTML = renderStatusChips();
}
async function rerollTodayStatus(){
  if(statusPool.length===0) return;
  todayStatus = { date: todayKey(), text: pickRandomStatusText(), nextChangeAt: Date.now() + nextStatusChangeDelay() };
  await sSet('today-status', todayStatus);
  recordStatusHistory(todayStatus.text);
  renderTodayStatusHome();
  openTodayStatusPanel();
}
// App 从后台切回前台、或长时间停留在前台时，顺手检查一下状态是否到点该换了
function refreshTodayStatusIfDue(){
  ensureTodayStatus();
  renderTodayStatusHome();
  const chatStatEl = document.getElementById('chatCStat');
  if(chatStatEl && currentView==='chat') chatStatEl.textContent = todayStatus ? todayStatus.text : '暂无状态';
}
document.addEventListener('visibilitychange', ()=>{
  if(document.visibilityState==='visible'){
    refreshTodayStatusIfDue();
    if(typeof checkProactiveDue === 'function') checkProactiveDue(); // 切回前台时补发被后台冻结的主动消息/信件/来电/动态
  }
});
setInterval(refreshTodayStatusIfDue, 10*60*1000); // 前台长时间停留时，每 10 分钟兜底检查一次
setInterval(()=>{ if(document.visibilityState==='visible' && typeof checkProactiveDue==='function') checkProactiveDue(); }, 60*1000); // 前台长时间停留时，每 1 分钟兜底检查一次主动消息


function normalizeCardsJson(raw){
  const groups = {};
  const pushCard = (g, t)=>{
    if(typeof t !== 'string') return;
    t = t.trim(); if(!t) return;
    g = (g||'未分组').toString().trim() || '未分组';
    if(!groups[g]) groups[g]=[];
    if(!groups[g].includes(t)) groups[g].push(t);
  };
  try{
    if(raw && typeof raw === 'object' && !Array.isArray(raw) && Array.isArray(raw.customReplyGroups)){
      // 真实导出格式：{ customReplies:[...扁平总表...], customReplyGroups:[{id,name,items:[...],disabled}] }
      // 优先按 customReplyGroups 里的分组名归类，不使用扁平的 customReplies（避免重复堆成"未分组"）
      raw.customReplyGroups.forEach(g=>{
        const gname = (g && (g.name||g.title)) || '未分组';
        const items = (g && (g.items||g.cards||g.texts)) || [];
        items.forEach(c=> pushCard(gname, typeof c==='string'?c:(c && (c.text||c.content||c.value))));
      });
    } else if(Array.isArray(raw)){
      raw.forEach(item=>{
        if(typeof item === 'string'){ pushCard('未分组', item); return; }
        if(item && typeof item === 'object'){
          if(Array.isArray(item.cards) || Array.isArray(item.items) || Array.isArray(item.texts)){
            const gname = item.name||item.group||item.title||item.category||'未分组';
            (item.cards||item.items||item.texts).forEach(c=> pushCard(gname, typeof c==='string'?c:(c.text||c.content||c.value)));
          } else {
            const gname = item.group||item.category||item.tag||item.type||'未分组';
            const text = item.text||item.content||item.value||item.card||item.phrase||item.msg||item.message;
            pushCard(gname, text);
          }
        }
      });
    } else if(raw && typeof raw === 'object'){
      // 可能是 {groups:[...]} 或 {分组名: [...]} 或 {分组名: {items:[...]}}
      if(Array.isArray(raw.groups)){
        raw.groups.forEach(g=>{
          const gname = g.name||g.group||g.title||'未分组';
          const arr = g.cards||g.items||g.texts||[];
          (arr||[]).forEach(c=> pushCard(gname, typeof c==='string'?c:(c.text||c.content||c.value)));
        });
      } else {
        Object.keys(raw).forEach(key=>{
          const val = raw[key];
          if(Array.isArray(val)){
            val.forEach(c=> pushCard(key, typeof c==='string'?c:(c && (c.text||c.content||c.value))));
          } else if(val && typeof val === 'object'){
            const arr = val.cards||val.items||val.texts;
            if(Array.isArray(arr)) arr.forEach(c=> pushCard(key, typeof c==='string'?c:(c.text||c.content||c.value)));
          }
        });
      }
    }
  }catch(e){ console.error('normalize error', e); }
  return { groups };
}
function exportCardsFile(){
  const groups = (cardsData && cardsData.groups) || {};
  if(Object.keys(groups).length===0){ alert('字卡库还是空的，没什么可导出的'); return; }
  const blob = new Blob([JSON.stringify(groups, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '字卡备份-' + new Date().toISOString().slice(0,10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
}

function onCardsFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    let parsed;
    try{ parsed = JSON.parse(reader.result); }
    catch(err){ alert('这个 JSON 文件解析失败，可能是空文件或格式有问题，请检查后重新导入。'); return; }
    const normalized = normalizeCardsJson(parsed);
    const groupCount = Object.keys(normalized.groups).length;
    if(groupCount===0){ alert('没有从这个文件里识别出任何字卡分组，请确认文件内容不是空的。'); return; }
    showImportChoiceModal(normalized);
  };
  reader.readAsText(f, 'utf-8');
}

let _pendingImport = null;
function showImportChoiceModal(normalized){
  _pendingImport = normalized;
  const groupCount = Object.keys(normalized.groups).length;
  const cardCount = Object.values(normalized.groups).reduce((a,b)=>a+b.length,0);
  openOverlay(`
    <div class="drawer-head"><h3>识别到 ${groupCount} 个分组，共 ${cardCount} 张字卡</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:10px;">${Object.keys(normalized.groups).map(g=>`「${g}」×${normalized.groups[g].length}`).join('　')}</div>
    <div class="btn-row">
      <div class="btn" onclick="applyImport('merge')">合并到现有字卡库</div>
      <div class="btn rouge" onclick="applyImport('replace')">替换全部字卡库</div>
    </div>
  `);
}
async function applyImport(mode){
  const normalized = _pendingImport;
  if(!normalized) return;
  if(mode==='replace'){
    cardsData = normalized;
  } else {
    Object.keys(normalized.groups).forEach(g=>{
      if(!cardsData.groups[g]) cardsData.groups[g]=[];
      normalized.groups[g].forEach(c=>{ if(!cardsData.groups[g].includes(c)) cardsData.groups[g].push(c); });
    });
  }
  await sSet('cards-data', cardsData);
  renderCardsView();
  closeOverlay();
}

function loadDemoCards(){
  const demo = {
    groups:{
      '日常可使用':['在干嘛呀','想我了吗','今天也要开心一点','早点休息','嗯，我在'],
      '表达关心的和心情的':['你还好吗','别太累了','有点想你了','今天心情不错','有点emo…'],
      '疑问句':['你吃饭了吗','在忙什么呢','什么时候回来','要不要一起看电影'],
      '表达状态':['刚忙完','有点困','在路上','在看书'],
      '简单回答':['是的','不是','好呀','嗯','再看看']
    }
  };
  showImportChoiceModal(demo);
}

let cardSelectMode = false;
let selectedCardIdx = new Set();
let _cardSelectMap = [];
let cardsCollapsed = {}; // 记录每个分组是否折叠
let cardsSearchKeyword = '';

function toggleGroupCollapse(g){
  cardsCollapsed[g] = !cardsCollapsed[g];
  renderCardsView();
}
function onCardsSearchInput(){
  const inp = document.getElementById('cardsSearchInput');
  cardsSearchKeyword = (inp && inp.value || '').trim().toLowerCase();
  renderCardsView();
}
function renderCardsView(){
  const wrap = document.getElementById('cardsGroupsList');
  const btn = document.getElementById('cardSelectModeBtn');
  if(btn) btn.textContent = cardSelectMode ? '✕' : '☑';
  const groups = Object.keys(cardsData.groups||{});
  if(groups.length===0){ wrap.innerHTML = '<div class="empty-note">还没有导入字卡，先在上面导入 JSON 文件，或载入示例数据看看效果。</div>'; return; }
  _cardSelectMap = [];

  // 搜索框
  const searchHtml = `
    <div class="box" style="margin-bottom:10px;">
      <input type="text" id="cardsSearchInput" placeholder="搜索字卡内容…" value="${cardsSearchKeyword.replace(/"/g,'&quot;')}" oninput="onCardsSearchInput()" style="width:100%;">
    </div>`;

  const toolbarHtml = cardSelectMode ? `
    <div class="box" style="position:sticky; top:0; z-index:5;">
      <div style="font-size:12.5px;color:var(--ink-soft);margin-bottom:8px;">已选 ${selectedCardIdx.size} 张</div>
      <div class="btn-row">
        <div class="btn outline" onclick="openMoveToGroupPanel()">移动到分组</div>
        <div class="btn rouge" onclick="deleteSelectedCards()">删除选中</div>
      </div>
    </div>` : '';

  const groupsHtml = groups.map(g=>{
    let cards = cardsData.groups[g] || [];
    // 搜索过滤
    if(cardsSearchKeyword){
      cards = cards.filter(c => c.toLowerCase().includes(cardsSearchKeyword));
      if(cards.length === 0) return ''; // 该分组无匹配则隐藏
    }
    const collapsed = !!cardsCollapsed[g];
    const pills = cards.map((c,i)=>{
      // 注意：过滤后 i 是过滤后的索引，编辑/删除时需要用原索引，这里简化处理，搜索时禁用编辑删除
      if(cardSelectMode){
        const idx = _cardSelectMap.length;
        _cardSelectMap.push({group:g, text:c});
        const checked = selectedCardIdx.has(idx);
        return `<span class="card-pill ${checked?'selected':''}" onclick="toggleCardSelect(${idx})">${checked?'☑':'☐'} ${c}</span>`;
      }
      if(cardsSearchKeyword){
        return `<span class="card-pill">${c}</span>`;
      }
      // 找到原索引
      const realIdx = (cardsData.groups[g]||[]).indexOf(c);
      return `<span class="card-pill">${c}<span class="del" style="margin-left:6px;opacity:.65;" onclick="editCardText('${escAttr(g)}',${realIdx})">✎</span><span class="del" style="margin-left:4px;" onclick="deleteCard('${escAttr(g)}',${realIdx})">✕</span></span>`;
    }).join('');

    return `<div class="group-block">
      <div class="group-name" style="cursor:pointer;user-select:none;" onclick="toggleGroupCollapse('${escAttr(g)}')">
        <span style="margin-right:6px;">${collapsed ? '▶' : '▼'}</span>
        <span style="border-bottom:1px dashed var(--rule);">${g}（${cards.length}${cardsSearchKeyword ? ' 匹配' : ''}）</span>
        ${cardSelectMode?'':`<span style="display:flex;gap:10px;align-items:center;margin-left:auto;" onclick="event.stopPropagation()">
          <span class="del" onclick="renameGroup('${escAttr(g)}')" style="opacity:.75;">✎ 改名</span>
          <span class="del" onclick="deleteGroup('${escAttr(g)}')">✕ 删除分组</span>
        </span>`}
      </div>
      <div class="group-content" style="${collapsed ? 'display:none;' : ''}">
        ${pills}
        ${cardSelectMode || cardsSearchKeyword ? '' : `
        <div style="margin-top:8px;">
          <textarea id="addcard-${escAttr(g)}" placeholder="批量添加（每行一条，自动去重）" style="width:100%;min-height:60px;resize:vertical;"></textarea>
          <div class="btn-row" style="margin-top:6px;">
            <div class="btn outline" style="padding:8px 12px;" onclick="addCardTo('${escAttr(g)}')">批量添加</div>
          </div>
        </div>`}
      </div>
    </div>`;
  }).join('');

  wrap.innerHTML = searchHtml + toolbarHtml + groupsHtml;
}
function toggleCardSelectMode(){
  cardSelectMode = !cardSelectMode;
  selectedCardIdx.clear();
  renderCardsView();
}
function toggleCardSelect(idx){
  if(selectedCardIdx.has(idx)) selectedCardIdx.delete(idx); else selectedCardIdx.add(idx);
  renderCardsView();
}
async function editCardText(g, idx){
  const current = cardsData.groups[g][idx] || '';
  const safeG = String(g).replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$');
  openOverlay(`
    <div class="drawer-head"><h3>修改字卡内容</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">内容</label>
    <textarea id="editCardTextInput" style="min-height:90px;">${String(current).replace(/</g,'&lt;')}</textarea>
    <div class="btn-row"><div class="btn" onclick="confirmEditCardText('${escAttr(g)}', ${idx})">保存</div></div>
  `);
  setTimeout(()=>{ const el=document.getElementById('editCardTextInput'); if(el) el.focus(); }, 50);
}
async function confirmEditCardText(g, idx){
  const el = document.getElementById('editCardTextInput');
  const trimmed = (el && el.value || '').trim();
  if(!trimmed){ alert('内容不能为空'); return; }
  if(!cardsData.groups[g] || cardsData.groups[g][idx]===undefined){ closeOverlay(); return; }
  cardsData.groups[g][idx] = trimmed;
  await sSet('cards-data', cardsData);
  renderCardsView();
  closeOverlay();
}
async function deleteSelectedCards(){
  if(selectedCardIdx.size===0){ alert('先选几张字卡'); return; }
  if(!confirm(`确定删除选中的 ${selectedCardIdx.size} 张字卡吗？`)) return;
  const items = [...selectedCardIdx].map(i=>_cardSelectMap[i]).filter(Boolean);
  items.forEach(({group,text})=>{
    if(cardsData.groups[group]) cardsData.groups[group] = cardsData.groups[group].filter(c=>c!==text);
  });
  await sSet('cards-data', cardsData);
  selectedCardIdx.clear();
  cardSelectMode = false;
  renderCardsView();
}
function openMoveToGroupPanel(){
  if(selectedCardIdx.size===0){ alert('先选几张字卡'); return; }
  const groups = Object.keys(cardsData.groups||{});
  openOverlay(`
    <div class="drawer-head"><h3>移动到分组（已选 ${selectedCardIdx.size} 张）</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <div class="btn-row">
      ${groups.map(g=>`<div class="btn outline" onclick="moveSelectedCardsTo('${escAttr(g)}')">${g}</div>`).join('')}
    </div>
    <label class="field">或新建一个分组</label>
    <div style="display:flex;gap:6px;">
      <input type="text" id="moveNewGroupName" placeholder="新分组名称">
      <div class="btn outline" style="padding:8px 12px;" onclick="moveSelectedCardsToNew()">建立并移入</div>
    </div>
  `);
}
async function moveSelectedCardsTo(targetGroup){
  const items = [...selectedCardIdx].map(i=>_cardSelectMap[i]).filter(Boolean);
  items.forEach(({group,text})=>{
    if(group===targetGroup) return;
    if(cardsData.groups[group]) cardsData.groups[group] = cardsData.groups[group].filter(c=>c!==text);
    if(!cardsData.groups[targetGroup]) cardsData.groups[targetGroup] = [];
    if(!cardsData.groups[targetGroup].includes(text)) cardsData.groups[targetGroup].push(text);
  });
  await sSet('cards-data', cardsData);
  selectedCardIdx.clear();
  cardSelectMode = false;
  closeOverlay();
  renderCardsView();
}
async function moveSelectedCardsToNew(){
  const inp = document.getElementById('moveNewGroupName');
  const name = inp.value.trim();
  if(!name) return;
  await moveSelectedCardsTo(name);
}
function escAttr(s){ return s.replace(/'/g,"\\'"); }
function escapeHtml(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
async function deleteGroup(g){
  delete cardsData.groups[g]; await sSet('cards-data', cardsData); renderCardsView();
}
async function renameGroup(oldName){
  if(!cardsData.groups || !cardsData.groups[oldName]) return;
  openOverlay(`
    <div class="drawer-head"><h3>修改分组名称</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <label class="field">新名称</label>
    <input type="text" id="renameGroupInput" value="${String(oldName).replace(/"/g,'&quot;')}" maxlength="30">
    <div class="btn-row"><div class="btn" onclick="confirmRenameGroup('${escAttr(oldName)}')">保存</div></div>
  `);
  setTimeout(()=>{ const el=document.getElementById('renameGroupInput'); if(el){ el.focus(); el.select(); } }, 50);
}
async function confirmRenameGroup(oldName){
  const el = document.getElementById('renameGroupInput');
  const newName = (el && el.value || '').trim();
  if(!newName){ alert('分组名不能为空'); return; }
  if(newName === oldName){ closeOverlay(); return; }
  if(!cardsData.groups || !cardsData.groups[oldName]){ closeOverlay(); return; }
  if(cardsData.groups[newName]){
    if(!confirm('已有分组「'+newName+'」，要把「'+oldName+'」里的字卡合并进去吗？')) return;
    const incoming = cardsData.groups[oldName] || [];
    incoming.forEach(c=>{ if(!cardsData.groups[newName].includes(c)) cardsData.groups[newName].push(c); });
    delete cardsData.groups[oldName];
  } else {
    cardsData.groups[newName] = cardsData.groups[oldName];
    delete cardsData.groups[oldName];
  }
  if(typeof lastGroupUsed !== 'undefined' && lastGroupUsed === oldName) lastGroupUsed = newName;
  await sSet('cards-data', cardsData);
  renderCardsView();
  closeOverlay();
}
async function deleteCard(g, idx){
  cardsData.groups[g].splice(idx,1); await sSet('cards-data', cardsData); renderCardsView();
}
async function addCardTo(g){
  const inp = document.getElementById('addcard-'+g);
  if(!inp) return;
  const raw = inp.value.trim();
  if(!raw) return;
  // 支持批量：按行拆分，自动去重
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if(!lines.length) return;
  if(!cardsData.groups[g]) cardsData.groups[g] = [];
  const existing = new Set(cardsData.groups[g]);
  let added = 0;
  lines.forEach(line => {
    if(!existing.has(line)){
      cardsData.groups[g].push(line);
      existing.add(line);
      added++;
    }
  });
  inp.value = '';
  await sSet('cards-data', cardsData);
  renderCardsView();
  if(added > 0){
    const tip = document.createElement('div');
    tip.textContent = `已添加 ${added} 条`;
    tip.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--paper);padding:8px 16px;border-radius:20px;font-size:13px;z-index:999;';
    document.body.appendChild(tip);
    setTimeout(() => tip.remove(), 1500);
  }
}
async function addGroupManual(){
  const inp = document.getElementById('newGroupName');
  const val = inp.value.trim(); if(!val) return;
  if(!cardsData.groups[val]) cardsData.groups[val]=[];
  inp.value='';
  await sSet('cards-data', cardsData); renderCardsView();
}

/* ============================================================
   CHAT
   ============================================================ */
function formatMsgTime(ts){
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth() && d.getDate()===now.getDate();
  return sameDay
    ? d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})
    : d.toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function renderChat(preserveScroll, scrollToId){
  const wrap = document.getElementById('chatMsgs');
  document.getElementById('chatCName').textContent = chatSettings.companionName;
  ensureTodayStatus();
  document.getElementById('chatCStat').textContent = todayStatus ? todayStatus.text : '暂无状态';
  if(chatMessages.length===0){
    wrap.innerHTML = '<div class="empty-note">还没有聊天记录，说点什么吧～</div>';
    return;
  }
  const prevScrollHeight = preserveScroll ? wrap.scrollHeight : 0;
  const prevScrollTop = preserveScroll ? wrap.scrollTop : 0;
  const botAvatar = profile.avatar && profile.avatar.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${profile.avatar}">` : (profile.avatar||'🌙');
  const myAvatar = profile.myAvatar && profile.myAvatar.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${profile.myAvatar}">` : (profile.myAvatar||'🙂');
  const loadMoreHtml = !pageState.chatMessages.exhausted ? `<div class="load-more-bar" onclick="loadMoreChat()">↑ 加载更早的聊天记录</div>` : '';
  wrap.innerHTML = loadMoreHtml + chatMessages.map(m=>{
    const time = formatMsgTime(m.time);
    if(m.type==='pat' || m.type==='gesture'){
      return `<div id="msg-${m.id}" style="text-align:center;font-size:11.5px;color:var(--ink-soft);margin:6px 0;">${m.content}</div>`;
    }
    const quoteRefHtml = m.quoteOf
      ? `<div class="quote-ref" onclick="jumpToMessage('${m.quoteOf.id}')">${m.quoteOf.from==='user'?(profile.myName||'我'):chatSettings.companionName}: ${m.quoteOf.preview}</div>` : '';
    const quoteBtn = `<span class="quote-trigger" onclick="setQuoteTarget('${m.id}')">↩引用</span>`;
    const avatarHtml = `<div class="msg-avatar">${m.from==='user'?myAvatar:botAvatar}</div>`;
    let bubbleHtml;
    if(m.type==='sticker'){
      const val = m.content.startsWith('data:') ? `<img loading="lazy" decoding="async" src="${m.content}">` : m.content;
      bubbleHtml = `<div class="msg sticker ${m.from}">${quoteRefHtml}${val}<div class="t" style="text-align:${m.from==='user'?'right':'left'};">${time}${quoteBtn}</div></div>`;
    } else if(m.type==='image'){
      bubbleHtml = `<div class="msg image ${m.from}">${quoteRefHtml}<img loading="lazy" decoding="async" class="chat-image" src="${m.content}" onclick="viewChatImage('${m.id}')"><div class="t" style="text-align:${m.from==='user'?'right':'left'};">${time}${(m.from==='user'&&m.read)?' · 已读':''}${quoteBtn}</div></div>`;
    } else if(m.type==='redpacket'){
      const revealed = m.from==='user' || m.opened;
      const tapAttr = revealed ? '' : `onclick="openRedPacket('${m.id}')"`;
      bubbleHtml = `<div class="msg redpacket ${m.from}" ${tapAttr}>
        ${quoteRefHtml}
        <div class="rp-top">🧧 ${m.note||'红包'}</div>
        ${revealed ? `<div class="rp-amount">¥${Number(m.amount).toFixed(2)}</div>` : `<div class="rp-tap">点击查收</div>`}
        <div class="t" style="color:rgba(255,255,255,0.75);">${time}${quoteBtn}</div>
      </div>`;
    } else if(m.type==='questionnaire'){
      const opts = (m.options||[]).map((o,i)=>{
        const chosen = m.answered && m.chosenOption === o;
        return `<div class="q-option${chosen?' chosen':''}">${chosen?'✓ ':''}${o}</div>`;
      }).join('');
      let statusHtml = '';
      if(m.answered){
        statusHtml = `<div class="q-meta">已选择 · ${formatMsgTime(m.answerTime||m.time)}</div>`;
      } else if(m.scheduledReplyAt){
        const eta = new Date(m.scheduledReplyAt).toLocaleString('zh-CN');
        statusHtml = `<div class="q-waiting">等待回复中…大概 ${eta} 前会选好</div>`;
      }
      bubbleHtml = `<div class="msg questionnaire ${m.from}">
        ${quoteRefHtml}
        <div class="q-title">📋 梦向问卷</div>
        <div class="q-question">${m.question||''}</div>
        ${opts}
        ${statusHtml}
        <div class="t">${time}${quoteBtn}</div>
      </div>`;
    } else if(m.type==='weblink'){
      const collapsed = m.collapsed !== undefined ? m.collapsed : true;
      const host = getUrlHost(m.content);
      bubbleHtml = `<div class="msg ${m.from}" style="padding:0;overflow:hidden;max-width:78%;">
        ${quoteRefHtml}
        <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;background:rgba(0,0,0,0.04);font-size:12.5px;">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">🌐 ${escapeHtml(host)}</span>
          <span onclick="event.stopPropagation();window.open('${escAttr(m.content)}','_blank')" style="cursor:pointer;padding:2px 4px;" title="新标签页打开">↗</span>
          <span onclick="event.stopPropagation();toggleWebLinkCollapse('${m.id}')" style="cursor:pointer;padding:2px 4px;" title="展开/收起">${collapsed ? '▾' : '▴'}</span>
        </div>
        ${collapsed ? '' : `<div style="height:420px;background:#000;"><iframe src="${escAttr(m.content)}" style="width:100%;height:100%;border:0;"></iframe></div>`}
        <div class="t" style="padding:4px 12px 8px;">${time}${(m.from==='user'&&m.read)?' · 已读':''}${quoteBtn}</div>
      </div>`;
    } else {
      const readTag = (m.from==='user' && m.read) ? ' · 已读' : '';
      const skinClass = m.from==='user' ? 'message message-sent' : 'message message-received';
      bubbleHtml = `<div class="msg ${m.from} ${skinClass}">${quoteRefHtml}${m.content}<div class="t">${time}${readTag}${quoteBtn}</div></div>`;
    }
    return `<div id="msg-${m.id}" class="msg-row ${m.from}">${avatarHtml}${bubbleHtml}</div>`;
  }).join('');
  syncTypingIndicatorDOM(false); // 重建整个聊天列表会把"正在输入…"这个提示一起冲掉，这里给它补回来，避免看起来像回复被打断了
  if(scrollToId){
    const el = document.getElementById('msg-'+scrollToId);
    if(el){
      el.scrollIntoView({behavior:'auto', block:'center'});
      const bubble = el.querySelector('.msg') || el;
      bubble.classList.add('msg-jump-highlight');
      setTimeout(()=>bubble.classList.remove('msg-jump-highlight'), 1200);
    }
  } else if(preserveScroll){
    wrap.scrollTop = wrap.scrollHeight - prevScrollHeight + prevScrollTop;
  } else {
    scrollChatBottom();
  }
}
async function loadMoreChat(){
  const older = await loadOlderPage('chatMessages', chatMessages);
  if(!older.length) return;
  chatMessages = [...older, ...chatMessages];
  renderChat(true);
}
/* 引用的那句话点一下，跳回原消息所在位置；哪怕原消息是很久之前翻过去的历史，也会自动往前加载，直到找到为止 */
async function jumpToMessage(id){
  let guard = 0;
  while(!chatMessages.find(m=>m.id===id) && !pageState.chatMessages.exhausted && guard < 50){
    const older = await loadOlderPage('chatMessages', chatMessages);
    if(!older.length) break;
    chatMessages = [...older, ...chatMessages];
    guard++;
  }
  if(!chatMessages.find(m=>m.id===id)){
    const toast = document.getElementById('saveToast');
    if(toast){
      const original = toast.textContent;
      toast.textContent = '没能找到原消息，可能已被清空～';
      toast.classList.add('show'); toast.classList.add('warn');
      setTimeout(()=>{ toast.classList.remove('show'); toast.classList.remove('warn'); toast.textContent = original; }, 1800);
    }
    return;
  }
  renderChat(false, id);
}
async function openRedPacket(id){
  const m = chatMessages.find(x=>x.id===id);
  if(!m || m.opened) return;
  m.opened = true;
  await recPut('chatMessages', m);
  renderChat();
}
function scrollChatBottom(){
  const wrap = document.getElementById('chatMsgs');
  setTimeout(()=>{ wrap.scrollTop = wrap.scrollHeight; }, 30);
}

/* ---- 引用消息：我可以引用，TA 也可以引用 ---- */
function buildQuotePreview(m){
  if(m.type==='sticker') return '[表情]';
  if(m.type==='redpacket') return '[红包]' + (m.note ? ('·'+m.note) : '');
  if(m.type==='image') return '[图片]';
  if(m.type==='weblink') return '[网页链接]';
  if(m.type==='questionnaire') return '[问卷] ' + (m.question||'').slice(0,30);

  if(m.type==='pat' || m.type==='gesture') return m.content;
  return (m.content||'').slice(0,40);
}
function viewChatImage(id){
  const m = chatMessages.find(x=>x.id===id);
  if(!m) return;
  openOverlay(`
    <div class="drawer-head"><h3>图片</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>
    <img loading="lazy" decoding="async" src="${m.content}" style="width:100%; border-radius:6px;">
  `);
}
function setQuoteTarget(id){
  const m = chatMessages.find(x=>x.id===id);
  if(!m) return;
  quoteTarget = { id:m.id, from:m.from, preview: buildQuotePreview(m) };
  renderQuoteBar();
  const inp = document.getElementById('chatInput');
  if(inp) inp.focus();
}
function clearQuoteTarget(){
  quoteTarget = null;
  renderQuoteBar();
}
function renderQuoteBar(){
  const bar = document.getElementById('quoteBar');
  if(!bar) return;
  if(!quoteTarget){ bar.classList.add('hidden'); bar.innerHTML=''; return; }
  bar.classList.remove('hidden');
  const who = quoteTarget.from==='user' ? (profile.myName||'我') : chatSettings.companionName;
  bar.innerHTML = `<div class="quote-bar-inner"><span>回复 ${who}：${quoteTarget.preview}</span><span class="close-x" onclick="clearQuoteTarget()">✕</span></div>`;
}
/* TA 自己回复时，随机决定要不要引用聊天记录里的某一条，纯随机不看内容对不对得上 */
function maybeQuoteMessage(){
  const candidates = chatMessages.filter(m=> (m.type==='text' || !m.type) );
  if(candidates.length===0) return null;
  if(Math.random() < 0.5){ // 不设区间，就是最朴素的对半抛硬币，跟已读不回那个逻辑一致
    const target = candidates[Math.floor(Math.random()*candidates.length)];
    return { id: target.id, from: target.from, preview: buildQuotePreview(target) };
  }
  return null;
}

async function sendUserMessage(){
  const inp = document.getElementById('chatInput');
  const text = inp.value.trim(); if(!text) return;
  inp.value='';
  const msg = {id:uid(), from:'user', type:'text', content:text, time:Date.now(), read:false};
  if(quoteTarget){ msg.quoteOf = quoteTarget; clearQuoteTarget(); }
  chatMessages.push(msg);
  await recPut('chatMessages', msg);
  renderChat();
  handleIncomingForBot(text);
}
function onChatImageFile(e){
  const f = e.target.files[0]; if(!f) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    const compressed = await compressImage(reader.result, 900);
    const msg = {id:uid(), from:'user', type:'image', content:compressed, time:Date.now(), read:false};
    if(quoteTarget){ msg.quoteOf = quoteTarget; clearQuoteTarget(); }
    chatMessages.push(msg);
    await recPut('chatMessages', msg);
    renderChat();
    handleIncomingForBot('[图片]');
  };
  reader.readAsDataURL(f);
  e.target.value = '';
}

/* 已读不回开启后，每条消息都用抛硬币的方式随机决定这次回不回：30% 概率不回 */
