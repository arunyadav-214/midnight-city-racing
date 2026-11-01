(() => {
  let ac,master,eg,eo,harm,sub,sg,noise,on=true,primed=false;

  function makeGraph(){
    if(ac)return;
    const A=window.AudioContext||window.webkitAudioContext;
    if(!A)return;
    ac=new A();
    master=ac.createGain();master.gain.value=.68;master.connect(ac.destination);

    eg=ac.createGain();eg.gain.value=.018;eg.connect(master);
    eo=ac.createOscillator();eo.type='sawtooth';eo.frequency.value=105;
    const f=ac.createBiquadFilter();f.type='lowpass';f.frequency.value=1100;f.Q.value=.7;
    eo.connect(f).connect(eg);eo.start();

    harm=ac.createOscillator();harm.type='square';harm.frequency.value=205;
    const hg=ac.createGain();hg.gain.value=.055;harm.connect(hg).connect(eg);harm.start();

    sub=ac.createOscillator();sub.type='triangle';sub.frequency.value=55;
    const g=ac.createGain();g.gain.value=.10;sub.connect(g).connect(eg);sub.start();

    const b=ac.createBuffer(1,ac.sampleRate*2,ac.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
    noise=ac.createBufferSource();noise.buffer=b;noise.loop=true;
    const bf=ac.createBiquadFilter();bf.type='bandpass';bf.frequency.value=2200;bf.Q.value=.85;
    sg=ac.createGain();sg.gain.value=0;noise.connect(bf).connect(sg).connect(master);noise.start();
  }

  function prime(){
    if(!ac||primed)return;
    try{
      const o=ac.createOscillator(),g=ac.createGain();
      g.gain.value=.00001;o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+.03);
      primed=true;
    }catch(_){ }
  }

  function init(){
    if(!on)return false;
    makeGraph();
    if(!ac)return false;
    const resume=()=>{try{prime()}catch(_){}};
    if(ac.state!=='running')ac.resume().then(resume).catch(()=>{});else resume();
    return true;
  }

  function unlock(){
    if(!on)return;
    init();
    if(ac&&ac.state!=='running')ac.resume().catch(()=>{});
  }

  ['pointerdown','touchstart','click','keydown'].forEach(type=>{
    addEventListener(type,unlock,{capture:true,passive:true});
  });
  addEventListener('pageshow',unlock,{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&on)unlock()});

  function update(me,input,phase){
    if(!me||!on)return;
    if(!ac){init();return;}
    if(ac.state!=='running')return;
    const s=Math.min(1,Math.abs(me.v)/330),t=input.up?1:0,n=ac.currentTime;
    // Keep more energy in the midrange so phone speakers can reproduce the engine.
    const f=100+s*220+t*34;
    eo.frequency.setTargetAtTime(f,n,.05);
    harm.frequency.setTargetAtTime(f*2.02,n,.055);
    sub.frequency.setTargetAtTime(Math.max(48,f*.5),n,.07);
    eg.gain.setTargetAtTime(phase==='race'?.045+s*.085:.014,n,.08);
    const sk=(input.left||input.right)&&s>.42?Math.min(.11,(s-.35)*.16):0;
    sg.gain.setTargetAtTime(sk,n,.06);
  }

  function beep(v){
    init();if(!ac||!on||ac.state!=='running')return;
    const o=ac.createOscillator(),g=ac.createGain(),now=ac.currentTime;
    o.type=v==='GO!'?'square':'sine';o.frequency.value=v==='GO!'?820:500+Number(v||0)*40;
    g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.20,now+.01);g.gain.exponentialRampToValueAtTime(.0001,now+(v==='GO!'?.30:.18));
    o.connect(g).connect(master);o.start(now);o.stop(now+.34);
  }

  function crash(power=.5){
    init();if(!ac||!on||ac.state!=='running')return;
    const p=Math.max(.2,Math.min(1,Number(power)||.5)),now=ac.currentTime;
    const hit=ac.createOscillator(),hg=ac.createGain(),hf=ac.createBiquadFilter();
    hit.type='square';hit.frequency.setValueAtTime(170+110*p,now);hit.frequency.exponentialRampToValueAtTime(58,now+.24);
    hf.type='lowpass';hf.frequency.value=900;hg.gain.setValueAtTime(.0001,now);hg.gain.exponentialRampToValueAtTime(.16+.20*p,now+.008);hg.gain.exponentialRampToValueAtTime(.0001,now+.30);
    hit.connect(hf).connect(hg).connect(master);hit.start(now);hit.stop(now+.32);

    const b=ac.createBuffer(1,Math.floor(ac.sampleRate*.26),ac.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
    const src=ac.createBufferSource(),bp=ac.createBiquadFilter(),ng=ac.createGain();src.buffer=b;bp.type='bandpass';bp.frequency.value=1050+1100*p;bp.Q.value=.6;
    ng.gain.setValueAtTime(.16+.23*p,now);ng.gain.exponentialRampToValueAtTime(.0001,now+.25);src.connect(bp).connect(ng).connect(master);src.start(now);
  }

  function stop(){if(ac&&eg)eg.gain.setTargetAtTime(.006,ac.currentTime,.08);if(ac&&sg)sg.gain.setTargetAtTime(0,ac.currentTime,.05)}
  function toggle(){
    on=!on;
    if(on){unlock();if(master&&ac)master.gain.setTargetAtTime(.68,ac.currentTime,.05)}
    else if(master&&ac)master.gain.setTargetAtTime(.0001,ac.currentTime,.04);
    return on;
  }

  window.MidnightSound={init,unlock,update,beep,crash,stop,toggle,isOn:()=>on,isReady:()=>!!ac&&ac.state==='running'};
})();