function openChatFunctionPanel(){
  openOverlay(
    '<div class="drawer-head"><h3>✨ 功能</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>'+
    '<p style="font-size:12px;color:var(--ink-soft);margin:0 0 10px;">一起听 / 学 / 睡可以互相邀请；发出后，对方会按「传讯设置」里的回复时长随机回应（约 75% 接受）。</p>'+
    '<div class="fn-panel-grid">'+
      '<div class="fn-panel-item" onclick="closeOverlay(); openQuestionnaireComposer();"><div class="fn-panel-icon">📋</div><div class="fn-panel-label">梦向问卷</div></div>'+
      '<div class="fn-panel-item" onclick="closeOverlay(); openGesturePicker();"><div class="fn-panel-icon">👋</div><div class="fn-panel-label">小动作</div></div>'+
      '<div class="fn-panel-item" onclick="closeOverlay(); openWebLinkComposer();"><div class="fn-panel-icon">🔗</div><div class="fn-panel-label">网页链接</div></div>'+
      '<div class="fn-panel-item" onclick="closeOverlay(); openInvitePanel();"><div class="fn-panel-icon">💌</div><div class="fn-panel-label">一起邀请</div></div>'+
      '<div class="fn-panel-item" onclick="closeOverlay(); openListenTogetherPanel();"><div class="fn-panel-icon">🎵</div><div class="fn-panel-label">一起听歌</div></div>'+
      '<div class="fn-panel-item" onclick="closeOverlay(); openStudyTogetherPanel();"><div class="fn-panel-icon">📚</div><div class="fn-panel-label">一起学习</div></div>'+
      '<div class="fn-panel-item" onclick="closeOverlay(); openSleepTogetherPanel();"><div class="fn-panel-icon">🌙</div><div class="fn-panel-label">一起睡觉</div></div>'+
    '</div>'
  );
}

function openInvitePanel(){
  openOverlay(
    '<div class="drawer-head"><h3>💌 一起邀请</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>'+
    '<p style="font-size:12px;color:var(--ink-soft);margin:0 0 12px;">选一种方式邀请 '+chatSettings.companionName+'。对方会在和聊天相同的回复时长内随机回应；也可以之后主动邀请你。</p>'+
    '<div class="invite-card" onclick="closeOverlay(); openListenTogetherPanel(true);"><b>🎵 一起听歌</b><div class="invite-status">黑胶唱片界面 · 可导入歌单 · 双人头像并排</div></div>'+
    '<div class="invite-card" onclick="closeOverlay(); openStudyTogetherPanel(true);"><b>📚 一起学习</b><div class="invite-status">安静陪伴 · 可写学习主题</div></div>'+
    '<div class="invite-card" onclick="closeOverlay(); openSleepTogetherPanel(true);"><b>🌙 一起睡觉</b><div class="invite-status">互道晚安 · 可写一句哄睡的话</div></div>'
  );
}

function togetherAvatarHtml(){
  const their = profile.avatar && profile.avatar.startsWith('data:')
    ? '<img src="'+profile.avatar+'" alt="">' : (profile.avatar || '🌙');
  const mine = profile.myAvatar && String(profile.myAvatar).startsWith('data:')
    ? '<img src="'+profile.myAvatar+'" alt="">' : (profile.myAvatar || '🙂');
  return '<div class="together-avatars"><div class="ta theirs">'+their+'</div><div class="link-heart">♡</div><div class="ta mine">'+mine+'</div></div>';
}

function formatSongTime(sec){
  sec = Math.max(0, Math.floor(sec||0));
  const m = Math.floor(sec/60), s = sec%60;
  return m+':'+String(s).padStart(2,'0');
}

