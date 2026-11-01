(() => {
  const players = document.querySelector('#players');
  if (!players) return;

  let summary = document.querySelector('#rosterSummary');
  if (!summary) {
    summary = document.createElement('div');
    summary.id = 'rosterSummary';
    summary.className = 'rosterSummary';
    players.parentNode.insertBefore(summary, players);
  }

  function cleanRoleText(text) {
    return String(text || '')
      .replace(/\(host\)/ig, '')
      .replace(/\(you\)/ig, '')
      .trim();
  }

  function decorate() {
    const rows = [...players.querySelectorAll('.player')];
    let readyCount = 0;

    rows.forEach((row, index) => {
      const existingNo = row.querySelector('.driverNo');
      const identity = row.querySelector('.driverIdentity') || (existingNo ? row.children[1] : row.children[0]);
      const status = row.querySelector('.readyBadge') || row.querySelector('.ok, .wait') || (existingNo ? row.children[2] : row.children[1]);
      if (!identity || !status) return;

      const raw = identity.textContent || '';
      const alreadyDecorated = identity.dataset.rosterDecorated === '1';
      const isHost = alreadyDecorated ? !!identity.querySelector('.hostBadge') : /\(host\)/i.test(raw);
      const isYou = alreadyDecorated ? !!identity.querySelector('.youBadge') : /\(you\)/i.test(raw);
      const isReady = status.classList.contains('ok') || /READY$/i.test(status.textContent.trim()) && !/NOT READY$/i.test(status.textContent.trim());
      if (isReady) readyCount++;

      row.classList.toggle('playerReady', isReady);
      row.classList.toggle('playerWaiting', !isReady);

      if (!existingNo) {
        const no = document.createElement('span');
        no.className = 'driverNo';
        no.textContent = String(index + 1);
        row.prepend(no);
      } else if (existingNo.textContent !== String(index + 1)) {
        existingNo.textContent = String(index + 1);
      }

      if (!alreadyDecorated) {
        const name = document.createElement('span');
        name.className = 'driverName';
        name.textContent = cleanRoleText(raw);

        const badges = document.createElement('span');
        badges.className = 'driverBadges';
        if (isHost) {
          const b = document.createElement('span');
          b.className = 'roleBadge hostBadge';
          b.textContent = 'HOST';
          badges.appendChild(b);
        }
        if (isYou) {
          const b = document.createElement('span');
          b.className = 'roleBadge youBadge';
          b.textContent = 'YOU';
          badges.appendChild(b);
        }

        identity.textContent = '';
        identity.classList.add('driverIdentity');
        identity.append(name, badges);
        identity.dataset.rosterDecorated = '1';
      }

      status.classList.add('readyBadge');
      const label = isReady ? '● READY' : '● NOT READY';
      if (status.textContent !== label) status.textContent = label;
    });

    const waiting = Math.max(0, rows.length - readyCount);
    const summaryHtml = `<strong>DRIVERS IN ROOM</strong><span>${rows.length} player${rows.length === 1 ? '' : 's'} · <b class="summaryReady">${readyCount} ready</b> · <b class="summaryWaiting">${waiting} not ready</b></span>`;
    if (summary.innerHTML !== summaryHtml) summary.innerHTML = summaryHtml;
  }

  let framePending = false;
  const schedule = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      decorate();
    });
  };

  const observer = new MutationObserver(schedule);
  observer.observe(players, { childList: true, subtree: true, characterData: true });
  addEventListener('load', decorate);
  setInterval(decorate, 1200);
  decorate();

  window.MidnightLobbyUI = { build: 'roster-r18' };
})();