const TAROT_SPREADS = [
  { id:'single', name:'单张', count:1, cat:['all','fortune'], positions:['核心指引'], hint:'适合日常随手问一问，答案简洁直接。' },
  { id:'free', name:'无牌阵', count:3, cat:['all','love','study','fortune'], positions:['牌一','牌二','牌三'], hint:'不设固定位置含义，三张牌自由串联解读，适合随手一问。（由原三张时间线改为无牌阵）' },
  { id:'three-rel', name:'三张·你与对方', count:3, cat:['love'], positions:['你','对方','关系动态'], hint:'爱情专用经典三张，看双方与关系本身。' },
  { id:'cross5', name:'五张十字', count:5, cat:['all','study','fortune'], positions:['核心','过去','未来','助力','阻力'], hint:'传统十字变体，适合学业决策或运势全貌。' },
  { id:'celtic', name:'凯尔特十字', count:10, cat:['all','love','study','fortune'], positions:['现状','阻碍','根基','过去','目标','近未来','自身','环境','希望与恐惧','结果'], hint:'塔罗最经典正规老牌阵，深度全面，适合重要问题。' },
  { id:'love5', name:'五张关系阵', count:5, cat:['love'], positions:['你','对方','关系','阻碍','走向'], hint:'爱情专用，看双方位置与关系走向。' },
  { id:'study5', name:'学业五张', count:5, cat:['study'], positions:['当前学业','优势','阻碍','建议','结果趋势'], hint:'针对考试/升学/学习状态。' },
  { id:'xp5', name:'他的XP / 性癖倾向', count:5, cat:['all','love'], positions:['核心XP','显性部分','隐性部分','心理需求','对你时如何显现'], hint:'看他整体性偏好结构：核心癖好、敢说与不敢说的、背后需求、以及落到你身上时的样子。' },
  { id:'fantasy6', name:'他对我的性幻想', count:6, cat:['all','love'], positions:['幻想核心','幻想中的你','身体层面','心理/角色层面','压抑或不敢说的','关系影响与建议'], hint:'专门看爱情里他对你的性幻想：核心欲望、脑中的你、身心两层、压抑部分与关系建议。' },
  { id:'xp_fantasy7', name:'XP × 对我的幻想', count:7, cat:['all','love'], positions:['核心XP','对你的幻想主轴','两者重叠','仅幻想难落地','顾虑/羞耻/边界','你若回应他会如何','关系建议'], hint:'把性癖与对你的幻想合在一起看：重叠点火点、现实难落地处、边界与互动建议。' },
];
const TAROT_DECK = [
  {n:'愚者', k:'新开始、冒险、纯真', t:'正位象征自由启程与信任直觉；逆位可能表示莽撞或逃避责任。'},
  {n:'魔术师', k:'行动力、资源、创造', t:'你具备把想法落地的能力，关键是专注与启动。'},
  {n:'女祭司', k:'直觉、内在、秘密', t:'答案在安静与内省中，先听内心再行动。'},
  {n:'女皇', k:'丰盛、滋养、感性', t:'允许自己被照顾与享受成果，关系或学业都宜温和推进。'},
  {n:'皇帝', k:'秩序、权威、结构', t:'需要规则与边界，用清晰计划稳住局面。'},
  {n:'教皇', k:'传统、指引、信念', t:'向可靠的人请教，或回归已验证的方法。'},
  {n:'恋人', k:'选择、联结、价值观', t:'重要选择关乎心与价值对齐，诚实面对关系或方向。'},
  {n:'战车', k:'意志、前进、掌控', t:'集中目标向前冲，纪律能带来突破。'},
  {n:'力量', k:'勇气、温柔的力量', t:'用耐心与内在力量化解阻力，而非硬碰硬。'},
  {n:'隐者', k:'独处、寻求真理', t:'暂时退一步沉淀，答案会在独处中清晰。'},
  {n:'命运之轮', k:'转折、周期、机遇', t:'运势在转动，抓住当下窗口，接受变化。'},
  {n:'正义', k:'公平、因果、真相', t:'按事实与原则处理，诚实会带来平衡。'},
  {n:'倒吊人', k:'换视角、暂停、牺牲', t:'暂时放下执念，换角度看会有新解。'},
  {n:'死神', k:'结束、转化、重生', t:'旧阶段落幕，为新可能腾出空间，不必恐惧。'},
  {n:'节制', k:'平衡、调和、耐心', t:'融合对立面，循序渐进比急于求成更有效。'},
  {n:'恶魔', k:'束缚、欲望、执念', t:'觉察是否被恐惧或习惯绑住，意识是解脱的第一步。'},
  {n:'塔', k:'突变、崩塌、觉醒', t:'旧结构可能被打破，混乱之后是更真实的基础。'},
  {n:'星星', k:'希望、疗愈、灵感', t:'保持信心，灵感与支持正在靠近。'},
  {n:'月亮', k:'不确定、潜意识、幻觉', t:'信息未明，避免过度解读，等真相浮现。'},
  {n:'太阳', k:'成功、清晰、活力', t:'积极结果可期，展现真实的自己会带来好运。'},
  {n:'审判', k:'觉醒、召唤、清算', t:'回顾过去做决定，回应内心真正的召唤。'},
  {n:'世界', k:'完成、整合、圆满', t:'一个周期圆满，可以庆祝并开启下一章。'},
  {n:'权杖ACE', k:'热情启动', t:'新项目或学习动力充足，适合立刻开始。'},
  {n:'权杖二', k:'规划、抉择', t:'手握资源开始规划下一步，是时候做出方向性的选择了。'},
  {n:'权杖三', k:'展望、扩张', t:'眼光放远，合作或布局会带来进展。'},
  {n:'权杖四', k:'庆祝、稳定', t:'阶段性成果值得庆祝，家庭或团队氛围和谐。'},
  {n:'权杖五', k:'竞争、摩擦', t:'意见不合带来一些内耗，试着把对立变成良性竞争。'},
  {n:'权杖六', k:'胜利、认可', t:'努力被看见，好消息或认可正在路上。'},
  {n:'权杖七', k:'坚持、防御', t:'顶住外部压力守住立场，你比想象中更有底气。'},
  {n:'权杖八', k:'迅速、消息', t:'事情加速，消息或进展会很快到来。'},
  {n:'权杖九', k:'疲惫、坚韧', t:'已经很累但还在硬撑，胜利往往就在再坚持一下之后。'},
  {n:'权杖十', k:'负重、责任', t:'扛的责任有点多了，可以考虑分担或断舍离一部分。'},
  {n:'权杖侍从', k:'好奇、跃跃欲试', t:'对新鲜事充满热情，适合大胆尝试和探索。'},
  {n:'权杖骑士', k:'冲动、行动力', t:'带着热情快速出发，注意别只图一时痛快。'},
  {n:'权杖王后', k:'自信、感染力', t:'用温暖又坚定的方式影响身边的人，魅力自然流露。'},
  {n:'权杖国王', k:'远见、领导力', t:'敢于承担风险的领导者，能把想法落地成局面。'},
  {n:'圣杯ACE', k:'情感新开端', t:'心有所感，感情或灵感正在萌芽。'},
  {n:'圣杯二', k:'伙伴、吸引', t:'双向的吸引与合作，关系中的平等交流。'},
  {n:'圣杯三', k:'庆祝、友谊', t:'与人同乐，社交支持对你有益。'},
  {n:'圣杯四', k:'冷漠、错失', t:'沉浸在自己的情绪里，容易忽略眼前其实还不错的选择。'},
  {n:'圣杯五', k:'遗憾、失落', t:'盯着失去的部分太久，回头看看还剩下的东西吧。'},
  {n:'圣杯六', k:'怀旧、纯真', t:'过去的美好回忆浮现，也可能是重新联系某个人的时机。'},
  {n:'圣杯七', k:'幻想、多选', t:'选项很多但都有点虚，先分清哪些是真实可行的。'},
  {n:'圣杯八', k:'放下、转身', t:'表面的圆满不再满足你，去寻找更深层的意义。'},
  {n:'圣杯九', k:'满足、如愿', t:'愿望达成带来的满足感，允许自己享受这份好状态。'},
  {n:'圣杯十', k:'圆满、和谐', t:'情感层面的圆满与安稳，家人或伴侣关系融洽。'},
  {n:'圣杯侍从', k:'纯真、直觉讯息', t:'带着孩子气的敏感去感受，一个小小的心动或灵感值得留意。'},
  {n:'圣杯骑士', k:'浪漫、理想主义', t:'带着诚意去追求心之所向，是关系里主动靠近的一步。'},
  {n:'圣杯王后', k:'共情、细腻', t:'情绪细腻又有包容力，是身边人愿意依靠的存在。'},
  {n:'圣杯国王', k:'成熟、情绪稳定', t:'能把情绪照顾得很好，也善于安抚和支持他人。'},
  {n:'宝剑ACE', k:'清晰、真相', t:'思维锋利，适合做决定或表达立场。'},
  {n:'宝剑二', k:'犹豫、逃避', t:'蒙着眼不想面对选择，但答案其实心里已经有数。'},
  {n:'宝剑三', k:'心痛、领悟', t:'痛苦带来清醒，疗愈需要时间与诚实。'},
  {n:'宝剑四', k:'休整、暂停', t:'先从纷争里退出来喘口气，恢复比硬撑更重要。'},
  {n:'宝剑五', k:'冲突、代价', t:'吵赢了道理却可能输了关系，值得想想值不值得。'},
  {n:'宝剑六', k:'过渡、离开', t:'带着一些伤驶向更平静的地方，情况正在慢慢好转。'},
  {n:'宝剑七', k:'独行、策略', t:'可能在单打独斗甚至耍点小心机，留意坦诚与信任的边界。'},
  {n:'宝剑八', k:'受限、自我设限', t:'束缚多半来自想法，换个角度就能松绑。'},
  {n:'宝剑九', k:'焦虑、失眠', t:'脑子里反复放大担忧，实际情况通常没有想的那么糟。'},
  {n:'宝剑十', k:'触底、结束', t:'一个艰难阶段的谷底，也意味着最坏的部分已经过去了。'},
  {n:'宝剑侍从', k:'警觉、好问', t:'保持敏锐观察，愿意问问题、也愿意听真话。'},
  {n:'宝剑骑士', k:'果断、直接', t:'想清楚就立刻行动，说话做事都很直接利落。'},
  {n:'宝剑王后', k:'理性、独立', t:'看事情很清醒，习惯用逻辑而不是情绪去判断。'},
  {n:'宝剑国王', k:'公正、权威', t:'讲原则、重逻辑的判断者，决定往往经得起推敲。'},
  {n:'星币ACE', k:'机会、物质基础', t:'务实的机会出现，适合投资时间或资源。'},
  {n:'星币二', k:'平衡、取舍', t:'在几件事之间找节奏，忙但还算游刃有余。'},
  {n:'星币三', k:'技艺、合作', t:'精进技能与团队合作会带来成果。'},
  {n:'星币四', k:'掌控、守成', t:'守住已有的成果没问题，但太紧抓不放会错过流动的机会。'},
  {n:'星币五', k:'匮乏、孤立', t:'一时的困顿让人觉得孤立无援，其实援手可能就在附近。'},
  {n:'星币六', k:'施与受', t:'资源或帮助在公平地流动，给予和接受都值得被看见。'},
  {n:'星币七', k:'耐心、评估', t:'投入之后需要耐心等待回报，也适合停下来评估值不值。'},
  {n:'星币八', k:'勤勉、专精', t:'持续练习与投入，学业或工作会稳步提升。'},
  {n:'星币九', k:'独立、自足', t:'靠自己的努力过上舒适的生活，允许自己享受这份成果。'},
  {n:'星币十', k:'稳定、传承', t:'长期安全感与成果分享，家庭或团队支持。'},
  {n:'星币侍从', k:'脚踏实地、学习', t:'认真对待一个新机会，愿意从头学起。'},
  {n:'星币骑士', k:'稳扎稳打、可靠', t:'做事保守但值得信赖，慢一点也没关系。'},
  {n:'星币王后', k:'务实、温暖', t:'把生活和资源打理得很好，也乐于照顾身边的人。'},
  {n:'星币国王', k:'丰盛、白手起家', t:'成熟稳重的实干家，靠踏实积累换来的丰盛。'},
];
let tarotState = { spread: null, drawn: [], question: '', cat: 'all', count: 3 };
let tarotModelOn = false;