function extractNeteasePlaylistId(input){
  if(!input) return '';
  var s = String(input).trim();
  // plain id
  if(/^\d{5,}$/.test(s)) return s;
  // url forms: music.163.com/#/playlist?id=xxx  or /playlist?id=xxx  or y.music.163.com/m/playlist?id=
  var m = s.match(/[?&]id=(\d+)/);
  if(m) return m[1];
  m = s.match(/playlist[\/_](\d+)/i);
  if(m) return m[1];
  m = s.match(/(\d{6,})/);
  return m ? m[1] : '';
}

var _vinylAudio = null;
function getVinylAudio(){
  if(!_vinylAudio){
    _vinylAudio = new Audio();
    _vinylAudio.crossOrigin = 'anonymous';
    _vinylAudio.preload = 'metadata';
    _vinylAudio.addEventListener('timeupdate', function(){
      var st = togetherState.music;
      if(!_vinylAudio || !st.playing) return;
      st.progress = _vinylAudio.currentTime || 0;
      if(_vinylAudio.duration && isFinite(_vinylAudio.duration)) st.duration = _vinylAudio.duration;
      refreshVinylUI();
    });
    _vinylAudio.addEventListener('ended', function(){
      vinylNext(true);
    });
    _vinylAudio.addEventListener('error', function(){
      var st = togetherState.music;
      st.playing = false;
      stopVinylTimer();
      var tip = document.getElementById('vinylLoadTip');
      if(tip) tip.textContent = '这首暂时无法播放（版权/网络），已跳过或请换一首';
      // try next after short delay
      setTimeout(function(){ if(st.playlist.length > 1) vinylNext(true); }, 800);
    });
    _vinylAudio.addEventListener('play', function(){
      togetherState.music.playing = true;
      var disc = document.getElementById('vinylDisc');
      if(disc) disc.classList.add('spinning');
    });
    _vinylAudio.addEventListener('pause', function(){
      togetherState.music.playing = false;
      var disc = document.getElementById('vinylDisc');
      if(disc) disc.classList.remove('spinning');
    });
  }
  return _vinylAudio;
}

