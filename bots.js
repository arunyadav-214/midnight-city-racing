(() => {
  const WAYPOINTS = [
    {x:820,y:547},
    {x:823,y:165},
    {x:545,y:165},
    {x:240,y:295},
    {x:240,y:547},
    {x:545,y:547}
  ];
  const NAMES = ['Nova','Blaze','Viper','Storm','Ghost'];
  const SPEEDS = [0.91,0.95,0.89,0.98,0.93];
  const norm = a => {
    while(a > Math.PI) a -= Math.PI * 2;
    while(a < -Math.PI) a += Math.PI * 2;
    return a;
  };
  function reset(car,index=0){
    car.bot = true;
    car.botIndex = index;
    car.aiWaypoint = 0;
    car.botSpeed = SPEEDS[index % SPEEDS.length];
  }
  function input(car){
    if(!Number.isInteger(car.aiWaypoint)) car.aiWaypoint = 0;
    let t = WAYPOINTS[car.aiWaypoint % WAYPOINTS.length];
    let dx=t.x-car.x, dy=t.y-car.y;
    if(Math.hypot(dx,dy) < 55){
      car.aiWaypoint = (car.aiWaypoint + 1) % WAYPOINTS.length;
      t = WAYPOINTS[car.aiWaypoint];
      dx=t.x-car.x; dy=t.y-car.y;
    }
    const desired = Math.atan2(dy,dx);
    const diff = norm(desired - car.a);
    const hard = Math.abs(diff) > 0.68;
    return {
      up: !(hard && Math.abs(car.v) > 150),
      down: hard && Math.abs(car.v) > 190,
      left: diff < -0.055,
      right: diff > 0.055
    };
  }
  const name = i => `Bot ${NAMES[i % NAMES.length]}`;
  const speedFactor = car => Number(car.botSpeed) || 0.93;
  window.MidnightBots = { reset, input, name, speedFactor, waypoints: WAYPOINTS };
})();
