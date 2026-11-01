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
      const identity = row.children[0];
      const status = row.children[1];
      if (!identity || !status) return;

      const raw = identity.textContent || '';
      const isHost = /\(host\)/i.test(raw);
      const isYou = /\(you\)/i.test(raw);
      const isReady = status.classList.contains('ok') || /^ready/i.test(status.textContent.trim());
      if (isReady) readyCount++;

      row.classList.toggle('playerReady', isReady);
      row.classList.toggle('playerWaiting', !isReady);

      if (!row.querySelector('.driverNo')) {
        const no = document.createElement('span');
        no.className = 'driverNo';
        no.textContent = String(index + 1);
        row.prepend(no);
      }

      if (!identity.dataset.rosterDecorated) {
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
      status.textContent = isReady ? '● READY' : '● NOT READY';
    });

    const waiting = Math.max(0, rows.length - readyCount);
    summary.innerHTML = `<strong>DRIVERS IN ROOM</strong><span>${rows.length} player${rows.length === 1 ? '' : 's'} · <b class="summaryReady">${readyCount} ready</b> · <b class="summaryWaiting">${waiting} not ready</b></span>`;
  }

  const observer = new MutationObserver(() => requestAnimationFrame(decorate));
  observer.observe(players, { childList: true, subtree: true, characterData: true });
  addEventListener('load', decorate);
  setInterval(decorate, 900);
  decorate();

  window.MidnightLobbyUI = { build: 'roster-r18' };
})();