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
  let r,sc,cam,cars={},look,ready=false,canvas,lastCrash={},effects=[],walkers=[],skyGroup,lastFrame=performance.now();
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
    const asphalt=mat(0x17191d,.94,.04),curb=mat(0xb7b9bd,.9,.05),walk=mat(0xaaa8a1,.96,.02);
    T.roads.forEach(q=>{
      const p=wp(q.x+q.w/2,q.y+q.h/2),m=new THREE.Mesh(new THREE.PlaneGeometry(q.w*S,q.h*S),asphalt);
      m.rotation.x=-Math.PI/2;m.position.set(p.x,.015,p.z);m.receiveShadow=true;sc.add(m);
      const c1=new THREE.Mesh(new THREE.BoxGeometry(q.w*S,.2,.34),curb),c2=c1.clone();
      c1.position.set(p.x,.10,wp(0,q.y).z);c2.position.set(p.x,.10,wp(0,q.y+q.h).z);sc.add(c1,c2);

      const sidewalkWidth=30*S,side1=new THREE.Mesh(new THREE.BoxGeometry(q.w*S,.14,sidewalkWidth),walk),side2=side1.clone();
      side1.position.set(p.x,.07,wp(0,q.y-16).z);side2.position.set(p.x,.07,wp(0,q.y+q.h+16).z);side1.receiveShadow=side2.receiveShadow=true;sc.add(side1,side2);
      const jointMat=new THREE.MeshBasicMaterial({color:0x77756f,transparent:true,opacity:.38});
      for(let x=q.x+180;x<q.x+q.w;x+=520){[-1,1].forEach(side=>{const z=wp(0,side<0?q.y-16:q.y+q.h+16).z,j=new THREE.Mesh(new THREE.BoxGeometry(.035,.155,sidewalkWidth*.92),jointMat);j.position.set(wp(x,0).x,.145,z);sc.add(j);});}
    });
    const laneMat=new THREE.LineDashedMaterial({color:0xf1d24a,dashSize:2.2,gapSize:2.1,transparent:true,opacity:.88});
    (T.laneYs||[]).forEach(y=>{
      const g=new THREE.BufferGeometry().setFromPoints([wp(T.startX||115,y),wp(T.finishX||900,y)]),line=new THREE.Line(g,laneMat.clone());
      line.position.y=.05;line.computeLineDistances();sc.add(line);
    });
    checkerLine(T.startX||115);checkerLine(T.finishX||900);
  }

  function building(b,i){
    const p=wp(b.x+b.w/2,b.y+b.h/2),w=Math.max(5,b.w*S*.8),d=Math.max(5,b.h*S*.8),h=8+(i%7)*1.75;
    const shellColors=[0x8c8074,0xa49a8f,0x756f69,0x9d8d80,0x6f7d83,0x93857b,0x7c756d];
    const shell=mat(shellColors[i%shellColors.length],.82,.04),trim=mat(i%2?0x302d2a:0x3a3e42,.7,.08),glass=mat(0x294252,.28,.18,0x152d3d);
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),shell);m.position.set(p.x,h/2,p.z);m.castShadow=m.receiveShadow=true;sc.add(m);

    const base=new THREE.Mesh(new THREE.BoxGeometry(w+.18,.55,d+.18),trim);base.position.set(p.x,.3,p.z);base.castShadow=true;sc.add(base);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.22,.28,d+.22),trim);roof.position.set(p.x,h+.13,p.z);roof.castShadow=true;sc.add(roof);

    const floors=Math.min(5,Math.max(3,Math.floor(h/2.45)));
    for(let f=0;f<floors;f++){
      const band=new THREE.Mesh(new THREE.BoxGeometry(Math.max(2,w-1.15),.62,.06),glass);
      band.position.set(p.x,1.55+f*2.05,p.z+d/2+.035);sc.add(band);
      if(f<floors-1){const sill=new THREE.Mesh(new THREE.BoxGeometry(Math.max(2,w-1.0),.08,.10),trim);sill.position.set(p.x,2.05+f*2.05,p.z+d/2+.07);sc.add(sill);}
    }
    const door=new THREE.Mesh(new THREE.BoxGeometry(Math.min(1.25,w*.18),1.8,.09),mat(0x202a30,.35,.35));door.position.set(p.x-w*.27,.93,p.z+d/2+.06);sc.add(door);
    const awning=new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.6,w*.38),.13,.72),mat(i%2?0x5c6268:0x514943,.6,.12));awning.position.set(p.x-w*.18,2.05,p.z+d/2+.37);sc.add(awning);
    if(i%3===0){const unit=new THREE.Mesh(new THREE.BoxGeometry(1.15,.55,.8),mat(0x777c80,.75,.2));unit.position.set(p.x+w*.22,h+.55,p.z);unit.castShadow=true;sc.add(unit);}
  }

  function tree(x,y,seed=0){
    const p=wp(x,y),trunk=new THREE.Mesh(new THREE.CylinderGeometry(.10,.15,1.7,7),mat(0x694a31,.95,.01));trunk.position.set(p.x,.9,p.z);trunk.castShadow=true;sc.add(trunk);
    const crown=new THREE.Mesh(new THREE.SphereGeometry(.72+(seed%3)*.08,9,7),mat([0x355d3b,0x416a45,0x2f5837][seed%3],.98,.01));crown.position.set(p.x,2.0,p.z);crown.scale.set(1,1.18,.9);crown.castShadow=true;sc.add(crown);
  }

  function pedestrian(x,y,dir,seed=0){
    const p=wp(x,y),g=new THREE.Group(),skin=mat([0xc88962,0xa66e4e,0xe0aa80,0x8d5e45][seed%4],.85,.02),shirt=mat([0x365a7a,0x8a3d44,0x446b4f,0x6b4f7a,0x8b6b36][seed%5],.9,.02),pants=mat([0x252a30,0x36383c,0x263644][seed%3],.95,.01);
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.22,.27,.85,8),shirt);body.position.y=1.05;g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.19,8,6),skin);head.position.y=1.62;g.add(head);
    const leg1=new THREE.Mesh(new THREE.CylinderGeometry(.075,.085,.68,6),pants),leg2=leg1.clone();leg1.position.set(-.11,.42,0);leg2.position.set(.11,.42,0);g.add(leg1,leg2);
    const arm1=new THREE.Mesh(new THREE.CylinderGeometry(.055,.06,.66,6),skin),arm2=arm1.clone();arm1.position.set(-.31,1.05,0);arm2.position.set(.31,1.05,0);g.add(arm1,arm2);
    g.position.set(p.x,.08,p.z);g.rotation.y=dir>0?-Math.PI/2:Math.PI/2;g.scale.setScalar(.9);sc.add(g);
    walkers.push({g,leg1,leg2,arm1,arm2,dir,baseX:p.x,phase:seed*1.17,speed:.62+(seed%3)*.11});
  }

  function city(){
    T.buildings.forEach(building);
    const finish=T.finishX||900;let idx=T.buildings.length;
    for(let x=1150;x<finish;x+=1550){
      building({x:x-130,y:28,w:175,h:135},idx++);building({x:x+255,y:42,w:125,h:118},idx++);
      building({x:x+20,y:488,w:155,h:118},idx++);building({x:x+410,y:482,w:150,h:142},idx++);
    }

    const poleMat=mat(0x575d63,.42,.46),bulbMat=mat(0xf6efcf,.28,.05,0xffdca0);
    for(let x=260,i=0;x<finish;x+=1050,i++)[-1,1].forEach(side=>{
      const y=side<0?186:464,p=wp(x,y),pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,4.3,8),poleMat);
      pole.position.set(p.x,2.15,p.z);pole.castShadow=true;sc.add(pole);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(.75,.06,.06),poleMat);arm.position.set(p.x+(side<0?.34:-.34),4.18,p.z);sc.add(arm);
      const b=new THREE.Mesh(new THREE.SphereGeometry(.13,9,7),bulbMat);b.position.set(p.x+(side<0?.68:-.68),4.08,p.z);sc.add(b);
      if(i%2===0){const l=new THREE.PointLight(0xffe8bd,5.5,13,2);l.position.copy(b.position);sc.add(l);}
    });

    for(let x=520,i=0;x<finish;x+=1450,i++){
      tree(x,177,i);tree(x+620,473,i+1);
      pedestrian(x+180,188,i%2?1:-1,i);pedestrian(x+760,462,i%2?-1:1,i+7);
      if(i%2===0)pedestrian(x+1030,188,1,i+13);
    }
  }

  function sky(){
    skyGroup=new THREE.Group();sc.add(skyGroup);
    const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,vertexShader:`varying vec3 vPos;void main(){vec4 w=modelMatrix*vec4(position,1.0);vPos=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec3 vPos;void main(){vec3 d=normalize(vPos-cameraPosition);float h=clamp(d.y*.72+.35,0.0,1.0);vec3 horizon=vec3(0.78,0.64,0.58);vec3 mid=vec3(0.30,0.48,0.67);vec3 zenith=vec3(0.08,0.17,0.34);vec3 c=mix(horizon,mid,smoothstep(0.05,0.45,h));c=mix(c,zenith,smoothstep(0.42,1.0,h));gl_FragColor=vec4(c,1.0);}`});
    const dome=new THREE.Mesh(new THREE.SphereGeometry(420,28,16),skyMat);skyGroup.add(dome);
    const sun=new THREE.Mesh(new THREE.SphereGeometry(7,18,12),new THREE.MeshBasicMaterial({color:0xffd8a1,fog:false}));sun.position.set(-135,62,-205);skyGroup.add(sun);
    const cloudMat=new THREE.MeshBasicMaterial({color:0xe8e7e2,transparent:true,opacity:.42,depthWrite:false,fog:false});
    for(let i=0;i<11;i++){
      const g=new THREE.Group();for(let j=0;j<4;j++){const c=new THREE.Mesh(new THREE.SphereGeometry(3.4+(j%2)*1.4,9,6),cloudMat);c.position.set(j*3.8,Math.sin(j)*.7,(j%2)*1.7);c.scale.y=.55;g.add(c);}g.position.set(-155+i*31,35+(i%4)*9,-150-(i%3)*48);g.scale.setScalar(.75+(i%3)*.22);skyGroup.add(g);
    }
  }

  function updateWalkers(dt,time){
    walkers.forEach(w=>{
      w.g.position.x+=w.dir*w.speed*dt;
      if(w.g.position.x>w.baseX+3.8){w.g.position.x=w.baseX-3.8;}
      if(w.g.position.x<w.baseX-3.8){w.g.position.x=w.baseX+3.8;}
      const step=Math.sin(time*.006*w.speed*2.2+w.phase);
      w.leg1.rotation.z=step*.42;w.leg2.rotation.z=-step*.42;w.arm1.rotation.z=-step*.34;w.arm2.rotation.z=step*.34;w.g.position.y=.08+Math.abs(step)*.035;
    });
  }

  function nameTag(text,color){
    const c=document.createElement('canvas');c.width=320;c.height=86;const x=c.getContext('2d');
    x.fillStyle='rgba(3,7,12,.82)';x.beginPath();x.roundRect(4,4,312,78,18);x.fill();
    x.strokeStyle=color;x.lineWidth=5;x.stroke();x.fillStyle='#fff';x.font='800 34px system-ui';x.textAlign='center';x.textBaseline='middle';x.fillText(String(text||'Driver').slice(0,18),160,44);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
    s.scale.set(7.4,2,1);s.position.set(0,3.35,0);s.renderOrder=20;return s;
  }

  function car(color,name,modelId='falcon-gt'){
    const spec=window.MidnightGarage?.get?.(modelId)||{
      id:'falcon-gt',paint:color,accent:'#fff1aa',
      roof:1.62,roofX:-.35,hood:.93,tail:1.04,width:2.08,wheel:.46,spoiler:0,stripe:1,lightbar:0
    };
    const g=new THREE.Group();
    const body=mat(spec.paint||color,.28,.54),trim=mat(0x101824,.57,.27),
      glass=mat(0x102f43,.16,.56),tire=mat(0x080b10,.98,.01),
      rim=mat(0xc9d7e0,.20,.85),accent=mat(spec.accent||0xffffff,.33,.30),
      lamp=mat(0xd9f8ff,.24,.06,0xa4e9ff),red=mat(0xff365a,.27,.08,0xff1b2f);
    const add=(geo,m,x,y,z)=>{
      const o=new THREE.Mesh(geo,m);
      o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;
    };
    const half=spec.width*.5,rs=(spec.roofX||-.3)-.91,re=(spec.roofX||-.3)+.70;
    // Beveled wedge silhouette instead of the old rectangular car body.
    const outline=new THREE.Shape();
    outline.moveTo(-2.36,.47);outline.lineTo(-2.36,.86);
    outline.lineTo(-1.94,spec.tail);outline.lineTo(rs-.24,1.12);
    outline.lineTo(rs,spec.roof);outline.lineTo(re,spec.roof-.035);
    outline.lineTo(re+.53,1.10);outline.lineTo(1.85,spec.hood);
    outline.lineTo(2.41,.73);outline.lineTo(2.41,.46);outline.closePath();
    const chassis=new THREE.ExtrudeGeometry(outline,{
      depth:spec.width*.84,bevelEnabled:true,bevelThickness:.055,
      bevelSize:.065,bevelSegments:1,steps:1,curveSegments:1
    });
    chassis.translate(0,0,-spec.width*.42);
    add(chassis,body,0,0,0);
    // Windshield and wraparound side glass have a distinct roof profile per model.
    const windowShape=new THREE.Shape();
    windowShape.moveTo(rs+.17,1.17);
    windowShape.lineTo(rs+.22,spec.roof-.10);
    windowShape.lineTo(re-.12,spec.roof-.12);
    windowShape.lineTo(re+.33,1.17);
    windowShape.closePath();
    const windowGeo=new THREE.ExtrudeGeometry(windowShape,{
      depth:spec.width*.76,bevelEnabled:false,steps:1
    });
    windowGeo.translate(0,0,-spec.width*.38);
    add(windowGeo,glass,0,0,0);
    add(new THREE.BoxGeometry(4.40,.17,spec.width*.85),trim,0,.51,0);
    // Side skirts and aerodynamic rear diffuser.
    [-1,1].forEach(side=>{
      add(new THREE.BoxGeometry(2.55,.17,.11),trim,-.03,.52,side*(half-.04));
      add(new THREE.BoxGeometry(.66,.20,.055),trim,-.70,.83,side*(half+.015));
    });
    add(new THREE.BoxGeometry(.20,.24,spec.width*.92),trim,2.38,.49,0);
    add(new THREE.BoxGeometry(.30,.30,spec.width*.91),trim,-2.35,.51,0);
    // Sport tires, metallic alloy rims and brake hubs.
    [-1.44,1.44].forEach(x=>[-1,1].forEach(side=>{
      const z=side*(half+.03),rad=spec.wheel||.46;
      const wheel=add(new THREE.CylinderGeometry(rad,rad,.35,20),tire,x,.48,z);
      wheel.rotation.x=Math.PI/2;
      const alloy=add(new THREE.CylinderGeometry(rad*.66,rad*.66,.37,12),rim,x,.48,side*(half+.10));
      alloy.rotation.x=Math.PI/2;
      const hub=add(new THREE.CylinderGeometry(rad*.23,rad*.23,.39,12),trim,x,.48,side*(half+.11));
      hub.rotation.x=Math.PI/2;
    }));
    [-1,1].forEach(side=>{
      const z=side*spec.width*.30;
      add(new THREE.BoxGeometry(.10,.10,.50),lamp,2.39,.78,z);
      add(new THREE.BoxGeometry(.10,.13,.52),red,-2.38,.84,z);
      add(new THREE.BoxGeometry(.20,.10,.36),trim,1.68,.78,side*(half-.1));
      add(new THREE.BoxGeometry(.17,.07,.39),trim,-2.25,.65,side*(half-.1));
    });
    if(spec.lightbar){
      add(new THREE.BoxGeometry(.075,.055,spec.width*.79),lamp,2.43,.85,0);
      add(new THREE.BoxGeometry(.075,.08,spec.width*.80),red,-2.40,.84,0);
    }
    if(spec.stripe){
      add(new THREE.BoxGeometry(1.10,.036,.11),accent,1.25,spec.hood+.043,0);
      add(new THREE.BoxGeometry(.82,.036,.10),accent,-1.85,spec.tail+.044,0);
    }
    if(spec.spoiler){
      [-1,1].forEach(side=>add(new THREE.BoxGeometry(.10,.49,.10),trim,-2.06,1.24,side*half*.63));
      const wingWidth=spec.width+(spec.spoiler===2?.36:.08);
      add(new THREE.BoxGeometry(.53,.115,wingWidth),trim,-2.05,1.50,0);
      add(new THREE.BoxGeometry(.33,.035,wingWidth*.93),accent,-2.05,1.58,0);
    }
    // Exhaust tips, with blue flames only while a car uses its air boost.
    const flames=[];
    [-1,1].forEach(side=>{
      add(new THREE.CylinderGeometry(.13,.13,.14,10),rim,-2.43,.57,side*.57).rotation.z=Math.PI/2;
      const flame=add(new THREE.ConeGeometry(.16,.72,9),
        new THREE.MeshBasicMaterial({color:0x2fd4ff,transparent:true,opacity:.84,depthWrite:false}),
        -2.78,.59,side*.57);
      flame.rotation.z=Math.PI/2;flame.visible=false;flames.push(flame);
    });
    g.userData.model=spec.id;g.userData.driverName=name;g.userData.flames=flames;
    g.add(nameTag(name,spec.paint||color));
    return g;
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
    Object.entries(players).forEach(([id,p])=>{
      const model=window.MidnightGarage?.get?.(p.car)?.id||'falcon-gt';
      if(cars[id]&&(cars[id].userData.model!==model||cars[id].userData.driverName!==p.name)){
        const old=cars[id];sc.remove(old);
        old.traverse(o=>{
          o.geometry?.dispose?.();
          if(o.material){
            const mats=Array.isArray(o.material)?o.material:[o.material];
            mats.forEach(m=>{m.map?.dispose?.();m.dispose?.();});
          }
        });
        delete cars[id];
      }
      if(!cars[id]){
        cars[id]=car(COLORS[id]||'#fff',p.name,model);
        sc.add(cars[id]);lastCrash[id]=p.crashSeq||0;
      }
      cars[id].visible=true;
    });
    Object.keys(cars).forEach(id=>{if(!players[id])cars[id].visible=false;});
  }
  function resize(){if(!r)return;const b=canvas.getBoundingClientRect(),w=Math.max(320,b.width|0),h=Math.max(240,b.height|0);r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}

  function init(c){
    if(ready)return true;canvas=c;if(typeof THREE==='undefined')return false;
    r=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});r.setPixelRatio(Math.min(devicePixelRatio||1,1.75));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.1;
    sc=new THREE.Scene();sc.background=new THREE.Color(0x879caf);sc.fog=new THREE.Fog(0x879caf,100,385);
    cam=new THREE.PerspectiveCamera(65,16/9,.1,500);cam.position.set(0,8,14);look=new THREE.Vector3();
    sc.add(new THREE.HemisphereLight(0xddeaff,0x55483d,1.65));const sunLight=new THREE.DirectionalLight(0xffe2bf,2.5);sunLight.position.set(-25,55,20);sunLight.castShadow=true;sc.add(sunLight);
    const len=((T.finishX||900)-(T.startX||115)+1800)*S,center=wp(((T.finishX||900)+(T.startX||115))/2,325);
    const grd=new THREE.Mesh(new THREE.PlaneGeometry(len,110),mat(0x56614e,1));grd.rotation.x=-Math.PI/2;grd.position.set(center.x,-.06,0);grd.receiveShadow=true;sc.add(grd);
    road();city();sky();addEventListener('resize',resize);resize();lastFrame=performance.now();ready=true;return true;
  }

  function boostHeight(s,now){
    const start=Number(s.boostStart)||0,end=Number(s.boostUntil)||0;
    if(!start||now>=end||end<=start)return 0;
    const t=Math.max(0,Math.min(1,(now-start)/(end-start)));
    return Math.sin(Math.PI*t)*6.4;
  }

  function update(world,myId){
    if(!ready||!world?.players)return;ensureCars(world.players);const frameNow=performance.now(),dt=Math.min(.04,(frameNow-lastFrame)/1000);lastFrame=frameNow;updateEffects(dt);updateWalkers(dt,frameNow);const now=Date.now();
    Object.entries(world.players).forEach(([id,s])=>{
      const m=cars[id],p=wp(s.x,s.y),power=Math.max(.25,Math.min(1,s.crashPower||.5)),air=boostHeight(s,now);m.position.set(p.x,.05+air,p.z);m.rotation.y=-s.a;
      m.userData.flames?.forEach((f,i)=>{f.visible=air>.15;if(f.visible)f.scale.y=.9+Math.sin(now*.04+i)*.15;});
      if((s.crashSeq||0)!==(lastCrash[id]||0)){lastCrash[id]=s.crashSeq||0;if(s.crashSeq)spawnImpact(m.position.clone(),power);}
      if(air>0){const total=Math.max(1,(s.boostUntil||0)-(s.boostStart||0)),t=Math.max(0,Math.min(1,(now-(s.boostStart||0))/total));m.rotation.z*=.82;m.rotation.x=-Math.sin(Math.PI*t)*.16;}
      else if(s.crashUntil&&now<s.crashUntil){const pulse=Math.sin(now*.045+Number(id.slice(1)));m.rotation.z=pulse*.10*power;m.rotation.x=Math.cos(now*.05)*.04*power;m.position.y=.05+Math.abs(pulse)*.15*power;}else{m.rotation.z*=.78;m.rotation.x*=.78;}
    });
    const me=world.players[myId];if(!me)return;const p=wp(me.x,me.y),d=new THREE.Vector3(Math.cos(me.a),0,Math.sin(me.a)),f=Math.min(1,Math.abs(me.v)/520),air=boostHeight(me,now),tc=new THREE.Vector3(p.x-d.x*(10+f*3),5.3+f+air*.28,p.z-d.z*(10+f*3));
    if(!air&&me.crashUntil&&now<me.crashUntil){const power=Math.max(.25,Math.min(1,me.crashPower||.5)),shake=.22+.62*power;tc.x+=Math.sin(now*.095)*shake;tc.y+=Math.sin(now*.12)*shake*.55;tc.z+=Math.cos(now*.105)*shake;}
    cam.position.lerp(tc,.09);look.lerp(new THREE.Vector3(p.x+d.x*5,1.15+air*.34,p.z+d.z*5),.14);cam.lookAt(look);cam.fov=65+f*8+(air>0?4:0);cam.updateProjectionMatrix();if(skyGroup)skyGroup.position.set(cam.position.x,0,cam.position.z);resize();r.render(sc,cam);
  }

  const colorFor=id=>COLORS[id]||'#fff';window.Midnight3D={init,update,track:T,scale:S,colorFor};
})();