function openListenTogetherPanel(asInvite){
  const st = togetherState.music;
  const song = st.playlist[st.index] || null;
  const songName = song ? (song.name || '未命名') : '还没有歌曲';
  const artist = song ? (song.artist || '') : '';
  const pct = st.duration ? Math.min(100, (st.progress/st.duration)*100) : 0;
  const spinCls = st.playing ? ' spinning' : '';
  const statusText = st.active && st.accepted
    ? ('正在和 '+chatSettings.companionName+' 一起听')
    : (st.active ? '等待对方回应…' : '粘贴网易云歌单链接，真正导入并播放');
  openOverlay(
    '<div class="drawer-head"><h3>🎵 一起听歌</h3><span class="close-x" onclick="closeOverlay();">✕</span></div>'+
    togetherAvatarHtml()+
    '<div style="text-align:center;font-size:12px;color:var(--ink-soft);margin-bottom:4px;">'+statusText+'</div>'+
    '<div class="vinyl-stage"><div class="vinyl-disc'+spinCls+'" id="vinylDisc">'+
      '<div class="vinyl-groove" style="inset:36px;"></div>'+
      '<div class="vinyl-groove" style="inset:48px;"></div>'+
      '<div class="vinyl-groove" style="inset:60px;"></div>'+
      '<div class="vinyl-label">'+(songName||'♪').slice(0,6)+'</div>'+
    '</div></div>'+
    '<div style="text-align:center;">'+
      '<div style="font-family:\'Noto Serif SC\',serif;font-weight:700;font-size:15px;" id="vinylSongName">'+songName+'</div>'+
      '<div style="font-size:12px;color:var(--ink-soft);margin-top:4px;" id="vinylArtist">'+(artist||'—')+'</div>'+
      (song && song.pic ? '<img id="vinylCover" src="'+song.pic+'" alt="" style="width:56px;height:56px;border-radius:6px;object-fit:cover;margin-top:8px;border:1px solid var(--rule);">' : '<div id="vinylCoverWrap"></div>')+
    '</div>'+
    '<div class="song-progress-wrap">'+
      '<div class="song-progress-bar" style="cursor:pointer;" onclick="seekVinyl(event)"><div class="song-progress-fill" id="vinylProgress" style="width:'+pct+'%;"></div></div>'+
      '<div class="song-time-row"><span id="vinylCur">'+formatSongTime(st.progress)+'</span><span id="vinylDur">'+formatSongTime(st.duration)+'</span></div>'+
    '</div>'+
    '<div class="btn-row" style="justify-content:center;flex-wrap:wrap;">'+
      '<div class="btn outline" onclick="vinylPrev()">⏮</div>'+
      '<div class="btn rouge" id="vinylPlayBtn" onclick="vinylTogglePlay()">'+(st.playing?'⏸ 暂停':'▶ 播放')+'</div>'+
      '<div class="btn outline" onclick="vinylNext()">⏭</div>'+
    '</div>'+
    '<div id="vinylLoadTip" style="font-size:11.5px;color:var(--ink-soft);text-align:center;margin-top:6px;min-height:16px;"></div>'+
    '<label class="field" style="margin-top:12px;">网易云歌单链接 / ID</label>'+
    '<input type="text" id="neteasePlaylistInput" placeholder="例如 https://music.163.com/#/playlist?id=3778678 或直接填 3778678" style="width:100%;">'+
    '<div class="btn-row" style="margin-top:8px;">'+
      '<div class="btn rouge" onclick="importNeteasePlaylist()">导入网易云歌单</div>'+
      ((asInvite || !st.active) ? '<div class="btn outline" onclick="inviteListenTogether()">邀请一起听</div>' : '')+
      (st.active ? '<div class="btn outline" onclick="endListenTogether()">结束</div>' : '')+
    '</div>'+
    '<p style="font-size:11px;color:var(--ink-soft);margin:8px 0 0;">在网易云打开歌单 → 点分享 → 复制链接，粘贴到上面即可。公开歌单可导入；部分 VIP 歌曲可能无法试听。</p>'+
    '<details style="margin-top:10px;font-size:12px;color:var(--ink-soft);"><summary style="cursor:pointer;">也可以手动粘贴歌名列表</summary>'+
      '<textarea id="playlistImport" placeholder="每行：歌名 - 歌手" style="min-height:56px;margin-top:6px;"></textarea>'+
      '<div class="btn-row"><div class="btn outline" onclick="importPlaylistText()">导入文本</div></div>'+
    '</details>'+
    '<div style="margin-top:10px;font-size:12px;color:var(--ink-soft);" id="playlistCount">当前歌单 '+(st.playlistName ? '「'+st.playlistName+'」 ' : '')+st.playlist.length+' 首</div>'+
    '<div id="playlistPreview" style="max-height:140px;overflow:auto;margin-top:6px;font-size:12.5px;"></div>'
  );
  renderPlaylistPreview();
}

function renderPlaylistPreview(){
  const el = document.getElementById('playlistPreview');
  const cnt = document.getElementById('playlistCount');
  const st = togetherState.music;
  if(cnt) cnt.textContent = '当前歌单 '+(st.playlistName ? '「'+st.playlistName+'」 ' : '')+st.playlist.length+' 首';
  if(!el) return;
  const list = st.playlist;
  if(!list.length){ el.innerHTML = '<div class="empty-note" style="padding:8px 0;">还没有导入歌单</div>'; return; }
  el.innerHTML = list.map(function(s,i){
    return '<div onclick="vinylJumpTo('+i+')" style="padding:5px 4px;border-bottom:1px dotted var(--rule);cursor:pointer;'+(i===st.index?'color:var(--rouge);font-weight:700;background:var(--blush);':'')+'">'+
      (i+1)+'. '+s.name+(s.artist?' · '+s.artist:'')+(s.url?'':' <span style="opacity:.5;">(无链接)</span>')+'</div>';
  }).join('');
}

