(() => {
  const models = [
    {id:'vortex-r',name:'Vortex R',type:'Track supercar',paint:'#e32436',accent:'#ffd7d9',roof:1.43,roofX:-.42,hood:.84,tail:1.13,width:2.26,wheel:.48,spoiler:2,stripe:1,lightbar:0},
    {id:'bmw-m4',name:'BMW M4 Competition',type:'Twin-turbo performance coupe',paint:'#204f8c',accent:'#d6e8ff',roof:1.61,roofX:-.50,hood:1.02,tail:1.06,width:2.19,wheel:.49,spoiler:0,stripe:0,lightbar:0},
    {id:'neon-x',name:'Neon X',type:'Electric supercar',paint:'#10a8d5',accent:'#b1f0ff',roof:1.38,roofX:-.12,hood:.81,tail:.89,width:2.17,wheel:.43,spoiler:0,stripe:0,lightbar:1},
    {id:'shadow-rs',name:'Shadow RS',type:'Stealth sports coupe',paint:'#68728c',accent:'#e3eaff',roof:1.47,roofX:-.48,hood:.92,tail:.99,width:2.14,wheel:.47,spoiler:1,stripe:0,lightbar:1},
    {id:'apex-z',name:'Apex Z',type:'Exotic hypercar',paint:'#35c47d',accent:'#e4ffe9',roof:1.28,roofX:-.13,hood:.78,tail:.95,width:2.29,wheel:.44,spoiler:1,stripe:1,lightbar:0},
    {id:'titan-s',name:'Titan S',type:'Muscle sport',paint:'#d5dce8',accent:'#ffd2a0',roof:1.71,roofX:-.50,hood:1.05,tail:1.13,width:2.22,wheel:.50,spoiler:0,stripe:1,lightbar:0}
  ];
  const byId = Object.fromEntries(models.map(m => [m.id,m]));
  const safe = id => byId[id] ? id : models[0].id;
  let selected = models[0].id;
  try { selected = safe(localStorage.getItem('mcr-car-r26') || localStorage.getItem('mcr-car-r25') || localStorage.getItem('mcr-car-r24')); } catch (_) {}
  const get = id => byId[safe(id)];
  const label = id => get(id).name;
  const selectedCar = () => selected;
  window.MidnightGarage = {build:'bmw-r26',models,get,label,selectedCar};

  const panel = document.querySelector('#home .modeTabs');
  if (!panel) return;

  function preview(m) {
    // Detailed vector showroom thumbnail: highlights, vents, windscreen, alloy spokes.
    const roofY = Math.round(47 - (m.roof - 1.25) * 18);
    const tailY = m.tail > 1.07 ? 52 : 56;
    const roofBack = m.roofX < -.35 ? 77 : 87;
    const roofFront = roofBack + 53;
    const body = 'M12 73 L15 ' + tailY + ' L46 49 L' + (roofBack-12) +
      ' 50 L' + roofBack + ' ' + roofY + ' L' + roofFront + ' ' + (roofY+1) +
      ' L159 49 L185 54 Q205 59 205 69 L201 77 L14 77 Z';
    const stripe=m.stripe?'<path d="M63 56 L171 56" stroke="'+m.accent+'" stroke-width="2" opacity=".7"/>':'';
    const wing=m.spoiler?'<path d="M17 53 L15 45 L51 45" stroke="#c7d6e3" stroke-width="3" fill="none"/>':'';
    const id=m.id;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 100" role="img" aria-label="'+m.name+' realistic sport coupe profile">'+
      '<defs>'+
      '<linearGradient id="body-'+id+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="'+m.accent+'"/><stop offset=".35" stop-color="'+m.paint+'"/><stop offset="1" stop-color="#121b29"/></linearGradient>'+
      '<linearGradient id="glass-'+id+'" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#718da4"/><stop offset=".45" stop-color="#1a3448"/><stop offset="1" stop-color="#07121e"/></linearGradient>'+
      '</defs>'+
      '<ellipse cx="108" cy="85" rx="94" ry="7" fill="#000" opacity=".44"/>'+
      wing+'<path d="'+body+'" fill="url(#body-'+id+')" stroke="'+m.accent+'" stroke-width="1.15" stroke-linejoin="round"/>'+
      '<path d="M'+(roofBack+4)+' '+(roofY+3)+' L'+(roofFront-4)+' '+(roofY+4)+' L154 51 L68 51 Z" fill="url(#glass-'+id+')" stroke="#a5c2d0" stroke-width="1.2"/>'+
      '<path d="M'+roofBack+' '+roofY+' L'+roofFront+' '+(roofY+1)+'" stroke="'+m.accent+'" stroke-width="3" fill="none"/>'+
      '<path d="M109 '+(roofY+3)+' L111 51" stroke="#c5dce6" opacity=".75" stroke-width="1.3"/>'+
      '<path d="M22 65 L191 65" stroke="#0b1d2d" opacity=".85" stroke-width="2"/>'+
      '<path d="M105 54 L107 70" stroke="#162738" stroke-width=".8" opacity=".5"/>'+
      '<path d="M129 56 L142 56" stroke="#09121c" stroke-width="2" opacity=".55"/>'+
      stripe+'<path d="M170 62 L194 62" stroke="#0b1a23" stroke-width="3"/>'+
      '<path d="M34 58 L51 58" stroke="#081822" stroke-width="3" opacity=".7"/>'+
      '<rect x="198" y="63" width="8" height="4" rx="1" fill="#d8fcff"/><rect x="12" y="64" width="7" height="4" rx="1" fill="#ff5369"/>'+
      '<circle cx="56" cy="76" r="15" fill="#070c14" stroke="#202d39" stroke-width="4"/>'+
      '<circle cx="169" cy="76" r="15" fill="#070c14" stroke="#202d39" stroke-width="4"/>'+
      '<circle cx="56" cy="76" r="9.5" fill="#adbbc5" stroke="#e3edf4" stroke-width="1.5"/>'+
      '<circle cx="169" cy="76" r="9.5" fill="#adbbc5" stroke="#e3edf4" stroke-width="1.5"/>'+
      [0,60,120].map(deg=>'<path d="M'+(56-8*Math.cos(deg*Math.PI/180)).toFixed(1)+' '+(76-8*Math.sin(deg*Math.PI/180)).toFixed(1)+' L'+(56+8*Math.cos(deg*Math.PI/180)).toFixed(1)+' '+(76+8*Math.sin(deg*Math.PI/180)).toFixed(1)+' M'+(169-8*Math.cos(deg*Math.PI/180)).toFixed(1)+' '+(76-8*Math.sin(deg*Math.PI/180)).toFixed(1)+' L'+(169+8*Math.cos(deg*Math.PI/180)).toFixed(1)+' '+(76+8*Math.sin(deg*Math.PI/180)).toFixed(1)+'" stroke="#43596b" stroke-width="2"/>').join('')+
      '<circle cx="56" cy="76" r="3.2" fill="#e8f0f6"/><circle cx="169" cy="76" r="3.2" fill="#e8f0f6"/>'+
      '<path d="M34 55 L169 52" stroke="#fff" stroke-width="1.2" opacity=".23"/>'+
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
    try { localStorage.setItem('mcr-car-r26',selected); } catch (_) {}
    paintSelection();
  });
  paintSelection();
})();
