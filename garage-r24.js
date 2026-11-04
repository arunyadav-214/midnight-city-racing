(() => {
  const models = [
    {id:'falcon-gt',name:'Falcon GT',type:'Grand tourer',paint:'#f6b83b',accent:'#fff0a2',roof:1.62,roofX:-.35,hood:.93,tail:1.04,width:2.08,wheel:.46,spoiler:0,stripe:1,lightbar:0},
    {id:'neon-x',name:'Neon X',type:'Electric supercar',paint:'#23c9ed',accent:'#a7f5ff',roof:1.37,roofX:-.12,hood:.80,tail:.88,width:2.18,wheel:.42,spoiler:0,stripe:0,lightbar:1},
    {id:'vortex-r',name:'Vortex R',type:'Track racer',paint:'#fa4f64',accent:'#ffdada',roof:1.44,roofX:-.45,hood:.84,tail:1.12,width:2.22,wheel:.48,spoiler:2,stripe:1,lightbar:0},
    {id:'shadow-rs',name:'Shadow RS',type:'Stealth coupe',paint:'#777e9d',accent:'#e5e9ff',roof:1.46,roofX:-.50,hood:.92,tail:.98,width:2.13,wheel:.46,spoiler:1,stripe:0,lightbar:1},
    {id:'apex-z',name:'Apex Z',type:'Exotic hypercar',paint:'#77eaa3',accent:'#dbffe7',roof:1.27,roofX:-.15,hood:.76,tail:.95,width:2.27,wheel:.43,spoiler:1,stripe:1,lightbar:0},
    {id:'titan-s',name:'Titan S',type:'Muscle sport',paint:'#e5e9f2',accent:'#ffb158',roof:1.72,roofX:-.52,hood:1.04,tail:1.14,width:2.20,wheel:.51,spoiler:0,stripe:1,lightbar:0}
  ];
  const byId = Object.fromEntries(models.map(m => [m.id,m]));
  const safe = id => byId[id] ? id : models[0].id;
  let selected = models[0].id;
  try { selected = safe(localStorage.getItem('mcr-car-r24')); } catch (_) {}
  const get = id => byId[safe(id)];
  const label = id => get(id).name;
  const selectedCar = () => selected;
  window.MidnightGarage = {build:'sports-r24',models,get,label,selectedCar};

  const panel = document.querySelector('#home .modeTabs');
  if (!panel) return;

  function preview(m) {
    const roofY = Math.round(53 - (m.roof - 1.25) * 26);
    const rearY = m.tail > 1.08 ? 51 : 55;
    return '<svg viewBox="0 0 210 100" role="img" aria-label="' + m.name + ' side-profile illustration" xmlns="http://www.w3.org/2000/svg">' +
      '<defs><linearGradient id="paint-' + m.id + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="' + m.accent + '"/><stop offset="35%" stop-color="' + m.paint + '"/><stop offset="100%" stop-color="#182332"/></linearGradient></defs>' +
      '<ellipse cx="108" cy="83" rx="92" ry="8" fill="#020812" opacity=".55"/>' +
      '<path d="M14 71 L19 ' + rearY + ' L54 48 L77 ' + roofY + ' L135 ' + (roofY+1) + ' L163 51 L195 60 L201 72 L191 78 L24 78 Z" fill="url(#paint-' + m.id + ')" stroke="' + m.accent + '" stroke-width="1.1"/>' +
      '<path d="M80 ' + (roofY+3) + ' L132 ' + (roofY+4) + ' L154 52 L75 52 Z" fill="#0b2336" stroke="#b4d1df" stroke-width="1.5" opacity=".9"/>' +
      '<path d="M25 68 H190" stroke="' + m.accent + '" stroke-width="2" opacity=".65"/>' +
      (m.stripe ? '<path d="M58 56 H174" stroke="' + m.accent + '" stroke-width="2" opacity=".8"/>' : '') +
      (m.spoiler ? '<path d="M20 51 L20 44 L48 44" stroke="' + m.accent + '" stroke-width="3" fill="none"/>' : '') +
      '<rect x="193" y="61" width="7" height="5" rx="2" fill="#c9fcff"/><rect x="15" y="64" width="5" height="5" rx="2" fill="#ff6476"/>' +
      '<circle cx="55" cy="77" r="15" fill="#070b11" stroke="#485569" stroke-width="4"/><circle cx="55" cy="77" r="7" fill="#dbe8f3"/>' +
      '<circle cx="160" cy="77" r="15" fill="#070b11" stroke="#485569" stroke-width="4"/><circle cx="160" cy="77" r="7" fill="#dbe8f3"/>' +
      '</svg>';
  }

  const section = document.createElement('section');
  section.className = 'sportsGarage';
  section.setAttribute('aria-label','Choose your sports car');
  section.innerHTML = '<div class="garageHeading"><div><strong>CHOOSE YOUR SPORTS CAR</strong><small>6 models · equal performance in online races</small></div><span class="garageChoice" id="garageChoice"></span></div>' +
    '<div class="garageCards" role="group" aria-label="Available cars">' +
    models.map(m => '<button type="button" class="garageCard" data-car="' + m.id + '" aria-pressed="false">' +
      '<span class="garagePreview">' + preview(m) + '</span>' +
      '<span class="garageName">' + m.name + '</span><span class="garageType">' + m.type + '</span>' +
      '<span class="garageSelected">SELECTED ✓</span></button>').join('') + '</div>';
  panel.insertAdjacentElement('afterend',section);

  function paintSelection() {
    section.querySelectorAll('[data-car]').forEach(b => {
      const chosen = b.dataset.car === selected;
      b.classList.toggle('selected',chosen);
      b.setAttribute('aria-pressed',String(chosen));
      b.querySelector('.garageSelected').textContent = chosen ? 'SELECTED ✓' : 'SELECT';
    });
    const choice = section.querySelector('#garageChoice');
    if (choice) choice.textContent = label(selected);
  }
  section.addEventListener('click',e => {
    const btn = e.target.closest('[data-car]');
    if (!btn) return;
    selected = safe(btn.dataset.car);
    try { localStorage.setItem('mcr-car-r24',selected); } catch (_) {}
    paintSelection();
  });
  paintSelection();
})();
