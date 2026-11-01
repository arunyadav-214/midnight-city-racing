(() => {
  if (!window.THREE || !THREE.MeshStandardMaterial) return;
  const Base = THREE.MeshStandardMaterial;
  const palette = [0xff7b72,0x4cc9f0,0xffc857,0x7bd389,0xb794f4,0xff8fab,0x72ddf7,0xf4a261];
  let buildingIndex = 0;
  class ColorCityMaterial extends Base {
    constructor(params = {}) {
      const p = { ...params };
      const isBuildingShell = p.roughness === 0.72 && p.metalness === 0.08 && [0xf8f8f8,0xe9ebee,0xffffff,0xdfe3e7].includes(p.color);
      if (isBuildingShell) {
        p.color = palette[buildingIndex % palette.length];
        p.roughness = 0.68;
        p.metalness = 0.08;
        buildingIndex++;
      }
      super(p);
    }
  }
  THREE.MeshStandardMaterial = ColorCityMaterial;
})();
