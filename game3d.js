(() => {
  const $=s=>document.querySelector(s),views=['home','lobby','race','finish'],canvas=$('#canvas'),TOTAL=3;
  let peer=null,conn=null,isHost=false,myName='',room='',myId='',world=null,ready=false,finished=false,hostLoop=null,raf=null;
  let input={up:false,down:false,left:false,right:false},guestInput={up:false,down:false,left:false,right:false};
  const T=()=>Midnight3D.track;
  const show=id=>views.forEach(v=>$('#'+v).classList.toggle('active',v===id)),status=t=>$('#status').textContent=t;
  const code=s=>(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6),peerId=c=>'midnight-city-racing-'+c.toLowerCase();
  const rand=()=>{let s='',c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';for(let i=0;i<6;i++)s+=c[Math.floor(Math.random()*c.length)];return s};
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const error=(t='')=>{const e=$('#error');e.hidden=!t;e.textContent=t},send=o=>{if(conn&&conn.open)conn.send(o)};
  const player=(name,x,y)=>({name,ready:false,connected:true,x,y,a:0,v:0,lap:0,cp:0,done:false,finish:0});
  const newWorld=host=>({phase:'lobby',p1:player(host,500,532),p2:player('Waiting for friend…',500,566),winner:null});

  function cleanup(){clearInterval(hostLoop);hostLoop=null;cancelAnimationFrame(raf);raf=null;try{conn&&conn.close()}catch{}try{peer&&peer.destroy()}catch{}peer=conn=null;world=null;ready=false;finished=false;input={up:false,down:false,left:false,right:false};guestInput={up:false,down:false,left:false,right:false};MidnightSound.stop()}
  function home(){cleanup();isHost=false;myName=room=myId='';status('Ready');error();show('home')}

  $('#hostTab').onclick=()=>{$('#hostTab').classList.add('active');$('#joinTab').classList.remove('active');$('#hostForm').classList.add('active');$('#joinForm').classList.remove('active')};
  $('#joinTab').onclick=()=>{$('#joinTab').classList.add('active');$('#hostTab').classList.remove('active');$('#joinForm').classList.add('active');$('#hostForm').classList.remove('active')};
  ['hostCode','joinCode'].forEach(id=>$('#'+id).oninput=e=>e.target.value=code(e.target.value));
  $('#hostForm').onsubmit=e=>{e.preventDefault();const n=$('#hostName').value.trim();if(n)host(n,code($('#hostCode').value)||rand())};
  $('#joinForm').onsubmit=e=>{e.preventDefault();const n=$('#joinName').value.trim(),c=code($('#joinCode').value);if(!n||c.length<4)return error('Enter your name and the room code from your friend.');join(n,c)};

  function host(name,c){cleanup();error();if(typeof Peer==='undefined')return error('Multiplayer could not load. Check your connection.');isHost=true;myName=name;room=c;myId='p1';world=newWorld(name);status('Creating room…');peer=new Peer(peerId(c));peer.on('open',()=>{status('Room open');openLobby();peer.on('connection',x=>{if(conn&&conn.open)return x.close();conn=x;wireHost(x)})});peer.on('error',e=>{status('Connection error');error(e.type==='unavailable-id'?'That room code is already in use.':'Could not create the room. Try again.')})}
  function wireHost(c){c.on('open',()=>{world.p2.connected=true;status('Friend connected');send({type:'hello',host:myName});syncLobby()});c.on('data',d=>{if(!d||typeof d!=='object')return;if(d.type==='join'){world.p2.name=String(d.name||'Friend').slice(0,18);world.p2.connected=true;syncLobby()}if(d.type==='ready'){world.p2.ready=!!d.value;syncLobby()}if(d.type==='input')guestInput={...guestInput,...d.value};if(d.type==='rematch'){world.p2.ready=true;syncLobby()}});c.on('close',()=>{status('Friend disconnected');world.p2.connected=false;world.p2.ready=false;updateLobby()})}
  function join(name,c){cleanup();error();if(typeof Peer==='undefined')return error('Multiplayer could not load. Check your connection.');isHost=false;myName=name;room=c;myId='p2';world=newWorld('Host');world.p2.name=name;status('Connecting…');peer=new Peer();peer.on('open',()=>{conn=peer.connect(peerId(c),{reliable:true});wireGuest(conn)});peer.on('error',()=>{status('Connection error');error('Could not connect. Check the room code and try again.')})}
  function wireGuest(c){const t=setTimeout(()=>{if(!c.open)error('Room not found. Ask your friend to keep the host page open.')},7000);c.on('open',()=>{clearTimeout(t);status('Connected');openLobby();send({type:'join',name:myName})});c.on('data',d=>{if(!d||typeof d!=='object')return;if(d.type==='hello')status('Connected to '+d.host);if(d.type==='lobby'){world=d.world;updateLobby()}if(d.type==='count'){show('race');startRender();count(d.value)}if(d.type==='world'){world=d.world;show('race');startRender();updateHud()}if(d.type==='finish'){world=d.world;finish(d.winner)}if(d.type==='back'){world=d.world;finished=false;show('lobby');updateLobby()}});c.on('close',()=>status('Host disconnected'))}

  function openLobby(){$('#roomCode').textContent=room;$('#raceCode').textContent=room;show('lobby');updateLobby()}
  function row(p,h){return`<div class="player"><span>${esc(p.name)}${h?' <small>(host)</small>':''}</span><span class="${p.ready?'ok':'wait'}">${p.ready?'Ready':'Not ready'}</span></div>`}
  function updateLobby(){if(!world)return;$('#players').innerHTML=row(world.p1,true)+row(world.p2,false);$('#ready').textContent=ready?'Ready ✓':"I'm ready";$('#start').hidden=!isHost;if(isHost)$('#start').disabled=!(world.p1.ready&&world.p2.ready&&conn&&conn.open);const me=myId==='p1'?world.p1:world.p2,other=myId==='p1'?world.p2:world.p1;$('#youName').textContent=me.name||myName;$('#friendName').textContent=other.name||'Friend'}
  function syncLobby(){updateLobby();send({type:'lobby',world})}
  $('#ready').onclick=()=>{MidnightSound.init();ready=!ready;if(isHost){world.p1.ready=ready;syncLobby()}else{world.p2.ready=ready;updateLobby();send({type:'ready',value:ready})}};
  $('#start').onclick=()=>{MidnightSound.init();if(isHost&&world.p1.ready&&world.p2.ready&&conn&&conn.open)startRace()};
  $('#leave').onclick=home;$('#exitRace').onclick=home;$('#homeBtn').onclick=home;

  function resetCars(){Object.assign(world.p1,player(world.p1.name,500,532));Object.assign(world.p2,player(world.p2.name,500,566));world.p1.ready=world.p2.ready=true;world.phase='count';world.winner=null;finished=false}
  function startRace(){if(!Midnight3D.init(canvas))return error('3D engine failed to start. Refresh and try again.');resetCars();show('race');startRender();let n=3;send({type:'count',value:n});count(n);const timer=setInterval(()=>{n--;if(n){send({type:'count',value:n});count(n)}else{clearInterval(timer);send({type:'count',value:'GO!'});count('GO!');world.phase='race';runHost()}},900)}
  function count(v){Midnight3D.init(canvas);const e=$('#countdown');e.textContent=v;e.classList.add('show');MidnightSound.beep(v);setTimeout(()=>e.classList.remove('show'),700)}
  function runHost(){clearInterval(hostLoop);let last=performance.now(),push=0;hostLoop=setInterval(()=>{if(!world||world.phase!=='race'||finished)return;const now=performance.now(),dt=Math.min(.04,(now-last)/1000);last=now;drive(world.p1,input,dt);drive(world.p2,guestInput,dt);lapCheck(world.p1);lapCheck(world.p2);winnerCheck();push+=dt;if(push>.05){push=0;send({type:'world',world})}updateHud()},16)}
  function onRoad(x,y){return T().roads.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h)}
  function drive(c,k,dt){if(c.done)return;const road=onRoad(c.x,c.y),ac=k.up?(road?285:145):k.down?-185:0;c.v+=ac*dt;c.v*=Math.pow(road?.986:.955,dt*60);c.v=Math.max(-100,Math.min(330,c.v));if(Math.abs(c.v)<.8)c.v=0;const turn=(k.left?-1:0)+(k.right?1:0),f=Math.min(1,Math.abs(c.v)/72);c.a+=turn*(road?2.25:1.5)*f*dt*(c.v>=0?1:-1);const ox=c.x,oy=c.y;c.x+=Math.cos(c.a)*c.v*dt;c.y+=Math.sin(c.a)*c.v*dt;if(!onRoad(c.x,c.y)){const far=!T().roads.some(r=>c.x>r.x-18&&c.x<r.x+r.w+18&&c.y>r.y-18&&c.y<r.y+r.h+18);if(far){c.x=ox;c.y=oy;c.v*=-.18}}}
  function lapCheck(c){if(c.done)return;const z=[c.x>780&&c.y>500,c.x>790&&c.y<240,c.x>500&&c.x<650&&c.y<220,c.x<320&&c.y>250&&c.y<380,c.x<320&&c.y>470];if(c.cp<5&&z[c.cp])c.cp++;if(c.cp===5&&c.x>470&&c.x<560&&c.y>500){c.lap++;c.cp=0;if(c.lap>=TOTAL){c.done=true;c.finish=Date.now()}}}
  const progress=c=>c.lap*6+c.cp;
  function winnerCheck(){if(!(world.p1.done||world.p2.done))return;finished=true;world.phase='finish';const w=world.p1.done&&world.p2.done?(world.p1.finish<=world.p2.finish?'p1':'p2'):(world.p1.done?'p1':'p2');world.winner=w;send({type:'finish',winner:w,world});finish(w)}

  function startRender(){if(!Midnight3D.init(canvas)||raf)return;const loop=()=>{if(world){Midnight3D.update(world,myId);const me=myId==='p2'?world.p2:world.p1;MidnightSound.update(me,input,world.phase)}raf=requestAnimationFrame(loop)};loop()}
  function stopRender(){cancelAnimationFrame(raf);raf=null}
  function updateHud(){if(!world)return;const me=myId==='p1'?world.p1:world.p2,op=myId==='p1'?world.p2:world.p1;$('#lap').textContent=Math.min(me.lap,TOTAL)+' / '+TOTAL;$('#speed').textContent=Math.round(Math.abs(me.v)*.68);$('#position').textContent=(progress(me)>=progress(op)?'1':'2')+' / 2';$('#youName').textContent=me.name;$('#friendName').textContent=op.name}
  function finish(w){clearInterval(hostLoop);hostLoop=null;stopRender();MidnightSound.stop();finished=true;show('finish');const win=w===myId;$('#finishTitle').textContent=win?'You won! 🏁':'Your friend won!';$('#finishText').textContent=win?'You conquered the Midnight City street circuit.':'Close race. Hit rematch and take back the streets.'}
  $('#rematch').onclick=()=>{MidnightSound.init();if(isHost){ready=true;world.phase='lobby';world.p1.ready=true;world.p2.ready=false;send({type:'back',world});show('lobby');updateLobby();syncLobby()}else{ready=true;send({type:'rematch'});show('lobby');updateLobby()}};
  $('#soundBtn').onclick=()=>{$('#soundBtn').textContent=MidnightSound.toggle()?'🔊 Sound on':'🔇 Sound off'};

  const keys={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
  const inputSend=()=>{if(!isHost)send({type:'input',value:input})};
  addEventListener('keydown',e=>{const k=keys[e.key];if(!k||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;e.preventDefault();MidnightSound.init();input[k]=true;inputSend()});
  addEventListener('keyup',e=>{const k=keys[e.key];if(!k)return;e.preventDefault();input[k]=false;inputSend()});
  document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key,on=e=>{e.preventDefault();MidnightSound.init();input[k]=true;inputSend()},off=e=>{e.preventDefault();input[k]=false;inputSend()};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
  setTimeout(()=>Midnight3D.init(canvas),50);
})();