function parsePlaylistLines(raw){
  const lines = String(raw||'').split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
  const out = [];
  lines.forEach(function(line){
    if(/^(歌单|播放|收藏|评论|\d+$)/.test(line)) return;
    var name = line, artist = '';
    var m = line.match(/^(.+?)\s*[-–—|]\s*(.+)$/);
    if(m){ name = m[1].trim(); artist = m[2].trim(); }
    name = name.replace(/^\d+[\.、\)]\s*/, '');
    if(name) out.push({ name:name, artist:artist, duration: 180, url:'', id:'', pic:'' });
  });
  return out;
}
function importPlaylistText(){
  const ta = document.getElementById('playlistImport');
  if(!ta) return;
  const items = parsePlaylistLines(ta.value);
  if(!items.length){ alert('没有识别到歌曲，请每行一首：歌名 - 歌手'); return; }
  togetherState.music.playlist = items;
  togetherState.music.playlistName = '手动导入';
  togetherState.music.index = 0;
  togetherState.music.progress = 0;
  togetherState.music.duration = items[0].duration || 180;
  ta.value = '';
  loadVinylTrack(0, false);
  renderPlaylistPreview();
}

async function importNeteasePlaylist(){
  const inp = document.getElementById('neteasePlaylistInput');
  const tip = document.getElementById('vinylLoadTip');
  if(!inp) return;
  const id = extractNeteasePlaylistId(inp.value);
  if(!id){ alert('请粘贴网易云歌单链接，或填写歌单数字 ID'); return; }
  if(tip) tip.textContent = '正在从网易云拉取歌单…';
  const apis = [
    'https://api.injahow.cn/meting/?type=playlist&id='+encodeURIComponent(id),
    'https://api.i-meto.com/meting/api?server=netease&type=playlist&id='+encodeURIComponent(id)
  ];
  let list = null, lastErr = null;
  for(var ai=0; ai<apis.length; ai++){
    try{
      const resp = await fetch(apis[ai]);
      if(!resp.ok) throw new Error('HTTP '+resp.status);
      const data = await resp.json();
      if(Array.isArray(data) && data.length){ list = data; break; }
      if(data && Array.isArray(data.data) && data.data.length){ list = data.data; break; }
      throw new Error('空歌单');
    }catch(e){ lastErr = e; }
  }
  // fallback: 官方接口（可能只有前几首，且跨域可能失败）
  if(!list){
    try{
      const resp = await fetch('https://music.163.com/api/v6/playlist/detail?id='+encodeURIComponent(id), {
        headers: { 'Referer': 'https://music.163.com/' }
      });
      const data = await resp.json();
      const pl = data.playlist || data.result;
      if(pl && (pl.tracks||[]).length){
        list = (pl.tracks||[]).map(function(t){
          var arts = (t.ar || t.artists || []).map(function(a){ return a.name; }).join('/');
          return {
            name: t.name,
            artist: arts,
            url: 'https://api.injahow.cn/meting/?server=netease&type=url&id='+t.id,
            pic: (t.al && (t.al.picUrl||t.al.pic_str)) || '',
            id: String(t.id),
            duration: (t.dt ? t.dt/1000 : 180)
          };
        });
        togetherState.music.playlistName = pl.name || ('歌单 '+id);
      }
    }catch(e){ lastErr = e; }
  }
  if(!list || !list.length){
    if(tip) tip.textContent = '导入失败：'+(lastErr && lastErr.message ? lastErr.message : '请检查链接是否公开');
    alert('导入失败。请确认歌单是公开的，或换一个歌单链接再试。');
    return;
  }
  const items = list.map(function(x){
    return {
      name: x.name || x.title || '未命名',
      artist: x.artist || x.author || (Array.isArray(x.ar)?x.ar.map(function(a){return a.name;}).join('/'):'') || '',
      url: x.url || (x.id ? ('https://api.injahow.cn/meting/?server=netease&type=url&id='+x.id) : ''),
      pic: x.pic || x.cover || x.picture || '',
      id: x.id ? String(x.id) : '',
      duration: x.duration || x.dt || 180,
      lrc: x.lrc || ''
    };
  }).filter(function(x){ return x.name; });
  if(!togetherState.music.playlistName) togetherState.music.playlistName = '网易云 · '+id;
  togetherState.music.playlist = items;
  togetherState.music.index = 0;
  togetherState.music.progress = 0;
  togetherState.music.duration = items[0].duration || 180;
  if(tip) tip.textContent = '已导入 '+items.length+' 首，可以点播放';
  loadVinylTrack(0, false);
  renderPlaylistPreview();
  var cnt = document.getElementById('playlistCount');
  if(cnt) cnt.textContent = '当前歌单 「'+togetherState.music.playlistName+'」 '+items.length+' 首';
}

