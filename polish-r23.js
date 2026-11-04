(() => {
  const $ = s => document.querySelector(s);
  const track = window.Midnight3D?.track;

  // Extra city density. This only changes scenery data; multiplayer transport is untouched.
  if (track?.buildings && !track.__r23CityPolish) {
    track.__r23CityPolish = true;
    const finish = track.finishX || 30000;
    const step = innerWidth < 700 ? 3000 : 2200;
    let seed = 0;
    for (let x = 1200; x < finish - 700; x += step) {
      const wiggle = (seed % 3) * 35;
      track.buildings.push(
        { x: x + 120, y: 22 + wiggle * .18, w: 115 + (seed % 4) * 18, h: 120 + (seed % 3) * 14, l: `CITY-${seed}-N` },
        { x: x + 760, y: 530 + (seed % 2) * 10, w: 120 + (seed % 5) * 15, h: 112 + (seed % 4) * 12, l: `CITY-${seed}-S` }
      );
      seed++;
    }
  }

  const wrap = $('.canvasWrap');
  if (!wrap) return;

  // Start-grid traffic lights.
  const startFx = document.createElement('div');
  startFx.className = 'startGridFx';
  startFx.innerHTML = `<div class="startGridPanel"><span class="startGridLabel">STARTING GRID</span><span class="startLights"><i class="startLight red"></i><i class="startLight red"></i><i class="startLight amber"></i><i class="startLight green"></i></span></div>`;
  wrap.appendChild(startFx);
  const lights = [...startFx.querySelectorAll('.startLight')];

  const countdown = $('#countdown');
  let lightHideTimer = 0;
  function setLights(value) {
    const v = String(value || '').trim().toUpperCase();
    lights.forEach(l => l.classList.remove('on'));
    clearTimeout(lightHideTimer);
    if (v === '3') { startFx.classList.add('show'); lights[0].classList.add('on'); }
    else if (v === '2') { startFx.classList.add('show'); lights[0].classList.add('on'); lights[1].classList.add('on'); }
    else if (v === '1') { startFx.classList.add('show'); lights[0].classList.add('on'); lights[1].classList.add('on'); lights[2].classList.add('on'); }
    else if (v.includes('GO')) {
      startFx.classList.add('show'); lights[3].classList.add('on');
      lightHideTimer = setTimeout(() => startFx.classList.remove('show'), 850);
    }
  }
  if (countdown) new MutationObserver(() => setLights(countdown.textContent)).observe(countdown, { childList: true, characterData: true, subtree: true });

  // Boost visual feedback + cooldown meter. Mirrors the existing r22 double-tap timing; does not change physics.
  const boostFx = document.createElement('div'); boostFx.className = 'boostFx'; wrap.appendChild(boostFx);
  const boostWord = document.createElement('div'); boostWord.className = 'boostWord'; boostWord.textContent = 'BOOST!'; wrap.appendChild(boostWord);
  const boostMeter = document.createElement('div');
  boostMeter.className = 'boostMeter';
  boostMeter.innerHTML = `<div class="boostMeterHead"><span>DOUBLE-TAP BOOST</span><b id="boostState">READY</b></div><div class="boostBar"><i></i></div>`;
  wrap.appendChild(boostMeter);
  const boostFill = boostMeter.querySelector('.boostBar i'), boostState = boostMeter.querySelector('#boostState');
  let lastGas = 0, boostCount = 0, cooldownUntil = 0, fxTimer = 0, maxSpeed = 0;

  function triggerBoostFx() {
    const now = performance.now();
    if (now < cooldownUntil) return;
    boostCount++;
    cooldownUntil = now + 3200;
    boostFx.classList.add('active'); boostWord.classList.add('active');
    boostState.textContent = 'BOOSTING';
    clearTimeout(fxTimer);
    fxTimer = setTimeout(() => { boostFx.classList.remove('active'); boostWord.classList.remove('active'); }, 2000);
    if (navigator.vibrate) { try { navigator.vibrate([35, 35, 60]); } catch (_) {} }
  }
  function gasPress() {
    const now = performance.now(), gap = now - lastGas;
    if (gap >= 70 && gap <= 300) { triggerBoostFx(); lastGas = 0; }
    else lastGas = now;
  }
  const gas = document.querySelector('[data-key="up"]');
  gas?.addEventListener('pointerdown', gasPress, { passive: true });
  addEventListener('keydown', e => {
    if (e.repeat || !['ArrowUp','w','W'].includes(e.key) || ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    gasPress();
  });

  function meterLoop() {
    const now = performance.now();
    const remaining = Math.max(0, cooldownUntil - now);
    const ready = remaining <= 0;
    const pct = ready ? 1 : Math.max(0, 1 - remaining / 3200);
    boostFill.style.transform = `scaleX(${pct})`;
    if (ready && boostState.textContent !== 'READY') boostState.textContent = 'READY';
    else if (!ready && now > cooldownUntil - 2000) boostState.textContent = `${(remaining / 1000).toFixed(1)}s`;
    requestAnimationFrame(meterLoop);
  }
  meterLoop();

  // Three checkpoint milestones based on race progress.
  const toast = document.createElement('div'); toast.className = 'checkpointToast'; wrap.appendChild(toast);
  const hud = $('.hud');
  const cpHud = document.createElement('div');
  cpHud.className = 'checkpointHud';
  cpHud.innerHTML = `<small>Checkpoints</small><strong id="checkpointCount">0 / 3</strong><div class="checkpointDots"><i></i><i></i><i></i></div>`;
  hud?.appendChild(cpHud);
  const cpCount = cpHud.querySelector('#checkpointCount'), cpDots = [...cpHud.querySelectorAll('i')];
  const thresholds = [25, 50, 75];
  let reached = 0, lastPct = 0, toastTimer = 0;
  function resetCheckpoints() {
    reached = 0; lastPct = 0; cpCount.textContent = '0 / 3'; cpDots.forEach(d => d.classList.remove('done'));
  }
  function updateCheckpoint() {
    const pct = parseInt($('#lap')?.textContent || '0', 10) || 0;
    if (pct < 4 && lastPct > 10) resetCheckpoints();
    lastPct = pct;
    while (reached < thresholds.length && pct >= thresholds[reached]) {
      reached++;
      cpDots[reached - 1]?.classList.add('done');
      cpCount.textContent = `${reached} / 3`;
      toast.textContent = reached < 3 ? `CHECKPOINT ${reached} / 3` : 'FINAL CHECKPOINT ✓';
      toast.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 1200);
      if (navigator.vibrate) { try { navigator.vibrate(35); } catch (_) {} }
    }
  }
  const lap = $('#lap');
  if (lap) new MutationObserver(updateCheckpoint).observe(lap, { childList: true, characterData: true, subtree: true });

  // Track top speed and keep a snapshot of the live order for the results screen.
  let orderSnapshot = [];
  const speed = $('#speed'), driverList = $('#driverList');
  if (speed) new MutationObserver(() => { maxSpeed = Math.max(maxSpeed, parseInt(speed.textContent || '0', 10) || 0); }).observe(speed, { childList: true, characterData: true, subtree: true });
  function snapshotOrder() {
    if (!driverList) return;
    const rows = [...driverList.querySelectorAll('p span')].map(s => s.textContent.trim()).filter(Boolean);
    if (rows.length) orderSnapshot = rows;
  }
  if (driverList) new MutationObserver(snapshotOrder).observe(driverList, { childList: true, subtree: true, characterData: true });

  const finishView = $('#finish'), finishPanel = finishView?.querySelector('.finish');
  let finalBoard = $('#finalLeaderboard');
  if (!finalBoard && finishPanel) {
    finalBoard = document.createElement('div'); finalBoard.id = 'finalLeaderboard'; finalBoard.className = 'finalBoard';
    const actions = finishPanel.querySelector('.actions'); finishPanel.insertBefore(finalBoard, actions || null);
  }
  let stats = $('#raceStats');
  if (!stats && finishPanel) {
    stats = document.createElement('div'); stats.id = 'raceStats'; stats.className = 'raceStatLine';
    finishPanel.insertBefore(stats, finalBoard || finishPanel.querySelector('.actions'));
  }
  function renderResults() {
    if (!finishView?.classList.contains('active')) return;
    const list = orderSnapshot.length ? orderSnapshot : ['Race complete'];
    if (finalBoard) {
      finalBoard.innerHTML = `<h3>FINAL RACE ORDER</h3>` + list.map((raw, i) => {
        const clean = raw.replace(/^\d+\.\s*/, '');
        const medal = i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
        return `<div class="finalBoardRow"><span class="finalRank">${medal}</span><span class="finalName">${clean}</span><span class="finalTag">${i === 0 ? 'WINNER' : 'FINISHED'}</span></div>`;
      }).join('');
    }
    if (stats) stats.innerHTML = `<span>⚡ Top speed ${maxSpeed} km/h</span><span>🚀 Boosts ${boostCount}</span><span>🏁 Checkpoints ${reached}/3</span>`;
  }
  if (finishView) new MutationObserver(renderResults).observe(finishView, { attributes: true, attributeFilter: ['class'] });

  // Reset local polish stats when a new countdown starts.
  if (countdown) new MutationObserver(() => {
    if (String(countdown.textContent).trim() === '3') { maxSpeed = 0; boostCount = 0; resetCheckpoints(); }
  }).observe(countdown, { childList: true, characterData: true, subtree: true });

  window.MidnightPolish = { build: 'polish-r23', checkpoints: thresholds };
})();
