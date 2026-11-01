(() => {
  const $ = s => document.querySelector(s);
  const views = ['home','lobby','race','finish'];
  const canvas = $('#canvas');
  const TOTAL = 3;
  const MAX_PLAYERS = 6;

  let peer = null;
  let isHost = false;
  let myName = '';
  let room = '';
  let myId = '';
  let world = null;
  let ready = false;
  let finished = false;
  let hostLoop = null;
  let raf = null;
  let conn = null;
  let conns = new Map();
  let guestInputs = new Map();
  let input = { up:false, down:false, left:false, right:false };

  const T = () => Midnight3D.track;
  const show = id => views.forEach(v => $('#'+v).classList.toggle('active', v === id));
  const status = t => $('#status').textContent = t;
  const code = s => (s || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
  const peerId = c => 'midnight-city-racing-' + c.toLowerCase();
  const rand = () => {
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s='';
    for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
    return s;
  };
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const error = (t='') => { const e=$('#error'); e.hidden=!t; e.textContent=t; };

  const startSlots = [
    {x:430,y:510},{x:430,y:552},{x:430,y:594},
    {x:480,y:510},{x:480,y:552},{x:480,y:594}
  ];

  function player(id,name,index=0){
    const s=startSlots[index] || startSlots[0];
    return {id,name,ready:false,connected:true,x:s.x,y:s.y,a:0,v:0,lap:0,cp:0,done:false,finish:0};
  }

  function newWorld(hostName){
    return {phase:'lobby',players:{p1:player('p1',hostName,0)},winner:null};
  }

  function broadcast(msg){
    if(!isHost) return;
    conns.forEach(c => { if(c.open) c.send(msg); });
  }

  function send(msg){ if(conn && conn.open) conn.send(msg); }

  function cleanup(){
    clearInterval(hostLoop); hostLoop=null;
    cancelAnimationFrame(raf); raf=null;
    try{ conn && conn.close(); }catch{}
    conns.forEach(c=>{try{c.close()}catch{}});
    try{ peer && peer.destroy(); }catch{}
    peer=null; conn=null; conns=new Map(); guestInputs=new Map(); world=null;
    ready=false; finished=false;
    input={up:false,down:false,left:false,right:false};
    MidnightSound.stop();
  }

  function home(){
    cleanup(); isHost=false; myName=''; room=''; myId='';
    status('Ready'); error(); show('home');
  }

  $('#hostTab').onclick=()=>{
    $('#hostTab').classList.add('active'); $('#joinTab').classList.remove('active');
    $('#hostForm').classList.add('active'); $('#joinForm').classList.remove('active');
  };
  $('#joinTab').onclick=()=>{
    $('#joinTab').classList.add('active'); $('#hostTab').classList.remove('active');
    $('#joinForm').classList.add('active'); $('#hostForm').classList.remove('active');
  };
  ['hostCode','joinCode'].forEach(id=>$('#'+id).oninput=e=>e.target.value=code(e.target.value));

  $('#hostForm').onsubmit=e=>{
    e.preventDefault(); const n=$('#hostName').value.trim();
    if(n) host(n,code($('#hostCode').value)||rand());
  };
  $('#joinForm').onsubmit=e=>{
    e.preventDefault(); const n=$('#joinName').value.trim(), c=code($('#joinCode').value);
    if(!n || c.length<4) return error('Enter your name and the room code from your friend.');
    join(n,c);
  };

  function nextId(){
    for(let i=2;i<=MAX_PLAYERS;i++) if(!world.players['p'+i] && !conns.has('p'+i)) return 'p'+i;
    return null;
  }

  function host(name,c){
    cleanup(); error();
    if(typeof Peer==='undefined') return error('Multiplayer could not load. Check your connection.');
    isHost=true; myName=name; room=c; myId='p1'; world=newWorld(name);
    status('Creating room…');
    peer=new Peer(peerId(c));
    peer.on('open',()=>{
      status('Room open · waiting for drivers'); openLobby();
      peer.on('connection',wireIncomingGuest);
    });
    peer.on('error',e=>{
      status('Connection error');
      error(e.type==='unavailable-id'?'That room code is already in use.':'Could not create the room. Try again.');
    });
  }

  function wireIncomingGuest(c){
    if(!world || world.phase!=='lobby'){
      c.on('open',()=>{c.send({type:'reject',reason:'Race already started.'});c.close();});
      return;
    }
    const id=nextId();
    if(!id){
      c.on('open',()=>{c.send({type:'reject',reason:'Room is full (6 players max).'});c.close();});
      return;
    }
    conns.set(id,c); guestInputs.set(id,{up:false,down:false,left:false,right:false});
    c.on('open',()=>{
      status(`${Object.keys(world.players).length}/6 drivers connected`);
      c.send({type:'assign',id,room,maxPlayers:MAX_PLAYERS});
    });
    c.on('data',d=>{
      if(!d || typeof d!=='object') return;
      if(d.type==='join'){
        const index=Number(id.slice(1))-1;
        world.players[id]=player(id,String(d.name||'Driver').slice(0,18),index);
        syncLobby();
      }
      if(d.type==='ready' && world.players[id]){
        world.players[id].ready=!!d.value; syncLobby();
      }
      if(d.type==='input') guestInputs.set(id,{...guestInputs.get(id),...d.value});
      if(d.type==='rematch' && world.players[id]){
        world.players[id].ready=true; syncLobby();
      }
    });
    c.on('close',()=>{
      conns.delete(id); guestInputs.delete(id);
      if(world?.players?.[id]) delete world.players[id];
      if(world?.phase==='lobby') syncLobby();
      status(`${world?Object.keys(world.players).length:1}/6 drivers connected`);
    });
  }

  function join(name,c){
    cleanup(); error();
    if(typeof Peer==='undefined') return error('Multiplayer could not load. Check your connection.');
    isHost=false; myName=name; room=c; myId=''; world={phase:'lobby',players:{},winner:null};
    status('Connecting…');
    peer=new Peer();
    peer.on('open',()=>{
      conn=peer.connect(peerId(c),{reliable:true}); wireGuest(conn);
    });
    peer.on('error',()=>{status('Connection error');error('Could not connect. Check the room code and try again.')});
  }

  function wireGuest(c){
    const timer=setTimeout(()=>{if(!c.open) error('Room not found. Ask the host to keep the room open.')},7000);
    c.on('open',()=>{clearTimeout(timer);status('Connected · joining lobby')});
    c.on('data',d=>{
      if(!d || typeof d!=='object') return;
      if(d.type==='assign'){
        myId=d.id; $('#roomCode').textContent=room; $('#raceCode').textContent=room;
        send({type:'join',name:myName}); show('lobby');
      }
      if(d.type==='reject'){ error(d.reason||'Unable to join this room.'); status('Join rejected'); }
      if(d.type==='lobby'){ world=d.world; show('lobby'); updateLobby(); }
      if(d.type==='count'){ show('race'); startRender(); count(d.value); }
      if(d.type==='world'){ world=d.world; show('race'); startRender(); updateHud(); }
      if(d.type==='finish'){ world=d.world; finish(d.winner); }
      if(d.type==='back'){ world=d.world; finished=false; show('lobby'); updateLobby(); }
    });
    c.on('close',()=>status('Host disconnected'));
  }

  function openLobby(){
    $('#roomCode').textContent=room; $('#raceCode').textContent=room; show('lobby'); updateLobby();
  }

  function row(p){
    const hostMark=p.id==='p1'?' <small>(host)</small>':'';
    const youMark=p.id===myId?' <small>(you)</small>':'';
    return `<div class="player"><span>${esc(p.name)}${hostMark}${youMark}</span><span class="${p.ready?'ok':'wait'}">${p.ready?'Ready':'Not ready'}</span></div>`;
  }

  function connectedPlayers(){ return world ? Object.values(world.players).filter(p=>p.connected!==false) : []; }
  function allReady(){ const ps=connectedPlayers(); return ps.length>=2 && (!isHost || ps.length===conns.size+1) && ps.every(p=>p.ready); }

  function updateLobby(){
    if(!world) return;
    const ps=connectedPlayers().sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
    $('#players').innerHTML=ps.map(row).join('');
    $('#playerCount').textContent=`${ps.length} / ${MAX_PLAYERS}`;
    $('#ready').textContent=ready?'Ready ✓':"I'm ready";
    $('#start').hidden=!isHost;
    if(isHost) $('#start').disabled=!allReady();
    const me=world.players[myId];
    $('#youName').textContent=me?.name||myName||'You';
  }

  function syncLobby(){ updateLobby(); broadcast({type:'lobby',world}); }

  $('#ready').onclick=()=>{
    MidnightSound.init(); ready=!ready;
    if(isHost){ if(world.players.p1) world.players.p1.ready=ready; syncLobby(); }
    else { if(world.players[myId]) world.players[myId].ready=ready; updateLobby(); send({type:'ready',value:ready}); }
  };

  $('#start').onclick=()=>{
    MidnightSound.init(); if(isHost && allReady()) startRace();
  };
  $('#leave').onclick=home; $('#exitRace').onclick=home; $('#homeBtn').onclick=home;

  function resetCars(){
    const ps=connectedPlayers().sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
    ps.forEach((p,i)=>{
      const fresh=player(p.id,p.name,i);
      fresh.ready=true;
      Object.assign(p,fresh);
    });
    world.phase='count'; world.winner=null; finished=false;
  }

  function startRace(){
    if(!Midnight3D.init(canvas)) return error('3D engine failed to start. Refresh and try again.');
    resetCars(); show('race'); startRender();
    let n=3; broadcast({type:'count',value:n}); count(n);
    const timer=setInterval(()=>{
      n--;
      if(n){ broadcast({type:'count',value:n}); count(n); }
      else{
        clearInterval(timer); broadcast({type:'count',value:'GO!'}); count('GO!');
        world.phase='race'; runHost();
      }
    },900);
  }

  function count(v){
    Midnight3D.init(canvas); const e=$('#countdown'); e.textContent=v; e.classList.add('show');
    MidnightSound.beep(v); setTimeout(()=>e.classList.remove('show'),700);
  }

  function runHost(){
    clearInterval(hostLoop); let last=performance.now(),push=0;
    hostLoop=setInterval(()=>{
      if(!world || world.phase!=='race' || finished) return;
      const now=performance.now(),dt=Math.min(.04,(now-last)/1000); last=now;
      Object.values(world.players).forEach(p=>{
        const keys=p.id==='p1'?input:(guestInputs.get(p.id)||{});
        drive(p,keys,dt); lapCheck(p);
      });
      winnerCheck(); push+=dt;
      if(push>.05){ push=0; broadcast({type:'world',world}); }
      updateHud();
    },16);
  }

  function onRoad(x,y){ return T().roads.some(r=>x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h); }

  function drive(c,k,dt){
    if(c.done) return;
    const road=onRoad(c.x,c.y), ac=k.up?(road?300:150):k.down?-190:0;
    c.v+=ac*dt; c.v*=Math.pow(road?.987:.955,dt*60); c.v=Math.max(-105,Math.min(345,c.v));
    if(Math.abs(c.v)<.8)c.v=0;
    const turn=(k.left?-1:0)+(k.right?1:0),f=Math.min(1,Math.abs(c.v)/72);
    c.a+=turn*(road?2.1:1.4)*f*dt*(c.v>=0?1:-1);
    const ox=c.x,oy=c.y; c.x+=Math.cos(c.a)*c.v*dt; c.y+=Math.sin(c.a)*c.v*dt;
    if(!onRoad(c.x,c.y)){
      const far=!T().roads.some(r=>c.x>r.x-24&&c.x<r.x+r.w+24&&c.y>r.y-24&&c.y<r.y+r.h+24);
      if(far){c.x=ox;c.y=oy;c.v*=-.16;}
    }
  }

  function lapCheck(c){
    if(c.done)return;
    const z=[c.x>760&&c.y>475,c.x>760&&c.y<260,c.x>475&&c.x<675&&c.y<260,c.x<360&&c.y>220&&c.y<405,c.x<360&&c.y>450];
    if(c.cp<5&&z[c.cp])c.cp++;
    if(c.cp===5&&c.x>500&&c.x<590&&c.y>475){
      c.lap++;c.cp=0;
      if(c.lap>=TOTAL){c.done=true;c.finish=Date.now();}
    }
  }

  const progress=c=>c.lap*6+c.cp;

  function winnerCheck(){
    const done=Object.values(world.players).filter(p=>p.done);
    if(!done.length)return;
    done.sort((a,b)=>a.finish-b.finish);
    finished=true; world.phase='finish'; world.winner=done[0].id;
    broadcast({type:'finish',winner:world.winner,world}); finish(world.winner);
  }

  function startRender(){
    if(!Midnight3D.init(canvas)||raf)return;
    const loop=()=>{
      if(world&&myId){
        Midnight3D.update(world,myId);
        const me=world.players[myId]; if(me) MidnightSound.update(me,input,world.phase);
      }
      raf=requestAnimationFrame(loop);
    };
    loop();
  }
  function stopRender(){cancelAnimationFrame(raf);raf=null;}

  function updateHud(){
    if(!world)return;
    const me=world.players[myId]; if(!me)return;
    const ps=Object.values(world.players);
    const ranked=[...ps].sort((a,b)=>progress(b)-progress(a)||Math.abs(b.v)-Math.abs(a.v));
    const pos=Math.max(1,ranked.findIndex(p=>p.id===myId)+1);
    $('#lap').textContent=Math.min(me.lap,TOTAL)+' / '+TOTAL;
    $('#speed').textContent=Math.round(Math.abs(me.v)*.68);
    $('#position').textContent=pos+' / '+ps.length;
    $('#youName').textContent=me.name;
    $('#driverList').innerHTML=ranked.map((p,i)=>`<p><i style="background:${Midnight3D.colorFor(p.id)}"></i><span>${i+1}. ${esc(p.name)}</span></p>`).join('');
  }

  function finish(w){
    clearInterval(hostLoop);hostLoop=null;stopRender();MidnightSound.stop();finished=true;show('finish');
    const winner=world?.players?.[w]; const win=w===myId;
    $('#finishTitle').textContent=win?'You won! 🏁':`${winner?.name||'A driver'} won!`;
    $('#finishText').textContent=win?'You conquered the Midnight City street circuit.':'Race complete. Ready for a rematch?';
  }

  $('#rematch').onclick=()=>{
    MidnightSound.init(); ready=true;
    if(isHost){
      world.phase='lobby'; Object.values(world.players).forEach(p=>p.ready=p.id==='p1');
      broadcast({type:'back',world}); show('lobby'); updateLobby(); syncLobby();
    }else{
      if(world.players[myId]) world.players[myId].ready=true;
      send({type:'rematch'}); show('lobby'); updateLobby();
    }
  };

  $('#soundBtn').onclick=()=>{$('#soundBtn').textContent=MidnightSound.toggle()?'🔊 Sound on':'🔇 Sound off'};

  const keys={ArrowUp:'up',w:'up',W:'up',ArrowDown:'down',s:'down',S:'down',ArrowLeft:'left',a:'left',A:'left',ArrowRight:'right',d:'right',D:'right'};
  const inputSend=()=>{if(!isHost)send({type:'input',value:input})};
  addEventListener('keydown',e=>{const k=keys[e.key];if(!k||['INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;e.preventDefault();MidnightSound.init();input[k]=true;inputSend()});
  addEventListener('keyup',e=>{const k=keys[e.key];if(!k)return;e.preventDefault();input[k]=false;inputSend()});
  document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key,on=e=>{e.preventDefault();MidnightSound.init();input[k]=true;inputSend()},off=e=>{e.preventDefault();input[k]=false;inputSend()};b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});

  setTimeout(()=>Midnight3D.init(canvas),50);
})();
