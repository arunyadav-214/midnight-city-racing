(() => {
  const S=.11, T={roads:[
    {x:120,y:500,w:760,h:92},{x:790,y:210,w:92,h:382},{x:500,y:130,w:382,h:92},
    {x:500,y:130,w:92,h:220},{x:220,y:260,w:372,h:92},{x:220,y:260,w:92,h:302}],
    buildings:[
      {x:58,y:70,w:130,h:160,l:'MALL'},{x:72,y:270,w:110,h:140,l:'CLUB'},
      {x:344,y:88,w:110,h:110,l:'AUTO'},{x:635,y:82,w:130,h:110,l:'HOTEL'},
      {x:635,y:256,w:110,h:180,l:'GARAGE'},{x:342,y:390,w:155,h:90,l:'PIER'},
      {x:80,y:515,w:120,h:84,l:'DOCK'}],
    marks:[[160,546,840,546],[836,240,836,558],[540,176,842,176],[546,176,546,306],[260,306,548,306],[266,304,266,528]]};
  let r,sc,cam,cars={},look,ready=false,canvas;
  const wp=(x,y)=>new THREE.Vector3((x-500)*S,0,(y-325)*S);
  const mat=(c,rough=.8,metal=.05,em=0)=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,emissive:em,emissiveIntensity:em?1.8:0});

  function road(){
    const asphalt=mat(0x252a31,.93), curb=mat(0x69727d,.88,.15), line=mat(0xe3bf45,.7,.05,0x382b00);
    T.roads.forEach(q=>{
      const p=wp(q.x+q.w/2,q.y+q.h/2),m=new THREE.Mesh(new THREE.PlaneGeometry(q.w*S,q.h*S),asphalt);
      m.rotation.x=-Math.PI/2;m.position.set(p.x,.015,p.z);m.receiveShadow=true;sc.add(m);
      const hor=q.w>q.h;
      [-1,1].forEach(s=>{const c=new THREE.Mesh(hor?new THREE.BoxGeometry(q.w*S,.18,.18):new THREE.BoxGeometry(.18,.18,q.h*S),curb);c.position.set(p.x+(hor?0:s*(q.w*S/2+.09)),.09,p.z+(hor?s*(q.h*S/2+.09):0));c.castShadow=c.receiveShadow=true;sc.add(c)});
    });
    T.marks.forEach(([x1,y1,x2,y2])=>{const a=wp(x1,y1),b=wp(x2,y2),dx=b.x-a.x,dz=b.z-a.z,n=Math.max(1,Math.floor(Math.hypot(dx,dz)/3.4));for(let i=0;i<n;i+=2){const t=(i+.5)/n,m=new THREE.Mesh(new THREE.BoxGeometry(1.7,.04,.12),line);m.position.set(a.x+dx*t,.05,a.z+dz*t);m.rotation.y=-Math.atan2(dz,dx);sc.add(m)}});
    const st=wp(505,546);for(let i=-4;i<=4;i++)for(let j=-2;j<=2;j++){const m=new THREE.Mesh(new THREE.BoxGeometry(.55,.04,.55),mat((i+j)%2?0xf5f5f5:0x111318,.7));m.position.set(st.x+i*.55,.055,st.z+j*.55);sc.add(m)}
  }

  function building(b,i,outer=false){
    const p=wp(b.x+b.w/2,b.y+b.h/2),w=Math.max(5,b.w*S*.82),d=Math.max(5,b.h*S*.82),h=outer?12+(i%5)*3:8+(i%4)*3.4;
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat([0x151c27,0x1a2230,0x111927,0x202634][i%4],.82,.08));m.position.set(p.x,h/2,p.z);m.castShadow=m.receiveShadow=true;sc.add(m);
    const wm=mat(0xffd88a,.45,.05,0xffa62a),floors=Math.min(6,Math.max(2,Math.floor(h/2.5))),cols=Math.min(7,Math.max(2,Math.floor(w/2.1)));
    for(let f=0;f<floors;f++)for(let c=0;c<cols;c++){if((f+c+i)%3===0)continue;const z=new THREE.Mesh(new THREE.PlaneGeometry(.5,.68),wm);z.position.set(p.x-w/2+.9+c*((w-1.8)/Math.max(1,cols-1)),1.5+f*2,p.z+d/2+.011);sc.add(z)}
    if(b.l){const sm=mat(i%2?0x31d8ff:0xff3f8d,.4,.1,i%2?0x056f80:0x8f073b),s=new THREE.Mesh(new THREE.BoxGeometry(Math.min(w*.65,5),.5,.12),sm);s.position.set(p.x,Math.min(h-1.2,4.2),p.z+d/2+.08);sc.add(s)}
  }

  function city(){
    T.buildings.forEach(building);
    [{x:-140,y:20,w:120,h:130},{x:980,y:20,w:130,h:150},{x:-150,y:440,w:130,h:150},{x:980,y:440,w:120,h:150},{x:170,y:-150,w:135,h:130},{x:720,y:-160,w:160,h:140},{x:350,y:680,w:140,h:120},{x:690,y:690,w:160,h:120}].forEach((b,i)=>building(b,i+8,true));
    const pm=mat(0x4b5562,.4,.65),bm=mat(0xffe2a3,.4,.1,0xffb52f),pts=[[155,482],[350,482],[660,482],[895,470],[895,300],[770,112],[570,112],[475,235],[420,370],[205,390],[205,510]];
    pts.forEach(([x,y],i)=>{const p=wp(x,y),pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,4.2,8),pm);pole.position.set(p.x,2.1,p.z);sc.add(pole);const b=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),bm);b.position.set(p.x,4.15,p.z);sc.add(b);if(i%2===0){const l=new THREE.PointLight(0xffc66b,18,16,2);l.position.set(p.x,4,p.z);sc.add(l)}});
  }

  function car(color){
    const g=new THREE.Group(),body=mat(color,.26,.62),dark=mat(0x071018,.25,.55),glass=new THREE.MeshStandardMaterial({color:0x0b2031,metalness:.45,roughness:.12,transparent:true,opacity:.86}),tire=mat(0x050607,.95),rim=mat(0xb9c1ca,.2,.9);
    const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
    add(new THREE.BoxGeometry(4.3,.65,1.9),body,0,.72,0);add(new THREE.BoxGeometry(1.55,.34,1.82),body,1.25,1.05,0);add(new THREE.BoxGeometry(1.7,.82,1.55),glass,-.35,1.31,0);add(new THREE.BoxGeometry(.95,.3,1.8),body,-1.55,1,0);add(new THREE.BoxGeometry(.22,.16,2),dark,2.22,.47,0);add(new THREE.BoxGeometry(.22,.12,2.1),dark,-2.1,1.45,0);
    [-.72,.72].forEach(z=>add(new THREE.BoxGeometry(.12,.55,.12),dark,-1.92,1.19,z));
    [-1.35,1.35].forEach(x=>[-1.04,1.04].forEach(z=>{const w=add(new THREE.CylinderGeometry(.44,.44,.36,18),tire,x,.5,z);w.rotation.x=Math.PI/2;const rr=add(new THREE.CylinderGeometry(.23,.23,.38,16),rim,x,.5,z*1.015);rr.rotation.x=Math.PI/2}));
    const hm=mat(0xffffff,.35,.1,0xaee3ff),tm=mat(0xff3344,.4,.05,0xff0018);[-.62,.62].forEach(z=>{add(new THREE.BoxGeometry(.08,.22,.38),hm,2.18,.82,z);add(new THREE.BoxGeometry(.08,.22,.42),tm,-2.18,.82,z)});
    const beam=new THREE.SpotLight(0xcdeaff,30,32,Math.PI/8,.45,1.5);beam.position.set(2,.95,0);beam.target.position.set(12,.3,0);g.add(beam,beam.target);return g;
  }

  function stars(){const n=220,g=new THREE.BufferGeometry(),p=new Float32Array(n*3);for(let i=0;i<n;i++){const rr=80+Math.random()*80,a=Math.random()*Math.PI*2;p[i*3]=Math.cos(a)*rr;p[i*3+1]=25+Math.random()*65;p[i*3+2]=Math.sin(a)*rr}g.setAttribute('position',new THREE.BufferAttribute(p,3));sc.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xcbdcff,size:.2,transparent:true,opacity:.75})))}

  function resize(){if(!r)return;const b=canvas.getBoundingClientRect(),w=Math.max(320,b.width|0),h=Math.max(240,b.height|0);r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
  function init(c){if(ready)return true;canvas=c;if(typeof THREE==='undefined')return false;r=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.05;sc=new THREE.Scene();sc.background=new THREE.Color(0x06101a);sc.fog=new THREE.Fog(0x06101a,42,145);cam=new THREE.PerspectiveCamera(65,16/9,.1,260);cam.position.set(0,8,14);look=new THREE.Vector3();sc.add(new THREE.HemisphereLight(0x6f9dcc,0x121316,1.35));const moon=new THREE.DirectionalLight(0xc8dbff,2.2);moon.position.set(-30,55,20);moon.castShadow=true;moon.shadow.mapSize.set(1024,1024);moon.shadow.camera.left=-70;moon.shadow.camera.right=70;moon.shadow.camera.top=70;moon.shadow.camera.bottom=-70;sc.add(moon);const grd=new THREE.Mesh(new THREE.PlaneGeometry(150,115),mat(0x0b1714,1));grd.rotation.x=-Math.PI/2;grd.position.y=-.06;grd.receiveShadow=true;sc.add(grd);road();city();stars();cars.p1=car(0xffd23f);cars.p2=car(0x45d6ff);sc.add(cars.p1,cars.p2);addEventListener('resize',resize);resize();ready=true;return true}
  function update(world,myId){if(!ready||!world)return;[['p1',world.p1],['p2',world.p2]].forEach(([id,s])=>{const m=cars[id],p=wp(s.x,s.y);m.position.set(p.x,.05,p.z);m.rotation.y=-s.a});const me=myId==='p2'?world.p2:world.p1,p=wp(me.x,me.y),d=new THREE.Vector3(Math.cos(me.a),0,Math.sin(me.a)),f=Math.min(1,Math.abs(me.v)/330),tc=new THREE.Vector3(p.x-d.x*(8.8+f*2.7),4.4+f,p.z-d.z*(8.8+f*2.7));cam.position.lerp(tc,.085);look.lerp(new THREE.Vector3(p.x+d.x*4,1.1,p.z+d.z*4),.13);cam.lookAt(look);cam.fov=65+f*7;cam.updateProjectionMatrix();resize();r.render(sc,cam)}
  window.Midnight3D={init,update,track:T,scale:S};
})();