function switchTarotCat(el){
  document.querySelectorAll('#tarotTabs .btn').forEach(t=>{
    t.className = 'btn outline';
  });
  el.className = 'btn';
  tarotState.cat = el.dataset.cat;
  renderTarotSpreads();
}
function renderTarotSpreads(){
  const grid = document.getElementById('tarotSpreadGrid');
  if(!grid) return;
  const list = TAROT_SPREADS.filter(s => s.cat.includes(tarotState.cat) || tarotState.cat==='all');
  grid.innerHTML = list.map(s=>`
    <div class="tarot-spread-item ${tarotState.spread&&tarotState.spread.id===s.id?'active':''}" data-id="${s.id}" onclick="selectTarotSpread('${s.id}')">
      <div>${s.name}</div>
      <div class="s-count">${s.count} 张</div>
    </div>`).join('');
  const hint = document.getElementById('tarotHint');
  if(hint) hint.textContent = tarotState.spread ? tarotState.spread.hint : '选择牌阵后开始抽牌。推荐：三张 / 五张十字 / 凯尔特十字。';
}
function selectTarotSpread(id){
  tarotState.spread = TAROT_SPREADS.find(s=>s.id===id);
  if(tarotState.spread){
    tarotState.count = tarotState.spread.count;
  }
  renderTarotSpreads();
  const hint = document.getElementById('tarotHint');
  if(hint && tarotState.spread) hint.textContent = tarotState.spread.hint;
}