function loadVinylTrack(idx, autoPlay){
  const st = togetherState.music;
  if(!st.playlist.length) return;
  st.index = ((idx % st.playlist.length) + st.playlist.length) % st.playlist.length;
  const song = st.playlist[st.index];
  st.progress = 0;
  st.duration = song.duration || 180;
  const audio = getVinylAudio();
  audio.pause();
  if(song.url){
    audio.src = song.url;
    audio.load();
    if(autoPlay){
      audio.play().then(function(){ st.playing = true; refreshVinylUI(); }).catch(function(err){
        st.playing = false;
        var tip = document.getElementById('vinylLoadTip');
        if(tip) tip.textContent = '播放失败，可能是版权限制';
        refreshVinylUI();
      });
    } else {
      st.playing = false;
    }
  } else {
    st.playing = false;
    var tip = document.getElementById('vinylLoadTip');
    if(tip) tip.textContent = '这首没有可播放链接（文本导入的歌名无法在线播放）';
  }
  refreshVinylUI();
}

function refreshVinylUI(){
  const st = togetherState.music;
  const song = st.playlist[st.index];
  const nameEl = document.getElementById('vinylSongName');
  const artEl = document.getElementById('vinylArtist');
  const cur = document.getElementById('vinylCur');
  const dur = document.getElementById('vinylDur');
  const fill = document.getElementById('vinylProgress');
  const disc = document.getElementById('vinylDisc');
  const playBtn = document.getElementById('vinylPlayBtn');
  if(nameEl) nameEl.textContent = song ? song.name : '还没有歌曲';
  if(artEl) artEl.textContent = song ? (song.artist||'—') : '—';
  if(cur) cur.textContent = formatSongTime(st.progress);
  if(dur) dur.textContent = formatSongTime(st.duration);
  if(fill) fill.style.width = (st.duration ? Math.min(100,(st.progress/st.duration)*100) : 0)+'%';
  if(disc){
    if(st.playing) disc.classList.add('spinning'); else disc.classList.remove('spinning');
    var lab = disc.querySelector('.vinyl-label');
    if(lab) lab.textContent = ((song&&song.name)||'♪').slice(0,6);
  }
  if(playBtn) playBtn.textContent = st.playing ? '⏸ 暂停' : '▶ 播放';
  var cover = document.getElementById('vinylCover');
  if(song && song.pic){
    if(cover) cover.src = song.pic;
    else {
      var wrap = document.getElementById('vinylCoverWrap');
      if(wrap) wrap.innerHTML = '<img id="vinylCover" src="'+song.pic+'" alt="" style="width:56px;height:56px;border-radius:6px;object-fit:cover;margin-top:8px;border:1px solid var(--rule);">';
    }
  }
  renderPlaylistPreview();
}
function vinylTogglePlay(){
  const st = togetherState.music;
  if(!st.playlist.length){ alert('请先导入网易云歌单'); return; }
  const song = st.playlist[st.index];
  const audio = getVinylAudio();
  if(st.playing){
    audio.pause();
    st.playing = false;
    refreshVinylUI();
    return;
  }
  if(!song.url){
    alert('当前歌曲没有在线播放链接。请用「导入网易云歌单」而不是纯文本。');
    return;
  }
  if(!audio.src || audio.src.indexOf(song.id||'___') < 0 && audio.src !== song.url){
    loadVinylTrack(st.index, true);
    return;
  }
  audio.play().then(function(){ st.playing = true; refreshVinylUI(); }).catch(function(){
    loadVinylTrack(st.index, true);
  });
}
function startVinylTimer(){ /* 真实播放由 audio timeupdate 驱动，保留空函数兼容旧调用 */ }
function stopVinylTimer(){
  if(togetherState.music.timer){ clearInterval(togetherState.music.timer); togetherState.music.timer = null; }
  if(_vinylAudio){ try{ _vinylAudio.pause(); }catch(e){} }
}
function vinylNext(auto){
  const st = togetherState.music;
  if(!st.playlist.length) return;
  const next = (st.index + 1) % st.playlist.length;
  loadVinylTrack(next, !!(auto || st.playing));
}
function vinylPrev(){
  const st = togetherState.music;
  if(!st.playlist.length) return;
  const prev = (st.index - 1 + st.playlist.length) % st.playlist.length;
  loadVinylTrack(prev, !!st.playing);
}
function vinylJumpTo(i){
  const st = togetherState.music;
  loadVinylTrack(i, true);
}
function seekVinyl(e){
  const st = togetherState.music;
  const audio = getVinylAudio();
  if(!st.duration || !audio.duration) return;
  const bar = e.currentTarget;
  const rect = bar.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  audio.currentTime = ratio * audio.duration;
  st.progress = audio.currentTime;
  refreshVinylUI();
}

