(() => {
  const FINISH_X = 915;
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
    car.botSpeed = SPEEDS[index % SPEEDS.length];
    car.botLaneY = car.y;
  }

  function input(car){
    const laneY = Number(car.botLaneY) || car.y;
    const desired = Math.atan2(laneY - car.y, FINISH_X - car.x);
    const diff = norm(desired - car.a);
    return {
      up: true,
      down: false,
      left: diff < -0.035,
      right: diff > 0.035
    };
  }

  const name = i => `Bot ${NAMES[i % NAMES.length]}`;
  const speedFactor = car => Number(car.botSpeed) || 0.93;
  window.MidnightBots = { reset, input, name, speedFactor, waypoints:[{x:FINISH_X,y:325}] };
})();
