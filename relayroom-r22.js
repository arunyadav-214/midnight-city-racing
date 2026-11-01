(() => {
  if (!window.mqtt?.connect) return;

  const BROKERS = [
    { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
    { name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
    { name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' }
  ];
  const PREFIX = 'mcr-room-r22-b81d';

  const uid = (n = 12) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  };

  class Emitter {
    constructor() { this.events = new Map(); }
    on(name, fn) {
      if (!this.events.has(name)) this.events.set(name, []);
      this.events.get(name).push(fn);
      return this;
    }
    emit(name, ...args) {
      (this.events.get(name) || []).slice().forEach(fn => {
        try { fn(...args); } catch (err) { console.error(err); }
      });
    }
  }

  class Bridge {
    constructor() {
      this.clients = [];
      this.subs = new Map();
      this.seen = new Set();
      this.ready = false;
      this.readyHandlers = [];
      this.failHandlers = [];
      this.closed = false;

      BROKERS.forEach((broker, index) => {
        const client = mqtt.connect(broker.url, {
          clientId: `mcr22_${uid(14)}_${index}`,
          clean: true,
          reconnectPeriod: 1500,
          connectTimeout: 9000,
          keepalive: 25,
          protocolVersion: 4,
          resubscribe: true
        });
        const rec = { ...broker, client, connected: false, subReady: false };
        this.clients.push(rec);

        client.on('connect', () => {
          rec.connected = true;
          this.syncSubscriptions(rec, () => {
            rec.subReady = true;
            this.markReady();
            this.updateStatus();
          });
        });

        const offline = () => {
          rec.connected = false;
          rec.subReady = false;
          this.updateStatus();
        };
        client.on('offline', offline);
        client.on('close', offline);
        client.on('error', offline);

        client.on('message', (topic, payload) => {
          let packet;
          try { packet = JSON.parse(payload.toString()); } catch (_) { return; }
          if (!packet?.mid || this.seen.has(packet.mid)) return;
          this.seen.add(packet.mid);
          if (this.seen.size > 5000) this.seen.clear();
          (this.subs.get(topic) || []).slice().forEach(fn => {
            try { fn(packet.payload); } catch (err) { console.error(err); }
          });
        });
      });

      setTimeout(() => {
        if (!this.ready && !this.closed) {
          this.failHandlers.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
        }
      }, 12000);
    }

    syncSubscriptions(rec, done) {
      const topics = [...this.subs.keys()];
      if (!topics.length) { done(); return; }
      let left = topics.length;
      const finish = () => { if (--left <= 0) done(); };
      topics.forEach(topic => {
        try { rec.client.subscribe(topic, { qos: 1 }, finish); }
        catch (_) { finish(); }
      });
      setTimeout(() => { if (left > 0) { left = 0; done(); } }, 900);
    }

    markReady() {
      if (this.ready) return;
      if (!this.clients.some(r => r.connected && r.subReady)) return;
      this.ready = true;
      this.readyHandlers.splice(0).forEach(fn => { try { fn(); } catch (_) {} });
    }

    onlineCount() { return this.clients.filter(r => r.connected).length; }

    updateStatus() {
      const e = document.querySelector('#status');
      if (!e) return;
      const n = this.onlineCount();
      if (n > 0 && /Ready|Creating|Connecting|Connection error|relay|reconnecting/i.test(e.textContent || '')) {
        e.textContent = `Global relay online · ${n}/${BROKERS.length}`;
      } else if (n === 0 && this.ready) {
        e.textContent = 'Relay reconnecting…';
      }
    }

    onReady(fn) { if (this.ready) setTimeout(fn, 0); else this.readyHandlers.push(fn); }
    onFail(fn) { this.failHandlers.push(fn); }

    subscribe(topic, fn) {
      if (!this.subs.has(topic)) this.subs.set(topic, []);
      this.subs.get(topic).push(fn);
      this.clients.forEach(rec => {
        if (!rec.connected) return;
        try {
          rec.client.subscribe(topic, { qos: 1 }, () => {
            rec.subReady = true;
            this.markReady();
          });
        } catch (_) {}
      });
    }

    publish(topic, payload, important = false) {
      const packet = JSON.stringify({ mid: `${Date.now().toString(36)}-${uid(10)}`, payload });
      const send = () => {
        this.clients.forEach(rec => {
          if (!rec.connected) return;
          try { rec.client.publish(topic, packet, { qos: important ? 1 : 0, retain: false }); } catch (_) {}
        });
      };
      send();
      if (important) {
        setTimeout(send, 180);
        setTimeout(send, 600);
        setTimeout(send, 1200);
      }
      return this.onlineCount() > 0;
    }

    close() {
      this.closed = true;
      this.clients.forEach(rec => { try { rec.client.end(true); } catch (_) {} });
      this.clients = [];
      this.subs.clear();
    }
  }

  class RoomConnection extends Emitter {
    constructor(owner, room, guestId, role) {
      super();
      this.owner = owner;
      this.room = room;
      this.guestId = guestId;
      this.role = role;
      this.peer = role === 'host' ? guestId : `midnight-city-racing-${room}`;
      this.open = role === 'host';
      this.closed = false;
      this.queue = [];
      this.lastWorld = 0;
    }

    on(name, fn) {
      super.on(name, fn);
      if (name === 'open' && this.open) setTimeout(() => { if (this.open && !this.closed) fn(); }, 0);
      return this;
    }

    downTopic() { return `${PREFIX}/${this.room}/down/${this.guestId}`; }
    upTopic() { return `${PREFIX}/${this.room}/up`; }

    markOpen() {
      if (this.closed || this.open) return;
      this.open = true;
      this.emit('open');
      while (this.queue.length && this.open) this.send(this.queue.shift());
    }

    send(data) {
      if (this.closed) return;
      if (!this.open) { this.queue.push(data); return; }
      if (this.role === 'host' && data?.type === 'world') {
        const now = performance.now();
        if (now - this.lastWorld < 85) return;
        this.lastWorld = now;
      }
      const important = !['world', 'input'].includes(data?.type);
      if (this.role === 'host') {
        this.owner.bridge.publish(this.downTopic(), { sys: 'data', data }, important);
      } else {
        this.owner.bridge.publish(this.upTopic(), { guestId: this.guestId, packet: { sys: 'data', data } }, important);
      }
    }

    receive(packet) {
      if (this.closed || !packet) return;
      if (packet.sys === 'open') { this.markOpen(); return; }
      if (packet.sys === 'close') { this.closeLocal(); return; }
      if (packet.sys === 'data') {
        // r22: an assignment/data packet from the host is proof the route is live.
        // Mark the guest connection open BEFORE game3d handles the assignment,
        // so its immediate {type:'join', name} reply cannot be dropped.
        if (!this.open) this.markOpen();
        this.emit('data', packet.data);
      }
    }

    close() {
      if (this.closed) return;
      if (this.role === 'host') {
        this.owner.bridge.publish(this.downTopic(), { sys: 'close' }, true);
      } else {
        this.owner.bridge.publish(this.upTopic(), { guestId: this.guestId, packet: { sys: 'close' } }, true);
      }
      this.closeLocal();
    }

    closeLocal() {
      if (this.closed) return;
      const wasOpen = this.open;
      this.closed = true;
      this.open = false;
      if (wasOpen) this.emit('close');
    }
  }

  class RoomPeer extends Emitter {
    constructor(id) {
      super();
      if (id && typeof id === 'object') id = undefined;
      this.id = id || `mcr-guest-${uid(10)}`;
      this.destroyed = false;
      this.disconnected = false;
      this.bridge = new Bridge();
      this.hostRoom = this.id.startsWith('midnight-city-racing-') ? this.id.slice('midnight-city-racing-'.length) : null;
      this.connections = new Map();
      this.pending = [];
      this.opened = false;

      if (this.hostRoom) this.setupHost(this.hostRoom);

      this.bridge.onReady(() => {
        if (this.destroyed) return;
        this.opened = true;
        this.emit('open', this.id);
      });
      this.bridge.onFail(() => {
        if (!this.opened && !this.destroyed) this.emit('error', { type: 'network', message: 'No relay could be reached.' });
      });
    }

    on(name, fn) {
      super.on(name, fn);
      if (name === 'open' && this.opened) setTimeout(() => { if (!this.destroyed) fn(this.id); }, 0);
      if (name === 'connection' && this.pending.length) {
        const list = this.pending.splice(0);
        list.forEach(c => setTimeout(() => { if (!this.destroyed) fn(c); }, 0));
      }
      return this;
    }

    deliver(conn) {
      if ((this.events.get('connection') || []).length) this.emit('connection', conn);
      else this.pending.push(conn);
    }

    ensureHostConn(room, guestId) {
      let conn = this.connections.get(guestId);
      if (conn?.closed) { this.connections.delete(guestId); conn = null; }
      if (!conn) {
        conn = new RoomConnection(this, room, guestId, 'host');
        this.connections.set(guestId, conn);
        this.deliver(conn);
      }
      return conn;
    }

    setupHost(room) {
      const up = `${PREFIX}/${room}/up`;
      this.bridge.subscribe(up, envelope => {
        const guestId = envelope?.guestId;
        const packet = envelope?.packet;
        if (!guestId || !packet || this.destroyed) return;
        const conn = this.ensureHostConn(room, guestId);
        if (packet.sys === 'hello') {
          // r22: publish OPEN immediately. wireIncomingGuest's assign runs on a
          // zero-delay callback, so this OPEN is queued before the assign packet.
          this.bridge.publish(conn.downTopic(), { sys: 'open' }, true);
          return;
        }
        if (packet.sys === 'close') { conn.closeLocal(); return; }
        setTimeout(() => conn.receive(packet), 0);
      });
    }

    connect(targetId) {
      const room = String(targetId || '').replace(/^midnight-city-racing-/, '');
      const guestId = `g${uid(12)}`;
      const conn = new RoomConnection(this, room, guestId, 'guest');
      this.connections.set(guestId, conn);
      this.bridge.subscribe(conn.downTopic(), packet => conn.receive(packet));

      let attempts = 0;
      const hello = () => {
        if (this.destroyed || conn.open || conn.closed) return;
        attempts++;
        this.bridge.publish(conn.upTopic(), { guestId, packet: { sys: 'hello' } }, true);
        const s = document.querySelector('#status');
        if (s && !conn.open) s.textContent = `Joining room… attempt ${attempts}`;
      };

      this.bridge.onReady(() => {
        setTimeout(hello, 180);
        const timer = setInterval(() => {
          if (conn.open || conn.closed || this.destroyed) { clearInterval(timer); return; }
          hello();
          if (attempts >= 20) {
            clearInterval(timer);
            this.emit('error', { type: 'network', message: 'Room handshake timed out.' });
          }
        }, 900);
      });
      return conn;
    }

    reconnect() { this.disconnected = false; }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.connections.forEach(c => { try { c.close(); } catch (_) {} });
      this.connections.clear();
      this.bridge.close();
    }
  }

  window.Peer = RoomPeer;
  window.MidnightNetwork = {
    build: 'room-uplink-r22',
    transport: 'mqtt-room-uplink-open-first',
    brokers: BROKERS.map(b => b.url)
  };
})();