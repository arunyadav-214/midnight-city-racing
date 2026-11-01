(() => {
  let lastRoomState = '';

  function playerCount() {
    const text = document.querySelector('#playerCount')?.textContent || '0';
    return Number((text.match(/\d+/) || ['0'])[0]) || 0;
  }

  function syncAutoReady() {
    const lobby = document.querySelector('#lobby');
    const ready = document.querySelector('#ready');
    const start = document.querySelector('#start');
    if (!lobby?.classList.contains('active') || !ready) return;

    const count = playerCount();
    const isHost = !!start && !start.hidden;
    const key = `${count}:${isHost}:${ready.textContent}`;
    if (key === lastRoomState) return;
    lastRoomState = key;

    // Guests auto-ready as soon as they enter the lobby.
    // Hosts auto-ready once at least one friend is actually present.
    if (ready.textContent.trim().startsWith("I'm ready") && (!isHost || count >= 2)) {
      setTimeout(() => {
        if (document.querySelector('#lobby')?.classList.contains('active') &&
            document.querySelector('#ready')?.textContent.trim().startsWith("I'm ready")) {
          document.querySelector('#ready')?.click();
        }
      }, 220);
    }
  }

  const observer = new MutationObserver(syncAutoReady);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class','hidden','disabled']
  });
  addEventListener('load', syncAutoReady);
  setInterval(syncAutoReady, 800);
  window.MidnightAutoLobby = { build: 'dual443-r16' };
})();