function handleIncomingForBot(userText){
  if(chatSettings.readNoReply && Math.random() < 0.3){
    setTimeout(async ()=>{
      const last = chatMessages[chatMessages.length-1];
      if(last && last.from==='user'){ last.read = true; await recPut('chatMessages', last); renderChat(); }
    }, 1500 + Math.random()*2500);
    return;
  }
  scheduleAutoReply(userText);
}

/** 显示：1s / 2分钟 等（上限 120 秒） */
function getReplyDelayMs(){
  // 单位：分钟，滑条 1～5
  const lo0 = Number(chatSettings.delayMin) || 1;
  const hi0 = Number(chatSettings.delayMax) || 5;
  const lo = Math.max(1, Math.min(5, Math.min(lo0, hi0)));
  const hi = Math.max(lo, Math.min(5, Math.max(lo0, hi0)));
  const chosen = lo + Math.random()*(hi-lo);
  return Math.max(1, chosen) * 60 * 1000;
}
function scheduleAutoReply(userText){
  const delayMs = getReplyDelayMs();
  showTyping(true);
  if(pendingReplyTimer) clearTimeout(pendingReplyTimer);
  pendingReplyTimer = setTimeout(async ()=>{
    showTyping(false);
    const reply = pickReplyFor(userText);
    if(reply){
      const newMsg = {id:uid(), from:'bot', time:Date.now(), read:true, ...reply};
      chatMessages.push(newMsg);
      const last = [...chatMessages].reverse().find(m=>m.from==='user' && m.id!==newMsg.id);
      if(last) last.read = true;
      await recPutMany('chatMessages', last ? [newMsg, last] : [newMsg]);
      renderChat();
    }
  }, delayMs);
}
function hasReplyScheduled(){ return !!pendingReplyTimer; }
function maybeScheduleFromHistory(){
  const last = chatMessages[chatMessages.length-1];
  if(last && last.from==='user'){
    handleIncomingForBot(last.content);
  }
}
let typingVisible = false;
function showTyping(on){
  typingVisible = on;
  syncTypingIndicatorDOM(on);
}
function syncTypingIndicatorDOM(scrollAfter){
  const wrap = document.getElementById('chatMsgs');
  if(!wrap) return;
  const existing = document.getElementById('typingIndicator');
  if(existing) existing.remove();
  if(typingVisible){
    const el = document.createElement('div'); el.id='typingIndicator'; el.className='typing';
    el.textContent = chatSettings.companionName+' 正在输入…';
    wrap.appendChild(el);
    if(scrollAfter) scrollChatBottom();
  }
}

/* ---- 字卡自由挑选：不按用户说了什么去限定分组或回复内容，只在全部字卡里随机挑一条 ---- */
function getRandomCardText(){
  const groups = cardsData.groups||{};
  const groupNames = Object.keys(groups);
  let pool = [];
  groupNames.forEach(g=> (groups[g]||[]).forEach(card=> pool.push({group:g, card})));
  if(pool.length===0) return null;
  const idx = Math.floor(Math.random()*pool.length);
  return pool[idx].card;
}
/* 拼字卡：从字卡库里随机抽 2~4 张拼成一段 */
function getSplicedCardText(){
  const groups = cardsData.groups||{};
  let pool = [];
  Object.keys(groups).forEach(g=> (groups[g]||[]).forEach(card=> pool.push(card)));
  if(pool.length===0) return null;
  if(pool.length===1) return pool[0];
  const shuffled = pool.slice().sort(()=> Math.random()-0.5);
  // 张数限制在 2~4 张之间（如果库里不够 4 张，就按实际张数封顶）
  const maxN = Math.min(4, shuffled.length);
  const n = maxN <= 2 ? maxN : 2 + Math.floor(Math.random() * (maxN - 1));
  const picked = shuffled.slice(0, n);
  lastCardUsed = {text: picked[0]};
  return picked.join('\n');
}
const REDPACKET_NOTES = ['给你买奶茶','塞进你口袋','抢一个','爱的红包','恭喜发财','小心心'];
function pickReplyFor(userText){
  const roll = Math.random();
  // 开启“允许发送红包”后，沿用原来的小概率随机红包机制；关闭时完全不会自动发红包
  if(chatSettings.redPacketEnabled && roll < 0.05){
    const amount = (Math.random()*188+1).toFixed(2);
    const note = REDPACKET_NOTES[Math.floor(Math.random()*REDPACKET_NOTES.length)];
    return { type:'redpacket', amount, note, opened:false };
  }
  // 有一定概率发表情包，增加真实感
  if(chatSettings.stickers.length && roll < 0.05+0.12){
    const st = chatSettings.stickers[Math.floor(Math.random()*chatSettings.stickers.length)];
    return { type:'sticker', content: st.value };
  }
  // 也有一定概率是拍一拍/戳一戳这类小动作，而不是文字
  if(roll < 0.05+0.12+0.06){
    const g = QUICK_ACTIONS[Math.floor(Math.random()*QUICK_ACTIONS.length)];
    return { type:'gesture', content: `${chatSettings.companionName}${g.verb}你` };
  }
  // 拼字卡开启后也不是每条都拼，对半几率触发；没触发就正常抽一张
  let text;
  if(spliceCardsEnabled && Math.random() < 0.5){
    text = getSplicedCardText() || getRandomCardText();
  } else {
    text = getRandomCardText();
  }
  if(!text) return null;
  const quoteOf = maybeQuoteMessage();
  return quoteOf ? { type:'text', content:text, quoteOf } : { type:'text', content:text };
}

/* ============================================================
   主动性：梦角可以不等我先说话，自己主动发消息、写信、打电话过来
   ============================================================ */
