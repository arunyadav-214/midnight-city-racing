(() => {
  if (!window.mqtt?.connect) return;

  const RealPeer = window.Peer;
  // Prefer a standard HTTPS/WSS port so mobile carriers and international
  // networks are much less likely to block the relay connection.
  const BROKERS = [
    'wss://mqtt.eclipseprojects.io:443/mqtt',
    'wss://broker.emqx.io:8084/mqtt'
  ];
  const PREFIX = 'mcr-global-r14-443-5c21';

  const uid = (n=10) => {
    const a='abcdefghijklmnopqrstuvwxyz0123456789';
    let s='';
    for(let i=0;i<n;i++) s+=a[Math.floor(Math.random()*a.length)];
    return s;
  };

  class Emitter {
    constructor(){ this._events = new Map(); }
    on(name,fn){
      if(!this._events.has(name)) this._events.set(name,[]);
      this._events.get(name).push(fn);
      return this;
    }
    _emit(name,...args){
      (this._events.get(name)||[]).slice().forEach(fn=>{ try{ fn(...args); }catch(e){ console.error(e); } });
    }
  }

  class BrokerBridge {
    constructor(){
      this.clients=[];
      this.subs=new Map();
      this.seen=new Set();
      this.ready=false;
      this.readyHandlers=[];
      this.failHandlers=[];
      this.connectedCount=0;
      this.initialSettled=0;
      this.primaryReady=false;

      BROKERS.forEach((url,index)=>{
        let everConnected=false;
        let initialErrorCounted=false;
        const client=mqtt.connect(url,{
          clientId:`mcr_${uid(14)}_${index}`,
          clean:true,
          reconnectPeriod:1200,
          connectTimeout:index===0?7000:5500,
          keepalive:20,
          protocolVersion:4,
          resubscribe:true
        });
        client.__mcrIndex=index;
        this.clients.push(client);

        client.on('connect',()=>{
          if(!everConnected){ everConnected=true; this.initialSettled++; }
          if(index===0) this.primaryReady=true;
          this.connectedCount=this.clients.filter(c=>c.connected).length;
          this.subs.forEach((_,topic)=>client.subscribe(topic,{qos:1}));
          if(!this.ready){
            this.ready=true;
            this.readyHandlers.splice(0).forEach(fn=>{try{fn()}catch(_){}});
          }
          this._paintStatus();
        });
        client.on('offline',()=>{ this.connectedCount=this.clients.filter(c=>c.connected).length; this._paintStatus(); });
        client.on('close',()=>{ this.connectedCount=this.clients.filter(c=>c.connected).length; this._paintStatus(); });
        client.on('error',()=>{
          if(!everConnected&&!initialErrorCounted){
            initialErrorCounted=true;
            this.initialSettled=Math.min(BROKERS.length,this.initialSettled+1);
            if(this.initialSettled>=BROKERS.length&&!this.ready){
              this.failHandlers.forEach(fn=>{try{fn()}catch(_){}});
            }
          }
        });
        client.on('message',(topic,buf)=>this._route(topic,buf));
      });
    }

    _paintStatus(){
      const s=document.querySelector('#status');
      if(!s) return;
      if(this.primaryReady && /Ready|Creating|Connecting|Global relay/.test(s.textContent||'')) s.textContent='Global relay · WSS 443 online';
    }

    onReady(fn){ if(this.ready) setTimeout(fn,0); else this.readyHandlers.push(fn); }
    onFail(fn){ this.failHandlers.push(fn); }

    subscribe(topic,fn){
      if(!this.subs.has(topic)) this.subs.set(topic,[]);
      this.subs.get(topic).push(fn);
      this.clients.forEach(c=>{ if(c.connected) c.subscribe(topic,{qos:1}); });
    }

    publish(topic,payload,qos=0){
      const packet=JSON.stringify({mid:`${Date.now().toString(36)}-${uid(8)}`,payload});
      let sent=0;
      // Prefer the port-443 broker. Also mirror to any other connected broker
      // so both peers still have a common path if possible.
      const connected=this.clients.filter(c=>c.connected).sort((a,b)=>(a.__mcrIndex||0)-(b.__mcrIndex||0));
      connected.forEach(c=>{
        try{ c.publish(topic,packet,{qos,retain:false}); sent++; }catch(_){ }
      });
      return sent>0;
    }

    _route(topic,buf){
      let msg;
      try{ msg=JSON.parse(buf.toString()); }catch(_){ return; }
      if(!msg?.mid) return;
      if(this.seen.has(msg.mid)) return;
      this.seen.add(msg.mid);
      if(this.seen.size>2500) this.seen.clear();
      (this.subs.get(topic)||[]).slice().forEach(fn=>{ try{fn(msg.payload)}catch(e){console.error(e);} });
    }

    close(){
      this.clients.forEach(c=>{ try{c.end(true);}catch(_){ } });
      this.clients=[];
      this.subs.clear();
    }
  }

  class RelayConnection extends Emitter {
    constructor(owner,room,guestId,role){
      super();
      this.owner=owner;
      this.room=room;
      this.guestId=guestId;
      this.role=role;
      this.peer=role==='host'?guestId:`midnight-city-racing-${room}`;
      this.metadata=null;
      this.open=role==='host';
      this._closed=false;
      this._queue=[];
      this._lastWorld=0;
    }

    on(name,fn){
      super.on(name,fn);
      if(name==='open'&&this.open) setTimeout(()=>{ if(this.open&&!this._closed) fn(); },0);
      return this;
    }

    _topic(direction){
      const base=`${PREFIX}/${this.room}`;
      return direction==='to'?`${base}/to/${this.guestId}`:`${base}/from/${this.guestId}`;
    }

    _markOpen(){
      if(this._closed||this.open) return;
      this.open=true;
      this._emit('open');
      while(this._queue.length&&this.open){
        const d=this._queue.shift();
        this.send(d);
      }
    }

    send(data){
      if(this._closed) return;
      if(!this.open){ this._queue.push(data); return; }
      if(this.role==='host'&&data?.type==='world'){
        const now=performance.now();
        if(now-this._lastWorld<90) return;
        this._lastWorld=now;
      }
      const topic=this.role==='host'?this._topic('to'):this._topic('from');
      const unreliable=data?.type==='world'||data?.type==='input';
      this.owner._bridge.publish(topic,{sys:'data',data},unreliable?0:1);
    }

    _receive(packet){
      if(this._closed||!packet) return;
      if(packet.sys==='open'){ this._markOpen(); return; }
      if(packet.sys==='close'){ this._closeLocal(); return; }
      if(packet.sys==='data') this._emit('data',packet.data);
    }

    close(){
      if(this._closed) return;
      const topic=this.role==='host'?this._topic('to'):this._topic('from');
      this.owner._bridge.publish(topic,{sys:'close'},1);
      this._closeLocal();
    }

    _closeLocal(){
      if(this._closed) return;
      this._closed=true;
      const wasOpen=this.open;
      this.open=false;
      if(wasOpen) this._emit('close');
    }
  }

  class RelayPeer extends Emitter {
    constructor(id,options){
      super();
      if(id&&typeof id==='object'){ options=id; id=undefined; }
      this.id=id||`mcr-guest-${uid(10)}`;
      this.destroyed=false;
      this.disconnected=false;
      this._bridge=new BrokerBridge();
      this._hostRoom=id?.startsWith('midnight-city-racing-')?id.slice('midnight-city-racing-'.length):null;
      this._connections=new Map();
      this._pendingConnections=[];
      this._opened=false;

      if(this._hostRoom) this._setupHost(this._hostRoom);

      this._bridge.onReady(()=>{
        if(this.destroyed) return;
        this._opened=true;
        this._emit('open',this.id);
      });
      this._bridge.onFail(()=>{
        if(!this._opened&&!this.destroyed) this._emit('error',{type:'network',message:'Global relay unavailable'});
      });
    }

    on(name,fn){
      super.on(name,fn);
      if(name==='open'&&this._opened) setTimeout(()=>{if(!this.destroyed) fn(this.id);},0);
      if(name==='connection'&&this._pendingConnections.length){
        const pending=this._pendingConnections.splice(0);
        pending.forEach(c=>setTimeout(()=>{if(!this.destroyed) fn(c);},0));
      }
      return this;
    }

    _deliverConnection(conn){
      if((this._events.get('connection')||[]).length) this._emit('connection',conn);
      else this._pendingConnections.push(conn);
    }

    _setupHost(room){
      const joinTopic=`${PREFIX}/${room}/join`;
      this._bridge.subscribe(joinTopic,msg=>{
        const guestId=msg?.guestId;
        if(!guestId||this.destroyed) return;
        let conn=this._connections.get(guestId);
        if(conn?._closed){ this._connections.delete(guestId); conn=null; }
        if(!conn){
          conn=new RelayConnection(this,room,guestId,'host');
          this._connections.set(guestId,conn);
          this._bridge.subscribe(`${PREFIX}/${room}/from/${guestId}`,p=>conn._receive(p));
          this._deliverConnection(conn);
        }
        setTimeout(()=>this._bridge.publish(`${PREFIX}/${room}/to/${guestId}`,{sys:'open'},1),80);
      });
    }

    connect(targetId,options={}){
      const room=String(targetId||'').replace(/^midnight-city-racing-/,'');
      const guestId=`g${uid(12)}`;
      const conn=new RelayConnection(this,room,guestId,'guest');
      conn.metadata=options.metadata;
      this._connections.set(guestId,conn);
      this._bridge.subscribe(`${PREFIX}/${room}/to/${guestId}`,p=>conn._receive(p));

      let attempts=0;
      const announce=()=>{
        if(this.destroyed||conn.open||conn._closed) return;
        attempts++;
        this._bridge.publish(`${PREFIX}/${room}/join`,{guestId},1);
        const s=document.querySelector('#status');
        if(s&&!conn.open) s.textContent=`Connecting globally on 443… ${Math.min(attempts,12)}`;
      };
      this._bridge.onReady(()=>{
        announce();
        const timer=setInterval(()=>{
          if(conn.open||conn._closed||this.destroyed){ clearInterval(timer); return; }
          announce();
          if(attempts>=15){
            clearInterval(timer);
            conn._emit('error',new Error('Global relay room handshake timed out.'));
          }
        },1000);
      });
      return conn;
    }

    reconnect(){ this.disconnected=false; }

    destroy(){
      if(this.destroyed) return;
      this.destroyed=true;
      this._connections.forEach(c=>{try{c.close();}catch(_){}});
      this._connections.clear();
      this._bridge.close();
    }
  }

  window.Peer=RelayPeer;
  window.MidnightNetwork={
    build:'global-relay-r14-443',
    transport:'mqtt-over-wss',
    primaryBroker:'mqtt.eclipseprojects.io:443/mqtt',
    brokers:BROKERS,
    note:'Public relay transport; do not send sensitive information.'
  };
  window.MidnightDirectPeer=RealPeer;
})();