async function inviteListenTogether(){
  const st = togetherState.music;
  if(!st.playlist.length){ alert('请先导入至少一首歌'); return; }
  st.active = true; st.accepted = false; st.inviter = 'user';
  const song = st.playlist[st.index];
  await postTogetherSystemMsg('你邀请 '+chatSettings.companionName+' 一起听「'+song.name+'」');
  closeOverlay();
  scheduleTogetherReply('music');
}

function scheduleTogetherReply(kind){
  const delayMs = getReplyDelayMs();
  showTyping(true);
  setTimeout(async function(){
    showTyping(false);
    const accept = Math.random() < 0.75;
    if(kind==='music'){
      togetherState.music.accepted = accept;
      if(accept){
        togetherState.music.active = true;
        const song = togetherState.music.playlist[togetherState.music.index];
        const line = getRandomCardText() || '好呀，一起听。';
        await postTogetherSystemMsg(chatSettings.companionName+' 接受了一起听歌');
        const msg = {id:uid(), from:'bot', type:'text', content: line + (song?'\n正在放：'+song.name:''), time:Date.now(), read:true};
        chatMessages.push(msg); await recPut('chatMessages', msg);
      } else {
        togetherState.music.active = false;
        await postTogetherSystemMsg(chatSettings.companionName+' 现在不太方便一起听');
        const msg = {id:uid(), from:'bot', type:'text', content: getRandomCardText() || '改天好不好？我这边有点忙。', time:Date.now(), read:true};
        chatMessages.push(msg); await recPut('chatMessages', msg);
      }
    } else if(kind==='study'){
      togetherState.study.accepted = accept;
      if(accept){
        togetherState.study.active = true;
        await postTogetherSystemMsg(chatSettings.companionName+' 接受了一起学习');
        const msg = {id:uid(), from:'bot', type:'text', content: getRandomCardText() || '好，一起安静待一会儿。', time:Date.now(), read:true};
        chatMessages.push(msg); await recPut('chatMessages', msg);
      } else {
        togetherState.study.active = false;
        await postTogetherSystemMsg(chatSettings.companionName+' 婉拒了一起学习');
        const msg = {id:uid(), from:'bot', type:'text', content: getRandomCardText() || '我这边事情还没弄完，晚点陪你。', time:Date.now(), read:true};
        chatMessages.push(msg); await recPut('chatMessages', msg);
      }
    } else if(kind==='sleep'){
      togetherState.sleep.accepted = accept;
      if(accept){
        togetherState.sleep.active = true;
        await postTogetherSystemMsg(chatSettings.companionName+' 接受了一起睡觉');
        const msg = {id:uid(), from:'bot', type:'text', content: getRandomCardText() || '晚安，闭上眼，我在。', time:Date.now(), read:true};
        chatMessages.push(msg); await recPut('chatMessages', msg);
      } else {
        togetherState.sleep.active = false;
        await postTogetherSystemMsg(chatSettings.companionName+' 还想再待一会儿');
        const msg = {id:uid(), from:'bot', type:'text', content: getRandomCardText() || '再聊两句再睡好不好？', time:Date.now(), read:true};
        chatMessages.push(msg); await recPut('chatMessages', msg);
      }
    }
    if(currentView==='chat') renderChat();
    else { chatUnread = true; await sSet('chat-unread', true); renderUnreadDots(); }
  }, delayMs);
}

