(() => {
  const mini=document.querySelector('#minimap');if(!mini||!window.Midnight3D)return;
  const ctx=mini.getContext('2d'),W=mini.width,H=mini.height,PAD=10;
  const COLORS={p1:'#ffd23f',p2:'#45d6ff',p3:'#ff5f7e',p4:'#70ff9c',p5:'#c58cff',p6:'#ff9b45'};
  const track=Midnight3D.track;
  const start=()=>track.startX||115,finish=()=>track.finishX||60000;
  const sx=x=>PAD+(x-start())*(W-PAD*2)/Math.max(1,finish()-start());
  const sy=y=>PAD+(y-180)*(H-PAD*2)/290;
  function bg(){ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(4,7,11,.94)';ctx.fillRect(0,0,W,H);ctx.fillStyle='#171a1f';ctx.strokeStyle='#737a84';ctx.lineWidth=1.2;ctx.fillRect(PAD,sy(205),W-PAD*2,sy(445)-sy(205));ctx.strokeRect(PAD,sy(205),W-PAD*2,sy(445)-sy(205));}
  function finishLine(){const x=sx(finish()),y1=sy(205),y2=sy(445);for(let y=y1,n=0;y<y2;y+=4,n++)for(let c=0;c<2;c++){ctx.fillStyle=(n+c)%2?'#fff':'#111318';ctx.fillRect(x-8+c*4,y,4,4);}ctx.fillStyle='#fff';ctx.font='700 9px system-ui';ctx.fillText('FINISH',W-48,12);}
  function car(p,id,isMe){const x=sx(p.x),y=sy(p.y),color=COLORS[id]||'#fff';ctx.save();ctx.translate(x,y);ctx.rotate(p.a||0);ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-4,-4);ctx.lineTo(-3,0);ctx.lineTo(-4,4);ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.strokeStyle=isMe?'#fff':'#000';ctx.lineWidth=isMe?2:1;ctx.stroke();ctx.restore();if(isMe){ctx.fillStyle='#fff';ctx.font='800 8px system-ui';ctx.fillText('YOU',Math.min(W-24,x+5),Math.max(9,y-6));}}
  function draw(world,myId){if(!world?.players)return;bg();finishLine();const me=world.players[myId];if(me){ctx.save();ctx.setLineDash([5,4]);ctx.strokeStyle='#ffd23f';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(sx(me.x),sy(me.y));ctx.lineTo(sx(finish()),sy(me.y));ctx.stroke();ctx.restore();}Object.entries(world.players).forEach(([id,p])=>car(p,id,id===myId));ctx.fillStyle='rgba(255,255,255,.75)';ctx.font='700 9px system-ui';ctx.fillText('3:00 HIGHWAY RACE',10,H-8);}
  const original=Midnight3D.update;Midnight3D.update=function(world,myId){original(world,myId);draw(world,myId);};window.MidnightMap={draw};
})();
