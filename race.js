(() => {
  const $ = (s) => document.querySelector(s);
  const views = ['home', 'lobby', 'race', 'finish'];
  const canvas = $('#canvas');
  const ctx = canvas.getContext('2d');
  const TOTAL_LAPS = 3;

  let peer = null, conn = null, isHost = false;
  let myName = '', room = '', myId = '';
  let world = null, ready = false, finished = false;
  let hostLoop = null, raf = null;
  let input = { up: false, down: false, left: false, right: false };
  let guestInput = { up: false, down: false, left: false, right: false };

  const TRACK = {
    width: 1000,
    height: 650,
    roads: [
      { x: 120, y: 500, w: 760, h: 92 },
      { x: 790, y: 210, w: 92, h: 382 },
      { x: 500, y: 130, w: 382, h: 92 },
      { x: 500, y: 130, w: 92, h: 220 },
      { x: 220, y: 260, w: 372, h: 92 },
      { x: 220, y: 260, w: 92, h: 302 }
    ],
    buildings: [
      { x: 58, y: 70, w: 130, h: 160, label: 'MALL' },
      { x: 72, y: 270, w: 110, h: 140, label: 'CLUB' },
      { x: 344, y: 88, w: 110, h: 110, label: 'AUTO' },
      { x: 635, y: 82, w: 130, h: 110, label: 'HOTEL' },
      { x: 635, y: 256, w: 110, h: 180, label: 'GARAGE' },
      { x: 342, y: 390, w: 155, h: 90, label: 'PIER' },
      { x: 80, y: 515, w: 120, h: 84, label: 'DOCK' }
    ],
    startLine: { x: 470, y: 500, w: 74, h: 92 },
    laneMarks: [
      { x1: 160, y1: 546, x2: 840, y2: 546 },
      { x1: 836, y1: 240, x2: 836, y2: 558 },
      { x1: 540, y1: 176, x2: 842, y2: 176 },
      { x1: 546, y1: 176, x2: 546, y2: 306 },
      { x1: 260, y1: 306, x2: 548, y2: 306 },
      { x1: 266, y1: 304, x2: 266, y2: 528 }
    ],
    checkpoints: [
      (c) => c.x > 780 && c.y > 500,
      (c) => c.x > 790 && c.y < 240,
      (c) => c.x > 500 && c.x < 650 && c.y < 220,
      (c) => c.x < 320 && c.y > 250 && c.y < 380,
      (c) => c.x < 320 && c.y > 470
    ],
    startZone: (c) => c.x > 470 && c.x < 560 && c.y > 500
  };

  const show = (id) => views.forEach(v => $('#' + v).classList.toggle('active', v === id));
  const status = (t) => $('#status').textContent = t;
  const code = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const rand = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
  const peerId = (c) => 'midnight-city-racing-' + c.toLowerCase();
  const esc = (s) => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  function error(t = '') {
    const e = $('#error');
    e.hidden = !t;
    e.textContent = t;
  }

  function send(o) {
    if (conn && conn.open) conn.send(o);
  }

  function player(name, x, y, angle = 0) {
    return { name, ready: false, connected: true, x, y, a: angle, v: 0, lap: 0, cp: 0, done: false, finish: 0 };
  }

  function newWorld(host) {
    return {
      phase: 'lobby',
      p1: player(host, 500, 532, 0),
      p2: player('Waiting for friend…', 500, 566, 0),
      winner: null
    };
  }

  function cleanup() {
    clearInterval(hostLoop); hostLoop = null;
    cancelAnimationFrame(raf); raf = null;
    try { conn && conn.close(); } catch {}
    try { peer && peer.destroy(); } catch {}
    peer = null; conn = null; world = null; ready = false; finished = false;
    input = { up: false, down: false, left: false, right: false };
    guestInput = { up: false, down: false, left: false, right: false };
  }

  function home() {
    cleanup();
    isHost = false; myName = ''; room = ''; myId = '';
    status('Ready'); error(); show('home');
  }

  $('#hostTab').onclick = () => {
    $('#hostTab').classList.add('active');
    $('#joinTab').classList.remove('active');
    $('#hostForm').classList.add('active');
    $('#joinForm').classList.remove('active');
  };
  $('#joinTab').onclick = () => {
    $('#joinTab').classList.add('active');
    $('#hostTab').classList.remove('active');
    $('#joinForm').classList.add('active');
    $('#hostForm').classList.remove('active');
  };
  ['hostCode', 'joinCode'].forEach(id => $('#' + id).oninput = e => e.target.value = code(e.target.value));
  $('#hostForm').onsubmit = (e) => {
    e.preventDefault();
    const n = $('#hostName').value.trim();
    if (n) host(n, code($('#hostCode').value) || rand());
  };
  $('#joinForm').onsubmit = (e) => {
    e.preventDefault();
    const n = $('#joinName').value.trim();
    const c = code($('#joinCode').value);
    if (!n || c.length < 4) return error('Enter your name and the room code from your friend.');
    join(n, c);
  };

  function host(name, c) {
    cleanup(); error();
    if (typeof Peer === 'undefined') return error('Multiplayer could not load. Check your internet connection.');
    isHost = true; myName = name; room = c; myId = 'p1'; world = newWorld(name);
    status('Creating room…');
    peer = new Peer(peerId(c));
    peer.on('open', () => {
      status('Room open'); openLobby();
      peer.on('connection', x => {
        if (conn && conn.open) { x.close(); return; }
        conn = x; wireHost(x);
      });
    });
    peer.on('error', (e) => {
      status('Connection error');
      error(e.type === 'unavailable-id' ? 'That room code is already in use. Try another.' : 'Could not create the room. Try again.');
    });
  }

  function wireHost(c) {
    c.on('open', () => {
      world.p2.connected = true; status('Friend connected');
      send({ type: 'hello', host: myName }); syncLobby();
    });
    c.on('data', (d) => {
      if (!d || typeof d !== 'object') return;
      if (d.type === 'join') {
        world.p2.name = String(d.name || 'Friend').slice(0, 18);
        world.p2.connected = true; syncLobby();
      }
      if (d.type === 'ready') { world.p2.ready = !!d.value; syncLobby(); }
      if (d.type === 'input') guestInput = { ...guestInput, ...d.value };
      if (d.type === 'rematch') { world.p2.ready = true; syncLobby(); }
    });
    c.on('close', () => {
      status('Friend disconnected');
      world.p2.connected = false; world.p2.ready = false; updateLobby();
    });
  }

  function join(name, c) {
    cleanup(); error();
    if (typeof Peer === 'undefined') return error('Multiplayer could not load. Check your internet connection.');
    isHost = false; myName = name; room = c; myId = 'p2';
    world = newWorld('Host'); world.p2.name = name;
    status('Connecting…');
    peer = new Peer();
    peer.on('open', () => {
      conn = peer.connect(peerId(c), { reliable: true });
      wireGuest(conn);
    });
    peer.on('error', () => {
      status('Connection error'); error('Could not connect. Check the room code and try again.');
    });
  }

  function wireGuest(c) {
    const timer = setTimeout(() => {
      if (!c.open) error('Room not found. Ask your friend to keep the host page open.');
    }, 7000);
    c.on('open', () => {
      clearTimeout(timer); status('Connected'); openLobby(); send({ type: 'join', name: myName });
    });
    c.on('data', (d) => {
      if (!d || typeof d !== 'object') return;
      if (d.type === 'hello') status('Connected to ' + d.host);
      if (d.type === 'lobby') { world = d.world; updateLobby(); }
      if (d.type === 'count') { show('race'); startRender(); count(d.value); }
      if (d.type === 'world') { world = d.world; show('race'); startRender(); updateHud(); }
      if (d.type === 'finish') { world = d.world; finish(d.winner); }
      if (d.type === 'back') { world = d.world; finished = false; show('lobby'); updateLobby(); }
    });
    c.on('close', () => status('Host disconnected'));
  }

  function openLobby() {
    $('#roomCode').textContent = room;
    $('#raceCode').textContent = room;
    show('lobby'); updateLobby();
  }

  function row(p, hostPlayer) {
    return `<div class="player"><span>${esc(p.name)}${hostPlayer ? ' <small>(host)</small>' : ''}</span><span class="${p.ready ? 'ok' : 'wait'}">${p.ready ? 'Ready' : 'Not ready'}</span></div>`;
  }

  function updateLobby() {
    if (!world) return;
    $('#players').innerHTML = row(world.p1, true) + row(world.p2, false);
    $('#ready').textContent = ready ? 'Ready ✓' : "I'm ready";
    $('#start').hidden = !isHost;
    if (isHost) $('#start').disabled = !(world.p1.ready && world.p2.ready && conn && conn.open);
    const me = myId === 'p1' ? world.p1 : world.p2;
    const other = myId === 'p1' ? world.p2 : world.p1;
    $('#youName').textContent = me.name || myName;
    $('#friendName').textContent = other.name || 'Friend';
  }

  function syncLobby() { updateLobby(); send({ type: 'lobby', world }); }

  $('#ready').onclick = () => {
    ready = !ready;
    if (isHost) { world.p1.ready = ready; syncLobby(); }
    else { world.p2.ready = ready; updateLobby(); send({ type: 'ready', value: ready }); }
  };

  $('#start').onclick = () => {
    if (isHost && world.p1.ready && world.p2.ready && conn && conn.open) startRace();
  };
  $('#leave').onclick = home;
  $('#exitRace').onclick = home;
  $('#homeBtn').onclick = home;

  function resetCars() {
    Object.assign(world.p1, player(world.p1.name, 500, 532, 0));
    Object.assign(world.p2, player(world.p2.name, 500, 566, 0));
    world.p1.ready = world.p2.ready = true;
    world.phase = 'count'; world.winner = null; finished = false;
  }

  function startRace() {
    resetCars(); show('race'); startRender();
    let n = 3;
    send({ type: 'count', value: n }); count(n);
    const timer = setInterval(() => {
      n--;
      if (n) { send({ type: 'count', value: n }); count(n); }
      else {
        clearInterval(timer);
        send({ type: 'count', value: 'GO!' }); count('GO!');
        world.phase = 'race'; runHost();
      }
    }, 900);
  }

  function count(v) {
    const e = $('#countdown');
    e.textContent = v; e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 700);
  }

  function runHost() {
    clearInterval(hostLoop);
    let last = performance.now(), push = 0;
    hostLoop = setInterval(() => {
      if (!world || world.phase !== 'race' || finished) return;
      const now = performance.now();
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      drive(world.p1, input, dt); drive(world.p2, guestInput, dt);
      lapCheck(world.p1); lapCheck(world.p2); winnerCheck();
      push += dt;
      if (push > 0.05) { push = 0; send({ type: 'world', world }); }
      updateHud();
    }, 16);
  }

  function onRoad(x, y) {
    return TRACK.roads.some(r => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  }

  function drive(car, keys, dt) {
    if (car.done) return;
    const accel = keys.up ? 260 : keys.down ? -170 : 0;
    car.v += accel * dt;
    car.v *= Math.pow(0.985, dt * 60);
    car.v = Math.max(-95, Math.min(315, car.v));
    if (Math.abs(car.v) < 1) car.v = 0;
    const turn = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
    const factor = Math.min(1, Math.abs(car.v) / 75);
    car.a += turn * 2.35 * factor * dt * (car.v >= 0 ? 1 : -1);
    const oldX = car.x, oldY = car.y;
    car.x += Math.cos(car.a) * car.v * dt;
    car.y += Math.sin(car.a) * car.v * dt;
    if (!onRoad(car.x, car.y)) {
      car.x = oldX; car.y = oldY; car.v *= -0.2;
    }
  }

  function lapCheck(car) {
    if (car.done) return;
    if (car.cp < TRACK.checkpoints.length && TRACK.checkpoints[car.cp](car)) car.cp++;
    if (car.cp === TRACK.checkpoints.length && TRACK.startZone(car)) {
      car.lap++; car.cp = 0;
      if (car.lap >= TOTAL_LAPS) { car.done = true; car.finish = Date.now(); }
    }
  }

  function progress(car) {
    return car.lap * (TRACK.checkpoints.length + 1) + car.cp;
  }

  function winnerCheck() {
    if (!(world.p1.done || world.p2.done)) return;
    finished = true; world.phase = 'finish';
    const winner = world.p1.done && world.p2.done
      ? (world.p1.finish <= world.p2.finish ? 'p1' : 'p2')
      : (world.p1.done ? 'p1' : 'p2');
    world.winner = winner;
    send({ type: 'finish', winner, world }); finish(winner);
  }

  function startRender() {
    if (raf) return;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    loop();
  }

  function stopRender() { cancelAnimationFrame(raf); raf = null; }

  function drawRoadBase() {
    ctx.fillStyle = '#091018';
    ctx.fillRect(0, 0, TRACK.width, TRACK.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= TRACK.width; x += 50) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, TRACK.height); ctx.stroke();
    }
    for (let y = 0; y <= TRACK.height; y += 50) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(TRACK.width, y); ctx.stroke();
    }

    TRACK.buildings.forEach((b, i) => {
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      g.addColorStop(0, i % 2 ? '#18222d' : '#1e2936');
      g.addColorStop(1, '#111820');
      ctx.fillStyle = g;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(82, 211, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255, 210, 63, 0.9)';
      ctx.font = '700 13px system-ui';
      ctx.fillText(b.label, b.x + 12, b.y + 22);
      for (let wy = b.y + 35; wy < b.y + b.h - 10; wy += 18) {
        for (let wx = b.x + 10; wx < b.x + b.w - 8; wx += 16) {
          ctx.fillStyle = (wx + wy) % 3 ? 'rgba(255, 213, 99, 0.12)' : 'rgba(82, 211, 255, 0.08)';
          ctx.fillRect(wx, wy, 8, 10);
        }
      }
    });

    TRACK.roads.forEach(r => {
      const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      g.addColorStop(0, '#272d36');
      g.addColorStop(1, '#313845');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#646f7f';
      ctx.lineWidth = 4;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    });

    ctx.strokeStyle = '#ffe16d';
    ctx.lineWidth = 4;
    ctx.setLineDash([22, 18]);
    TRACK.laneMarks.forEach(m => {
      ctx.beginPath(); ctx.moveTo(m.x1, m.y1); ctx.lineTo(m.x2, m.y2); ctx.stroke();
    });
    ctx.setLineDash([]);

    for (let y = TRACK.startLine.y, row = 0; y < TRACK.startLine.y + TRACK.startLine.h; y += 18, row++) {
      for (let x = TRACK.startLine.x, col = 0; x < TRACK.startLine.x + TRACK.startLine.w; x += 18, col++) {
        ctx.fillStyle = (row + col) % 2 ? '#10161e' : '#fff';
        ctx.fillRect(x, y, 18, 18);
      }
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(350, 20, 300, 54);
    ctx.strokeStyle = 'rgba(82, 211, 255, 0.3)';
    ctx.strokeRect(350, 20, 300, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 23px system-ui';
    ctx.fillText('MIDNIGHT CITY SPRINT', 382, 43);
    ctx.fillStyle = '#9ddfff';
    ctx.font = '14px system-ui';
    ctx.fillText('STREET CIRCUIT · 3 LAPS', 420, 63);
  }

  function drawStreetDecor() {
    const lights = [
      [150, 486], [250, 486], [350, 486], [450, 486], [650, 486], [750, 486],
      [894, 255], [894, 365], [894, 475], [485, 116], [645, 116], [805, 116],
      [206, 282], [206, 392], [206, 502]
    ];
    lights.forEach(([x, y]) => {
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 18);
      glow.addColorStop(0, 'rgba(255, 226, 123, 0.8)');
      glow.addColorStop(1, 'rgba(255, 226, 123, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe27b'; ctx.fillRect(x - 2, y - 2, 4, 4);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    [[760, 470], [760, 495], [760, 520], [410, 242], [435, 242], [460, 242]].forEach(([x, y]) => {
      ctx.fillRect(x, y, 16, 4);
    });
  }

  function draw() {
    drawRoadBase(); drawStreetDecor();
    if (world) {
      car(world.p1, '#ffd23f', myId === 'p1');
      car(world.p2, '#52d3ff', myId === 'p2');
    }
  }

  function car(c, color, me) {
    ctx.save();
    ctx.translate(c.x, c.y); ctx.rotate(c.a);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-17, -9, 40, 22);
    ctx.fillStyle = color; ctx.fillRect(-20, -11, 40, 22);
    ctx.fillStyle = '#10151c'; ctx.fillRect(2, -8, 11, 16);
    ctx.fillStyle = '#f5f7fb'; ctx.fillRect(14, -6, 5, 12);
    if (me) {
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(-24, -15, 48, 30);
    }
    ctx.restore();
  }

  function updateHud() {
    if (!world) return;
    const me = myId === 'p1' ? world.p1 : world.p2;
    const op = myId === 'p1' ? world.p2 : world.p1;
    $('#lap').textContent = Math.min(me.lap, TOTAL_LAPS) + ' / ' + TOTAL_LAPS;
    $('#speed').textContent = Math.round(Math.abs(me.v) * 0.62);
    $('#position').textContent = (progress(me) >= progress(op) ? '1' : '2') + ' / 2';
    $('#youName').textContent = me.name;
    $('#friendName').textContent = op.name;
  }

  function finish(winner) {
    clearInterval(hostLoop); hostLoop = null; stopRender();
    finished = true; show('finish');
    const win = winner === myId;
    $('#finishTitle').textContent = win ? 'You won! 🏁' : 'Your friend won!';
    $('#finishText').textContent = win
      ? 'You owned the city streets and crossed the line first.'
      : 'Close race. Hit rematch and take the street crown.';
  }

  $('#rematch').onclick = () => {
    if (isHost) {
      ready = true; world.phase = 'lobby'; world.p1.ready = true; world.p2.ready = false;
      send({ type: 'back', world }); show('lobby'); updateLobby(); syncLobby();
    } else {
      ready = true; send({ type: 'rematch' }); show('lobby'); updateLobby();
    }
  };

  const keys = {
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right'
  };

  function inputSend() {
    if (!isHost) send({ type: 'input', value: input });
  }

  addEventListener('keydown', (e) => {
    const k = keys[e.key];
    if (!k || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    e.preventDefault(); input[k] = true; inputSend();
  });

  addEventListener('keyup', (e) => {
    const k = keys[e.key];
    if (!k) return;
    e.preventDefault(); input[k] = false; inputSend();
  });

  document.querySelectorAll('[data-key]').forEach(b => {
    const k = b.dataset.key;
    const on = (e) => { e.preventDefault(); input[k] = true; inputSend(); };
    const off = (e) => { e.preventDefault(); input[k] = false; inputSend(); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
  });

  draw();
})();
