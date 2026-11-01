(() => {
  const digits = input => {
    if (!input) return;
    input.setAttribute('maxlength', '4');
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('pattern', '[0-9]{4}');
    input.autocomplete = 'one-time-code';
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 4);
    });
  };

  const randomCode = () => String(Math.floor(1000 + Math.random() * 9000));
  const hostCode = document.querySelector('#hostCode');
  const joinCode = document.querySelector('#joinCode');
  const hostForm = document.querySelector('#hostForm');
  const joinForm = document.querySelector('#joinForm');

  digits(hostCode);
  digits(joinCode);

  if (hostCode && !hostCode.value) hostCode.value = randomCode();

  hostForm?.addEventListener('submit', () => {
    if (!/^\d{4}$/.test(hostCode.value)) hostCode.value = randomCode();
  }, true);

  joinForm?.addEventListener('submit', e => {
    if (!/^\d{4}$/.test(joinCode.value)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const err = document.querySelector('#error');
      if (err) {
        err.hidden = false;
        err.textContent = 'Enter the 4-digit room code from your friend.';
      }
    }
  }, true);

  window.MidnightRoomCode = { digits: 4, randomCode };
})();
