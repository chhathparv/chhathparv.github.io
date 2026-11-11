(() => {
  'use strict';
  const config=window.CHHATH_SITE_CONFIG||{};
  const songs=config.tracks||[];
  const byId=(id)=>document.getElementById(id);
  const all=(selector)=>[...document.querySelectorAll(selector)];
  const clamp=(number,min,max)=>Math.max(min,Math.min(max,number));
  const store={get:(key)=>{try{return localStorage.getItem(key)}catch{return null}},set:(key,value)=>{try{localStorage.setItem(key,value)}catch{}}};
  const PLAYER_STATE_KEY='chhath-player-state';
  const OWNER_KEY='chhath-active-owner';
  const INSTANCE_ID='main-'+Math.random().toString(36).slice(2,8)+'-'+Date.now().toString(36);
  const ua=navigator.userAgent||'';
  const isIOS=/iP(hone|ad|od)/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const isAndroid=/Android/i.test(ua);
  const isMobileDevice=isIOS||isAndroid;
  let savedPlayer=null;
  try{savedPlayer=JSON.parse(store.get(PLAYER_STATE_KEY)||'null')}catch{}
  const initialIndex=songs.length?clamp(Number(savedPlayer?.index??0)||0,0,songs.length-1):0;
  const initialQueue=(Array.isArray(savedPlayer?.queueOrder)&&savedPlayer.queueOrder.length===songs.length)?savedPlayer.queueOrder:songs.map((_,i)=>i);
  const ui={song:byId('nowSong'),artist:byId('nowArtist'),notice:byId('playerNotice')};
  const state={index:initialIndex,resumeTime:Math.max(0,Number(savedPlayer?.time??0)||0),queueOrder:initialQueue,scene:'sandhya',playing:false,externalPlaying:false,wantsPlay:false,mode:'curated',tab:'curated',youTube:null,youtubeReady:false,ytAPILoading:false,pipWindow:null,popupWindow:null,musicVol:clamp(Number(savedPlayer?.musicVol??store.get('chhath-music-vol')??55),0,100),fxVol:clamp(Number(store.get('chhath-fx-vol')??25),0,100),speechVol:clamp(Number(store.get('chhath-voice-vol')??65),0,100),ambient:false,ambientContext:null,ambientNodes:null,lastSound:0,toastTimer:null,playlist:store.get('chhath-playlist')||config.publicPlaylistUrl||'',reducedMotion:window.matchMedia('(prefers-reduced-motion: reduce)').matches};
  const track=()=>songs[state.index]||songs[0];
  const playerChannel=typeof BroadcastChannel==='function'?new BroadcastChannel('chhath-player'):null;
  const safeUrl=(value)=>{try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='youtube.com'||u.hostname==='www.youtube.com'||u.hostname==='music.youtube.com')?u:null}catch{return null}};
  const playlistId=(value)=>{const u=safeUrl(value);return u?(u.searchParams.get('list')||'').match(/^[A-Za-z0-9_-]{10,50}$/)?.[0]||null:null};
  let toastTick=null;
  function toast(msg){const n=byId('toast');if(!n)return;n.textContent=msg;n.classList.add('show');clearTimeout(toastTick);toastTick=setTimeout(()=>n.classList.remove('show'),3400)}
  function currentPlayerTime(){
    try{
      if(state.youTube&&typeof state.youTube.getCurrentTime==='function'){
        const cur=Number(state.youTube.getCurrentTime());
        if(Number.isFinite(cur)&&cur>=0)return cur;
      }
    }catch{}
    return state.resumeTime||0;
  }
  function persistPlayerState(extra={}){
    const payload={index:state.index,time:currentPlayerTime(),queueOrder:state.queueOrder,playing:state.playing,mode:state.mode,musicVol:state.musicVol,ownerId:INSTANCE_ID,updatedAt:Date.now(),...extra};
    store.set(PLAYER_STATE_KEY,JSON.stringify(payload));
    return payload;
  }
  function postPlayerChannel(msg){try{if(playerChannel)playerChannel.postMessage(msg)}catch{}}
  function pauseYouTubeSafely(){
    state.wantsPlay=false;
    state.playing=false;
    try{if(state.youTube&&typeof state.youTube.pauseVideo==='function')state.youTube.pauseVideo()}catch{}
  }
  function claimPlaybackOwnership(){
    state.externalPlaying=false;
    const payload={ownerId:INSTANCE_ID,index:state.index,time:currentPlayerTime(),at:Date.now()};
    store.set(OWNER_KEY,JSON.stringify(payload));
    postPlayerChannel({type:'claim-playback',...payload});
  }
  function syncMediaSession(){
    if(!('mediaSession' in navigator)||state.mode!=='curated')return;
    const t=track();
    if(!t)return;
    try{
      const artJpg=new URL('assets/share-preview.jpg',location.href).href;
      const artSvg=new URL('assets/sun-icon.svg',location.href).href;
      if(typeof MediaMetadata==='function'){
        navigator.mediaSession.metadata=new MediaMetadata({
          title:t.title,
          artist:t.artist||'छठ भक्ति संगीत',
          album:'छठ महापर्व • डिजिटल घाट',
          artwork:[{src:artJpg,sizes:'1200x630',type:'image/jpeg'},{src:artSvg,sizes:'any',type:'image/svg+xml'}]
        });
      }
      navigator.mediaSession.playbackState=state.playing?'playing':'paused';
    }catch{}
    const handlers={
      play:()=>{if(!state.playing)toggleMusic();else try{claimPlaybackOwnership();state.youTube?.playVideo()}catch{}},
      pause:()=>{pauseYouTubeSafely();updateMusic()},
      previoustrack:()=>changeSong(-1,true),
      nexttrack:()=>changeSong(1,true),
      stop:()=>{pauseYouTubeSafely();updateMusic()}
    };
    for(const [action,fn] of Object.entries(handlers)){
      try{navigator.mediaSession.setActionHandler(action,fn)}catch{}
    }
    try{
      if(typeof navigator.mediaSession.setPositionState==='function'&&state.youTube&&typeof state.youTube.getDuration==='function'){
        const dur=Number(state.youTube.getDuration())||0;
        const pos=currentPlayerTime();
        if(dur>0&&pos>=0&&pos<=dur){
          navigator.mediaSession.setPositionState({duration:dur,playbackRate:1,position:pos});
        }
      }
    }catch{}
  }
  function updateMusic(){
    ui.song.textContent=state.mode==='mine'?'आपकी YouTube playlist':track().title;
    ui.artist.textContent=state.mode==='mine'?'Official YouTube playlist player':`${track().artist} · T-Series Bhakti Sagar`;
    byId('nowSong').title=ui.song.textContent;
    const symbol=state.playing?'Ⅱ':'▶';
    for(const id of ['mainPlay','drawerPlay']){const button=byId(id);if(!button)continue;button.textContent=id==='drawerPlay'?(state.playing?'Ⅱ Pause':'▶ Play'):symbol;button.setAttribute('aria-label',state.playing?'गीत रोकें':'गीत सुनें')}
    const dock=byId('playerDock');
    dock.classList.toggle('is-playing',state.playing);
    dock.classList.toggle('external-playing',!state.playing&&state.externalPlaying);
    const modeLabel=byId('dockModeLabel');
    if(modeLabel)modeLabel.textContent=state.externalPlaying&&!state.playing?'मिनी प्लेयर में चल रहा है':'भक्ति संगीत • 22 गीत';
    byId('watchYoutube').href=state.mode==='mine'?(state.playlist||config.publicPlaylistUrl):`https://www.youtube.com/watch?v=${track().videoId}&t=${track().start}s`;
    const alt=byId('alternateYoutube');if(alt)alt.href=byId('watchYoutube').href;
    renderSongs();
    syncMediaSession();
    persistPlayerState();
  }
  function setNotice(message){if(ui.notice)ui.notice.textContent=message}
  function renderSongs(){
    const search=(byId('songSearch')?.value||'').trim().toLocaleLowerCase();
    const root=byId('songList');if(!root)return;root.replaceChildren();
    let visible=0;
    songs.forEach((s,i)=>{
      if(search && !(`${s.title} ${s.artist} ${s.mood} ${i+1}`.toLocaleLowerCase().includes(search))) return;
      visible++;
      const b=document.createElement('button');b.className='song-row'+(i===state.index&&state.mode==='curated'?' active':'');b.type='button';b.setAttribute('aria-current',i===state.index&&state.mode==='curated'?'true':'false');
      const num=document.createElement('span');num.className='song-num';num.textContent=String(i+1).padStart(2,'0');
      const copy=document.createElement('span');copy.className='song-row-copy';const title=document.createElement('strong');title.textContent=s.title;const subtitle=document.createElement('small');subtitle.textContent=`${s.artist} · ${s.mood}`;copy.append(title,subtitle);
      const mark=document.createElement('span');mark.className='song-row-play';mark.textContent=i===state.index&&state.mode==='curated'&&state.playing?'♫':'▶';b.append(num,copy,mark);
      b.onclick=()=>chooseTrack(i,true);root.append(b);
    });
    if(!visible){const p=document.createElement('p');p.className='empty-search';p.textContent='इस खोज के लिए कोई गीत नहीं मिला।';root.append(p)}
  }
  function renderPreview(){const target=byId('songPreview');if(!target)return;target.replaceChildren();songs.slice(0,6).forEach((s,i)=>{
    const b=document.createElement('button');b.className='song-preview-item';b.type='button';b.onclick=()=>{chooseTrack(i,true)};
    const n=document.createElement('span');n.className='preview-num';n.textContent=String(i+1).padStart(2,'0');const text=document.createElement('span');text.className='preview-title';const t=document.createElement('strong');t.textContent=s.title;const a=document.createElement('small');a.textContent=s.artist;text.append(t,a);
    const end=document.createElement('span');end.className='preview-end';end.textContent='सुनें ↗';b.append(n,text,end);target.append(b);
  })}
  const drawer=byId('musicDrawer'),settings=byId('settingsPanel'),backdrop=byId('drawerBackdrop');
  let lastFocus=null;
  function openDrawer(type){lastFocus=document.activeElement;closePanels(false);const el=type==='sound'?settings:drawer;el.classList.add('open');el.setAttribute('aria-hidden','false');backdrop.hidden=false;document.body.classList.add('panel-open');(el.querySelector('.drawer-close')||el).focus();}
  function closePanels(restore=true){[drawer,settings].forEach(el=>{el.classList.remove('open');el.setAttribute('aria-hidden','true')});backdrop.hidden=true;document.body.classList.remove('panel-open');if(restore&&lastFocus?.isConnected)lastFocus.focus()}
  byId('closeDrawer').onclick=()=>closePanels();byId('closeSettings').onclick=()=>closePanels();backdrop.onclick=()=>closePanels();
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!backdrop.hidden)closePanels();if(e.key==='Tab'&&!backdrop.hidden){const panel=settings.classList.contains('open')?settings:drawer;const focusables=[...panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])')].filter(x=>x.getClientRects().length);if(!focusables.length)return;const first=focusables[0],last=focusables.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
  function libraryTab(tab){state.tab=tab;all('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));byId('curatedSection').hidden=tab!=='curated';byId('yoursSection').hidden=tab!=='yours'}
  all('[data-tab]').forEach(b=>b.onclick=()=>libraryTab(b.dataset.tab));
  byId('dockLibrary').onclick=()=>{openDrawer('music');libraryTab('curated')};byId('openPlaylist').onclick=()=>{openDrawer('music');libraryTab('curated')};
  if(byId('openSoundSettings')) byId('openSoundSettings').onclick=()=>openDrawer('sound');
  byId('soundBtn').onclick=()=>openDrawer('sound');
  byId('songSearch').addEventListener('input',renderSongs);
  let ytPromise=null;
  function whenYtReady(){
    if(window.YT?.Player) return Promise.resolve(true);
    if(ytPromise) return ytPromise;
    ytPromise=new Promise(resolve=>{
      let done=false;
      const complete=ok=>{if(done)return;done=true;clearTimeout(timer);if(!ok)ytPromise=null;resolve(ok)};
      const timer=setTimeout(()=>complete(Boolean(window.YT?.Player)),9500);
      const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;
      script.onerror=()=>complete(false);
      window.onYouTubeIframeAPIReady=()=>complete(Boolean(window.YT?.Player));
      document.head.append(script);
    });
    return ytPromise;
  }
  function removeYT(){if(state.youTube){try{state.youTube.destroy()}catch{}state.youTube=null}}
  function refreshExternalSyncUI(){
    const t=track();
    if(!t)return;
    ui.song.textContent=t.title;
    ui.artist.textContent=`${t.artist} · T-Series Bhakti Sagar`;
    byId('nowSong').title=t.title;
    const dock=byId('playerDock');
    dock.classList.toggle('is-playing',state.playing);
    dock.classList.toggle('external-playing',!state.playing&&state.externalPlaying);
    const modeLabel=byId('dockModeLabel');
    if(modeLabel)modeLabel.textContent=state.externalPlaying&&!state.playing?'मिनी प्लेयर में चल रहा है':'भक्ति संगीत • 22 गीत';
    renderSongs();
    syncMediaSession();
  }

  if(playerChannel){
    playerChannel.onmessage=(ev)=>{
      const m=ev.data||{};
      if(!m.ownerId||m.ownerId===INSTANCE_ID)return;
      if(m.type==='claim-playback'){
        pauseYouTubeSafely();
        state.externalPlaying=true;
        if(Number.isInteger(m.index)&&songs.length)state.index=clamp(m.index,0,songs.length-1);
        if(Number.isFinite(Number(m.time)))state.resumeTime=Math.max(0,Number(m.time));
        refreshExternalSyncUI();
      }else if(m.type==='state-sync'&&!state.playing){
        if(Number.isInteger(m.index)&&songs.length)state.index=clamp(m.index,0,songs.length-1);
        if(Number.isFinite(Number(m.time)))state.resumeTime=Math.max(0,Number(m.time));
        state.externalPlaying=Boolean(m.playing);
        refreshExternalSyncUI();
      }
    };
  }

  window.addEventListener('storage',(ev)=>{
    if(ev.key===OWNER_KEY&&ev.newValue){
      try{
        const d=JSON.parse(ev.newValue);
        if(d.ownerId&&d.ownerId!==INSTANCE_ID){
          pauseYouTubeSafely();
          state.externalPlaying=true;
          if(Number.isInteger(d.index)&&songs.length)state.index=clamp(d.index,0,songs.length-1);
          refreshExternalSyncUI();
        }
      }catch{}
    }else if(ev.key===PLAYER_STATE_KEY&&ev.newValue&&!state.playing){
      try{
        const d=JSON.parse(ev.newValue);
        if(d.ownerId&&d.ownerId!==INSTANCE_ID){
          if(Number.isInteger(d.index)&&songs.length)state.index=clamp(d.index,0,songs.length-1);
          if(Number.isFinite(Number(d.time)))state.resumeTime=Math.max(0,Number(d.time));
          state.externalPlaying=Boolean(d.playing);
          refreshExternalSyncUI();
        }
      }catch{}
    }
  });

  function loadCurated(index,autoplay=true){
    state.mode='curated';state.index=(index+songs.length)%songs.length;state.wantsPlay=autoplay;
    if(autoplay)claimPlaybackOwnership();
    const playingTrack=track();
    const startSec=(state.resumeTime&&state.resumeTime>=(playingTrack.start||0))?Math.floor(state.resumeTime):(playingTrack.start||0);
    state.resumeTime=0;
    updateMusic();
    if(state.youTube && typeof state.youTube.loadVideoById==='function'){
      try{
        state.youTube.setVolume(state.musicVol);
        state.youTube.loadVideoById({videoId:playingTrack.videoId,startSeconds:startSec,...(playingTrack.end?{endSeconds:playingTrack.end}:{})});
        if(!state.wantsPlay) state.youTube.pauseVideo();
        else toast(`♫ ${playingTrack.title}`);
        return;
      }catch{}
    }
    byId('youtubeMount').replaceChildren();removeYT();
    const holder=document.createElement('div');holder.id='youtubePlayer';byId('youtubeMount').append(holder);
    setNotice('आधिकारिक YouTube player लोड हो रहा है…');
    if(autoplay) toast(`♫ ${playingTrack.title} — शुरू हो रहा है…`);
    whenYtReady().then(ok=>{
      if(state.mode!=='curated'||document.getElementById('youtubePlayer')!==holder)return;
      if(!ok){fallbackIframe(track());return}
      const nextTrack=track();
      state.youTube=new YT.Player('youtubePlayer',{height:'240',width:'425',videoId:nextTrack.videoId,
        playerVars:{playsinline:1,rel:0,modestbranding:1,start:startSec,enablejsapi:1,autoplay:state.wantsPlay?1:0,origin:location.origin.startsWith('http')?location.origin:undefined},
        events:{onReady:e=>{try{e.target.setVolume(state.musicVol);e.target.loadVideoById({videoId:nextTrack.videoId,startSeconds:startSec,...(nextTrack.end?{endSeconds:nextTrack.end}: {})});if(!state.wantsPlay)e.target.pauseVideo()}catch{}setNotice('YouTube player तैयार है। ▶ नहीं चलता हो तो वीडियो के अंदर Play दबाएँ या नीचे YouTube link खोलें।')},
                onStateChange:e=>{if(state.mode!=='curated')return;const Y=window.YT.PlayerState;if(e.data===Y.PLAYING){state.playing=true;state.externalPlaying=false;claimPlaybackOwnership();updateMusic()}else if(e.data===Y.PAUSED){state.playing=false;updateMusic()}else if(e.data===Y.ENDED){state.playing=false;changeSong(1,true)}},
                onAutoplayBlocked:()=>{state.playing=false;updateMusic();setNotice('Browser ने autoplay रोक दिया है। कृपया player पर Play दबाएँ।');toast('दोबारा ▶ Play दबाएँ या ♫ गीत सूची से चलाएँ।')},
                onError:e=>{state.playing=false;updateMusic();setNotice('इस गीत को यहाँ चलाने की अनुमति नहीं है। नीचे सीधे YouTube पर सुनें।');toast('यह गीत embed में उपलब्ध नहीं है — ❯❯ से अगला गीत सुनें।')}}});
    });
  }
  function fallbackIframe(s){const mount=byId('youtubeMount');mount.replaceChildren();const frame=document.createElement('iframe');frame.title=`${s.title} official YouTube recording`;frame.allow='autoplay; encrypted-media; picture-in-picture';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';frame.src=`https://www.youtube-nocookie.com/embed/${s.videoId}?start=${s.start}${s.end?`&end=${s.end}`:''}&autoplay=${state.wantsPlay?1:0}&playsinline=1`;mount.append(frame);state.playing=false;updateMusic();setNotice('YouTube controls के साथ गीत सुनें। यदि player न खुले तो YouTube लिंक इस्तेमाल करें।')}
  function chooseTrack(index,autoplay=true){state.resumeTime=0;libraryTab('curated');loadCurated(index,autoplay)}
  function changeSong(delta,autoplay=true){
    if(state.mode==='mine'){toast('आपकी playlist में अगले गीत के लिए YouTube player के controls इस्तेमाल करें।');return}
    const qPos=Math.max(0,state.queueOrder.indexOf(state.index));
    const nextQPos=(qPos+delta+state.queueOrder.length)%state.queueOrder.length;
    chooseTrack(state.queueOrder[nextQPos]??0,autoplay);
  }
  function toggleMusic(){
    if(state.mode==='mine'){openDrawer('music');toast('अपनी playlist को YouTube player के Play button से चलाएँ।');return}
    if(!state.youTube){loadCurated(state.index,true);return}
    try{const now=state.youTube.getPlayerState();if(now===YT.PlayerState.PLAYING){state.youTube.pauseVideo()}else{claimPlaybackOwnership();state.youTube.playVideo()}}catch{loadCurated(state.index,true)}
  }

  function showMiniPopupBanner(url){
    const banner=byId('miniPopupBanner'),link=byId('miniPopupFallbackLink');
    if(link)link.href=url;
    if(banner)banner.hidden=false;
  }

  function openMiniPlayer(){
    const curSec=Math.floor(currentPlayerTime());
    persistPlayerState({time:curSec,playing:false});
    pauseYouTubeSafely();
    state.externalPlaying=true;
    updateMusic();

    const miniUrl=new URL('mini-player.html',location.href);
    miniUrl.searchParams.set('track',String(state.index));
    miniUrl.searchParams.set('t',String(curSec));
    miniUrl.searchParams.set('vol',String(state.musicVol));
    miniUrl.searchParams.set('autoplay','1');

    const banner=byId('miniPopupBanner');
    if(banner)banner.hidden=true;

    const canDocPiP=Boolean(!isMobileDevice&&window.documentPictureInPicture&&typeof window.documentPictureInPicture.requestWindow==='function');
    if(canDocPiP){
      const pipUrl=new URL(miniUrl.href);
      pipUrl.searchParams.set('pip','1');
      window.documentPictureInPicture.requestWindow({width:400,height:540}).then(pipWin=>{
        state.pipWindow=pipWin;
        pipWin.document.title='छठ गीत मिनी प्लेयर';
        pipWin.document.body.style.margin='0';
        pipWin.document.body.style.background='#121718';
        pipWin.document.body.style.height='100vh';
        const frame=pipWin.document.createElement('iframe');
        frame.src=pipUrl.href;
        frame.title='छठ गीत फ्लोटिंग मिनी प्लेयर';
        frame.allow='autoplay; encrypted-media; picture-in-picture';
        frame.style.cssText='width:100%;height:100%;border:0;display:block;';
        pipWin.document.body.append(frame);
        pipWin.addEventListener('pagehide',()=>{
          state.pipWindow=null;
          state.externalPlaying=false;
          try{
            const latest=JSON.parse(store.get(PLAYER_STATE_KEY)||'null');
            if(latest&&Number.isInteger(latest.index)){
              state.index=clamp(latest.index,0,songs.length-1);
              state.resumeTime=Math.max(0,Number(latest.time)||0);
            }
          }catch{}
          refreshExternalSyncUI();
        });
        toast('⧉ फ्लोटिंग मिनी प्लेयर खुल गया — अब आप किसी भी टैब या पेज पर जा सकते हैं!');
      }).catch(()=>{
        showMiniPopupBanner(miniUrl.href);
        toast('⧉ ब्राउज़र ने पॉप-आउट रोका — नीचे दिए लिंक से मिनी प्लेयर खोलें।');
      });
      return;
    }

    let popup=null;
    try{
      popup=isMobileDevice
        ?window.open(miniUrl.href,'chhathMiniPlayer')
        :window.open(miniUrl.href,'chhathMiniPlayer','width=420,height=580,resizable=yes,scrollbars=yes');
    }catch{popup=null}

    if(popup&&!popup.closed){
      state.popupWindow=popup;
      try{popup.focus()}catch{}
      toast('⧉ मिनी प्लेयर अलग विंडो/टैब में खुल गया — अब मुख्य टैब में नेविगेट करने पर भी संगीत चलता रहेगा।');
    }else{
      state.externalPlaying=false;
      updateMusic();
      showMiniPopupBanner(miniUrl.href);
      toast('⧉ पॉप-अप अवरुद्ध हुआ — नीचे दिए लिंक पर टैप करें।');
    }
  }

  if(byId('miniPlayerBtn'))byId('miniPlayerBtn').onclick=openMiniPlayer;
  if(byId('openMiniPlayerSection'))byId('openMiniPlayerSection').onclick=openMiniPlayer;
  if(byId('drawerMiniPlayer'))byId('drawerMiniPlayer').onclick=()=>{closePanels(false);openMiniPlayer()};
  if(byId('closeMiniPopupBanner'))byId('closeMiniPopupBanner').onclick=()=>{const b=byId('miniPopupBanner');if(b)b.hidden=true};

  for(const id of ['mainPlay','drawerPlay','startMusic'])byId(id).addEventListener('click',toggleMusic);
  for(const id of ['prevSong','drawerPrev'])byId(id).onclick=()=>changeSong(-1);
  for(const id of ['nextSong','drawerNext'])byId(id).onclick=()=>changeSong(1);
  setInterval(()=>{
    if(state.mode!=='curated'||!state.youTube||!state.playing)return;
    const t=track();
    persistPlayerState();
    syncMediaSession();
    if(!t.end)return;
    try{if(state.youTube.getCurrentTime()>=t.end-.4)changeSong(1,true)}catch{}
  },1000);
  window.addEventListener('pagehide',()=>persistPlayerState());
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persistPlayerState()});
  const loadMyPlaylist=()=>{const input=byId('playlistInput').value.trim(),id=playlistId(input);
    if(!id){toast('कृपया सही YouTube playlist URL दें, जिसमें list=... हो।');return}
    state.playlist=input;store.set('chhath-playlist',input);state.mode='mine';state.playing=false;state.wantsPlay=true;removeYT();
    const mount=byId('youtubeMount');mount.replaceChildren();const frame=document.createElement('iframe');frame.title='Your YouTube music playlist';frame.allow='autoplay; encrypted-media; picture-in-picture';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;frame.src=`https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(id)}&autoplay=1&playsinline=1&rel=0`;mount.append(frame);
    byId('playlistOpenExternal').href=(safeUrl(input)?.href)||config.publicPlaylistUrl;updateMusic();setNotice('आपकी playlist YouTube पर उपलब्ध और public/unlisted होने पर ही चलेगी। Spotify/YouTube Music account sync नहीं होता।');toast('आपकी playlist लिंक सेट कर दिया गया है।');
  };
  byId('loadMyPlaylist').onclick=loadMyPlaylist;
  byId('playlistInput').value=state.playlist;
  byId('playlistOpenExternal').href=(safeUrl(state.playlist)?.href)||config.publicPlaylistUrl;
  byId('playlistInput').addEventListener('input',e=>{const url=safeUrl(e.target.value);if(url)byId('playlistOpenExternal').href=url.href});
  function volumeApply(music,fx,voice){
    if(music!==undefined){state.musicVol=clamp(Number(music),0,100);byId('musicVol').value=String(state.musicVol);byId('settingsMusicVol').value=String(state.musicVol);byId('musicVolValue').textContent=`${state.musicVol}%`;store.set('chhath-music-vol',String(state.musicVol));try{state.youTube?.setVolume(state.musicVol)}catch{}}
    if(fx!==undefined){state.fxVol=clamp(Number(fx),0,100);byId('fxVol').value=String(state.fxVol);byId('fxVolValue').textContent=`${state.fxVol}%`;store.set('chhath-fx-vol',String(state.fxVol));updateAmbienceGain()}
    if(voice!==undefined){state.speechVol=clamp(Number(voice),0,100);byId('speechVol').value=String(state.speechVol);byId('speechVolValue').textContent=`${state.speechVol}%`;store.set('chhath-voice-vol',String(state.speechVol))}
  }
  byId('musicVol').oninput=e=>volumeApply(e.target.value);byId('settingsMusicVol').oninput=e=>volumeApply(e.target.value);
  byId('fxVol').oninput=e=>volumeApply(undefined,e.target.value);byId('speechVol').oninput=e=>volumeApply(undefined,undefined,e.target.value);
  volumeApply(state.musicVol,state.fxVol,state.speechVol);
  function createAudio(){try{if(!state.ambientContext){state.ambientContext=new(window.AudioContext||window.webkitAudioContext)()}if(state.ambientContext.state==='suspended'){state.ambientContext.resume()}return state.ambientContext}catch{return null}}
  function tone(freq,duration,kind='sine',gain=.1,when=0,octave=null){const ctx=createAudio();if(!ctx||!state.fxVol)return;const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=kind;osc.frequency.setValueAtTime(freq,ctx.currentTime+when);if(octave)osc.frequency.exponentialRampToValueAtTime(octave,ctx.currentTime+when+duration*.75);const level=Math.min(.14,gain)*state.fxVol/100;g.gain.setValueAtTime(.0001,ctx.currentTime+when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,level),ctx.currentTime+when+.035);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+when+duration);osc.connect(g);g.connect(ctx.destination);osc.start(ctx.currentTime+when);osc.stop(ctx.currentTime+when+duration+.02)}
  function bell(){[660,990,1320,1760].forEach((f,i)=>tone(f,1.7,'sine',.095/(i+1),i*.009));toast('🔔 मंदिर की मधुर घंटी')}
  
  // --- Central Festive Audio Controller (One at a time, Strict Toggle on/off, No overlapping cacophony) ---
  let activeFestiveAudio = null;
  let activeFestiveId = null;
  let activeFestiveResetFn = null;

  function stopActiveFestiveAudio(notify=false){
    if(activeFestiveAudio){
      try{
        activeFestiveAudio.pause();
        activeFestiveAudio.currentTime = 0;
      }catch{}
      activeFestiveAudio = null;
    }
    if(typeof activeFestiveResetFn === 'function'){
      try{ activeFestiveResetFn(); }catch{}
      activeFestiveResetFn = null;
    }
    if(notify && activeFestiveId){
      toast('ध्वनि बंद कर दी गई।');
    }
    activeFestiveId = null;
  }

  function playFestiveAudio(id, fileUrl, volumeScale=1.0, onStart=null, onEnd=null){
    // 1. Toggle Check: Clicking the same sound while it's playing stops it immediately
    if(activeFestiveId === id){
      stopActiveFestiveAudio(true);
      return false;
    }

    // 2. Mutual Exclusion: Stop any other festive sound immediately (max 1 foreground sound)
    stopActiveFestiveAudio(false);

    try{
      const audio = new Audio(fileUrl);
      const vol = Math.min(1.0, Math.max(0.01, ((state.fxVol || 80) / 100) * volumeScale));
      audio.volume = vol;
      audio.loop = false; // strictly one play, stops automatically!

      activeFestiveAudio = audio;
      activeFestiveId = id;
      activeFestiveResetFn = onEnd;

      audio.onended = () => {
        stopActiveFestiveAudio(false);
      };
      audio.onerror = () => {
        stopActiveFestiveAudio(false);
      };

      audio.play().catch(e => {
        console.warn('Playback error', e);
        stopActiveFestiveAudio(false);
      });

      if(typeof onStart === 'function') onStart();
      return true;
    }catch(e){
      stopActiveFestiveAudio(false);
      return false;
    }
  }

  // --- Authentic Festive Effects (with Toggle Support) ---
  function toggleRocketCracker(){
    const btn = byId('rocketCrackerBtn');
    playFestiveAudio(
      'rocket',
      'assets/audio/rocket.m4a',
      1.0,
      () => {
        btn?.classList.add('is-playing');
        launchRocketAnimation();
        toast('🚀 रॉकेट आतिशबाज़ी • घाट से गगनभेदी उड़ान!');
      },
      () => {
        btn?.classList.remove('is-playing');
      }
    );
  }

  function toggleBombCracker(){
    const btn = byId('bombCrackerBtn');
    playFestiveAudio(
      'bomb',
      'assets/audio/bomb.m4a',
      1.0,
      () => {
        btn?.classList.add('is-playing');
        fireworks();
        toast('💥 छठ बम व लड़ी • गूँजता जोरदार धमाका!');
      },
      () => {
        btn?.classList.remove('is-playing');
      }
    );
  }

  function toggleConchSound(){
    const btn = byId('shankhSoundBtn');
    playFestiveAudio(
      'shankh',
      'assets/audio/shankh.m4a',
      1.0,
      () => {
        btn?.classList.add('is-playing');
        toast('🐚 पावन शंखनाद — जय छठी मैया!');
      },
      () => {
        btn?.classList.remove('is-playing');
      }
    );
  }

  function broadcastAnnouncement(customText){
    const btn = byId('loudspeakerAnnounceBtn');
    if(activeFestiveId === 'loudspeaker'){
      if('speechSynthesis' in window) window.speechSynthesis.cancel();
      stopActiveFestiveAudio(true);
      btn?.classList.remove('is-playing');
      return;
    }

    stopActiveFestiveAudio(false);
    btn?.classList.add('is-playing');

    const text = (customText || byId('customAnnounceInput')?.value || '').trim() ||
      "सभी श्रद्धालु माताओं एवं बहनों से निवेदन है कि कृपया गंगा घाट को स्वच्छ रखें, गहरे पानी में न जाएँ और बच्चों का ध्यान रखें। जय छठी मैया!";

    const ctx = createAudio();
    const now = ctx ? ctx.currentTime : 0;
    const vol = (state.speechVol || 80) / 100;

    activeFestiveId = 'loudspeaker';
    activeFestiveResetFn = () => {
      btn?.classList.remove('is-playing');
      if('speechSynthesis' in window) window.speechSynthesis.cancel();
    };

    // 1. Temple chime
    if(ctx){
      const chime = ctx.createOscillator();
      const g = ctx.createGain();
      chime.type = 'sine';
      chime.frequency.setValueAtTime(784, now);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.24 * ((state.fxVol || 80) / 100), now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      chime.connect(g);
      g.connect(ctx.destination);
      chime.start(now);
      chime.stop(now + 0.42);

      const chime2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      chime2.type = 'sine';
      chime2.frequency.setValueAtTime(1046.5, now + 0.38);
      g2.gain.setValueAtTime(0.001, now + 0.38);
      g2.gain.exponentialRampToValueAtTime(0.28 * ((state.fxVol || 80) / 100), now + 0.42);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
      chime2.connect(g2);
      g2.connect(ctx.destination);
      chime2.start(now + 0.38);
      chime2.stop(now + 0.9);
    }

    toast('📣 घाट लाउडस्पीकर उद्घोष प्रसारित हो रहा है...');

    // 2. Hindi Devotional Announcement
    if('speechSynthesis' in window){
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'hi-IN';
      utterance.rate = 0.92;
      utterance.pitch = 1.04;
      utterance.volume = vol;

      const voices = window.speechSynthesis.getVoices();
      const hindiVoice = voices.find(v => v.lang === 'hi-IN' || v.lang.startsWith('hi') || v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('lekha'));
      if(hindiVoice) utterance.voice = hindiVoice;

      utterance.onend = () => {
        stopActiveFestiveAudio(false);
      };
      utterance.onerror = () => {
        stopActiveFestiveAudio(false);
      };

      setTimeout(() => {
        try{ window.speechSynthesis.speak(utterance); }catch{ stopActiveFestiveAudio(false); }
      }, 750);
    } else {
      setTimeout(() => stopActiveFestiveAudio(false), 4000);
    }
  }

  function conch(){ toggleConchSound(); }
  function fxNoise(duration=.2,level=.02){const ctx=createAudio();if(!ctx||state.fxVol===0)return;const buffer=ctx.createBuffer(1,Math.max(1,Math.floor(ctx.sampleRate*duration)),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.5;const source=ctx.createBufferSource();source.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=500;const g=ctx.createGain();g.gain.setValueAtTime(level*state.fxVol/100,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);source.connect(filter);filter.connect(g);g.connect(ctx.destination);source.start()}
  function createAmbience(){if(state.ambientNodes)return;const ctx=createAudio();if(!ctx)return;const source=ctx.createBufferSource();const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<data.length;i++){last=last*.994+(Math.random()-.5)*.006;data[i]=last*.3}source.buffer=buffer;source.loop=true;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=380;const gain=ctx.createGain();gain.gain.value=0;source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);source.start();state.ambientNodes={source,gain};updateAmbienceGain()}
  function updateAmbienceGain(){if(state.ambientNodes){const g=state.ambientNodes.gain.gain;g.setTargetAtTime(state.ambient?state.fxVol/100*.27:0,state.ambientContext.currentTime,.15)}}
  byId('ambientToggle').onchange=e=>{state.ambient=e.target.checked;if(state.ambient)createAmbience();updateAmbienceGain();toast(state.ambient?'नदी की हल्की आवाज़ चालू है।':'पृष्ठभूमि की आवाज़ बंद है।')};

  const SCENE_KEYS = ['sandhya', 'usha', 'koshi', 'fireworks', 'arpan', 'bahangi'];
  function scene(name){
    if(!config.scenes[name])return;
    state.scene=name;
    document.body.dataset.scene=name;
    all('[data-scene-btn]').forEach(b=>{
      const active=b.dataset.sceneBtn===name;
      b.classList.toggle('is-active',active);
      b.setAttribute('aria-pressed',String(active));
    });
    const idx = SCENE_KEYS.indexOf(name) + 1;
    const foot=document.querySelector('.scene-foot');
    if(foot) foot.textContent=`SCENES · 0${idx || 1} / 06`;
    updateFestivalStatus();
    toast(config.scenes[name].label+' • '+config.scenes[name].message);
    if(name==='koshi'){for(let i=0;i<5;i++)setTimeout(addDiya,i*220)}
    if(name==='fireworks'){fireworks();setTimeout(fireworks,600)}
    if(name==='arpan'){arghya()}
  }
  all('[data-scene-btn]').forEach(b=>b.onclick=()=>scene(b.dataset.sceneBtn));

  let liveDevoteeCount = 18 + Math.floor(Math.random() * 5);
  function updateDevoteeCount(){
    const drift = Math.floor(Math.random() * 5) - 2; // -2, -1, 0, 1, 2
    liveDevoteeCount = clamp(liveDevoteeCount + drift, 16, 28);
    updateFestivalStatus();
  }
  function updateFestivalStatus(){
    const textEl = byId('ambienceText');
    if(textEl) textEl.textContent = `${liveDevoteeCount} श्रद्धालु लाइव जुड़े हैं`;
  }
  setInterval(updateDevoteeCount, 60000); // Updated once every 1 minute

  function updateLiveGhatClock(){
    const clockEl = byId('liveGhatClock');
    const dateEl = byId('liveGhatDate');
    if(!clockEl && !dateEl) return;
    const now = new Date();
    if(clockEl){
      clockEl.textContent = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).toUpperCase();
      clockEl.setAttribute('datetime', now.toISOString());
    }
    if(dateEl){
      dateEl.textContent = now.toLocaleDateString('hi-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      });
    }
  }
  updateLiveGhatClock();
  setInterval(updateLiveGhatClock, 1000);

  function createDiyaBowlSvg(uid){
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('viewBox','0 0 64 38');
    svg.setAttribute('class','diya-svg');
    svg.setAttribute('aria-hidden','true');

    const defs=document.createElementNS(ns,'defs');
    const clayGrad=document.createElementNS(ns,'linearGradient');
    clayGrad.setAttribute('id',`clay-${uid}`);
    clayGrad.setAttribute('x1','0%');clayGrad.setAttribute('y1','0%');
    clayGrad.setAttribute('x2','0%');clayGrad.setAttribute('y2','100%');
    const s1=document.createElementNS(ns,'stop');s1.setAttribute('offset','0%');s1.setAttribute('stop-color','#d97a46');
    const s2=document.createElementNS(ns,'stop');s2.setAttribute('offset','55%');s2.setAttribute('stop-color','#a84d24');
    const s3=document.createElementNS(ns,'stop');s3.setAttribute('offset','100%');s3.setAttribute('stop-color','#642812');
    clayGrad.append(s1,s2,s3);

    const gheeGrad=document.createElementNS(ns,'radialGradient');
    gheeGrad.setAttribute('id',`ghee-${uid}`);
    const g1=document.createElementNS(ns,'stop');g1.setAttribute('offset','0%');g1.setAttribute('stop-color','#ffe89e');
    const g2=document.createElementNS(ns,'stop');g2.setAttribute('offset','70%');g2.setAttribute('stop-color','#e29934');
    const g3=document.createElementNS(ns,'stop');g3.setAttribute('offset','100%');g3.setAttribute('stop-color','#8a4618');
    gheeGrad.append(g1,g2,g3);

    defs.append(clayGrad,gheeGrad);
    svg.append(defs);

    // Traditional leaf base (पत्ता / दोना) floating on Ganga
    const leaf=document.createElementNS(ns,'ellipse');
    leaf.setAttribute('cx','32');leaf.setAttribute('cy','28');
    leaf.setAttribute('rx','29');leaf.setAttribute('ry','7');
    leaf.setAttribute('fill','#2d5a34');leaf.setAttribute('opacity','0.9');
    svg.append(leaf);

    // Earthen clay diya bowl
    const bowl=document.createElementNS(ns,'path');
    bowl.setAttribute('d','M10 15 Q32 34 54 15 L49 11 Q32 21 15 11 Z');
    bowl.setAttribute('fill',`url(#clay-${uid})`);
    svg.append(bowl);

    // Upper rim & ghee pool
    const rim=document.createElementNS(ns,'ellipse');
    rim.setAttribute('cx','32');rim.setAttribute('cy','12.5');
    rim.setAttribute('rx','21');rim.setAttribute('ry','5.5');
    rim.setAttribute('fill','#c96736');
    svg.append(rim);

    const ghee=document.createElementNS(ns,'ellipse');
    ghee.setAttribute('cx','32');ghee.setAttribute('cy','12.5');
    ghee.setAttribute('rx','16.5');ghee.setAttribute('ry','3.6');
    ghee.setAttribute('fill',`url(#ghee-${uid})`);
    svg.append(ghee);

    // Subtle marigold petal accents on leaf
    for(const [cx,cy,col] of [[12,25,'#ff9800'],[52,25,'#ffb300'],[20,29,'#ffd54f']]){
      const petal=document.createElementNS(ns,'circle');
      petal.setAttribute('cx',String(cx));petal.setAttribute('cy',String(cy));
      petal.setAttribute('r','2.2');petal.setAttribute('fill',col);
      svg.append(petal);
    }
    return svg;
  }

  let deepDaanGlowTimer=0;
  let diyaUid=0;
  function spawnViewportDiya(originX,originY,index,total){
    const container=byId('deepDaanDiyas');
    if(!container)return;
    const vw=window.innerWidth||1280;
    const vh=window.innerHeight||800;

    const item=document.createElement('div');
    item.className='deep-daan-item';

    // Target spread across screen width while rising smoothly toward upper horizon
    const slotRatio=(index+0.35+Math.random()*0.3)/total;
    const targetX=vw*(0.08+0.84*slotRatio);
    const dx=targetX-originX;
    const sway=(Math.random()-0.5)*90;
    const riseTotal=Math.max(vh*0.62,originY+40);
    const scale=0.68+Math.random()*0.48;
    const dur=state.reducedMotion?1.8:(4.5+Math.random()*1.8);

    item.style.setProperty('--sx',`${originX+(Math.random()-0.5)*18}px`);
    item.style.setProperty('--sy',`${originY+(Math.random()-0.5)*10}px`);
    item.style.setProperty('--bx',`${dx*0.38}px`);
    item.style.setProperty('--by',`${-28-Math.random()*42}px`);
    item.style.setProperty('--mx',`${dx*0.78+sway}px`);
    item.style.setProperty('--my',`${-riseTotal*0.48}px`);
    item.style.setProperty('--ex',`${dx+sway*0.6}px`);
    item.style.setProperty('--ey',`${-riseTotal}px`);
    item.style.setProperty('--sc',scale.toFixed(2));
    item.style.setProperty('--dur',`${dur.toFixed(2)}s`);
    item.style.setProperty('--f-dur',`${(0.75+Math.random()*0.45).toFixed(2)}s`);
    item.style.setProperty('--f-delay',`${(-Math.random()*0.8).toFixed(2)}s`);

    const aura=document.createElement('div');aura.className='diya-aura';
    const flameWrap=document.createElement('div');flameWrap.className='diya-flame-wrap';
    const flameOuter=document.createElement('div');flameOuter.className='diya-flame-outer';
    const flameCore=document.createElement('div');flameCore.className='diya-flame-core';
    flameWrap.append(flameOuter,flameCore);

    const reflect=document.createElement('div');reflect.className='diya-reflection';
    const svg=createDiyaBowlSvg(++diyaUid);

    item.append(aura,reflect,svg,flameWrap);
    container.append(item);

    const cleanupMs=Math.ceil(dur*1000)+150;
    item.addEventListener('animationend',()=>item.remove(),{once:true});
    setTimeout(()=>item.remove(),cleanupMs);
  }

  function spawnDeepSpark(originX,originY){
    if(state.reducedMotion)return;
    const container=byId('deepDaanDiyas');
    if(!container)return;
    const spark=document.createElement('span');
    spark.className='deep-spark';
    spark.style.setProperty('--sx',`${originX+(Math.random()-0.5)*60}px`);
    spark.style.setProperty('--sy',`${originY+(Math.random()-0.5)*20}px`);
    spark.style.setProperty('--sz',`${3+Math.random()*4.5}px`);
    spark.style.setProperty('--sx-drift',`${(Math.random()-0.5)*240}px`);
    spark.style.setProperty('--sy-rise',`${-160-Math.random()*280}px`);
    const dur=1.9+Math.random()*1.4;
    spark.style.setProperty('--dur',`${dur.toFixed(2)}s`);
    container.append(spark);
    spark.addEventListener('animationend',()=>spark.remove(),{once:true});
    setTimeout(()=>spark.remove(),Math.ceil(dur*1000)+100);
  }

  function addDiya(){
    const parent=byId('floatingDiyas');
    if(!parent)return;
    const d=document.createElement('div');
    d.className='floating-diya';
    d.style.left=`${18+Math.random()*72}%`;
    d.style.setProperty('--dur',`${11+Math.random()*8}s`);
    parent.append(d);
    d.addEventListener('animationend',()=>d.remove(),{once:true});
    setTimeout(()=>d.remove(),21000);
  }

  function diya(event){
    // 1. Populate top hero river backdrop
    for(let i=0;i<6;i++)setTimeout(addDiya,i*180);

    // 2. Determine origin coordinates from clicked button (so diyas visibly emerge right from it!)
    const btn=(event&&event.currentTarget instanceof Element)?event.currentTarget:byId('diyaDirectBtn');
    const vw=window.innerWidth||1280;
    const vh=window.innerHeight||800;
    let originX=vw*0.5;
    let originY=vh*0.76;

    if(btn){
      const rect=btn.getBoundingClientRect();
      if(rect.width>0&&rect.bottom>0&&rect.top<vh){
        originX=rect.left+rect.width/2;
        originY=rect.top+rect.height/2;
      }
      btn.classList.add('is-offering');
      setTimeout(()=>btn.classList.remove('is-offering'),900);
    }

    // 3. Activate golden river twilight glow on current viewport
    const glow=byId('deepRiverGlow');
    if(glow){
      glow.classList.add('active');
      clearTimeout(deepDaanGlowTimer);
      deepDaanGlowTimer=setTimeout(()=>glow.classList.remove('active'),4800);
    }

    // 4. Launch 16 realistic earthen diyas emerging from the button & floating upward
    const totalDiyas=state.reducedMotion?5:16;
    for(let i=0;i<totalDiyas;i++){
      setTimeout(()=>spawnViewportDiya(originX,originY,i,totalDiyas),i*85);
    }
    const totalSparks=state.reducedMotion?0:24;
    for(let j=0;j<totalSparks;j++){
      setTimeout(()=>spawnDeepSpark(originX,originY),j*65);
    }

    // 5. Gentle devotional temple bell harmonic chime (respects fxVol)
    [528,792,1056].forEach((f,i)=>tone(f,1.4,'sine',0.065/(i+1),i*0.09));

    toast('🪔 गंगा में पावन दीपदान संपन्न • छठी मैया सबका कल्याण करें');
  }

  let arghyaTimer=null;
  function arghya(){
    const el=byId('arghyaEffect');
    if(el){
      const layer=byId('arghyaDynamicLayer');
      clearTimeout(arghyaTimer);
      el.classList.remove('active');
      if(layer)layer.replaceChildren();
      void el.offsetWidth;
      el.classList.add('active');

      const stage=el.querySelector('.arghya-ritual-stage');
      if(stage&&layer){
        const rect=stage.getBoundingClientRect();
        const mouthX=rect.left+rect.width*0.52;
        const mouthY=rect.top+rect.height*0.30;
        const dropCount=state.reducedMotion?6:22;
        const petalCount=state.reducedMotion?3:9;

        for(let i=0;i<dropCount;i++){
          const drop=document.createElement('span');
          drop.className='arghya-drop';
          drop.style.setProperty('--ax',`${mouthX+(Math.random()*12-6)}px`);
          drop.style.setProperty('--ay',`${mouthY+(Math.random()*10-4)}px`);
          drop.style.setProperty('--aw',`${(4+Math.random()*3.2).toFixed(1)}px`);
          drop.style.setProperty('--adx',`${(-rect.width*0.34+Math.random()*22-11).toFixed(1)}px`);
          drop.style.setProperty('--ady',`${(rect.height*0.60+Math.random()*28-14).toFixed(1)}px`);
          drop.style.setProperty('--ad',`${(0.95+Math.random()*0.45).toFixed(2)}s`);
          drop.style.setProperty('--adelay',`${(0.18+i*0.095).toFixed(2)}s`);
          layer.appendChild(drop);
        }

        for(let j=0;j<petalCount;j++){
          const petal=document.createElement('span');
          petal.className='arghya-petal';
          petal.style.setProperty('--px',`${mouthX+(Math.random()*28-14)}px`);
          petal.style.setProperty('--py',`${mouthY+(Math.random()*14-7)}px`);
          petal.style.setProperty('--pdx',`${(-rect.width*0.42+Math.random()*45-22).toFixed(1)}px`);
          petal.style.setProperty('--pdy',`${(rect.height*0.64+Math.random()*40-10).toFixed(1)}px`);
          petal.style.setProperty('--pd',`${(1.65+Math.random()*0.65).toFixed(2)}s`);
          petal.style.setProperty('--pdelay',`${(0.28+j*0.22).toFixed(2)}s`);
          layer.appendChild(petal);
        }
      }

      fxNoise(1.15,0.022);
      setTimeout(()=>fxNoise(0.9,0.015),320);
      [528,660,792].forEach((f,i)=>tone(f,1.45,'sine',0.05/(i+1),0.14+i*0.16));

      arghyaTimer=setTimeout(()=>{
        el.classList.remove('active');
        if(layer)layer.replaceChildren();
      },3700);
    }
    toast('☀ भगवान सूर्य को श्रद्धापूर्वक पावन अर्घ्य अर्पित');
  }

  const canvas=byId('effectsCanvas'),ctx2=canvas.getContext('2d');
  let particles=[],rockets=[],frameId=0;
  function resizeCanvas(){
    const rect=canvas.getBoundingClientRect();
    canvas.width=Math.round(rect.width*Math.min(devicePixelRatio||1,2));
    canvas.height=Math.round(rect.height*Math.min(devicePixelRatio||1,2));
    ctx2.setTransform(canvas.width/rect.width,0,0,canvas.height/rect.height,0,0);
  }
  resizeCanvas();
  window.addEventListener('resize',resizeCanvas);
  function animateFx(){
    const w=canvas.width/Math.min(devicePixelRatio||1,2),h=canvas.height/Math.min(devicePixelRatio||1,2);
    ctx2.clearRect(0,0,w,h);

    // Update & draw flying rockets
    rockets=rockets.filter(r=>r.progress<1);
    for(const r of rockets){
      r.progress+=1/r.duration;
      const ease=1-Math.pow(1-r.progress,2);
      r.x=r.startX+(r.targetX-r.startX)*r.progress;
      r.y=r.startY+(r.targetY-r.startY)*ease;

      // Glowing rocket head
      ctx2.beginPath();
      ctx2.arc(r.x,r.y,3.5,0,Math.PI*2);
      ctx2.fillStyle='#fff';
      ctx2.shadowColor='#ffca28';
      ctx2.shadowBlur=14;
      ctx2.fill();
      ctx2.shadowBlur=0;

      // Trailing sparks & smoke
      for(let s=0;s<4;s++){
        particles.push({
          x:r.x+(Math.random()-.5)*5,
          y:r.y+Math.random()*9,
          vx:(Math.random()-.5)*1.4,
          vy:Math.random()*2.8+1.2,
          life:.75,
          decay:.04,
          size:Math.random()*2.2+1,
          color:Math.random()>.3?'#ffb300':'#ff3d00'
        });
      }

      if(r.progress>=1){
        explodeRocket(r.targetX,r.targetY);
      }
    }

    // Update & draw explosion particles
    particles=particles.filter(p=>p.life>0);
    for(const p of particles){
      p.x+=p.vx;p.y+=p.vy;
      p.vy+=.032; // gravity
      p.vx*=.988; // air drag
      p.life-=(p.decay||.015);
      ctx2.globalAlpha=Math.max(0,p.life);
      ctx2.fillStyle=p.color;
      ctx2.beginPath();
      ctx2.arc(p.x,p.y,p.size,0,Math.PI*2);
      ctx2.fill();
    }
    ctx2.globalAlpha=1;
    if(particles.length||rockets.length)frameId=requestAnimationFrame(animateFx);else frameId=0;
  }

  function launchRocketAnimation(){
    if(state.reducedMotion)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const sx=w*(.35+Math.random()*.3);
    const tx=w*(.25+Math.random()*.5);
    const ty=h*(.12+Math.random()*.18);
    rockets.push({
      x:sx,y:h*.95,
      startX:sx,startY:h*.95,
      targetX:tx,targetY:ty,
      progress:0,
      duration:42 // ~0.7s flight to apex
    });
    if(!frameId)frameId=requestAnimationFrame(animateFx);
  }

  function explodeRocket(x,y){
    const colors=['#ffd700','#ff5722','#ff4081','#00e676','#fff59d','#fff'];
    const count=65;
    for(let i=0;i<count;i++){
      const angle=(i/count)*Math.PI*2+(Math.random()-.5)*.2;
      const speed=1.8+Math.random()*3.8;
      particles.push({
        x:x,y:y,
        vx:Math.cos(angle)*speed,
        vy:Math.sin(angle)*speed,
        life:1.0,
        decay:.016+Math.random()*.008,
        size:1.5+Math.random()*2.4,
        color:colors[i%colors.length]
      });
    }
  }

  function launchFlowerPotAnimation(){
    if(state.reducedMotion)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    const baseX=w*0.5, baseY=h*0.92;
    let burstCount=0;
    const fountainInterval=setInterval(()=>{
      if(state.reducedMotion || burstCount>18){
        clearInterval(fountainInterval);
        return;
      }
      burstCount++;
      for(let i=0;i<12;i++){
        const angle=-Math.PI/2+(Math.random()-0.5)*0.75;
        const speed=4.5+Math.random()*4.5;
        particles.push({
          x:baseX+(Math.random()-0.5)*18,
          y:baseY,
          vx:Math.cos(angle)*speed,
          vy:Math.sin(angle)*speed,
          life:1.0,
          decay:0.024+Math.random()*0.012,
          size:1.8+Math.random()*2.2,
          color:Math.random()>0.35?'#ffd700':'#ffffff'
        });
      }
      if(!frameId)frameId=requestAnimationFrame(animateFx);
    },120);
  }

  function launchLadiAnimation(){
    if(state.reducedMotion)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    let count=0;
    const ladiInterval=setInterval(()=>{
      if(state.reducedMotion || count>16){
        clearInterval(ladiInterval);
        return;
      }
      count++;
      const lx=w*(0.35+Math.random()*0.3);
      const ly=h*(0.88+Math.random()*0.06);
      for(let i=0;i<9;i++){
        const angle=Math.random()*Math.PI*2;
        const speed=1.5+Math.random()*2.5;
        particles.push({
          x:lx,y:ly,
          vx:Math.cos(angle)*speed,
          vy:Math.sin(angle)*speed,
          life:0.9,
          decay:0.04+Math.random()*0.02,
          size:1.4+Math.random()*1.8,
          color:Math.random()>0.4?'#ff4400':'#fff59d'
        });
      }
      if(!frameId)frameId=requestAnimationFrame(animateFx);
    },140);
  }

  function fireworks(){
    if(state.reducedMotion)return;
    const w=canvas.clientWidth,h=canvas.clientHeight;
    for(let j=0;j<2;j++){
      const x=w*(.55+Math.random()*.32),y=h*(.14+Math.random()*.20);
      explodeRocket(x,y);
    }
    if(!frameId)frameId=requestAnimationFrame(animateFx);
  }

  // Muhurat & Direct Actions
  byId('offerArghya')?.addEventListener('click',arghya);
  byId('offerArghyaDirect')?.addEventListener('click',arghya);
  byId('diyaDirectBtn')?.addEventListener('click',diya);
  byId('heroDeepDaanBtn')?.addEventListener('click',diya);

  // Festive Ghat Audio Effects Handlers (Strict Toggle On/Off, No Cacophony)
  byId('rocketCrackerBtn')?.addEventListener('click',toggleRocketCracker);
  byId('bombCrackerBtn')?.addEventListener('click',toggleBombCracker);
  byId('shankhSoundBtn')?.addEventListener('click',toggleConchSound);
  byId('loudspeakerAnnounceBtn')?.addEventListener('click',()=>broadcastAnnouncement());

  // --- FLOATING FEATURE RAIL & AUTHENTIC MENUS (CHHATHGEET INSPIRED) ---
  const fcBtn = byId('firecrackerRailBtn');
  const fcMenu = byId('firecrackerOptions');
  const annBtn = byId('announceRailBtn');
  const annMenu = byId('announcementOptions');

  function closeAllFeatureMenus(){
    if(fcMenu) fcMenu.hidden = true;
    if(annMenu) annMenu.hidden = true;
    fcBtn?.classList.remove('is-open');
    annBtn?.classList.remove('is-open');
    fcBtn?.setAttribute('aria-expanded', 'false');
    annBtn?.setAttribute('aria-expanded', 'false');
  }

  fcBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !fcMenu.hidden;
    closeAllFeatureMenus();
    if(!isOpen){
      fcMenu.hidden = false;
      fcBtn.classList.add('is-open');
      fcBtn.setAttribute('aria-expanded', 'true');
    }
  });

  annBtn?.addEventListener('click', e => {
    e.stopPropagation();
    const isOpen = !annMenu.hidden;
    closeAllFeatureMenus();
    if(!isOpen){
      annMenu.hidden = false;
      annBtn.classList.add('is-open');
      annBtn.setAttribute('aria-expanded', 'true');
    }
  });

  fcMenu?.addEventListener('click', e => e.stopPropagation());
  annMenu?.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', closeAllFeatureMenus);
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') closeAllFeatureMenus();
  });

  // Feature Rail: Firecracker Sounds Suite
  const FC_CONFIG = {
    'flower-pot': {
      file: 'assets/audio/firecrackers/flower-pot.mp3',
      name: 'Flower pot',
      desc: 'A bright fountain of sparks',
      anim: launchFlowerPotAnimation,
      toastMsg: '✨ अनार (Flower pot) • स्वर्णिम फुहारें!'
    },
    'ladi': {
      file: 'assets/audio/firecrackers/ladi.mp3',
      name: 'Ladi',
      desc: 'A long chain of crackers',
      anim: launchLadiAnimation,
      toastMsg: '💥 लड़ी (Ladi) • चट-चट पटाखों की गूँज!'
    },
    'multi-sky-shot': {
      file: 'assets/audio/firecrackers/multi-sky-shot.mp3',
      name: 'Multi-sky shot',
      desc: 'A spectacular sky barrage',
      anim: () => { launchRocketAnimation(); setTimeout(launchRocketAnimation, 650); },
      toastMsg: '🚀 मल्टी-स्काई शॉट • आसमान में भव्य आतिशबाज़ी!'
    }
  };

  all('.sound-option-row').forEach(row => {
    row.addEventListener('click', () => {
      const fcId = row.dataset.fcId;
      const info = FC_CONFIG[fcId];
      if(!info) return;

      const small = row.querySelector('small');
      const fcStatus = byId('firecrackerStatusText');

      playFestiveAudio(
        'fc-' + fcId,
        info.file,
        1.0,
        () => {
          all('.sound-option-row').forEach(r => {
            r.classList.remove('is-playing');
            const s = r.querySelector('small');
            const rid = r.dataset.fcId;
            if(s && FC_CONFIG[rid]) s.textContent = FC_CONFIG[rid].desc;
          });
          row.classList.add('is-playing');
          if(small) small.textContent = 'Playing now...';
          if(fcStatus) fcStatus.textContent = 'Playing now...';
          info.anim();
          toast(info.toastMsg);
        },
        () => {
          row.classList.remove('is-playing');
          if(small) small.textContent = info.desc;
          if(fcStatus) fcStatus.textContent = 'Choose a sound';
        }
      );
    });
  });

  // Feature Rail: Periodic Ghaat Announcements Controller
  let announcementTimer = null;
  let announcementIndex = 0;
  let announcementsActive = false;
  let announcementGapMin = 9;

  function scheduleNextAnnouncement(){
    clearTimeout(announcementTimer);
    if(!announcementsActive) return;
    announcementTimer = setTimeout(() => {
      if(announcementsActive) playNextPeriodicAnnouncement();
    }, announcementGapMin * 60 * 1000);
  }

  function playNextPeriodicAnnouncement(){
    if(!announcementsActive) return;
    const fileNum = (announcementIndex % 8) + 1;
    announcementIndex++;
    const audioFile = `assets/audio/ghaat/announcement-${fileNum}.mp3`;
    const railBtn = byId('announceRailBtn');
    const statusText = byId('announceStatusText');

    playFestiveAudio(
      'ghaat-periodic-announcement',
      audioFile,
      1.0,
      () => {
        railBtn?.classList.add('is-enabled');
        if(statusText) statusText.textContent = 'Playing now...';
        toast(`📣 घाट लाउडस्पीकर उद्घोष #${fileNum} प्रसारित हो रहा है...`);
      },
      () => {
        if(announcementsActive){
          if(statusText) statusText.textContent = `Every ${announcementGapMin} min`;
          scheduleNextAnnouncement();
        } else {
          railBtn?.classList.remove('is-enabled');
          if(statusText) statusText.textContent = 'Currently off';
        }
      }
    );
  }

  function toggleAnnouncements(enable){
    announcementsActive = (enable !== undefined) ? enable : !announcementsActive;
    const toggleBtn = byId('announceToggleSwitch');
    const railBtn = byId('announceRailBtn');
    const statusText = byId('announceStatusText');

    if(announcementsActive){
      toggleBtn?.classList.add('is-active');
      toggleBtn?.setAttribute('aria-checked', 'true');
      railBtn?.classList.add('is-enabled');
      if(statusText) statusText.textContent = `Every ${announcementGapMin} min`;
      toast('📣 घाट उद्घोष चालू किया गया • पहला उद्घोष अभी बजेगा');
      playNextPeriodicAnnouncement();
    } else {
      clearTimeout(announcementTimer);
      toggleBtn?.classList.remove('is-active');
      toggleBtn?.setAttribute('aria-checked', 'false');
      railBtn?.classList.remove('is-enabled');
      if(statusText) statusText.textContent = 'Currently off';
      if(activeFestiveId === 'ghaat-periodic-announcement'){
        stopActiveFestiveAudio(false);
      }
      toast('घाट उद्घोष बंद कर दिया गया।');
    }
  }

  byId('announceToggleSwitch')?.addEventListener('click', () => toggleAnnouncements());

  const gapSlider = byId('announceGapSlider');
  const gapVal = byId('announceGapValue');
  gapSlider?.addEventListener('input', e => {
    announcementGapMin = Number(e.target.value) || 9;
    if(gapVal) gapVal.textContent = `${announcementGapMin} min`;
    if(announcementsActive){
      const statusText = byId('announceStatusText');
      if(statusText && activeFestiveId !== 'ghaat-periodic-announcement') statusText.textContent = `Every ${announcementGapMin} min`;
      scheduleNextAnnouncement();
    }
  });

  // Custom Live Announcement Handlers
  byId('broadcastCustomBtn')?.addEventListener('click',()=>broadcastAnnouncement());
  byId('customAnnounceInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')broadcastAnnouncement()});
  all('.preset-chip').forEach(chip=>{
    chip.addEventListener('click',()=>{
      all('.preset-chip').forEach(c=>c.classList.remove('active'));
      chip.classList.add('active');
      const input=byId('customAnnounceInput');
      if(input && chip.dataset.preset){
        input.value=chip.dataset.preset;
        input.focus();
      }
    });
  });

  // Sankalp Modal handlers
  const sankalpModal=byId('sankalpModal');
  const sankalpBackdrop=byId('sankalpBackdrop');
  function openSankalp(){
    if(!sankalpModal)return;
    sankalpModal.hidden=false;
    if(sankalpBackdrop)sankalpBackdrop.hidden=false;
    byId('familyInput')?.focus();
  }
  function closeSankalp(){
    if(!sankalpModal)return;
    sankalpModal.hidden=true;
    if(sankalpBackdrop)sankalpBackdrop.hidden=true;
  }
  byId('sankalpBtn')?.addEventListener('click',openSankalp);
  byId('closeSankalpBtn')?.addEventListener('click',closeSankalp);
  sankalpBackdrop?.addEventListener('click',closeSankalp);

  byId('confirmSankalpBtn')?.addEventListener('click',()=>{
    const val=(byId('familyInput')?.value||'').trim()||'आप और आपका परिवार';
    const resultEl=byId('sankalpResult');
    const textEl=byId('sankalpText');
    if(textEl)textEl.textContent=`“${val} द्वारा सूर्य देव व षष्ठी देवी के चरणों में श्रद्धापूर्वक छठ महापर्व का पावन संकल्प समर्पित हुआ। छठी मैया आपके परिवार में सुख, उत्तम स्वास्थ्य, समृद्धि और प्रकाश प्रदान करें।”`;
    if(resultEl)resultEl.hidden=false;
    byId('sankalpForm').hidden=true;
    toast('🌸 पावन संकल्प पत्र तैयार हुआ • जय छठी मैया');
    fireworks();
  });

  const PUBLIC_SHARE_URL='https://chhathparv.github.io/';

  byId('shareSankalpBtn')?.addEventListener('click',async()=>{
    const val=(byId('familyInput')?.value||'').trim()||'हमारा परिवार';
    const msg=`॥ जय छठी मैया ॥ 🌞\n${val} ने छठ महापर्व पर भगवान सूर्य व षष्ठी देवी का पावन संकल्प लिया है।\nछठी मैया सबके जीवन में सुख, स्वास्थ्य और तेज भरें।\nशुभ छठ महापर्व!`;
    try{
      if(navigator.share){await navigator.share({title:'छठ महापर्व संकल्प',text:msg,url:PUBLIC_SHARE_URL});return}
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(msg+'\n\n👉 '+PUBLIC_SHARE_URL);toast('संकल्प संदेश व लिंक कॉपी हो गया। WhatsApp पर भेजें।');return}
    }catch{}
    toast('संकल्प संदेश तैयार है।');
  });

  // Interactive Story Carousel
  let currentStory=0;
  const storySlides=all('.story-slide');
  const storyDots=all('.story-dot');
  function showStory(index){
    if(!storySlides.length)return;
    currentStory=(index+storySlides.length)%storySlides.length;
    storySlides.forEach((slide,i)=>{
      slide.classList.toggle('active',i===currentStory);
    });
    storyDots.forEach((dot,i)=>{
      dot.classList.toggle('active',i===currentStory);
    });
    const counter=byId('storyCounter');
    if(counter)counter.textContent=`0${currentStory+1} / 0${storySlides.length}`;
  }
  byId('prevStoryBtn')?.addEventListener('click',()=>showStory(currentStory-1));
  byId('nextStoryBtn')?.addEventListener('click',()=>showStory(currentStory+1));
  storyDots.forEach((dot,i)=>dot.addEventListener('click',()=>showStory(i)));
  document.addEventListener('keydown',e=>{
    if(document.activeElement?.tagName==='INPUT'||backdrop.hidden===false)return;
    if(e.key==='ArrowLeft')showStory(currentStory-1);
    if(e.key==='ArrowRight')showStory(currentStory+1);
  });

  function petals(){
    const root=byId('flowerFall');
    if(state.reducedMotion||document.hidden)return;
    const p=document.createElement('span');
    p.className='petal';
    p.style.left=`${Math.random()*100}%`;
    p.style.top='-20px';
    p.style.setProperty('--dx',`${(Math.random()-.5)*250}px`);
    p.style.animationDuration=`${15+Math.random()*11}s`;
    root.append(p);
    setTimeout(()=>p.remove(),29000);
  }
  let petalTimer=setInterval(petals,1800);
  for(let i=0;i<14;i++)addDiya();
  setInterval(()=>{if(document.hidden||state.reducedMotion)return;const count=byId('floatingDiyas').querySelectorAll('.floating-diya').length,target=13+Math.floor(Math.random()*12);for(let i=count;i<target;i++)addDiya();},6500);
  function reduceMotion(value){state.reducedMotion=Boolean(value);document.body.classList.toggle('reduce-motion',state.reducedMotion);byId('reduceMotionToggle').checked=state.reducedMotion;store.set('chhath-reduce-motion',String(state.reducedMotion));if(state.reducedMotion){particles.length=0;ctx2.clearRect(0,0,canvas.clientWidth,canvas.clientHeight)}}
  byId('reduceMotionToggle').onchange=e=>reduceMotion(e.target.checked);reduceMotion(store.get('chhath-reduce-motion')==='true'||state.reducedMotion);
  const headerNav=byId('navBtn');headerNav.onclick=()=>{const nav=document.querySelector('.site-nav'),expanded=headerNav.getAttribute('aria-expanded')==='true';headerNav.setAttribute('aria-expanded',String(!expanded));nav.classList.toggle('nav-open',!expanded)};
  all('.site-nav a').forEach(a=>a.onclick=()=>{document.querySelector('.site-nav').classList.remove('nav-open');headerNav.setAttribute('aria-expanded','false')});
  const offeringFacts={
    thekua:{
      name:'ठेकुआ (महाप्रसाद)',
      img:'assets/offering-thekua.webp',
      caption:'पारंपरिक ठेकुआ महाप्रसाद • सूर्य चक्र अलंकरण',
      leftTitle:'✦ क्या है यह महाप्रसाद?',
      leftSummary:'गुड़, गेहूँ के दरदरे आटे, सौंफ और शुद्ध गाय के देसी घी से बना छठ का अनिवार्य भोग—जिसे नए मिट्टी के चूल्हे पर आम की लकड़ी की पवित्र आंच में बनाया जाता है।',
      text:'छठ का सबसे पावन और अनिवार्य महाप्रसाद—बिना ठेकुआ के सूर्य अर्घ्य पूर्ण नहीं माना जाता।',
      insights:[
        {
          title:'✦ रोग-प्रतिरोधक व ऊर्जा स्रोत',
          desc:'शरद ऋतु में गुड़, आटा व देसी घी शरीर को अंदरूनी गर्मी, ताकत और बेहतर इम्युनिटी देते हैं।'
        },
        {
          title:'✦ सूर्य चक्र व कमल सांचा',
          desc:'काष्ठ सांचे पर बनी सूर्य किरणों की आकृति भगवान भास्कर को प्रत्यक्ष समर्पण का प्रतीक है।'
        },
        {
          title:'✦ अखंड शुद्धता व नियम',
          desc:'व्रती माताएँ स्नान कर, निर्जल रहकर और छठ गीत गाते हुए इसे पूर्ण सात्विकता से तैयार करती हैं।'
        }
      ],
      tags:['शुद्ध देसी घी', 'मिट्टी का नया चूल्हा', 'रोग-प्रतिरोधक भोग']
    },
    soop:{
      name:'सूप और दौरा (अर्घ्य पात्र)',
      img:'assets/pooja-thali-soop.webp',
      caption:'बाँस का सूप व दौरा • पावन अर्घ्य पात्र',
      leftTitle:'✦ क्या है सूप व दौरा?',
      leftSummary:'पारंपरिक कारीगरों द्वारा हाथों से बुने नए बाँस का सूप और दौरा, जिसमें सिंदूर, ठेकुआ, हल्दी-अदरक और मौसमी फल सजाकर भगवान सूर्य को अर्घ्य अर्पित किया जाता है।',
      text:'बाँस को सनातन परंपरा में वंश वृद्धि, प्रकृति और जीवन की निरंतरता का सर्वोच्च प्रतीक माना गया है।',
      insights:[
        {
          title:'✦ सामाजिक समरसता व सम्मान',
          desc:'समाज के पारंपरिक शिल्पकारों द्वारा बुने सूप के बिना छठ पूजा पूर्ण नहीं होती—यह पर्व हर वर्ग को जोड़ता है।'
        },
        {
          title:'✦ अहंकार का त्याग',
          desc:'भरा हुआ भारी दौरा सिर पर रखकर नंगे पाँव घाट जाना विनम्रता और ईश्वर के प्रति पूर्ण समर्पण सिखाता है।'
        },
        {
          title:'✦ पर्यावरण व सात्विकता',
          desc:'प्लास्टिक की जगह पूर्णतः प्राकृतिक बाँस का उपयोग प्रकृति और नदी की स्वच्छता बनाए रखता है।'
        }
      ],
      tags:['वंश वृद्धि प्रतीक', 'सामाजिक समानता', 'सिर पर पावन दौरा']
    },
    fruits:{
      name:'फल और गन्ना (मौसमी उपज)',
      img:'assets/offering-fruits-sugarcane.webp',
      caption:'पत्तेदार गन्ना • डाभ नींबू • अक्षत ऋतु फल',
      leftTitle:'✦ क्या है यह प्राकृतिक अर्पण?',
      leftSummary:'धरती माता से प्राप्त ताज़ा, बिना कटी-छँटी मौसमी फसलें—मोटे छिलके वाला डाभ नींबू, केला का पूरा घौंद, पत्तेदार गन्ना, कच्ची हल्दी और अदरक भगवान सूर्य को चढ़ाए जाते हैं।',
      text:'यह अर्पण किसान की नई उपज और प्रकृति की औषधीय शक्तियों के प्रति कृतज्ञता व्यक्त करता है।',
      insights:[
        {
          title:'✦ डाभ नींबू (चकोतरा)',
          desc:'विटामिन-C और एंटीऑक्सीडेंट से भरपूर, जो बदलते मौसम में कफ-पित्त संतुलित कर संक्रमण से बचाता है।'
        },
        {
          title:'✦ कच्ची हल्दी व अदरक',
          desc:'मिट्टी से निकली औषधीय गाँठें शरीर की सूजन कम करती हैं और सर्दियों में स्वास्थ्य रक्षा करती हैं।'
        },
        {
          title:'✦ पत्तेदार गन्ना व केला',
          desc:'अखंड केला वंश समृद्धि का, और खड़ा गन्ना शीतलता व परिवार पर सूर्य की सुखद छांव का प्रतीक है।'
        }
      ],
      tags:['डाभ नींबू (विटामिन-C)', 'औषधीय हल्दी-अदरक', 'प्रकृति का उपहार']
    },
    kosi:{
      name:'कोसी भराई (रात्रि जागरण)',
      img:'assets/ghat-koshi-night.webp',
      caption:'कोसी भराई • 24 दीपकों की अखंड ज्योति',
      leftTitle:'✦ क्या है कोसी भराई?',
      leftSummary:'संध्या अर्घ्य के बाद आँगन या घाट पर साबुत गन्नों के मंडप के नीचे मिट्टी के हाथी (ऐरावत) और 24 मिट्टी के दीयों के साथ किया जाने वाला पावन रात्रि अनुष्ठान।',
      text:'संतान की दीर्घायु, परिवार के कल्याण या मन्नत पूरी होने पर आभार प्रकट करने का अलौकिक उत्सव।',
      insights:[
        {
          title:'✦ गन्ने का दिव्य मंडप',
          desc:'4, 12 या 24 गन्नों को बाँधकर बना प्राकृतिक छत्र भगवान सूर्य के रथ और परिवार की रक्षा का प्रतीक है।'
        },
        {
          title:'✦ मिट्टी का हाथी व 24 दीये',
          desc:'ऐरावत हाथी ऐश्वर्य व शक्ति का, तथा 24 अखंड दीपक घर-आँगन में स्थायी प्रकाश व सुख-शांति के प्रतीक हैं।'
        },
        {
          title:'✦ सामूहिक कोसी गीत',
          desc:'परिवार और पड़ोस की माताओं का रात भर साथ बैठकर भक्ति गीत गाना पारिवारिक प्रेम व एकता को मजबूत करता है।'
        }
      ],
      tags:['24 अखंड दीपक', 'गन्ने का मंडप', 'मन्नत व आभार']
    }
  };

  function updateOfferingDetails(key, index){
    const info=offeringFacts[key];
    if(!info)return;
    const numEl=byId('offeringNumber');
    const nameEl=byId('offeringName');
    const textEl=byId('offeringText');
    const leftTitleEl=byId('leftSummaryLabel');
    const leftTextEl=byId('leftSummaryText');
    const insightsEl=byId('offeringInsights');
    const tagsEl=byId('offeringTags');
    const imgEl=byId('offeringImg');
    const captionEl=byId('stageCaption');

    if(numEl) numEl.textContent=`0${index+1} / अर्पण`;
    if(nameEl) nameEl.textContent=info.name;
    if(textEl) textEl.textContent=info.text;
    if(leftTitleEl && info.leftTitle) leftTitleEl.textContent=info.leftTitle;
    if(leftTextEl && info.leftSummary) leftTextEl.textContent=info.leftSummary;

    if(imgEl && info.img){
      imgEl.classList.add('fade-out');
      setTimeout(()=>{
        imgEl.src=info.img;
        imgEl.alt=info.name;
        imgEl.classList.remove('fade-out');
      },140);
    }
    if(captionEl && info.caption){
      captionEl.textContent=info.caption;
    }

    if(insightsEl){
      insightsEl.replaceChildren();
      (info.insights||[]).forEach(item=>{
        const box=document.createElement('div');
        box.className='insight-box';
        const strong=document.createElement('strong');
        strong.textContent=item.title;
        const p=document.createElement('p');
        p.textContent=item.desc;
        box.append(strong,p);
        insightsEl.append(box);
      });
    }

    if(tagsEl){
      tagsEl.replaceChildren();
      (info.tags||[]).forEach(tag=>{
        const span=document.createElement('span');
        span.className='offering-tag-item';
        span.textContent=`✦ ${tag}`;
        tagsEl.append(span);
      });
    }
  }

  all('[data-offering]').forEach((b,i)=>b.addEventListener('click',()=>{
    all('[data-offering]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b))});
    updateOfferingDetails(b.dataset.offering, i);
  }));

  updateOfferingDetails('thekua', 0);
  all('[data-jhanki]').forEach(b=>b.addEventListener('click',()=>{
    scene(b.dataset.jhanki);
    if(b.classList.contains('photo-fireworks')){
      toggleRocketCracker();
    }else if(b.classList.contains('photo-maha-arghya')){
      arghya();
    }
    document.getElementById('top').scrollIntoView({behavior:state.reducedMotion?'instant':'smooth',block:'start'});
  }));

  // Multi-Platform Social Share Handlers
  const getPublicShareUrl=()=>PUBLIC_SHARE_URL;

  const shareMessage='॥ जय छठी मैया ॥ 🌞\n“आदित्य देव को प्रणाम, छठी मैया का आशीर्वाद सबके जीवन में उजाला लाए।”\nसूर्य देव और छठी मैया आपके परिवार में सुख, उत्तम स्वास्थ्य, तेज और अखंड समृद्धि प्रदान करें।\nछठ महापर्व की हार्दिक शुभकामनाएँ!\n— Abhinav';

  byId('shareWhatsAppBtn')?.addEventListener('click',()=>{
    const publicUrl=getPublicShareUrl();
    const url=`https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage+'\n\n👉 '+publicUrl)}`;
    window.open(url,'_blank','noopener,noreferrer');
    toast('💬 WhatsApp पर शुभकामना संदेश खुल रहा है...');
  });

  byId('shareFacebookBtn')?.addEventListener('click',()=>{
    const publicUrl=getPublicShareUrl();
    const url=`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}&quote=${encodeURIComponent(shareMessage)}`;
    window.open(url,'_blank','width=600,height=500,noopener,noreferrer');
    toast('🌐 Facebook पर शुभकामना पोस्ट खुल रहा है...');
  });

  byId('shareInstagramBtn')?.addEventListener('click',async()=>{
    const publicUrl=getPublicShareUrl();
    try{
      if(navigator.share){
        await navigator.share({title:'छठ महापर्व की शुभकामनाएँ',text:shareMessage,url:publicUrl});
        toast('📸 Instagram / सोशल मीडिया पर शेयर हुआ!');
        return;
      }
    }catch(e){}
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(shareMessage+'\n\n👉 '+publicUrl);
      toast('📸 संदेश व लिंक कॉपी हो गया! अब Instagram स्टोरी या पोस्ट में पेस्ट करें।');
    }
  });

  byId('shareWish')?.addEventListener('click',async()=>{
    const publicUrl=getPublicShareUrl();
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(shareMessage+'\n\n👉 '+publicUrl);
        toast('📋 शुभकामना संदेश व लिंक कॉपी हो गया! परिवार को भेजें।');
        return;
      }
    }catch(e){}
    toast('शुभकामना संदेश तैयार है।');
  });
  // Visitor numbers are not invented. An atmospheric label is the only indicator until real backend analytics exists.
  scene('sandhya');renderPreview();renderSongs();updateMusic();
})();
