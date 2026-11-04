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
  let r,sc,cam,cars={},look,ready=false,canvas,lastCrash={},effects=[],walkers=[],trafficMeshes=new Map(),skyGroup,lastFrame=performance.now();
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
      building({x:x-130,y:-1,w:175,h:135},idx++);building({x:x+255,y:11,w:125,h:118},idx++);
      building({x:x+20,y:530,w:155,h:118},idx++);building({x:x+410,y:532,w:150,h:142},idx++);
    }

    const poleMat=mat(0x575d63,.42,.46),bulbMat=mat(0xf6efcf,.28,.05,0xffdca0);
    for(let x=260,i=0;x<finish;x+=1050,i++)[-1,1].forEach(side=>{
      const y=side<0?146:505,p=wp(x,y),pole=new THREE.Mesh(new THREE.CylinderGeometry(.055,.075,4.3,8),poleMat);
      pole.position.set(p.x,2.15,p.z);pole.castShadow=true;sc.add(pole);
      const arm=new THREE.Mesh(new THREE.BoxGeometry(.75,.06,.06),poleMat);arm.position.set(p.x+(side<0?.34:-.34),4.18,p.z);sc.add(arm);
      const b=new THREE.Mesh(new THREE.SphereGeometry(.13,9,7),bulbMat);b.position.set(p.x+(side<0?.68:-.68),4.08,p.z);sc.add(b);
      if(i%2===0){const l=new THREE.PointLight(0xffe8bd,5.5,13,2);l.position.copy(b.position);sc.add(l);}
    });

    for(let x=520,i=0;x<finish;x+=1450,i++){
      tree(x,135,i);tree(x+620,517,i+1);
      pedestrian(x+180,139,i%2?1:-1,i);pedestrian(x+760,511,i%2?-1:1,i+7);
      if(i%2===0)pedestrian(x+1030,139,1,i+13);
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
    // Compact, depth-tested tag. Large unoccluded name plates previously hid the road.
    const c=document.createElement('canvas');c.width=256;c.height=58;
    const x=c.getContext('2d');
    x.fillStyle='rgba(3,7,12,.64)';
    x.beginPath();x.roundRect(3,3,250,52,12);x.fill();
    x.strokeStyle=color;x.lineWidth=2.3;x.stroke();
    x.fillStyle='#f7fbff';x.font='800 23px system-ui';x.textAlign='center';x.textBaseline='middle';
    x.fillText(String(text||'Driver').slice(0,18),128,30,230);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({
      map:tex,transparent:true,opacity:.91,depthTest:true,depthWrite:false
    }));
    s.scale.set(3.25,.74,1);
    s.position.set(0,2.46,0);
    return s;
  }

  function car(color,name,modelId='vortex-r'){
    const spec=window.MidnightGarage?.get?.(modelId)||{
      id:'vortex-r',paint:'#e32436',accent:'#ffd7d9',
      roof:1.43,roofX:-.42,hood:.84,tail:1.13,width:2.26,wheel:.48,spoiler:2,stripe:1,lightbar:0
    };
    const g=new THREE.Group(),half=spec.width*.5,baseHeight=.48;
    const paint=new THREE.MeshPhysicalMaterial({
      color:spec.paint||color,metalness:.64,roughness:.24,
      clearcoat:.96,clearcoatRoughness:.12,side:THREE.DoubleSide
    });
    const glass=new THREE.MeshPhysicalMaterial({
      color:0x132a3c,metalness:.26,roughness:.10,clearcoat:1,
      transparent:true,opacity:.97,side:THREE.DoubleSide
    });
    const trim=new THREE.MeshStandardMaterial({color:0x121720,metalness:.34,roughness:.47});
    const carbon=new THREE.MeshStandardMaterial({color:0x171d24,metalness:.34,roughness:.49});
    const grille=new THREE.MeshStandardMaterial({color:0x060b12,metalness:.22,roughness:.64});
    const tire=new THREE.MeshStandardMaterial({color:0x0a0d12,metalness:.04,roughness:.92});
    const alloys=new THREE.MeshStandardMaterial({color:0xb7c2ca,metalness:.89,roughness:.24});
    const darkAlloy=new THREE.MeshStandardMaterial({color:0x424c58,metalness:.82,roughness:.33});
    const accents=new THREE.MeshStandardMaterial({color:spec.accent||0xffffff,metalness:.68,roughness:.22});
    const headlight=new THREE.MeshBasicMaterial({color:0xc7f1ff,transparent:true,opacity:.92});
    const taillight=new THREE.MeshBasicMaterial({color:0xff314d});
    const add=(geometry,material,x=0,y=0,z=0)=>{
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.set(x,y,z);
      mesh.castShadow=true;mesh.receiveShadow=true;
      g.add(mesh);return mesh;
    };
    const box=(w,h,d,m,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),m,x,y,z);
    const line=(points,m)=>{
      const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
      const obj=new THREE.Line(geometry,m);g.add(obj);return obj;
    };
    // A smooth multi-section loft gives curved fenders, sculpted nose and tapered tail.
    // It is generated locally, with no external 3D asset requests on phones.
    const cat=(a,b,d,e,t)=>.5*(2*b+(-a+d)*t+(2*a-5*b+4*d-e)*t*t+(-a+3*b-3*d+e)*t*t*t);
    function loft(stations,profile,material){
      const rings=[];
      for(let i=0;i<stations.length-1;i++){
        for(let j=0;j<=5;j++){
          if(i&&j===0)continue;
          const t=j/5, prev=stations[Math.max(0,i-1)],a=stations[i],
            b=stations[i+1],next=stations[Math.min(stations.length-1,i+2)];
          const s={};
          ['x','w','y'].forEach(k=>s[k]=cat(prev[k],a[k],b[k],next[k],t));
          s.w=Math.max(.13,s.w);
          rings.push(profile(s));
        }
      }
      const vertexCount=rings[0].length,coords=[],index=[];
      rings.forEach(r=>r.forEach(v=>coords.push(v[0],v[1],v[2])));
      for(let i=0;i<rings.length-1;i++){
        for(let j=0;j<vertexCount;j++){
          const nj=(j+1)%vertexCount,a=i*vertexCount+j,b=i*vertexCount+nj;
          const c=(i+1)*vertexCount+j,d=(i+1)*vertexCount+nj;
          index.push(a,b,c,b,d,c);
        }
      }
      const geom=new THREE.BufferGeometry();
      geom.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
      geom.setIndex(index);geom.computeVertexNormals();
      return add(geom,material);
    }
    const w=half,tail=spec.tail,hood=spec.hood;
    const bodyStations=[
      {x:-2.45,w:w*.77,y:.73},
      {x:-2.32,w:w*.93,y:.86},
      {x:-1.99,w:w*.99,y:tail},
      {x:-1.55,w:w,y:Math.max(.98,tail-.07)},
      {x:-.90,w:w*.99,y:1.08},
      {x:-.16,w:w*.98,y:1.06},
      {x:.68,w:w*.98,y:.99},
      {x:1.27,w:w*.99,y:.95},
      {x:1.82,w:w*.94,y:hood+.025},
      {x:2.30,w:w*.85,y:.74},
      {x:2.46,w:w*.69,y:.67}
    ];
    loft(bodyStations,s=>{
      const x=s.x,y=s.y,z=s.w;
      return [
        [x,.44,-z*.84],[x,.54,-z*.96],[x,.68,-z],
        [x,y-.10,-z*.98],[x,y+.005,-z*.82],
        [x,y+.065,-z*.48],[x,y+.087,0],
        [x,y+.065,z*.48],[x,y+.005,z*.82],
        [x,y-.10,z*.98],[x,.68,z],[x,.54,z*.96],
        [x,.44,z*.84],[x,.40,0]
      ];
    },paint);
    // Separate curved panoramic canopy with raised roof and tinted glass.
    const cx=spec.roofX||-.35,roof=spec.roof;
    const cabinStations=[
      {x:cx-1.21,w:w*.50,y:1.17},
      {x:cx-.82,w:w*.65,y:roof-.13},
      {x:cx-.48,w:w*.70,y:roof},
      {x:cx+.26,w:w*.68,y:roof-.01},
      {x:cx+.59,w:w*.62,y:roof-.10},
      {x:cx+1.02,w:w*.46,y:1.12}
    ];
    loft(cabinStations,s=>{
      const x=s.x,y=s.y,z=s.w;
      const base=Math.min(1.17,y-.025);
      return [
        [x,base,-z],[x,base+.11,-z],
        [x,y-.03,-z*.94],[x,y+.045,-z*.73],
        [x,y+.088,0],[x,y+.045,z*.73],
        [x,y-.03,z*.94],[x,base+.11,z],
        [x,base,z],[x,base-.04,0]
      ];
    },glass);
    const roofLine=box(.84,.036,w*1.05,paint,cx-.12,roof+.077,0);
    roofLine.castShadow=false;
    // Delicate front splitter, rocker skirts, front intakes and diffuser.
    box(.34,.105,spec.width*.85,carbon,2.28,.43,0);
    box(.44,.11,spec.width*.89,carbon,-2.30,.43,0);
    box(.082,.19,spec.width*.59,grille,2.446,.57,0);
    box(.082,.13,spec.width*.72,grille,-2.425,.56,0);
    [-1,1].forEach(side=>{
      box(2.90,.14,.10,trim,-.09,.51,side*(w-.015));
      box(.22,.14,.34,grille,2.385,.62,side*w*.70);
      box(.23,.15,.34,grille,-2.365,.63,side*w*.72);
      // Single-line side panel/door seams read as real car surfacing.
      const z=side*(w*.97+.009);
      const seam=new THREE.LineBasicMaterial({color:0x1a202a,transparent:true,opacity:.50});
      line([[cx+.58,1.02,z],[cx+.60,.70,z],[cx+.43,.58,z]],seam);
      line([[cx-1.05,1.00,z],[cx-.98,.66,z]],seam);
      box(.30,.045,.028,alloys,cx-.28,.96,side*w*.989);
      // Mirrors: body color shell plus narrow black mount and reflective face.
      box(.21,.075,.24,trim,cx+.56,1.20,side*w*.75);
      const mirror=add(new THREE.SphereGeometry(.16,12,8),paint,cx+.63,1.23,side*(w*.84));
      mirror.scale.set(1,.55,1.25);
      box(.045,.09,.14,alloys,cx+.53,1.24,side*(w*.99));
      // Angular LED headlights, inset and brake lamps.
      const rz=side*(w*.68);
      box(.085,.105,.48,trim,2.432,.79,rz);
      box(.090,.035,.39,headlight,2.478,.823,rz);
      box(.083,.115,.42,trim,-2.425,.88,rz);
      box(.090,.060,.34,taillight,-2.475,.90,rz);
      box(.49,.036,.038,accents,1.74,hood+.085,side*w*.55);
    });
    if(spec.lightbar){
      box(.085,.048,spec.width*.78,headlight,2.478,.79,0);
      box(.085,.061,spec.width*.72,taillight,-2.470,.89,0);
    }
    if(spec.stripe){
      box(.98,.020,.065,accents,1.26,hood+.110,0);
      box(.74,.018,.067,accents,-1.86,tail+.073,0);
    }
    // Detailed wheel package: recessed brakes, polished rims, 5-spoke alloy wheels.
    [-1.47,1.47].forEach(x=>[-1,1].forEach(side=>{
      const radius=spec.wheel||.48;
      const wheelZ=side*(w+.055);
      const wheel=add(new THREE.CylinderGeometry(radius,radius,.36,28,1),tire,x,.49,wheelZ);
      wheel.rotation.x=Math.PI/2;
      const brake=add(new THREE.CylinderGeometry(radius*.74,radius*.74,.38,24),darkAlloy,x,.49,side*(w+.095));
      brake.rotation.x=Math.PI/2;
      const disc=add(new THREE.CylinderGeometry(radius*.64,radius*.64,.39,24),alloys,x,.49,side*(w+.115));
      disc.rotation.x=Math.PI/2;
      const faceZ=side*(w+.315);
      for(let k=0;k<5;k++){
        const spoke=box(radius*.18,radius*1.00,.036,darkAlloy,x,.49,faceZ);
        spoke.rotation.z=k*Math.PI*2/5;
      }
      const hub=add(new THREE.CylinderGeometry(radius*.21,radius*.21,.405,12),alloys,x,.49,side*(w+.12));
      hub.rotation.x=Math.PI/2;
    }));
    if(spec.spoiler){
      [-1,1].forEach(side=>box(.12,.36,.10,carbon,-2.08,1.24,side*w*.67));
      const wingW=spec.width+(spec.spoiler===2?.27:.04);
      box(.53,.075,wingW,carbon,-2.08,1.48,0);
      box(.18,.024,wingW*.87,accents,-2.04,1.528,0);
    }
    if(spec.id==='bmw-m4'){
      // BMW M4 Competition-inspired twin vertical kidney grilles.
      // Flat local XY grille panels face the car's forward (+X) direction.
      const kidney=new THREE.Shape();
      kidney.moveTo(0,.235);
      kidney.bezierCurveTo(-.115,.225,-.157,.13,-.151,.035);
      kidney.lineTo(-.129,-.179);
      kidney.quadraticCurveTo(0,-.281,.129,-.179);
      kidney.lineTo(.151,.035);
      kidney.bezierCurveTo(.157,.13,.115,.225,0,.235);
      const points=kidney.getPoints(30);
      const grilleFace=new THREE.ShapeGeometry(kidney,20);
      const kidneyEdge=new THREE.LineBasicMaterial({color:0xc4d1df,transparent:true,opacity:.92});
      [-1,1].forEach(side=>{
        const z=side*.175;
        const face=add(grilleFace.clone(),grille,2.513,.824,z);
        face.rotation.y=Math.PI/2;
        face.castShadow=false;
        const rimGeometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(p.x,p.y,0)));
        const rimLine=new THREE.LineLoop(rimGeometry,kidneyEdge);
        rimLine.position.set(2.524,.824,z);
        rimLine.rotation.y=Math.PI/2;
        g.add(rimLine);
        for(let k=-1;k<=1;k++){
          box(.014,.30,.013,darkAlloy,2.537,.81,z+k*.058);
        }
        // Two crisp light signatures near the outer corners of the grille.
        box(.050,.035,.20,headlight,2.505,.86,side*(w*.68));
        box(.050,.030,.11,headlight,2.502,.818,side*(w*.78));
        // Shadowline side vent behind front wheel.
        box(.23,.155,.032,carbon,.67,.79,side*(w*1.025));
        box(.035,.12,.034,alloys,.79,.79,side*(w*1.047));
        // Contoured hood creases.
        const seam=new THREE.LineBasicMaterial({color:0x9cb6dc,transparent:true,opacity:.35});
        line([[.91,1.03,side*.32],[1.59,1.003,side*.50],[2.05,.85,side*.58]],seam);
        // Competition quad exhaust: two existing inner tips plus two outer tips.
        const tip=add(new THREE.CylinderGeometry(.115,.115,.16,14),alloys,-2.48,.58,side*.82);
        tip.rotation.z=Math.PI/2;
      });
      // Subtle boot spoiler / diffuser, without a track wing.
      box(.23,.065,1.55,paint,-2.31,1.085,0);
      box(.12,.062,1.51,carbon,-2.39,.48,0);
    }else if(spec.id==='titan-s'){
      // Sculpted muscle-car hood intake.
      box(.52,.075,.67,carbon,1.08,hood+.18,0);
      box(.065,.09,.50,grille,1.34,hood+.19,0);
    }else if(spec.id==='apex-z'){
      [-1,1].forEach(side=>box(.49,.034,.25,carbon,1.27,hood+.095,side*w*.52));
    }else if(spec.id==='vortex-r'){
      [-1,1].forEach(side=>box(.39,.055,.22,carbon,-1.38,tail+.092,side*w*.53));
    }
    // Twin polished exhaust outlets; their turbo flames remain tied to existing boost state.
    const flames=[];
    [-1,1].forEach(side=>{
      const tip=add(new THREE.CylinderGeometry(.115,.115,.16,14),alloys,-2.47,.58,side*.57);
      tip.rotation.z=Math.PI/2;
      const flame=add(new THREE.ConeGeometry(.13,.60,9),
        new THREE.MeshBasicMaterial({color:0x2fd4ff,transparent:true,opacity:.84,depthWrite:false}),
        -2.78,.59,side*.57);
      flame.rotation.z=Math.PI/2;flame.visible=false;flames.push(flame);
    });
    g.userData.model=spec.id;g.userData.driverName=name;g.userData.flames=flames;
    const label=nameTag(name,spec.paint||color);
    g.userData.nameSprite=label;
    g.add(label);
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
      const model=window.MidnightGarage?.get?.(p.car)?.id||'vortex-r';
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
  // Lightweight highway traffic models. Positions come ONLY from the host world.
  function buildTrafficCar(t){
    const kind=t.kind||'sedan',truck=kind==='truck',suv=kind==='suv';
    const group=new THREE.Group(),paint=mat(t.color||'#a6b1be',.43,.32),
      glass=mat(0x163044,.24,.38),dark=mat(0x121821,.83,.07),
      tire=mat(0x080b10,.98),alloy=mat(0xbac5cb,.34,.65),
      white=mat(0xbcecff,.39,.04,0x9ddcff),red=mat(0xff4a56,.32,.05,0xff132a);
    const add=(geo,m,x,y,z)=>{
      const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);
      o.castShadow=false;o.receiveShadow=false;group.add(o);return o;
    };
    const length=truck?6.2:suv?4.35:3.95,width=truck?2.05:suv?1.88:1.78;
    add(new THREE.BoxGeometry(length,.56,width),paint,0,.69,0);
    if(truck){
      add(new THREE.BoxGeometry(3.10,1.37,width*.93),paint,-1.03,1.42,0);
      add(new THREE.BoxGeometry(1.24,1.06,width*.84),glass,2.00,1.30,0);
      add(new THREE.BoxGeometry(.10,.76,width*.85),dark,1.20,1.32,0);
    }else{
      add(new THREE.BoxGeometry(suv?2.25:1.91,suv?.83:.65,width*.81),glass,-.24,suv?1.27:1.18,0);
      add(new THREE.BoxGeometry(.25,.16,width*.90),dark,-length*.45,1.0,0);
    }
    [-1,1].forEach(side=>{
      const z=side*(width*.52),wheelX=truck?[-2.16,1.89]:[-1.20,1.17];
      wheelX.forEach(x=>{
        const w=add(new THREE.CylinderGeometry(.36,.36,.27,12),tire,x,.47,z);w.rotation.x=Math.PI/2;
        const hub=add(new THREE.CylinderGeometry(.20,.20,.29,12),alloy,x,.47,side*(width*.55));
        hub.rotation.x=Math.PI/2;
      });
      add(new THREE.BoxGeometry(.075,.16,.29),white,length*.505,.76,side*width*.32);
      add(new THREE.BoxGeometry(.078,.14,.30),red,-length*.505,.76,side*width*.32);
    });
    if(kind==='taxi'){
      add(new THREE.BoxGeometry(.85,.20,.55),mat(0xf2c74f,.6,.05),-.15,1.64,0);
    }
    group.userData.kind=kind;
    return group;
  }
  function syncTraffic(traffic){
    const active=new Set();
    (traffic||[]).forEach(t=>{
      active.add(t.id);
      let m=trafficMeshes.get(t.id);
      if(m&&m.userData.kind!==t.kind){sc.remove(m);trafficMeshes.delete(t.id);m=null;}
      if(!m){m=buildTrafficCar(t);sc.add(m);trafficMeshes.set(t.id,m);}
      const goal=wp(t.x,t.y);goal.y=.055;
      if(m.position.distanceToSquared(goal)>4900)m.position.copy(goal);
      else m.position.lerp(goal,.29);
      m.rotation.set(0,-(t.a||0),0);
      m.visible=true;
    });
    for(const [id,m] of trafficMeshes){
      if(!active.has(id)){
        sc.remove(m);
        m.traverse(o=>{o.geometry?.dispose?.();if(o.material)o.material.dispose?.();});
        trafficMeshes.delete(id);
      }
    }
  }

  function resize(){if(!r)return;const b=canvas.getBoundingClientRect(),w=Math.max(320,b.width|0),h=Math.max(240,b.height|0);r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}

  function init(c){
    if(ready)return true;canvas=c;if(typeof THREE==='undefined')return false;
    r=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});r.setPixelRatio(Math.min(devicePixelRatio||1,1.75));r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFSoftShadowMap;r.outputColorSpace=THREE.SRGBColorSpace;r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=1.1;
    sc=new THREE.Scene();sc.background=new THREE.Color(0x879caf);sc.fog=new THREE.Fog(0x879caf,140,465);
    cam=new THREE.PerspectiveCamera(72,16/9,.1,600);cam.position.set(0,8,14);look=new THREE.Vector3();
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
    if(!ready||!world?.players)return;ensureCars(world.players);syncTraffic(world.traffic||[]);const frameNow=performance.now(),dt=Math.min(.04,(frameNow-lastFrame)/1000);lastFrame=frameNow;updateEffects(dt);updateWalkers(dt,frameNow);const now=Date.now();
    Object.entries(world.players).forEach(([id,s])=>{
      const m=cars[id],p=wp(s.x,s.y),power=Math.max(.25,Math.min(1,s.crashPower||.5)),air=boostHeight(s,now);m.position.set(p.x,.05+air,p.z);m.rotation.y=-s.a;
      // Don't cover the player's car or road with their own name; only label nearby rivals.
      const nameSprite=m.userData.nameSprite,self=world.players[myId];
      if(nameSprite)nameSprite.visible=(id!==myId)&&!!self&&s.x>self.x-450&&s.x<self.x+1500;
      m.userData.flames?.forEach((f,i)=>{f.visible=air>.15;if(f.visible)f.scale.y=.9+Math.sin(now*.04+i)*.15;});
      if((s.crashSeq||0)!==(lastCrash[id]||0)){lastCrash[id]=s.crashSeq||0;if(s.crashSeq)spawnImpact(m.position.clone(),power);}
      if(air>0){const total=Math.max(1,(s.boostUntil||0)-(s.boostStart||0)),t=Math.max(0,Math.min(1,(now-(s.boostStart||0))/total));m.rotation.z*=.82;m.rotation.x=-Math.sin(Math.PI*t)*.16;}
      else if(s.crashUntil&&now<s.crashUntil){const pulse=Math.sin(now*.045+Number(id.slice(1)));m.rotation.z=pulse*.10*power;m.rotation.x=Math.cos(now*.05)*.04*power;m.position.y=.05+Math.abs(pulse)*.15*power;}else{m.rotation.z*=.78;m.rotation.x*=.78;}
    });
    // Elevated, farther-back chase camera with its focus far along the road.
    // The larger forward view helps drivers spot slow traffic before overtaking it.
    const me=world.players[myId];if(!me)return;
    const p=wp(me.x,me.y),d=new THREE.Vector3(Math.cos(me.a),0,Math.sin(me.a));
    const f=Math.min(1,Math.abs(me.v)/520),air=boostHeight(me,now);
    const behind=17.5+f*3.5,lookAhead=17+f*10;
    const tc=new THREE.Vector3(p.x-d.x*behind,9.3+f*.8+air*.24,p.z-d.z*behind);
    if(!air&&me.crashUntil&&now<me.crashUntil){
      const power=Math.max(.25,Math.min(1,me.crashPower||.5)),shake=(.22+.62*power)*.55;
      tc.x+=Math.sin(now*.095)*shake;tc.y+=Math.sin(now*.12)*shake*.55;tc.z+=Math.cos(now*.105)*shake;
    }
    cam.position.lerp(tc,.12);
    look.lerp(new THREE.Vector3(p.x+d.x*lookAhead,.78+air*.27,p.z+d.z*lookAhead),.15);
    cam.lookAt(look);
    cam.fov=(cam.aspect<1.05?76:71)+f*5+(air>0?3:0);
    cam.updateProjectionMatrix();
    if(skyGroup)skyGroup.position.set(cam.position.x,0,cam.position.z);
    resize();r.render(sc,cam);
  }

  const colorFor=id=>COLORS[id]||'#fff';window.Midnight3D={init,update,track:T,scale:S,colorFor};
})();