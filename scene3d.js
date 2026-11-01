(() => {
  const S=.11;
  const T={
    roads:[{x:60,y:205,w:880,h:240}],
    buildings:[
      {x:70,y:35,w:125,h:130,l:'MALL'},
      {x:235,y:35,w:110,h:130,l:'CLUB'},
      {x:390,y:30,w:110,h:120,l:'AUTO'},
      {x:555,y:30,w:120,h:125,l:'HOTEL'},
      {x:735,y:35,w:110,h:130,l:'GARAGE'},
      {x:230,y:485,w:145,h:90,l:'PIER'},
      {x:610,y:485,w:140,h:90,l:'DOCK'}
    ],
    marks:[
      [80,245,925,245],[80,285,925,285],[80,325,925,325],
      [80,365,925,365],[80,405,925,405]
    ]
  };

  const COLORS={p1:'#ffd23f',p2:'#45d6ff',p3:'#ff5f7e',p4:'#70ff9c',p5:'#c58cff',p6:'#ff9b45'};
  let r,sc,cam,cars={},look,ready=false,canvas;
  const wp=(x,y)=>new THREE.Vector3((x-500)*S,0,(y-325)*S);
  const mat=(c,rough=.8,metal=.05,em=0)=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,emissive:em,emissiveIntensity:em?1.5:0});

  function checkerLine(x){
    const st=wp(x,325);
    for(let i=-1;i<=1;i++)for(let j=-12;j<=12;j++){
      const m=new THREE.Mesh(new THREE.BoxGeometry(.52,.04,.52),mat((i+j)%2?0xffffff:0x20242a,.75));
      m.position.set(st.x+i*.52,.055,st.z+j*.52);sc.add(m);
    }
  }

  function road(){
    const asphalt=mat(0xf2f3f5,.92,.03),curb=mat(0xd4d7dc,.85,.08),line=mat(0x5b616a,.75,.03);
    T.roads.forEach(q=>{
      const p=wp(q.x+q.w/2,q.y+q.h/2),m=new THREE.Mesh(new THREE.PlaneGeometry(q.w*S,q.h*S),asphalt);
      m.rotation.x=-Math.PI/2;m.position.set(p.x,.015,p.z);m.receiveShadow=true;sc.add(m);
      const hor=q.w>q.h;
      [-1,1].forEach(s=>{
        const c=new THREE.Mesh(hor?new THREE.BoxGeometry(q.w*S,.16,.22):new THREE.BoxGeometry(.22,.16,q.h*S),curb);
        c.position.set(p.x+(hor?0:s*(q.w*S/2+.11)),.08,p.z+(hor?s*(q.h*S/2+.11):0));c.castShadow=c.receiveShadow=true;sc.add(c);
      });
    });
    T.marks.forEach(([x1,y1,x2,y2])=>{
      const a=wp(x1,y1),b=wp(x2,y2),dx=b.x-a.x,dz=b.z-a.z,n=Math.max(1,Math.floor(Math.hypot(dx,dz)/3.6));
      for(let i=0;i<n;i+=2){
        const t=(i+.5)/n,m=new THREE.Mesh(new THREE.BoxGeometry(1.9,.035,.11),line);
        m.position.set(a.x+dx*t,.045,a.z+dz*t);m.rotation.y=-Math.atan2(dz,dx);sc.add(m);
      }
    });
    checkerLine(115);
    checkerLine(900);
  }

  function building(b,i,outer=false){
    const p=wp(b.x+b.w/2,b.y+b.h/2),w=Math.max(5,b.w*S*.8),d=Math.max(5,b.h*S*.8),h=outer?11+(i%5)*3:8+(i%4)*3;
    const shell=mat([0xf8f8f8,0xe9ebee,0xffffff,0xdfe3e7][i%4],.72,.08);
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),shell);m.position.set(p.x,h/2,p.z);m.castShadow=m.receiveShadow=true;sc.add(m);
    const wm=mat(0xd9eefc,.38,.08,0x6bbcff),floors=Math.min(6,Math.max(2,Math.floor(h/2.5))),cols=Math.min(7,Math.max(2,Math.floor(w/2.1)));
    for(let f=0;f<floors;f++)for(let c=0;c<cols;c++){
      if((f+c+i)%3===0)continue;
      const z=new THREE.Mesh(new THREE.PlaneGeometry(.5,.68),wm);
      z.position.set(p.x-w/2+.9+c*((w-1.8)/Math.max(1,cols-1)),1.5+f*2,p.z+d/2+.011);sc.add(z);
    }
    if(b.l){
      const sm=mat(0x2b2f35,.45,.1),s=new THREE.Mesh(new THREE.BoxGeometry(Math.min(w*.65,5),.5,.12),sm);
      s.position.set(p.x,Math.min(h-1.2,4.2),p.z+d/2+.08);sc.add(s);
    }
  }

  function city(){
    T.buildings.forEach(building);
    [{x:-145,y:15,w:120,h:130},{x:985,y:15,w:130,h:150},{x:-150,y:470,w:130,h:150},{x:985,y:470,w:120,h:150},{x:160,y:-155,w:140,h:130},{x:720,y:-165,w:160,h:140},{x:340,y:685,w:150,h:120},{x:700,y:690,w:165,h:120}].forEach((b,i)=>building(b,i+8,true));

    const pm=mat(0xb6bbc2,.4,.35),bm=mat(0xffffff,.35,.08,0xddeeff);
    const pts=[];
    [90,250,410,570,730,890].forEach(x=>{pts.push([x,185]);pts.push([x,465]);});
    pts.forEach(([x,y],i)=>{
      const p=wp(x,y),pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,4.2,8),pm);pole.position.set(p.x,2.1,p.z);sc.add(pole);
      const b=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),bm);b.position.set(p.x,4.15,p.z);sc.add(b);
      if(i%2===0){const l=new THREE.PointLight(0xe8f4ff,12,16,2);l.position.set(p.x,4,p.z);sc.add(l);}
    });
  }

  function car(color){
    const g=new THREE.Group(),body=mat(color,.26,.62),dark=mat(0x071018,.25,.55),glass=new THREE.MeshStandardMaterial({color:0x0b2031,metalness:.45,roughness:.12,transparent:true,opacity:.86}),tire=mat(0x050607,.95),rim=mat(0xb9c1ca,.2,.9);
    const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
    add(new THREE.BoxGeometry(4.3,.65,1.9),body,0,.72,0);add(new THREE.BoxGeometry(1.55,.34,1.82),body,1.25,1.05,0);add(new THREE.BoxGeometry(1.7,.82,1.55),glass,-.35,1.31,0);add(new THREE.BoxGeometry(.95,.3,1.8),body,-1.55,1,0);add(new THREE.BoxGeometry(.22,.16,2),dark,2.22,.47,0);add(new THREE.BoxGeometry(.22,.12,2.1),dark,-2.1,1.45,0);
    [-.72,.72].forEach(z=>add(new THREE.BoxGeometry(.12,.55,.12),dark,-1.92,1.19,z));
    [-1.35,1.35].forEach(x=>[-1.04,1.04].forEach(z=>{const w=add(new THREE.CylinderGeometry(.44,.44,.36,18),tire,x,.5,z);w.rotation.x=Math.PI/2;const rr=add(new THREE.CylinderGeometry(.23,.23,.38,16),rim,x,.5,z*1.015);rr.rotation.x=Math.PI/2;}));
    const hm=mat(0xffffff,.35,.1,0xaee3ff),tm=mat(0xff3344,.4,.05,0xff0018);
    [-.62,.62].forEach(z=>{add(new THREE.BoxGeometry(.08,.22,.38),hm,2.18,.82,z);add(new THREE.BoxGeometry(.08,.22,.42),tm,-2.18,.82,z)});
    return g;
  }

  function ensureCars(players){
    Object.keys(players).forEach(id=>{
      if(!cars[id]){cars[id]=car(COLORS[id]||'#ffffff');sc.add(cars[id]);}
      cars[id].visible=true;
    });
    Object.keys(cars).forEach(id=>{if(!players[id])cars[id].visible=false;});
  }

  function resize(){
    if(!r)return;
    const b=canvas.getBoundingClientRect(),w=Math.max(320,b.width|0),h=Math.max(240,b.height|0);
    r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();
  }

  function init(c){
    if(ready)return true;canvas=c;if(typeof THREE==='undefined')return false;
    r=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.08;
    sc=new THREE.Scene();sc.background=new THREE.Color(0xcfd3d8);sc.fog=new THREE.Fog(0xcfd3d8,55,155);
    cam=new THREE.PerspectiveCamera(65,16/9,.1,260);cam.position.set(0,8,14);look=new THREE.Vector3();
    sc.add(new THREE.HemisphereLight(0xffffff,0x8f969e,2.2));
    const sun=new THREE.DirectionalLight(0xffffff,3.1);sun.position.set(-25,55,20);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-75;sun.shadow.camera.right=75;sun.shadow.camera.top=75;sun.shadow.camera.bottom=-75;sc.add(sun);
    const grd=new THREE.Mesh(new THREE.PlaneGeometry(160,120),mat(0xd9dde2,1));grd.rotation.x=-Math.PI/2;grd.position.y=-.06;grd.receiveShadow=true;sc.add(grd);
    road();city();addEventListener('resize',resize);resize();ready=true;return true;
  }

  function update(world,myId){
    if(!ready||!world?.players)return;
    ensureCars(world.players);
    Object.entries(world.players).forEach(([id,s])=>{const m=cars[id],p=wp(s.x,s.y);m.position.set(p.x,.05,p.z);m.rotation.y=-s.a;});
    const me=world.players[myId];if(!me)return;
    const p=wp(me.x,me.y),d=new THREE.Vector3(Math.cos(me.a),0,Math.sin(me.a)),f=Math.min(1,Math.abs(me.v)/345),tc=new THREE.Vector3(p.x-d.x*(9.8+f*3.2),5+f*1.2,p.z-d.z*(9.8+f*3.2));
    cam.position.lerp(tc,.085);look.lerp(new THREE.Vector3(p.x+d.x*4.5,1.1,p.z+d.z*4.5),.13);cam.lookAt(look);cam.fov=65+f*7;cam.updateProjectionMatrix();resize();r.render(sc,cam);
  }

  const colorFor=id=>COLORS[id]||'#ffffff';
  window.Midnight3D={init,update,track:T,scale:S,colorFor};
})();