async function endListenTogether(){
  stopVinylTimer();
  togetherState.music.active = false;
  togetherState.music.playing = false;
  togetherState.music.accepted = false;
  await postTogetherSystemMsg('一起听歌结束了');
  closeOverlay();
}

function openStudyTogetherPanel(asInvite){
  const st = togetherState.study;
  const statusText = st.active && st.accepted
    ? ('正在和 '+chatSettings.companionName+' 一起学习')
    : (st.active ? '等待对方回应…' : '邀请对方安静陪你学习一会儿');
  openOverlay(
    '<div class="drawer-head"><h3>📚 一起学习</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>'+
    togetherAvatarHtml()+
    '<div style="text-align:center;font-size:12.5px;color:var(--ink-soft);margin-bottom:12px;">'+statusText+'</div>'+
    '<label class="field">学习主题 / 想说的话（可改）</label>'+
    '<textarea id="studyNote" placeholder="例如：复习英语 / 写论文 / 只是想有人陪着" style="min-height:64px;">'+(st.note||'')+'</textarea>'+
    '<div class="btn-row" style="margin-top:12px;">'+
      ((asInvite || !st.active) ? '<div class="btn rouge" onclick="inviteStudyTogether()">发出邀请</div>' : '')+
      (st.active ? '<div class="btn outline" onclick="endStudyTogether()">结束</div>' : '')+
    '</div>'
  );
}
async function inviteStudyTogether(){
  const note = (document.getElementById('studyNote')||{}).value || '';
  togetherState.study.note = note.trim();
  togetherState.study.active = true;
  togetherState.study.accepted = false;
  togetherState.study.inviter = 'user';
  await postTogetherSystemMsg('你邀请 '+chatSettings.companionName+' 一起学习'+(togetherState.study.note?' · '+togetherState.study.note:''));
  closeOverlay();
  scheduleTogetherReply('study');
}
async function endStudyTogether(){
  togetherState.study.active = false;
  togetherState.study.accepted = false;
  await postTogetherSystemMsg('一起学习结束了');
  closeOverlay();
}

