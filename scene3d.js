(() => {
  const S=.11;
  const T={
    roads:[{x:60,y:205,w:880,h:240}],
    buildings:[
      {x:70,y:35,w:125,h:130,l:'MALL'},{x:235,y:35,w:110,h:130,l:'CLUB'},
      {x:390,y:30,w:110,h:120,l:'AUTO'},{x:555,y:30,w:120,h:125,l:'HOTEL'},
      {x:735,y:35,w:110,h:130,l:'GARAGE'},{x:230,y:485,w:145,h:90,l:'PIER'},
      {x:610,y:485,w:140,h:90,l:'DOCK'}
    ],
    marks:[],laneYs:[245,285,325,365,405],startX:115,finishX:900,roadMinY:205,roadMaxY:445
  };
  const COLORS={p1:'#ffd23f',p2:'#45d6ff',p3:'#ff5f7e',p4:'#70ff9c',p5:'#c58cff',p6:'#ff9b45'};
  let r,sc,cam,cars={},look,ready=false,canvas,lastCrash={},effects=[],lastFrame=performance.now();
  const wp=(x,y)=>new THREE.Vector3((x-500)*S,0,(y-325)*S);
  const mat=(c,rough=.8,metal=.05,em=0)=>new THREE.MeshStandardMaterial({color:c,roughness:rough,metalness:metal,emissive:em,emissiveIntensity:em?1.5:0});

  function checkerLine(x){
    const y0=T.roadMinY||205,y1=T.roadMaxY||445,cells=14,step=(y1-y0)/cells;
    for(let i=0;i<cells;i++)for(let j=0;j<2;j++){
      const p=wp(x+j*7,y0+(i+.5)*step),m=new THREE.Mesh(new THREE.BoxGeometry(.72,.05,step*S),mat((i+j)%2?0xffffff:0x16191f,.72));
      m.position.set(p.x,.06,p.z);sc.add(m);
    }
  }

  function road(){
    const asphalt=mat(0xf2f3f5,.92,.03),curb=mat(0xd4d7dc,.85,.08);
    T.roads.forEach(q=>{
      const p=wp(q.x+q.w/2,q.y+q.h/2),m=new THREE.Mesh(new THREE.PlaneGeometry(q.w*S,q.h*S),asphalt);
      m.rotation.x=-Math.PI/2;m.position.set(p.x,.015,p.z);m.receiveShadow=true;sc.add(m);
      const c1=new THREE.Mesh(new THREE.BoxGeometry(q.w*S,.18,.28),curb),c2=c1.clone();
      c1.position.set(p.x,.09,wp(0,q.y).z);c2.position.set(p.x,.09,wp(0,q.y+q.h).z);sc.add(c1,c2);
    });
    const laneMat=new THREE.LineDashedMaterial({color:0xf0c94f,dashSize:2.2,gapSize:2.1,transparent:true,opacity:.92});
    (T.laneYs||[]).forEach(y=>{
      const g=new THREE.BufferGeometry().setFromPoints([wp(T.startX||115,y),wp(T.finishX||900,y)]),line=new THREE.Line(g,laneMat.clone());
      line.position.y=.05;line.computeLineDistances();sc.add(line);
    });
    checkerLine(T.startX||115);checkerLine(T.finishX||900);
  }

  function building(b,i){
    const p=wp(b.x+b.w/2,b.y+b.h/2),w=Math.max(5,b.w*S*.8),d=Math.max(5,b.h*S*.8),h=8+(i%6)*2.2;
    const shell=mat([0xf8f8f8,0xe9ebee,0xffffff,0xdfe3e7][i%4],.72,.08);
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),shell);m.position.set(p.x,h/2,p.z);m.castShadow=m.receiveShadow=true;sc.add(m);
    const wm=mat(0xd9eefc,.38,.08,0x6bbcff),floors=Math.min(5,Math.max(2,Math.floor(h/2.5))),cols=Math.min(6,Math.max(2,Math.floor(w/2.2)));
    for(let f=0;f<floors;f++)for(let c=0;c<cols;c++){
      if((f+c+i)%3===0)continue;
      const z=new THREE.Mesh(new THREE.PlaneGeometry(.48,.62),wm);z.position.set(p.x-w/2+.9+c*((w-1.8)/Math.max(1,cols-1)),1.5+f*2,p.z+d/2+.011);sc.add(z);
    }
  }

  function city(){
    T.buildings.forEach(building);
    const finish=T.finishX||900;
    let idx=T.buildings.length;
    for(let x=1200;x<finish;x+=1800){
      building({x:x-120,y:35,w:170,h:125},idx++);building({x:x+280,y:35,w:135,h:150},idx++);
      building({x:x+40,y:490,w:165,h:110},idx++);building({x:x+430,y:485,w:145,h:135},idx++);
    }
    const poleMat=mat(0xb6bbc2,.4,.35),bulbMat=mat(0xffffff,.35,.08,0xddeeff);
    for(let x=300,i=0;x<finish;x+=1200,i++)[-1,1].forEach(side=>{
      const y=side<0?185:465,p=wp(x,y),pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,4.2,8),poleMat);
      pole.position.set(p.x,2.1,p.z);sc.add(pole);const b=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),bulbMat);b.position.set(p.x,4.15,p.z);sc.add(b);
      if(i%2===0){const l=new THREE.PointLight(0xe8f4ff,9,15,2);l.position.set(p.x,4,p.z);sc.add(l);}
    });
  }

  function nameTag(text,color){
    const c=document.createElement('canvas');c.width=320;c.height=86;const x=c.getContext('2d');
    x.fillStyle='rgba(3,7,12,.82)';x.beginPath();x.roundRect(4,4,312,78,18);x.fill();
    x.strokeStyle=color;x.lineWidth=5;x.stroke();x.fillStyle='#fff';x.font='800 34px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(String(text||'Driver').slice(0,18),160,44);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
    s.scale.set(7.4,2,1);s.position.set(0,3.35,0);s.renderOrder=20;return s;
  }

  function car(color,name){
    const g=new THREE.Group(),body=mat(color,.26,.62),dark=mat(0x071018,.25,.55),glass=new THREE.MeshStandardMaterial({color:0x0b2031,metalness:.45,roughness:.12,transparent:true,opacity:.86}),tire=mat(0x050607,.95),rim=mat(0xb9c1ca,.2,.9);
    const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
    add(new THREE.BoxGeometry(4.3,.65,1.9),body,0,.72,0);add(new THREE.BoxGeometry(1.55,.34,1.82),body,1.25,1.05,0);add(new THREE.BoxGeometry(1.7,.82,1.55),glass,-.35,1.31,0);add(new THREE.BoxGeometry(.95,.3,1.8),body,-1.55,1,0);add(new THREE.BoxGeometry(.22,.16,2),dark,2.22,.47,0);add(new THREE.BoxGeometry(.22,.12,2.1),dark,-2.1,1.45,0);
    [-1.35,1.35].forEach(x=>[-1.04,1.04].forEach(z=>{const w=add(new THREE.CylinderGeometry(.44,.44,.36,18),tire,x,.5,z);w.rotation.x=Math.PI/2;const rr=add(new THREE.CylinderGeometry(.23,.23,.38,16),rim,x,.5,z*1.015);rr.rotation.x=Math.PI/2;}));
    const hm=mat(0xffffff,.35,.1,0xaee3ff),tm=mat(0xff3344,.4,.05,0xff0018);[-.62,.62].forEach(z=>{add(new THREE.BoxGeometry(.08,.22,.38),hm,2.18,.82,z);add(new THREE.BoxGeometry(.08,.22,.42),tm,-2.18,.82,z)});
    g.add(nameTag(name,color));return g;
  }

  function spawnImpact(position,power=.5){
    const p=Math.max(.25,Math.min(1,power||.5)),count=8+Math.round(p*10),geo=new THREE.SphereGeometry(.075+.035*p,6,5);
    for(let i=0;i<count;i++){
      const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:i%3===0?0xffffff:(i%2?0xffb000:0xff5a1f)}));m.position.copy(position);m.position.y+=.7+Math.random()*.8;sc.add(m);
      effects.push({mesh:m,vel:new THREE.Vector3((Math.random()-.35)*(5+8*p),2.5+Math.random()*5*p,(Math.random()-.5)*(8+12*p)),life:.28+.35*Math.random()+.28*p,gravity:8});
    }
    const flash=new THREE.Mesh(new THREE.SphereGeometry(.45,10,8),new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.9,depthWrite:false}));flash.position.copy(position);flash.position.y+=.9;sc.add(flash);effects.push({mesh:flash,vel:new THREE.Vector3(),life:.16,flash:true,gravity:0});
  }

  function updateEffects(dt){
    for(let i=effects.length-1;i>=0;i--){const e=effects[i];e.life-=dt;if(e.life<=0){sc.remove(e.mesh);e.mesh.geometry?.dispose?.();e.mesh.material?.dispose?.();effects.splice(i,1);continue;}if(e.flash){const s=1+(1-e.life/.16)*2.6;e.mesh.scale.setScalar(s);e.mesh.material.opacity=Math.max(0,e.life/.16);continue;}e.vel.y-=e.gravity*dt;e.mesh.position.addScaledVector(e.vel,dt);}
  }

  function ensureCars(players){
    Object.entries(players).forEach(([id,p])=>{if(!cars[id]){cars[id]=car(COLORS[id]||'#fff',p.name);sc.add(cars[id]);lastCrash[id]=p.crashSeq||0;}cars[id].visible=true;});
    Object.keys(cars).forEach(id=>{if(!players[id])cars[id].visible=false;});
  }
  function resize(){if(!r)return;const b=canvas.getBoundingClientRect(),w=Math.max(320,b.width|0),h=Math.max(240,b.height|0);r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}

  function init(c){
    if(ready)return true;canvas=c;if(typeof THREE==='undefined')return false;
    r=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});r.setPixelRatio(Math.min(devicePixelRatio||1,2));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.08;
    sc=new THREE.Scene();sc.background=new THREE.Color(0xcfd3d8);sc.fog=new THREE.Fog(0xcfd3d8,85,360);
    cam=new THREE.PerspectiveCamera(65,16/9,.1,500);cam.position.set(0,8,14);look=new THREE.Vector3();
    sc.add(new THREE.HemisphereLight(0xffffff,0x8f969e,2.2));const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(-25,55,20);sun.castShadow=true;sc.add(sun);
    const len=((T.finishX||900)-(T.startX||115)+1800)*S,center=wp(((T.finishX||900)+(T.startX||115))/2,325);
    const grd=new THREE.Mesh(new THREE.PlaneGeometry(len,95),mat(0xd9dde2,1));grd.rotation.x=-Math.PI/2;grd.position.set(center.x,-.06,0);grd.receiveShadow=true;sc.add(grd);
    road();city();addEventListener('resize',resize);resize();lastFrame=performance.now();ready=true;return true;
  }

  function update(world,myId){
    if(!ready||!world?.players)return;ensureCars(world.players);const now=performance.now(),dt=Math.min(.04,(now-lastFrame)/1000);lastFrame=now;updateEffects(dt);
    Object.entries(world.players).forEach(([id,s])=>{
      const m=cars[id],p=wp(s.x,s.y),power=Math.max(.25,Math.min(1,s.crashPower||.5));m.position.set(p.x,.05,p.z);m.rotation.y=-s.a;
      if((s.crashSeq||0)!==(lastCrash[id]||0)){lastCrash[id]=s.crashSeq||0;if(s.crashSeq)spawnImpact(m.position.clone(),power);}
      if(s.crashUntil&&Date.now()<s.crashUntil){const pulse=Math.sin(Date.now()*.045+Number(id.slice(1)));m.rotation.z=pulse*.10*power;m.rotation.x=Math.cos(Date.now()*.05)*.04*power;m.position.y=.05+Math.abs(pulse)*.15*power;}else{m.rotation.z*=.78;m.rotation.x*=.78;}
    });
    const me=world.players[myId];if(!me)return;const p=wp(me.x,me.y),d=new THREE.Vector3(Math.cos(me.a),0,Math.sin(me.a)),f=Math.min(1,Math.abs(me.v)/345),tc=new THREE.Vector3(p.x-d.x*(10+f*3),5.3+f,p.z-d.z*(10+f*3));
    if(me.crashUntil&&Date.now()<me.crashUntil){const power=Math.max(.25,Math.min(1,me.crashPower||.5)),shake=.22+.62*power;tc.x+=Math.sin(Date.now()*.095)*shake;tc.y+=Math.sin(Date.now()*.12)*shake*.55;tc.z+=Math.cos(Date.now()*.105)*shake;}
    cam.position.lerp(tc,.09);look.lerp(new THREE.Vector3(p.x+d.x*5,1.15,p.z+d.z*5),.14);cam.lookAt(look);cam.fov=65+f*7;cam.updateProjectionMatrix();resize();r.render(sc,cam);
  }

  const colorFor=id=>COLORS[id]||'#fff';window.Midnight3D={init,update,track:T,scale:S,colorFor};
})();