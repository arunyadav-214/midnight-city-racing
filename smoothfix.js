(() => {
  if (!window.Midnight3D?.update) return;

  const originalUpdate = Midnight3D.update;
  const visual = new Map();
  let last = performance.now();

  const angleDiff = (a,b) => {
    let d = b-a;
    while (d > Math.PI) d -= Math.PI*2;
    while (d < -Math.PI) d += Math.PI*2;
    return d;
  };

  Midnight3D.update = function(world,myId){
    if (!world?.players) return originalUpdate(world,myId);
    const now = performance.now();
    const dt = Math.min(.05, Math.max(.001,(now-last)/1000));
    last = now;
    const alpha = 1 - Math.exp(-15*dt);
    const players = {};

    Object.entries(world.players).forEach(([id,p]) => {
      let v = visual.get(id);
      if (!v) {
        v = {x:p.x,y:p.y,a:p.a||0};
        visual.set(id,v);
      }
      const jump = Math.hypot((p.x||0)-v.x,(p.y||0)-v.y);
      if (jump > 140 || world.phase !== 'race') {
        v.x = p.x; v.y = p.y; v.a = p.a||0;
      } else {
        v.x += ((p.x||0)-v.x)*alpha;
        v.y += ((p.y||0)-v.y)*alpha;
        v.a += angleDiff(v.a,p.a||0)*alpha;
      }
      players[id] = {
        ...p,
        x:v.x,
        y:v.y,
        a:v.a,
        // Keep crash effects, but tone down the body/camera vibration.
        crashPower: Math.min(.42,(p.crashPower||0)*.38)
      };
    });

    [...visual.keys()].forEach(id=>{ if(!world.players[id]) visual.delete(id); });
    return originalUpdate({...world,players},myId);
  };

  window.MidnightSmooth = {build:'smooth-audio-r9'};
})();