function openSleepTogetherPanel(asInvite){
  const st = togetherState.sleep;
  const statusText = st.active && st.accepted
    ? ('正在和 '+chatSettings.companionName+' 一起休息')
    : (st.active ? '等待对方回应…' : '邀请对方一起互道晚安');
  openOverlay(
    '<div class="drawer-head"><h3>🌙 一起睡觉</h3><span class="close-x" onclick="closeOverlay()">✕</span></div>'+
    togetherAvatarHtml()+
    '<div style="text-align:center;font-size:12.5px;color:var(--ink-soft);margin-bottom:12px;">'+statusText+'</div>'+
    '<label class="field">想对 TA 说的话（可改）</label>'+
    '<textarea id="sleepNote" placeholder="例如：早点睡，明天还要早起" style="min-height:64px;">'+(st.note||'')+'</textarea>'+
    '<div class="btn-row" style="margin-top:12px;">'+
      ((asInvite || !st.active) ? '<div class="btn rouge" onclick="inviteSleepTogether()">发出邀请</div>' : '')+
      (st.active ? '<div class="btn outline" onclick="endSleepTogether()">结束</div>' : '')+
    '</div>'
  );
}
async function inviteSleepTogether(){
  const note = (document.getElementById('sleepNote')||{}).value || '';
  togetherState.sleep.note = note.trim();
  togetherState.sleep.active = true;
  togetherState.sleep.accepted = false;
  togetherState.sleep.inviter = 'user';
  await postTogetherSystemMsg('你邀请 '+chatSettings.companionName+' 一起睡觉'+(togetherState.sleep.note?' · '+togetherState.sleep.note:''));
  closeOverlay();
  scheduleTogetherReply('sleep');
}
async function endSleepTogether(){
  togetherState.sleep.active = false;
  togetherState.sleep.accepted = false;
  await postTogetherSystemMsg('一起睡觉结束了 · 晚安');
  closeOverlay();
}

/* TA 也可能主动邀请你一起听/学/睡 */
async function maybeBotInviteTogether(){
  if(Math.random() > 0.12) return;
  if(togetherState.music.active || togetherState.study.active || togetherState.sleep.active) return;
  const kinds = ['music','study','sleep'];
  const kind = kinds[Math.floor(Math.random()*kinds.length)];
  const delayMs = getReplyDelayMs();
  setTimeout(async function(){
    if(togetherState.music.active || togetherState.study.active || togetherState.sleep.active) return;
    var text = '';
    if(kind==='music'){
      togetherState.music.active = true; togetherState.music.accepted = false; togetherState.music.inviter = 'bot';
      if(!togetherState.music.playlist.length){
        togetherState.music.playlist = [{name:'未命名的歌', artist: chatSettings.companionName, duration:180}];
        togetherState.music.index = 0; togetherState.music.duration = 180;
      }
      text = chatSettings.companionName+' 邀请你一起听歌';
      await postTogetherSystemMsg(text);
      var msg = {id:uid(), from:'bot', type:'text', content: getRandomCardText() || '在听歌，要不要过来一起？', time:Date.now(), read:true};
      chatMessages.push(msg); await recPut('chatMessages', msg);
    } else if(kind==='study'){
      togetherState.study.active = true; togetherState.study.accepted = false; togetherState.study.inviter = 'bot';
      text = chatSettings.companionName+' 邀请你一起学习';
      await postTogetherSystemMsg(text);
      msg = {id:uid(), from:'bot', type:'text', content: getRandomCardText() || '我在看书，你也来安静待一会儿？', time:Date.now(), read:true};
      chatMessages.push(msg); await recPut('chatMessages', msg);
    } else {
      togetherState.sleep.active = true; togetherState.sleep.accepted = false; togetherState.sleep.inviter = 'bot';
      text = chatSettings.companionName+' 邀请你一起睡觉';
      await postTogetherSystemMsg(text);
      msg = {id:uid(), from:'bot', type:'text', content: getRandomCardText() || '困了，一起睡好不好？', time:Date.now(), read:true};
      chatMessages.push(msg); await recPut('chatMessages', msg);
    }
    if(currentView==='chat') renderChat();
    else { chatUnread = true; await sSet('chat-unread', true); renderUnreadDots(); tryBgNotify(chatSettings.companionName+' 的邀请', text); }
  }, delayMs);
}

loadBgSettings();
init();