function getTarotPositions(n){
  if(tarotState.spread && tarotState.spread.count === n) return tarotState.spread.positions.slice();
  if(n === 1) return ['核心指引'];
  if(n === 3) return ['过去','现在','未来'];
  if(n === 5) return ['核心','过去','未来','助力','阻力'];
  if(n === 7) return ['过去','现在','未来','自身','环境','建议','结果'];
  if(n === 10) return ['现状','阻碍','根基','过去','目标','近未来','自身','环境','希望与恐惧','结果'];
  const arr = [];
  for(let i=0;i<n;i++) arr.push('位置 '+(i+1));
  return arr;
}
function buildShuffledDeck(){
  // 复制牌库并洗牌，生成可点选的牌堆（类似正规站牌背列表）
  const deck = TAROT_DECK.slice();
  for(let i=deck.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    const t = deck[i]; deck[i]=deck[j]; deck[j]=t;
  }
  // 若需要张数接近或超过牌库，多洗几副拼在一起
  const need = tarotState.count || 3;
  while(deck.length < Math.max(need + 8, 24)){
    const extra = TAROT_DECK.slice();
    for(let i=extra.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const t = extra[i]; extra[i]=extra[j]; extra[j]=t;
    }
    deck.push.apply(deck, extra);
  }
  return deck;
}
function renderTarotSlots(){
  const slots = document.getElementById('tarotSlots');
  if(!slots) return;
  const n = tarotState.count || 3;
  const pos = getTarotPositions(n);
  slots.innerHTML = '';
  for(let i=0;i<n;i++){
    const d = document.createElement('div');
    d.className = 'tarot-slot' + (tarotState.drawn[i] ? ' filled' : '');
    d.dataset.idx = i;
    if(tarotState.drawn[i]){
      d.innerHTML = '<div class="slot-pos">'+pos[i]+'</div>'+tarotState.drawn[i].n;
    } else {
      d.innerHTML = '<div class="slot-pos">'+pos[i]+'</div>待选';
    }
    slots.appendChild(d);
  }
}
function renderTarotDeckStrip(){
  const strip = document.getElementById('tarotDeckStrip');
  if(!strip) return;
  strip.innerHTML = '';
  const deck = tarotState.deckList || [];
  deck.forEach((card, i)=>{
    const el = document.createElement('div');
    el.className = 'tarot-deck-card' + (tarotState.deckUsed && tarotState.deckUsed[i] ? ' used' : '');
    el.dataset.deckIdx = i;
    el.onclick = function(){ pickTarotFromDeck(i); };
    strip.appendChild(el);
  });
}
function shuffleTarotDeck(){
  if((tarotState.drawn.filter(Boolean).length || 0) > 0){
    if(!confirm('重新洗牌会清空已选牌，确定吗？')) return;
  }
  tarotState.drawn = [];
  tarotState.deckList = buildShuffledDeck();
  tarotState.deckUsed = {};
  const n = tarotState.count || 3;
  document.getElementById('tarotProgress').textContent = '已抽 0/'+n+' · 请从下方牌堆轻触选牌';
  const box = document.getElementById('tarotResultBox');
  if(box){ box.classList.add('hidden'); box.innerHTML=''; }
  renderTarotSlots();
  renderTarotDeckStrip();
}
function pickTarotFromDeck(deckIdx){
  if(tarotState.deckUsed && tarotState.deckUsed[deckIdx]) return;
  const n = tarotState.count || 3;
  const done = tarotState.drawn.filter(Boolean).length;
  if(done >= n) return;
  const card = (tarotState.deckList || [])[deckIdx];
  if(!card) return;
  // 放入下一个空位
  let slot = -1;
  for(let i=0;i<n;i++){ if(!tarotState.drawn[i]){ slot=i; break; } }
  if(slot < 0) return;
  tarotState.drawn[slot] = Object.assign({ reversed: Math.random() < 0.5 }, card);
  if(!tarotState.deckUsed) tarotState.deckUsed = {};
  tarotState.deckUsed[deckIdx] = true;
  const now = tarotState.drawn.filter(Boolean).length;
  document.getElementById('tarotProgress').textContent = now >= n
    ? ('已抽 '+n+'/'+n+' · 抽牌完成')
    : ('已抽 '+now+'/'+n+' · 还需轻触 '+(n-now)+' 张牌');
  renderTarotSlots();
  renderTarotDeckStrip();
  if(now >= n) showTarotResult();
}
function startTarotDraw(){
  if(!tarotState.spread){ alert('请先选择一个牌阵'); return; }
  tarotState.count = tarotState.spread.count;
  const n = tarotState.count;
  tarotState.question = (document.getElementById('tarotQuestion')||{}).value || '';
  tarotState.drawn = [];
  tarotState.deckList = buildShuffledDeck();
  tarotState.deckUsed = {};
  go('tarot-draw');
  const title = tarotState.spread.name;
  document.getElementById('tarotDrawTitle').textContent = title;
  document.getElementById('tarotDrawSub').textContent = (tarotState.question ? tarotState.question.slice(0,18)+'… · ' : '') + '需要抽 '+n+' 张';
  document.getElementById('tarotProgress').textContent = '已抽 0/'+n+' · 请从下方牌堆轻触选牌';
  const box = document.getElementById('tarotResultBox');
  if(box){ box.classList.add('hidden'); box.innerHTML=''; }
  renderTarotSlots();
  renderTarotDeckStrip();
}
function flipTarotCard(){ /* 兼容旧调用，已改用牌堆点选 */ }

