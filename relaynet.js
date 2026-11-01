(() => {
  const RealPeer = window.Peer;
  if (typeof WebSocket !== 'function') return;

  const ENDPOINTS = [
    'wss://mqtt.eclipseprojects.io:443/mqtt',
    'wss://broker.emqx.io:8084/mqtt'
  ];
  const PREFIX = 'mcr-native-r15-443-b7d2';
  const te = new TextEncoder();
  const td = new TextDecoder();

  const uid = (n=10) => {
    const a='abcdefghijklmnopqrstuvwxyz0123456789';
    let s='';
    for(let i=0;i<n;i++) s+=a[Math.floor(Math.random()*a.length)];
    return s;
  };
  const concat = (...parts) => {
    const len=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(len);
    let at=0; parts.forEach(p=>{out.set(p,at);at+=p.length;}); return out;
  };
  const u16 = n => new Uint8Array([(n>>8)&255,n&255]);
  const mqttString = s => { const b=te.encode(String(s)); return concat(u16(b.length),b); };
  const remLen = n => { const a=[]; do{let d=n%128;n=Math.floor(n/128);if(n>0)d|=128;a.push(d);}while(n>0);return new Uint8Array(a); };
  const frame = (header,body) => concat(new Uint8Array([header]),remLen(body.length),body);

  class Emitter {
    constructor(){this._events=new Map();}
    on(name,fn){if(!this._events.has(name))this._events.set(name,[]);this._events.get(name).push(fn);return this;}
    _emit(name,...args){(this._events.get(name)||[]).slice().forEach(fn=>{try{fn(...args)}catch(e){console.error(e)}});}
  }

  class NativeMqttSocket {
    constructor(url,index,onPacket,onState){
      this.url=url;this.index=index;this.onPacket=onPacket;this.onState=onState;
      this.ws=null;this.connected=false;this.closed=false;this.topics=new Set();this.packetId=1;
      this.reconnectTimer=null;this.pingTimer=null;this.handshakeTimer=null;
      this.connect();
    }
    connect(){
      if(this.closed)return;
      clearTimeout(this.reconnectTimer);clearTimeout(this.handshakeTimer);
      let ws;
      try{ws=new WebSocket(this.url,['mqtt']);}catch(_){this.scheduleReconnect();return;}
      this.ws=ws;ws.binaryType='arraybuffer';
      ws.onopen=()=>{
        const clientId=`mcr${uid(18)}`.slice(0,23);
        const variable=concat(mqttString('MQTT'),new Uint8Array([4,2,0,20]),mqttString(clientId));
        this.sendRaw(frame(0x10,variable));
        this.handshakeTimer=setTimeout(()=>{if(!this.connected)try{ws.close()}catch(_){}},5000);
      };
      ws.onmessage=e=>this.parse(e.data);
      ws.onerror=()=>{};
      ws.onclose=()=>{
        const was=this.connected;this.connected=false;clearInterval(this.pingTimer);clearTimeout(this.handshakeTimer);
        if(was)this.onState?.();
        this.scheduleReconnect();
      };
    }
    scheduleReconnect(){if(this.closed)return;clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>this.connect(),1200+Math.random()*700);}
    sendRaw(bytes){if(this.ws?.readyState===WebSocket.OPEN)try{this.ws.send(bytes)}catch(_){} }
    subscribe(topic){
      this.topics.add(topic);if(!this.connected)return;
      const id=(this.packetId++%65534)+1,body=concat(u16(id),mqttString(topic),new Uint8Array([0]));
      this.sendRaw(frame(0x82,body));
    }
    publish(topic,text){
      if(!this.connected)return false;
      const body=concat(mqttString(topic),te.encode(text));this.sendRaw(frame(0x30,body));return true;
    }
    parse(data){
      let bytes;
      if(data instanceof ArrayBuffer)bytes=new Uint8Array(data);
      else if(ArrayBuffer.isView(data))bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
      else return;
      let pos=0;
      while(pos<bytes.length){
        const header=bytes[pos++];let mul=1,len=0,d=0;
        do{if(pos>=bytes.length)return;d=bytes[pos++];len+=(d&127)*mul;mul*=128;}while(d&128);
        if(pos+len>bytes.length)return;
        const body=bytes.slice(pos,pos+len);pos+=len;const type=header>>4;
        if(type===2){
          if(body.length>=2&&body[1]===0){
            clearTimeout(this.handshakeTimer);this.connected=true;
            this.topics.forEach(t=>this.subscribe(t));
            clearInterval(this.pingTimer);this.pingTimer=setInterval(()=>this.sendRaw(new Uint8Array([0xc0,0x00])),12000);
            this.onState?.();
          }
        }else if(type===3){
          if(body.length<2)continue;const tl=(body[0]<<8)|body[1];if(body.length<2+tl)continue;
          const topic=td.decode(body.slice(2,2+tl));let p=2+tl;const qos=(header>>1)&3;if(qos>0)p+=2;
          const payload=td.decode(body.slice(p));this.onPacket?.(topic,payload);
        }
      }
    }
    end(){this.closed=true;clearTimeout(this.reconnectTimer);clearTimeout(this.handshakeTimer);clearInterval(this.pingTimer);try{this.ws?.close()}catch(_){} }
  }

  class BrokerBridge {
    constructor(){
      this.subs=new Map();this.seen=new Set();this.ready=false;this.readyHandlers=[];this.failHandlers=[];this.closed=false;
      this.sockets=ENDPOINTS.map((url,i)=>new NativeMqttSocket(url,i,(t,p)=>this.route(t,p),()=>this.stateChanged()));
      this.failTimer=setTimeout(()=>{if(!this.ready&&!this.closed)this.failHandlers.forEach(fn=>{try{fn()}catch(_){}})},9000);
    }
    stateChanged(){
      if(this.closed)return;
      const online=this.sockets.filter(s=>s.connected);
      if(online.length&&!this.ready){this.ready=true;clearTimeout(this.failTimer);this.readyHandlers.splice(0).forEach(fn=>{try{fn()}catch(_){}});}
      const status=document.querySelector('#status');
      if(status&&online.some(s=>s.index===0)&&/Ready|Creating|Connecting|Global relay/.test(status.textContent||''))status.textContent='Global relay · native WSS 443 online';
    }
    onReady(fn){if(this.ready)setTimeout(fn,0);else this.readyHandlers.push(fn);}
    onFail(fn){this.failHandlers.push(fn);}
    subscribe(topic,fn){if(!this.subs.has(topic))this.subs.set(topic,[]);this.subs.get(topic).push(fn);this.sockets.forEach(s=>s.subscribe(topic));}
    publish(topic,payload,reliable=false){
      const packet={mid:`${Date.now().toString(36)}-${uid(8)}`,payload};const text=JSON.stringify(packet);
      const send=()=>this.sockets.forEach(s=>s.publish(topic,text));send();
      if(reliable){setTimeout(send,120);setTimeout(send,420);}return this.sockets.some(s=>s.connected);
    }
    route(topic,text){
      let msg;try{msg=JSON.parse(text)}catch(_){return;}if(!msg?.mid||this.seen.has(msg.mid))return;
      this.seen.add(msg.mid);if(this.seen.size>3000)this.seen.clear();
      (this.subs.get(topic)||[]).slice().forEach(fn=>{try{fn(msg.payload)}catch(e){console.error(e)}});
    }
    close(){this.closed=true;clearTimeout(this.failTimer);this.sockets.forEach(s=>s.end());this.subs.clear();}
  }

  class RelayConnection extends Emitter {
    constructor(owner,room,guestId,role){
      super();this.owner=owner;this.room=room;this.guestId=guestId;this.role=role;
      this.peer=role==='host'?guestId:`midnight-city-racing-${room}`;this.metadata=null;this.open=role==='host';this._closed=false;this._queue=[];this._lastWorld=0;
    }
    on(name,fn){super.on(name,fn);if(name==='open'&&this.open)setTimeout(()=>{if(this.open&&!this._closed)fn()},0);return this;}
    _topic(direction){const base=`${PREFIX}/${this.room}`;return direction==='to'?`${base}/to/${this.guestId}`:`${base}/from/${this.guestId}`;}
    _markOpen(){if(this._closed||this.open)return;this.open=true;this._emit('open');while(this._queue.length&&this.open)this.send(this._queue.shift());}
    send(data){
      if(this._closed)return;if(!this.open){this._queue.push(data);return;}
      if(this.role==='host'&&data?.type==='world'){const now=performance.now();if(now-this._lastWorld<90)return;this._lastWorld=now;}
      const topic=this.role==='host'?this._topic('to'):this._topic('from');const important=!['world','input'].includes(data?.type);
      this.owner._bridge.publish(topic,{sys:'data',data},important);
    }
    _receive(packet){if(this._closed||!packet)return;if(packet.sys==='open'){this._markOpen();return;}if(packet.sys==='close'){this._closeLocal();return;}if(packet.sys==='data')this._emit('data',packet.data);}
    close(){if(this._closed)return;const topic=this.role==='host'?this._topic('to'):this._topic('from');this.owner._bridge.publish(topic,{sys:'close'},true);this._closeLocal();}
    _closeLocal(){if(this._closed)return;this._closed=true;const was=this.open;this.open=false;if(was)this._emit('close');}
  }

  class RelayPeer extends Emitter {
    constructor(id,options){
      super();if(id&&typeof id==='object'){options=id;id=undefined;}
      this.id=id||`mcr-guest-${uid(10)}`;this.destroyed=false;this.disconnected=false;this._bridge=new BrokerBridge();
      this._hostRoom=id?.startsWith('midnight-city-racing-')?id.slice('midnight-city-racing-'.length):null;
      this._connections=new Map();this._pendingConnections=[];this._opened=false;if(this._hostRoom)this._setupHost(this._hostRoom);
      this._bridge.onReady(()=>{if(this.destroyed)return;this._opened=true;this._emit('open',this.id)});
      this._bridge.onFail(()=>{if(!this._opened&&!this.destroyed)this._emit('error',{type:'network',message:'Native WSS relay unavailable'})});
    }
    on(name,fn){super.on(name,fn);if(name==='open'&&this._opened)setTimeout(()=>{if(!this.destroyed)fn(this.id)},0);if(name==='connection'&&this._pendingConnections.length){const p=this._pendingConnections.splice(0);p.forEach(c=>setTimeout(()=>{if(!this.destroyed)fn(c)},0));}return this;}
    _deliverConnection(c){if((this._events.get('connection')||[]).length)this._emit('connection',c);else this._pendingConnections.push(c);}
    _setupHost(room){
      this._bridge.subscribe(`${PREFIX}/${room}/join`,msg=>{
        const guestId=msg?.guestId;if(!guestId||this.destroyed)return;let conn=this._connections.get(guestId);
        if(conn?._closed){this._connections.delete(guestId);conn=null;}
        if(!conn){conn=new RelayConnection(this,room,guestId,'host');this._connections.set(guestId,conn);this._bridge.subscribe(`${PREFIX}/${room}/from/${guestId}`,p=>conn._receive(p));this._deliverConnection(conn);}
        setTimeout(()=>this._bridge.publish(`${PREFIX}/${room}/to/${guestId}`,{sys:'open'},true),100);
      });
    }
    connect(targetId,options={}){
      const room=String(targetId||'').replace(/^midnight-city-racing-/,'');const guestId=`g${uid(12)}`;const conn=new RelayConnection(this,room,guestId,'guest');conn.metadata=options.metadata;
      this._connections.set(guestId,conn);this._bridge.subscribe(`${PREFIX}/${room}/to/${guestId}`,p=>conn._receive(p));let attempts=0;
      const announce=()=>{if(this.destroyed||conn.open||conn._closed)return;attempts++;this._bridge.publish(`${PREFIX}/${room}/join`,{guestId},true);const s=document.querySelector('#status');if(s&&!conn.open)s.textContent=`Connecting globally on native 443… ${Math.min(attempts,15)}`;};
      this._bridge.onReady(()=>{setTimeout(announce,180);const timer=setInterval(()=>{if(conn.open||conn._closed||this.destroyed){clearInterval(timer);return;}announce();if(attempts>=15){clearInterval(timer);conn._emit('error',new Error('International room handshake timed out.'));}},1000);});
      return conn;
    }
    reconnect(){this.disconnected=false;}
    destroy(){if(this.destroyed)return;this.destroyed=true;this._connections.forEach(c=>{try{c.close()}catch(_){}});this._connections.clear();this._bridge.close();}
  }

  window.Peer=RelayPeer;
  window.MidnightNetwork={build:'native-global-r15',transport:'native-mqtt-over-wss',primary:'mqtt.eclipseprojects.io:443/mqtt',endpoints:ENDPOINTS};
  window.MidnightDirectPeer=RealPeer;
})();