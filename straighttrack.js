(() => {
  if (!window.Midnight3D?.track) return;
  const track = Midnight3D.track;

  // About 1 minute 30 seconds at full racing speed: one road, zero turns.
  track.startX = 115;
  track.finishX = 30000;
  track.roadMinY = 205;
  track.roadMaxY = 445;

  track.roads.splice(0, track.roads.length,
    {x:60, y:205, w:30020, h:240}
  );

  // Lane guides are rendered efficiently by scene3d.js from these y positions.
  track.laneYs = [245,285,325,365,405];
  track.marks.splice(0, track.marks.length);

  // Keep the named colorful buildings near the start; scene3d adds a repeating
  // colorful city corridor farther down the highway.
  const positions = {
    MALL:    {x:70, y:35,  w:125, h:130},
    CLUB:    {x:235,y:35,  w:110, h:130},
    AUTO:    {x:390,y:30,  w:110, h:120},
    HOTEL:   {x:555,y:30,  w:120, h:125},
    GARAGE:  {x:735,y:35,  w:110, h:130},
    PIER:    {x:230,y:485, w:145, h:90},
    DOCK:    {x:610,y:485, w:140, h:90}
  };
  track.buildings.forEach(b => {
    const p = positions[b.l];
    if (p) Object.assign(b, p);
  });
})();