function cardLine(c, i, pos){
  const rev = c.reversed ? '逆位' : '正位';
  return '<div style="margin:8px 0;padding-bottom:8px;border-bottom:1px dotted var(--rule);"><b>'+(pos[i]||('位置'+(i+1)))+'</b>：'+c.n+'（'+rev+'） <span style="color:var(--ink-soft);font-size:12px;">'+c.k+'</span></div>';
}
async function showTarotResult(){
  const box = document.getElementById('tarotResultBox');
  if(!box) return;
  const n = tarotState.count || tarotState.drawn.length;
  const pos = getTarotPositions(n);
  let html = '<div class="box-title">✦ 抽牌结果（'+n+' 张）</div>';
  if(tarotState.question) html += '<p style="font-size:12.5px;color:var(--ink-soft);margin:0 0 10px;">问题：'+tarotState.question+'</p>';
  tarotState.drawn.forEach((c,i)=>{
    if(!c) return;
    html += cardLine(c, i, pos);
  });
  box.innerHTML = html;
  box.classList.remove('hidden');

  // AI 解读（若已开启并配好接口），否则回退到本地简版解读
  const interpBox = document.createElement('div');
  interpBox.style.cssText = 'margin-top:14px;padding:12px;border:1px dashed var(--ink);background:var(--paper-2);font-size:13px;line-height:1.65;white-space:pre-wrap;';
  const useAI = tarotModelOn && bgSettings.aiEndpoint && bgSettings.aiKey && bgSettings.aiModel;
  if(useAI){
    interpBox.textContent = '塔罗师正在为你解读…';
    box.appendChild(interpBox);
    try{
      const text = await callTarotAI(pos);
      interpBox.textContent = text;
      saveTarotHistory(pos, text);
    }catch(err){
      const fb = localModelInterpret(pos);
      interpBox.innerHTML = '<span style="color:var(--rouge);">AI 解读失败：'+String(err&&err.message||err).replace(/</g,'&lt;')+'</span><br><span style="font-size:11.5px;color:var(--ink-soft);">已改用本地简版解读：</span><br><br>'+fb.replace(/</g,'&lt;');
      saveTarotHistory(pos, fb);
    }
  } else {
    const localText = localModelInterpret(pos);
    interpBox.textContent = localText;
    box.appendChild(interpBox);
    saveTarotHistory(pos, localText);
    if(!tarotModelOn){
      const hint = document.createElement('p');
      hint.style.cssText = 'font-size:12px;color:var(--ink-soft);margin-top:12px;';
      hint.textContent = '提示：到「设置 → 塔罗 AI 解读」填好接口信息并打开开关，可以让 AI 塔罗师给出更完整的解读。';
      box.appendChild(hint);
    } else {
      const hint = document.createElement('p');
      hint.style.cssText = 'font-size:12px;color:var(--ink-soft);margin-top:12px;';
      hint.textContent = '提示：AI 解读已开启，但接口地址 / Key / 模型名还没填全，暂时用的是本地简版解读。';
      box.appendChild(hint);
    }
  }
}
function localModelInterpret(pos){
  const lines = [];
  const q = tarotState.question ? ('围绕你的问题「'+tarotState.question+'」，') : '';
  lines.push(q+'这次抽到的牌整体上给出了一条循序渐进的线索，逐张来看：');
  tarotState.drawn.forEach((c,i)=>{
    if(!c) return;
    const posName = pos[i] || ('位置'+(i+1));
    const rev = c.reversed ? '逆位' : '正位';
    lines.push('【'+posName+'】'+c.n+'（'+rev+'）—— '+c.t+(c.reversed ? '（此处呈逆位，提醒你更关注被压抑或走向另一面的部分。）' : ''));
  });
  lines.push('把这些位置串起来看，牌面更像是在陪你把问题看得更清楚一些，而不是给一个非黑即白的结论——具体怎么落地，还是要结合你当下的处境自己感受一下。');
  return lines.join('\n\n');
}
const TAROT_AI_SYSTEM_PROMPT = '是一个精通塔罗牌的大师，深耕于玄梦领域，精通78张牌的正逆位牌意，帮助梦女和梦角进行传讯解读你语言风格平易近人现代化，不表现的高深莫测，每张牌得出的东西都不止一句话';
async function callTarotAI(pos){
  const cardsDesc = tarotState.drawn.map((c,i)=>{
    if(!c) return null;
    const posName = pos[i] || ('位置'+(i+1));
    return (i+1)+'. 【'+posName+'】'+c.n+'（'+(c.reversed?'逆位':'正位')+'）关键词：'+c.k;
  }).filter(Boolean).join('\n');
  const userPrompt = (tarotState.question ? ('提问者的问题：'+tarotState.question+'\n\n') : '（提问者没有写具体问题，就当作是问近期的整体状况）\n\n')
    + '本次抽到的牌阵与结果如下：\n' + cardsDesc
    + '\n\n请逐张结合位置含义给出解读，每张牌不要只写一句话，再给一段整体的串联总结。';
  const resp = await fetch(bgSettings.aiEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + bgSettings.aiKey
    },
    body: JSON.stringify({
      model: bgSettings.aiModel,
      temperature: (typeof bgSettings.temp === 'number') ? bgSettings.temp : 0.8,
      messages: [
        { role: 'system', content: TAROT_AI_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ]
    })
  });
  if(!resp.ok){
    let msg = '接口返回 ' + resp.status;
    try{ const j = await resp.json(); msg = (j.error && (j.error.message||j.error)) || msg; }catch(e){}
    throw new Error(msg);
  }
  const data = await resp.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if(!text) throw new Error('接口没有返回解读内容');
  return text;
}

