(() => {
  'use strict';
  // Host-authoritative moving traffic. Guests receive the same world.traffic snapshots
  // through the existing r22 world messages; no new networking transport is needed.
  const COUNTS={light:10,medium:18,heavy:26};
  const LABELS={light:'Light',medium:'Medium',heavy:'Heavy'};
  const KINDS=['sedan','suv','sedan','taxi','sedan','truck','suv','sedan'];
  const COLORS=['#e6eef5','#293f64','#b5b9c3','#9e3135','#37434d','#d4c6b8','#6e99a7','#5b6978'];
  const lanes=()=>window.Midnight3D?.track?.trafficLaneCenters||[185,225,265,305,345,385,425,465];
  let passes=new Set();
  const norm=level=>Object.hasOwn(COUNTS,level)?level:'medium';
  const count=level=>COUNTS[norm(level)];
  const label=level=>LABELS[norm(level)];
  function newTraffic(level='medium'){
    passes=new Set();
    const n=count(level),ys=lanes(),start=window.Midnight3D?.track?.startX||115;
    const result=[];
    let x=start+510;
    for(let i=0;i<n;i++){
      const kind=KINDS[(i*5+i%3)%KINDS.length];
      x+=240+(i%4)*50+Math.random()*170;
      result.push({
        id:'t'+i,x:Math.round(x),y:ys[(i*3+Math.floor(i/4))%ys.length],
        v:kind==='truck'?95+Math.random()*28:kind==='taxi'?150+Math.random()*40:120+Math.random()*65,
        kind,color:COLORS[(i*7+i%3)%COLORS.length],round:0
      });
    }
    return result;
  }
  function update(world,dt){
    if(!world?.traffic?.length||world.phase!=='race')return;
    const raceCars=Object.values(world.players||{});
    const lead=Math.max(window.Midnight3D?.track?.startX||115,...raceCars.map(p=>p.x||0));
    const rear=lead-1050;
    let farthest=Math.max(lead+950,...world.traffic.map(t=>t.x));
    const ys=lanes();
    for(const t of world.traffic){
      t.x+=t.v*dt;
      if(t.x<rear){
        // Recycle behind-traffic ahead of the race leader, maintaining a shared road.
        t.round=(t.round||0)+1;
        t.x=Math.max(farthest+175,lead+780)+130+Math.random()*260;
        t.y=ys[(Number(t.id.slice(1))+t.round*3)%ys.length];
        farthest=t.x;
      }
    }
  }
  function collide(world){
    if(!world?.traffic?.length||world.phase!=='race')return;
    const now=Date.now();
    for(const p of Object.values(world.players||{})){
      if(p.done||now<(p.trafficHitUntil||0)||now<(p.boostUntil||0))continue;
      for(const t of world.traffic){
        const distanceX=t.kind==='truck'?48:33;
        if(Math.abs(p.x-t.x)<distanceX&&Math.abs(p.y-t.y)<18){
          // A real penalty, with a short grace period to prevent repeat hits.
          p.x=Math.min(p.x,t.x-(distanceX+4));
          p.v=Math.min(Math.max(0,p.v*.24),Math.max(24,t.v*.55));
          p.a=Math.max(-.30,Math.min(.30,(p.a||0)+((p.y>=t.y)?1:-1)*.07));
          p.crashPower=.76;p.crashUntil=now+820;
          p.crashSeq=(p.crashSeq||0)+1;
          p.trafficHits=(p.trafficHits||0)+1;
          p.trafficHitUntil=now+1050;
          break;
        }
      }
    }
  }
  function countOvertakes(world,previousCars,previousTraffic){
    if(!world?.traffic?.length||world.phase!=='race')return;
    const now=Date.now();
    for(const p of Object.values(world.players||{})){
      if(p.done||now<(p.trafficHitUntil||0))continue;
      for(const t of world.traffic){
        const prev=previousCars[p.id],oldT=previousTraffic[t.id];
        if(prev==null||oldT==null)continue;
        const key=p.id+':'+t.id+':'+t.round;
        if(!passes.has(key)&&prev<=oldT+33&&p.x>t.x+33&&Math.abs(p.y-t.y)<74){
          passes.add(key);p.overtakes=(p.overtakes||0)+1;
        }
      }
    }
  }
  window.MidnightTraffic={build:'traffic-r28',newTraffic,update,collide,countOvertakes,count,label,norm,lanes};
})();
