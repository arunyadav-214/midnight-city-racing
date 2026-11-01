(() => {
  if (!window.Midnight3D?.track) return;
  const track = Midnight3D.track;

  // One long, wide straight road from START to FINISH. No turns.
  track.roads.splice(0, track.roads.length,
    {x:60, y:205, w:880, h:240}
  );

  // Long lane guides across the straight.
  track.marks.splice(0, track.marks.length,
    [80,245,925,245],
    [80,285,925,285],
    [80,325,925,325],
    [80,365,925,365],
    [80,405,925,405]
  );

  // Put the colorful buildings along the roadside, never on the track.
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
