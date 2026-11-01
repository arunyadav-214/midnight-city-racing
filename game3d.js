(() => {
  const $=s=>document.querySelector(s),views=['home','lobby','race','finish'],canvas=$('#canvas');
  const MAX_PLAYERS=6,RACE_MS=90000,COLLISION_DIST=30,BOOST_MS=2000,BOOST_COOLDOWN=3200,BASE_MAX=390,BOOST_MAX=540,BOOST_LAUNCH=480;
  let peer=null,isHost=false,soloMode=false,myName='',room='',myId='',world=null,ready=false,finished=false,hostLoop=null,raf=null,conn=null,conns=new Map(),guestInputs=new Map(),input={up:false,down:false,left:false,right:false,boost:false},lastCrashSeq=0,lastGasPress=0;
  const T=()=>Midnight3D.track,START=()=>T().startX||115,FINISH=()=>T().finishX||30000,YMIN=()=>T().roadMinY||205,YMAX=()=>T().roadMaxY||445;
  const show=id=>views.forEach(v=>$('#'+v).classList.toggle('active',v===id)),status=t=>$('#status').textContent=t;
  const code=s=>(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6),peerId=c=>'midnight-city-racing-'+c.toLowerCase();
  const rand=()=>{const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
  const error=(t='')=>{const e=$('#error');e.hidden=!t;e.textContent=t};
  const lanes=[325,245,405,285,365,425];
  function player(id,name,index=0){return{id,name,ready:false,connected:true,x:START(),y:lanes[index]||325,a:0,v:0,done:false,finish:0,crashUntil:0,crashSeq:0,crashPower:0,boostStart:0,boostUntil:0,boostCooldown:0,boostSeq:0};}
  function newWorld(name){return{phase:'lobby',players:{p1:player('p1',name,0)},winner:null,raceEndsAt:0,finishReason:''};}
  function broadcast(msg){if(!isHost||soloMode)return;conns.forEach(c=>{if(c.open)c.send(msg)});}
  function send(msg){if(conn?.open)conn.send(msg);}
  function cleanup(){clearInterval(hostLoop);hostLoop=null;cancelAnimationFrame(raf);raf=null;try{conn?.close()}catch{}conns.forEach(c=>{try{c.close()}catch{}});try{peer?.destroy()}catch{}peer=null;conn=null;conns=new Map();guestInputs=new Map();world=null;ready=false;finished=false;soloMode=false;lastCrashSeq=0;lastGasPress=0;input={up:false,down:false,left:false,right:false,boost:false};MidnightSound.stop();}
  function home(){cleanup();isHost=false;myName='';room='';myId='';status('Ready · 1:30 city boost build');error();show('home');}
  function activateMode(mode){['host','join','bot'].forEach(m=>{$('#'+m+'Tab')?.classList.toggle('active',m===mode);$('#'+m+'Form')?.classList.toggle('active',m===mode)});error();}
  $('#hostTab').onclick=()=>activateMode('host');$('#joinTab').onclick=()=>activateMode('join');$('#botTab').onclick=()=>activateMode('bot');['hostCode','joinCode'].forEach(id=>$('#'+id).oninput=e=>e.target.value=code(e.target.value));
  $('#hostForm').onsubmit=e=>{e.preventDefault();const n=$('#hostName').value.trim();if(n)host(n,code($('#hostCode').value)||rand())};
  $('#joinForm').onsubmit=e=>{e.preventDefault();const n=$('#joinName').value.trim(),c=code($('#joinCode').value);if(!n||c.length<4)return error('Enter your name and the room code from your friend.');join(n,c)};
  $('#botForm').onsubmit=e=>{e.preventDefault();const n=$('#botName').value.trim(),count=Math.max(1,Math.min(5,Number($('#botCount').value)||1));if(!n)return error('Enter your name to start the bot race.');startBotMode(n,count)};
  function nextId(){for(let i=2;i<=MAX_PLAYERS;i++)if(!world.players['p'+i]&&!conns.has('p'+i))return'p'+i;return null;}
  function host(name,c){cleanup();error();if(typeof Peer==='undefined')return error('Multiplayer could not load. Check your connection.');isHost=true;myName=name;room=c;myId='p1';world=newWorld(name);status('Creating room…');peer=new Peer(peerId(c));peer.on('open',()=>{status('Room open · waiting for drivers');openLobby();peer.on('connection',wireIncomingGuest)});peer.on('error',e=>{status('Connection error');error(e.type==='unavailable-id'?'That room code is already in use.':'Could not create the room. Try again.')});}
  function startBotMode(name,count){cleanup();isHost=true;soloMode=true;myName=name;room='BOTS';myId='p1';world=newWorld(name);world.players.p1.ready=true;for(let i=0;i<count;i++){const id='p'+(i+2),p=player(id,MidnightBots.name(i),i+1);p.ready=true;MidnightBots.reset(p,i);world.players[id]=p;}$('#raceCode').textContent='BOTS';status(`1:30 solo race · ${count} bot${count===1?'':'s'}`);MidnightSound.init();startRace();}
  function wireIncomingGuest(c){if(!world||world.phase!=='lobby'){c.on('open',()=>{c.send({type:'reject',reason:'Race already started.'});c.close()});return;}const id=nextId();if(!id){c.on('open',()=>{c.send({type:'reject',reason:'Room is full (6 players max).'});c.close()});return;}conns.set(id,c);guestInputs.set(id,{up:false,down:false,left:false,right:false,boost:false});c.on('open',()=>c.send({type:'assign',id,room,maxPlayers:MAX_PLAYERS}));c.on('data',d=>{if(!d||typeof d!=='object')return;if(d.type==='join'){world.players[id]=player(id,String(d.name||'Driver').slice(0,18),Number(id.slice(1))-1);syncLobby();}if(d.type==='ready'&&world.players[id]){world.players[id].ready=!!d.value;syncLobby();}if(d.type==='input')guestInputs.set(id,{...guestInputs.get(id),...d.value});if(d.type==='rematch'&&world.players[id]){world.players[id].ready=true;syncLobby();}});c.on('close',()=>{conns.delete(id);guestInputs.delete(id);if(world?.players?.[id])delete world.players[id];if(world?.phase==='lobby')syncLobby();});}
  function join(name,c){cleanup();error();if(typeof Peer==='undefined')return error('Multiplayer could not load. Check your connection.');myName=name;room=c;world={phase:'lobby',players:{},winner:null,raceEndsAt:0};status('Connecting…');peer=new Peer();peer.on('open',()=>{conn=peer.connect(peerId(c),{reliable:true});wireGuest(conn)});peer.on('error',()=>{status('Connection error');error('Could not connect. Check the room code and try again.')});}
  function wireGuest(c){const timer=setTimeout(()=>{if(!c.open)error('Room not found. Ask the host to keep the room open.')},7000);c.on('open',()=>{clearTimeout(timer);status('Connected · joining lobby')});c.on('data',d=>{if(!d||typeof d!=='object')return;if(d.type==='assign'){myId=d.id;$('#roomCode').textContent=room;$('#raceCode').textContent=room;send({type:'join',name:myName});show('lobby');}if(d.type==='reject'){error(d.reason||'Unable to join this room.');status('Join rejected');}if(d.type==='lobby'){world=d.world;show('lobby');updateLobby();}if(d.type==='count'){show('race');startRender();count(d.value);}if(d.type==='world'){world=d.world;show('race');startRender();updateHud();}if(d.type==='finish'){world=d.world;finish(d.winner);}if(d.type==='back'){world=d.world;finished=false;show('lobby');updateLobby();}});c.on('close',()=>status('Host disconnected'));}
  function openLobby(){$('#roomCode').textContent=room;$('#raceCode').textContent=room;show('lobby');updateLobby();}
  function row(p){return`<div class="player"><span>${esc(p.name)}${p.id==='p1'?' <small>(host)</small>':''}${p.id===myId?' <small>(you)</small>':''}</span><span class="${p.ready?'ok':'wait'}">${p.ready?'Ready':'Not ready'}</span></div>`;}
  function connectedPlayers(){return world?Object.values(world.players).filter(p=>p.connected!==false):[];}
  function allReady(){const ps=connectedPlayers();return ps.length>=2&&(!isHost||ps.length===conns.size+1)&&ps.every(p=>p.ready);}
  function updateLobby(){if(!world)return;const ps=connectedPlayers().sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));$('#players').innerHTML=ps.map(row).join('');$('#playerCount').textContent=`${ps.length} / ${MAX_PLAYERS}`;$('#ready').textContent=ready?'Ready ✓':"I'm ready";$('#start').hidden=!isHost;if(isHost)$('#start').disabled=!allReady();$('#youName').textContent=world.players[myId]?.name||myName||'You';}
  function syncLobby(){updateLobby();broadcast({type:'lobby',world});}
  $('#ready').onclick=()=>{MidnightSound.init();ready=!ready;if(isHost){if(world.players.p1)world.players.p1.ready=ready;syncLobby();}else{if(world.players[myId])world.players[myId].ready=ready;updateLobby();send({type:'ready',value:ready});}};
  $('#start').onclick=()=>{MidnightSound.init();if(isHost&&allReady())startRace();};$('#leave').onclick=home;$('#exitRace').onclick=home;$('#homeBtn').onclick=home;
  function resetCars(){lastCrashSeq=0;connectedPlayers().sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1))).forEach((p,i)=>{const wasBot=!!p.bot,bi=p.botIndex,f=player(p.id,p.name,i);f.ready=true;if(wasBot)MidnightBots.reset(f,bi);Object.assign(p,f)});world.phase='count';world.winner=null;world.raceEndsAt=0;world.finishReason='';finished=false;}
  function startRace(){if(!Midnight3D.init(canvas))return error('3D engine failed to start. Refresh and try again.');resetCars();show('race');startRender();let n=3;broadcast({type:'count',value:n});count(n);const timer=setInterval(()=>{n--;if(n){broadcast({type:'count',value:n});count(n);}else{clearInterval(timer);broadcast({type:'count',value:'GO!'});count('GO!');world.phase='race';world.raceEndsAt=Date.now()+RACE_MS;broadcast({type:'world',world});runHost();}},900);}
  function count(v){Midnight3D.init(canvas);const e=$('#countdown');e.textContent=v;e.classList.add('show');MidnightSound.beep(v);setTimeout(()=>e.classList.remove('show'),700);}
  function runHost(){clearInterval(hostLoop);let last=performance.now(),push=0;hostLoop=setInterval(()=>{if(!world||world.phase!=='race'||finished)return;const now=performance.now(),dt=Math.min(.04,(now-last)/1000);last=now;Object.values(world.players).forEach(p=>{const keys=p.id==='p1'?input:(p.bot?MidnightBots.input(p):(guestInputs.get(p.id)||{}));drive(p,keys,dt);finishCheck(p);});resolveCollisions(Object.values(world.players));if(!winnerCheck()&&Date.now()>=world.raceEndsAt)finishByTime();push+=dt;if(push>.05){push=0;broadcast({type:'world',world});}updateHud();},16);}
  function onRoad(x,y){return T().roads.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h);}
  function drive(c,k,dt){
    if(c.done)return;
    const now=Date.now(),boostRequested=!!k.boost;if(boostRequested)k.boost=false;
    if(boostRequested&&now>=(c.boostCooldown||0)){c.boostStart=now;c.boostUntil=now+BOOST_MS;c.boostCooldown=now+BOOST_COOLDOWN;c.boostSeq=(c.boostSeq||0)+1;c.v=Math.max(c.v,BOOST_LAUNCH);}
    const flying=now<(c.boostUntil||0),road=onRoad(c.x,c.y),bf=c.bot?MidnightBots.speedFactor(c):1,ac=k.up?(road?330*bf:165*bf):k.down?-195:0;
    c.v+=ac*dt;c.v*=Math.pow(road?.987:.955,dt*60);c.v=Math.max(-110,Math.min((flying?BOOST_MAX:BASE_MAX)*bf,c.v));if(Math.abs(c.v)<.8)c.v=0;
    const steer=(k.left?-1:0)+(k.right?1:0),speed=Math.min(1,Math.abs(c.v)/BOOST_MAX),maxHeading=.34-.12*speed,target=steer*maxHeading*(c.v>=0?1:-1),rate=(road?.92:.58)*(.45+.55*speed),delta=target-c.a,step=rate*dt;
    c.a+=Math.max(-step,Math.min(step,delta));
    if(!steer&&Math.abs(c.a)<.008)c.a=0;
    const ox=c.x,oy=c.y;c.x+=Math.cos(c.a)*c.v*dt;c.y+=Math.sin(c.a)*c.v*dt;
    const edge=18;if(c.y<YMIN()+edge||c.y>YMAX()-edge)c.v*=Math.pow(.988,dt*60);
    if(c.y<YMIN()+7){c.y=YMIN()+7;c.a=Math.max(-.12,Math.min(.12,c.a));}if(c.y>YMAX()-7){c.y=YMAX()-7;c.a=Math.max(-.12,Math.min(.12,c.a));}
    if(!onRoad(c.x,c.y)){const far=!T().roads.some(r=>c.x>r.x-20&&c.x<r.x+r.w+20&&c.y>r.y-20&&c.y<r.y+r.h+20);if(far){c.x=ox;c.y=oy;c.v*=-.18;}}
  }
  function resolveCollisions(ps){
    const now=Date.now();
    for(let i=0;i<ps.length;i++)for(let j=i+1;j<ps.length;j++){
      const a=ps[i],b=ps[j];if(a.done||b.done||now<(a.boostUntil||0)||now<(b.boostUntil||0))continue;let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=COLLISION_DIST)continue;if(d<.01){dx=1;dy=0;d=1;}
      const nx=dx/d,ny=dy/d,over=COLLISION_DIST-d,av=a.v,bv=b.v,relative=Math.abs(av-bv),impact=Math.max(.28,Math.min(1,relative/170+over/28));
      a.x-=nx*over*.56;a.y-=ny*over*.56;b.x+=nx*over*.56;b.y+=ny*over*.56;
      a.v=Math.max(-85,Math.min(BASE_MAX,av*(.48-impact*.08)+bv*(.30+impact*.08)));b.v=Math.max(-85,Math.min(BASE_MAX,bv*(.48-impact*.08)+av*(.40+impact*.08)));
      const spin=(.10+impact*.30)*Math.max(.25,Math.abs(ny));a.a=Math.max(-.46,Math.min(.46,a.a-ny*spin));b.a=Math.max(-.46,Math.min(.46,b.a+ny*spin));
      const until=Date.now()+Math.round(520+impact*520);a.crashUntil=until;b.crashUntil=until;a.crashPower=impact;b.crashPower=impact;a.crashSeq=(a.crashSeq||0)+1;b.crashSeq=(b.crashSeq||0)+1;
    }
  }
  function finishCheck(c){if(!c.done&&c.x>=FINISH()&&c.y>=YMIN()&&c.y<=YMAX()){c.done=true;c.finish=Date.now();}}
  const progress=c=>c.done?2:Math.max(0,Math.min(1,(c.x-START())/(FINISH()-START())));
  function winnerCheck(){const done=Object.values(world.players).filter(p=>p.done);if(!done.length)return false;done.sort((a,b)=>a.finish-b.finish);endRace(done[0].id,'finish');return true;}
  function finishByTime(){const ranked=Object.values(world.players).sort((a,b)=>progress(b)-progress(a)||b.x-a.x);endRace(ranked[0].id,'time');}
  function endRace(id,reason){if(finished)return;finished=true;world.phase='finish';world.winner=id;world.finishReason=reason;broadcast({type:'finish',winner:id,world});finish(id);}
  function startRender(){if(!Midnight3D.init(canvas)||raf)return;const loop=()=>{if(world&&myId){Midnight3D.update(world,myId);const me=world.players[myId];if(me){MidnightSound.update(me,input,world.phase);if((me.crashSeq||0)!==lastCrashSeq){lastCrashSeq=me.crashSeq||0;if(lastCrashSeq)MidnightSound.crash(me.crashPower||.5);}}updateHud();}raf=requestAnimationFrame(loop)};loop();}
  function stopRender(){cancelAnimationFrame(raf);raf=null;}
  function updateHud(){if(!world)return;const me=world.players[myId];if(!me)return;const ps=Object.values(world.players),ranked=[...ps].sort((a,b)=>progress(b)-progress(a)||Math.abs(b.v)-Math.abs(a.v)),pos=Math.max(1,ranked.findIndex(p=>p.id===myId)+1),pct=Math.round(Math.max(0,Math.min(100,(me.x-START())/(FINISH()-START())*100)));const remain=world.phase==='race'?Math.max(0,world.raceEndsAt-Date.now()):RACE_MS,sec=Math.ceil(remain/1000);$('#timer').textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;$('#lap').textContent=pct+'%';$('#speed').textContent=Math.round(Math.abs(me.v)*.68);$('#position').textContent=pos+' / '+ps.length;$('#youName').textContent=me.name;$('#driverList').innerHTML=ranked.map((p,i)=>`<p><i style="background:${Midnight3D.colorFor(p.id)}"></i><span>${i+1}. ${esc(p.name)}${p.bot?' 🤖':''}${p.crashUntil>Date.now()?' 💥':''}${p.boostUntil>Date.now()?' 🚀':''}</span></p>`).join('');}
  function finish(w){clearInterval(hostLoop);hostLoop=null;stopRender();MidnightSound.stop();finished=true;show('finish');const winner=world?.players?.[w],win=w===myId,byTime=world?.finishReason==='time';$('#finishTitle').textContent=win?'You won! 🏁':`${winner?.name||'A driver'} won!`;$('#finishText').textContent=byTime?'Ninety seconds are up — the farthest car wins.':win?'You reached the end of the 1:30 highway first.':'Race complete. Ready for a rematch?';}
  $('#rematch').onclick=()=>{MidnightSound.init();ready=true;if(soloMode){startRace();return;}if(isHost){world.phase='lobby';Object.values(world.players).forEach(p=>p.ready=p.id==='p1');broadcast({type:'back',world});show('lobby');updateLobby();syncLobby();}else{if(world.players[myId])world.players[myId].ready=true;send({type:'rematch'});show('lobby');updateLobby();}};
  $('#soundBtn').onclick=()=>{$('#soundBtn').textContent=MidnightSound.toggle()?'🔊 Sound on':'🔇 Sound off'};
  const keys={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'},inputSend=()=>{if(!isHost)send({type:'input',value:input})};
  function gasTap(){const now=performance.now(),gap=now-lastGasPress;if(gap>=70&&gap<=300){input.boost=true;inputSend();setTimeout(()=>{input.boost=false;inputSend()},160);lastGasPress=0;}else lastGasPress=now;}
  addEventListener('keydown',e=>{const k=keys[e.key];if(!k||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;e.preventDefault();MidnightSound.init();if(k==='up'&&!e.repeat&&!input.up)gasTap();input[k]=true;inputSend()});
  addEventListener('keyup',e=>{const k=keys[e.key];if(!k)return;e.preventDefault();input[k]=false;inputSend()});
  document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key,on=e=>{e.preventDefault();MidnightSound.init();if(k==='up'&&!input.up)gasTap();input[k]=true;inputSend()},off=e=>{e.preventDefault();input[k]=false;inputSend()};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
  status('Ready · 1:30 city boost build');
})();