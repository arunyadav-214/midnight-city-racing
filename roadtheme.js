(() => {
  if (!window.THREE || !THREE.MeshStandardMaterial) return;
  const Original = THREE.MeshStandardMaterial;
  class MidnightMaterial extends Original {
    constructor(params = {}) {
      const p = { ...params };
      if (p.color === 0xf2f3f5) {
        p.color = 0x111318;
        p.roughness = 0.94;
        p.metalness = 0.03;
      } else if (p.color === 0x5b616a) {
        p.color = 0xf0c94f;
        p.roughness = 0.72;
      }
      super(p);
    }
  }
  THREE.MeshStandardMaterial = MidnightMaterial;
})();