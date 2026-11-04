(() => {
  const NAMES=['Nova','Blaze','Viper','Storm','Ghost'];
  const SPEEDS=[.91,.95,.89,.98,.93];
  const norm=a=>{while(a>Math.PI)a-=Math.PI*2;while(a< -Math.PI)a+=Math.PI*2;return a;};
  const lanes=()=>window.Midnight3D?.track?.trafficLaneCenters||[185,225,265,305,345,385,425,465];
  function reset(car,index=0){
    car.bot=true;car.botIndex=index;
    car.botSpeed=SPEEDS[index%SPEEDS.length];
    car.botLaneY=car.y;
  }
  function input(car,world){
    const all=lanes(),traffic=world?.traffic||[];
    let target=Number(car.botLaneY)||car.y;
    // Bots choose a nearby empty lane when a slower traffic car blocks their route.
    const blocker=traffic.find(t=>t.x>car.x+25&&t.x<car.x+350&&Math.abs(t.y-target)<17);
    if(blocker){
      const index=all.reduce((best,y,i)=>Math.abs(y-target)<Math.abs(all[best]-target)?i:best,0);
      const possible=[index+((car.botIndex||0)%2?1:-1),index+((car.botIndex||0)%2?-1:1)]
        .filter(i=>i>=0&&i<all.length);
      const free=possible.find(i=>{
        const y=all[i];
        return !traffic.some(t=>Math.abs(t.y-y)<20&&t.x>car.x-100&&t.x<car.x+420)
          &&!Object.values(world?.players||{}).some(p=>p.id!==car.id&&Math.abs(p.y-y)<23&&Math.abs(p.x-car.x)<105);
      });
      if(free!==undefined){target=all[free];car.botLaneY=target;}
    }
    const error=target-car.y;
    const desired=Math.max(-.30,Math.min(.30,Math.atan2(error,230)));
    const diff=norm(desired-car.a);
    return{up:true,down:false,left:diff<-.025,right:diff>.025};
  }
  const name=i=>'Bot '+NAMES[i%NAMES.length];
  const speedFactor=car=>Number(car.botSpeed)||.93;
  window.MidnightBots={reset,input,name,speedFactor};
})();
