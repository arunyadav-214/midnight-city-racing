(() => {
  if (!window.Midnight3D?.track) return;
  const track = Midnight3D.track;

  // Cleaner rectangular street circuit with longer straightaways.
  track.roads.splice(0, track.roads.length,
    {x:95,  y:472, w:825, h:150},  // long bottom straight
    {x:748, y:90,  w:150, h:532},  // long right straight
    {x:165, y:90,  w:733, h:150},  // long top straight
    {x:165, y:90,  w:150, h:532}   // long left return
  );

  track.marks.splice(0, track.marks.length,
    [125,547,895,547],
    [823,120,823,600],
    [205,165,875,165],
    [240,120,240,600]
  );

  // Reposition a few buildings so the straighter road stays clear.
  const positions = {
    AUTO:   {x:350,y:260,w:105,h:105},
    HOTEL:  {x:480,y:260,w:110,h:115},
    GARAGE: {x:620,y:260,w:95,h:155},
    PIER:   {x:365,y:390,w:120,h:72}
  };
  track.buildings.forEach(b => {
    const p = positions[b.l];
    if (p) Object.assign(b, p);
  });
})();
