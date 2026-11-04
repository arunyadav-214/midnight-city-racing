(() => {
  if (!window.Midnight3D?.track) return;
  const track = Midnight3D.track;

  // About 1 minute 30 seconds at full racing speed: one road, zero turns.
  track.startX = 115;
  track.finishX = 30000;
  track.roadMinY = 165;
  track.roadMaxY = 485;

  track.roads.splice(0, track.roads.length,
    {x:60, y:165, w:30020, h:320}
  );

  // Lane guides are rendered efficiently by scene3d.js from these y positions.
  // Eight equal one-way lanes: 40 world units across a 320-unit road.
  track.laneYs = [205,245,285,325,365,405,445];
  track.trafficLaneCenters = [185,225,265,305,345,385,425,465];
  track.trafficLaneCount = 8;
  track.marks.splice(0, track.marks.length);

  // Keep the named colorful buildings near the start; scene3d adds a repeating
  // colorful city corridor farther down the highway.
  const positions = {
    MALL:    {x:70, y:10,  w:125, h:130},
    CLUB:    {x:235,y:10,  w:110, h:130},
    AUTO:    {x:390,y:7,   w:110, h:120},
    HOTEL:   {x:555,y:8,   w:120, h:125},
    GARAGE:  {x:735,y:10,  w:110, h:130},
    PIER:    {x:230,y:530, w:145, h:90},
    DOCK:    {x:610,y:530, w:140, h:90}
  };
  track.buildings.forEach(b => {
    const p = positions[b.l];
    if (p) Object.assign(b, p);
  });
})();