/* ---- 塔罗历史记录 ---- */
async function saveTarotHistory(pos, interpText){
  try{
    let list = await sGet('tarot-history', []);
    if(!Array.isArray(list)) list = [];
    const entry = {
      id: Date.now(),
      time: new Date().toLocaleString('zh-CN', {hour12:false}),
      question: tarotState.question || '',
      spreadName: (tarotState.spread && tarotState.spread.name) || '',
      count: tarotState.count,
      cards: tarotState.drawn.filter(Boolean).map((c,i)=>({
        pos: (pos && pos[i]) || ('位置'+(i+1)),
        name: c.n,
        reversed: !!c.reversed,
        k: c.k
      })),
      interp: (interpText || '').slice(0, 4000)
    };
    list.unshift(entry);
    if(list.length > 50) list = list.slice(0, 50);
    await sSet('tarot-history', list);
  }catch(e){ console.warn('save tarot history fail', e); }
}
async function openTarotHistory(){
  let list = [];
  try{ list = await sGet('tarot-history', []); }catch(e){}
  if(!Array.isArray(list)) list = [];
  let body = '';
  if(!list.length){
    body = '<div class="empty-note">还没有抽牌历史</div>';
  } else {
    body = list.map((h,i)=>{
      const cards = (h.cards||[]).map(c=>c.pos+'：'+c.name+(c.reversed?'(逆)':'')).join(' · ');
      const q = h.question ? h.question : '（无问题）';
      return '<div class="box" style="margin-bottom:10px;padding:12px;">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">'
        + '<b style="font-size:13.5px;">'+(h.spreadName||'牌阵')+'</b>'
        + '<span style="font-size:11px;color:var(--ink-soft);">'+(h.time||'')+'</span></div>'
        + '<div style="font-size:12.5px;margin-top:6px;">问题：'+q.replace(/</g,'&lt;')+'</div>'
        + '<div style="font-size:12px;color:var(--ink-soft);margin-top:6px;line-height:1.5;">'+cards.replace(/</g,'&lt;')+'</div>'
        + (h.interp ? '<div style="font-size:12px;margin-top:8px;padding-top:8px;border-top:1px dotted var(--rule);white-space:pre-wrap;max-height:120px;overflow:auto;">'+String(h.interp).replace(/</g,'&lt;')+'</div>' : '')
        + '<div class="btn-row" style="margin-top:8px;"><div class="btn outline" style="padding:4px 10px;font-size:12px;" onclick="deleteTarotHistoryItem('+h.id+')">删除这条</div></div>'
        + '</div>';
    }).join('');
    body += '<div class="btn-row" style="margin-top:8px;"><div class="btn outline" onclick="clearTarotHistory()">清空全部历史</div></div>';
  }
  openOverlay('<div class="drawer-head"><h3>塔罗历史记录</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>'+body);
}
async function deleteTarotHistoryItem(id){
  let list = await sGet('tarot-history', []);
  if(!Array.isArray(list)) list = [];
  list = list.filter(h=>h.id !== id);
  await sSet('tarot-history', list);
  openTarotHistory();
}
async function clearTarotHistory(){
  if(!confirm('确定清空全部塔罗历史记录吗？')) return;
  await sSet('tarot-history', []);
  openTarotHistory();
}


function resetTarotDraw(){ go('tarot'); }
function toggleTarotModel(){
  tarotModelOn = !tarotModelOn;
  const sw = document.getElementById('swTarotAI');
  if(sw) sw.classList.toggle('on', tarotModelOn);
  updateModelStatusLabel();
  sSet('tarot-model-on', tarotModelOn);
}
function updateModelStatusLabel(){
  const lab = document.getElementById('modelStatusLabel');
  if(!lab) return;
  const configured = !!(bgSettings.aiEndpoint && bgSettings.aiKey && bgSettings.aiModel);
  if(!tarotModelOn) lab.textContent = configured ? '已配置，但开关未打开 · 当前用本地简版解读' : '尚未配置 · 关闭时仅使用本地简版解读';
  else lab.textContent = configured ? '已开启 · 抽牌后会调用你配置的接口' : '已开启，但接口信息未填全，会先用本地简版解读';
}

const _goTarot = go;
go = function(name){
  _goTarot(name);
  if(name==='tarot'){ tarotState.cat='all'; tarotState.spread=null; renderTarotSpreads(); }
  if(name==='settings' && typeof applyBgSettingsUI==='function') applyBgSettingsUI();
};

/* ============================================================
*/
