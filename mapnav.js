(() => {
  const mini = document.querySelector('#minimap');
  if (!mini || !window.Midnight3D) return;

  const ctx = mini.getContext('2d');
  const W = mini.width;
  const H = mini.height;
  const PAD = 10;
  const COLORS = {
    p1:'#ffd23f', p2:'#45d6ff', p3:'#ff5f7e',
    p4:'#70ff9c', p5:'#c58cff', p6:'#ff9b45'
  };
  const targets = [
    {x:825,y:547,label:'CP 1'},
    {x:823,y:220,label:'CP 2'},
    {x:545,y:165,label:'CP 3'},
    {x:240,y:295,label:'CP 4'},
    {x:240,y:547,label:'CP 5'},
    {x:545,y:547,label:'FINISH'}
  ];

  const sx = x => PAD + x * (W - PAD * 2) / 1000;
  const sy = y => PAD + y * (H - PAD * 2) / 650;

  function roundedRect(x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
  }

  function drawFinish(){
    const x=sx(545), y1=sy(472), y2=sy(622);
    const cell=4;
    for(let y=y1,n=0;y<y2;y+=cell,n++){
      for(let col=0;col<2;col++){
        ctx.fillStyle=(n+col)%2?'#ffffff':'#111318';
        ctx.fillRect(x-4+col*4,y,4,cell);
      }
    }
    ctx.fillStyle='#ffffff';
    ctx.font='700 9px system-ui';
    ctx.fillText('FINISH',x+7,Math.max(12,y1-3));
  }

  function drawPlayer(p,id,isMe){
    const x=sx(p.x), y=sy(p.y), color=COLORS[id]||'#ffffff';
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(p.a || 0);
    ctx.beginPath();
    ctx.moveTo(7,0);
    ctx.lineTo(-5,-4.5);
    ctx.lineTo(-3,0);
    ctx.lineTo(-5,4.5);
    ctx.closePath();
    ctx.fillStyle=color;
    ctx.fill();
    ctx.lineWidth=isMe?2:1;
    ctx.strokeStyle=isMe?'#ffffff':'rgba(0,0,0,.65)';
    ctx.stroke();
    ctx.restore();
    if(isMe){
      ctx.fillStyle='#ffffff';
      ctx.font='800 9px system-ui';
      ctx.fillText('YOU',x+7,y-7);
    }
  }

  function draw(world,myId){
    if(!world?.players) return;
    const track=Midnight3D.track;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle='rgba(4,7,11,.94)';
    roundedRect(0,0,W,H,12);ctx.fill();

    ctx.fillStyle='#20242a';
    ctx.strokeStyle='#666d76';
    ctx.lineWidth=1.2;
    track.roads.forEach(r=>{
      const x=sx(r.x),y=sy(r.y),w=r.w*(W-PAD*2)/1000,h=r.h*(H-PAD*2)/650;
      ctx.fillRect(x,y,w,h);
      ctx.strokeRect(x,y,w,h);
    });

    drawFinish();

    const me=world.players[myId];
    if(me){
      const target=targets[Math.min(me.cp||0,targets.length-1)];
      const mx=sx(me.x), my=sy(me.y), tx=sx(target.x), ty=sy(target.y);
      ctx.save();
      ctx.setLineDash([5,4]);
      ctx.strokeStyle='#ffd23f';
      ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(tx,ty);ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(tx,ty,5,0,Math.PI*2);
      ctx.fillStyle=target.label==='FINISH'?'#ffffff':'#ffd23f';ctx.fill();
      ctx.strokeStyle='#111318';ctx.stroke();
      ctx.fillStyle='#ffffff';ctx.font='700 9px system-ui';
      ctx.fillText(target.label,Math.min(W-44,tx+7),Math.max(11,ty-6));
      ctx.restore();
    }

    Object.entries(world.players).forEach(([id,p])=>drawPlayer(p,id,id===myId));

    ctx.fillStyle='rgba(255,255,255,.75)';
    ctx.font='700 9px system-ui';
    ctx.fillText('LIVE NAVIGATION',10,H-8);
  }

  const originalUpdate = Midnight3D.update;
  Midnight3D.update = function(world,myId){
    originalUpdate(world,myId);
    draw(world,myId);
  };

  window.MidnightMap = { draw };
})();