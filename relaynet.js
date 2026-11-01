(() => {
  if (!window.mqtt?.connect) return;

  const BROKERS = [
    { name: 'EMQX', url: 'wss://broker.emqx.io:8084/mqtt' },
    { name: 'HiveMQ', url: 'wss://broker.hivemq.com:8884/mqtt' },
    { name: 'Mosquitto', url: 'wss://test.mosquitto.org:8081/mqtt' }
  ];
  const PREFIX = 'mcr-global-r17-91c4';

  const uid = (n = 10) => {
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

  class BrokerBridge {
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
          clientId: `mcr_${uid(16)}_${index}`,
          clean: true,
          reconnectPeriod: 1600,
          connectTimeout: 8000,
          keepalive: 30,
          protocolVersion: 4,
          resubscribe: true
        });

        const rec = { ...broker, index, client, connected: false };
        this.clients.push(rec);

        client.on('connect', () => {
          rec.connected = true;
          this.subs.forEach((_, topic) => client.subscribe(topic, { qos: 0 }));
          if (!this.ready) {
            this.ready = true;
            this.readyHandlers.splice(0).forEach(fn => {
              try { fn(); } catch (_) {}
            });
          }
          this.updateStatus();
        });

        const offline = () => {
          rec.connected = false;
          this.updateStatus();
        };
        client.on('offline', offline);
        client.on('close', offline);
        client.on('error', () => offline());

        client.on('message', (topic, payload) => {
          let packet;
          try { packet = JSON.parse(payload.toString()); } catch (_) { return; }
          if (!packet?.mid || this.seen.has(packet.mid)) return;
          this.seen.add(packet.mid);
          if (this.seen.size > 4000) this.seen.clear();
          (this.subs.get(topic) || []).slice().forEach(fn => {
            try { fn(packet.payload); } catch (err) { console.error(err); }
          });
        });
      });

      setTimeout(() => {
        if (!this.ready && !this.closed) {
          this.failHandlers.forEach(fn => { try { fn(); } catch (_) {} });
        }
      }, 12000);
    }

    onlineCount() { return this.clients.filter(r => r.connected).length; }

    updateStatus() {
      const count = this.onlineCount();
      const status = document.querySelector('#status');
      if (!status) return;
      if (count > 0 && /Ready|Creating|Connecting|Connection error|relay/i.test(status.textContent || '')) {
        status.textContent = `Global relay online · ${count}/${BROKERS.length}`;
      } else if (count === 0 && this.ready) {
        status.textContent = 'Relay reconnecting…';
      }
    }

    onReady(fn) {
      if (this.ready) setTimeout(fn, 0);
      else this.readyHandlers.push(fn);
    }

    onFail(fn) { this.failHandlers.push(fn); }

    subscribe(topic, fn) {
      if (!this.subs.has(topic)) this.subs.set(topic, []);
      this.subs.get(topic).push(fn);
      this.clients.forEach(r => {
        if (r.connected) r.client.subscribe(topic, { qos: 0 });
      });
    }

    publish(topic, payload, important = false) {
      const packet = JSON.stringify({
        mid: `${Date.now().toString(36)}-${uid(9)}`,
        payload
      });

      const send = () => {
        this.clients.forEach(r => {
          if (!r.connected) return;
          try { r.client.publish(topic, packet, { qos: 0, retain: false }); } catch (_) {}
        });
      };

      send();
      if (important) {
        setTimeout(send, 180);
        setTimeout(send, 650);
      }
      return this.onlineCount() > 0;
    }

    close() {
      this.closed = true;
      this.clients.forEach(r => {
        try { r.client.end(true); } catch (_) {}
      });
      this.clients = [];
      this.subs.clear();
    }
  }

  class RelayConnection extends Emitter {
    constructor(owner, room, guestId, role) {
      super();
      this.owner = owner;
      this.room = room;
      this.guestId = guestId;
      this.role = role;
      this.peer = role === 'host' ? guestId : `midnight-city-racing-${room}`;
      this.metadata = null;
      this.open = role === 'host';
      this.closed = false;
      this.queue = [];
      this.lastWorld = 0;
    }

    on(name, fn) {
      super.on(name, fn);
      if (name === 'open' && this.open) {
        setTimeout(() => { if (this.open && !this.closed) fn(); }, 0);
      }
      return this;
    }

    topic(direction) {
      const base = `${PREFIX}/${this.room}`;
      return direction === 'to'
        ? `${base}/to/${this.guestId}`
        : `${base}/from/${this.guestId}`;
    }

    markOpen() {
      if (this.closed || this.open) return;
      this.open = true;
      this.emit('open');
      while (this.queue.length && this.open) this.send(this.queue.shift());
    }

    send(data) {
      if (this.closed) return;
      if (!this.open) {
        this.queue.push(data);
        return;
      }

      if (this.role === 'host' && data?.type === 'world') {
        const now = performance.now();
        if (now - this.lastWorld < 90) return;
        this.lastWorld = now;
      }

      const topic = this.role === 'host' ? this.topic('to') : this.topic('from');
      const important = !['world', 'input'].includes(data?.type);
      this.owner.bridge.publish(topic, { sys: 'data', data }, important);
    }

    receive(packet) {
      if (this.closed || !packet) return;
      if (packet.sys === 'open') return this.markOpen();
      if (packet.sys === 'close') return this.closeLocal();
      if (packet.sys === 'data') this.emit('data', packet.data);
    }

    close() {
      if (this.closed) return;
      const topic = this.role === 'host' ? this.topic('to') : this.topic('from');
      this.owner.bridge.publish(topic, { sys: 'close' }, true);
      this.closeLocal();
    }

    closeLocal() {
      if (this.closed) return;
      this.closed = true;
      const wasOpen = this.open;
      this.open = false;
      if (wasOpen) this.emit('close');
    }
  }

  class RelayPeer extends Emitter {
    constructor(id, options) {
      super();
      if (id && typeof id === 'object') {
        options = id;
        id = undefined;
      }

      this.id = id || `mcr-guest-${uid(10)}`;
      this.destroyed = false;
      this.disconnected = false;
      this.bridge = new BrokerBridge();
      this.hostRoom = id?.startsWith('midnight-city-racing-')
        ? id.slice('midnight-city-racing-'.length)
        : null;
      this.connections = new Map();
      this.pendingConnections = [];
      this.opened = false;

      if (this.hostRoom) this.setupHost(this.hostRoom);

      this.bridge.onReady(() => {
        if (this.destroyed) return;
        this.opened = true;
        this.emit('open', this.id);
      });

      this.bridge.onFail(() => {
        if (!this.opened && !this.destroyed) {
          this.emit('error', {
            type: 'network',
            message: 'No public relay could be reached.'
          });
        }
      });
    }

    on(name, fn) {
      super.on(name, fn);
      if (name === 'open' && this.opened) {
        setTimeout(() => { if (!this.destroyed) fn(this.id); }, 0);
      }
      if (name === 'connection' && this.pendingConnections.length) {
        const list = this.pendingConnections.splice(0);
        list.forEach(c => setTimeout(() => { if (!this.destroyed) fn(c); }, 0));
      }
      return this;
    }

    deliverConnection(conn) {
      if ((this.events.get('connection') || []).length) this.emit('connection', conn);
      else this.pendingConnections.push(conn);
    }

    setupHost(room) {
      const joinTopic = `${PREFIX}/${room}/join`;
      this.bridge.subscribe(joinTopic, msg => {
        const guestId = msg?.guestId;
        if (!guestId || this.destroyed) return;

        let conn = this.connections.get(guestId);
        if (conn?.closed) {
          this.connections.delete(guestId);
          conn = null;
        }

        if (!conn) {
          conn = new RelayConnection(this, room, guestId, 'host');
          this.connections.set(guestId, conn);
          this.bridge.subscribe(`${PREFIX}/${room}/from/${guestId}`, p => conn.receive(p));
          this.deliverConnection(conn);
        }

        setTimeout(() => {
          this.bridge.publish(`${PREFIX}/${room}/to/${guestId}`, { sys: 'open' }, true);
        }, 100);
      });
    }

    connect(targetId, options = {}) {
      const room = String(targetId || '').replace(/^midnight-city-racing-/, '');
      const guestId = `g${uid(12)}`;
      const conn = new RelayConnection(this, room, guestId, 'guest');
      conn.metadata = options.metadata;
      this.connections.set(guestId, conn);
      this.bridge.subscribe(`${PREFIX}/${room}/to/${guestId}`, p => conn.receive(p));

      let attempts = 0;
      const announce = () => {
        if (this.destroyed || conn.open || conn.closed) return;
        attempts++;
        this.bridge.publish(`${PREFIX}/${room}/join`, { guestId }, true);
        const status = document.querySelector('#status');
        if (status && !conn.open) status.textContent = `Joining room… attempt ${attempts}`;
      };

      this.bridge.onReady(() => {
        setTimeout(announce, 250);
        const timer = setInterval(() => {
          if (conn.open || conn.closed || this.destroyed) {
            clearInterval(timer);
            return;
          }
          announce();
          if (attempts >= 20) {
            clearInterval(timer);
            conn.emit('error', new Error('Room handshake timed out.'));
          }
        }, 1000);
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

  window.Peer = RelayPeer;
  window.MidnightNetwork = {
    build: 'verified-wss-r17',
    transport: 'mqtt-js-multi-broker',
    brokers: BROKERS.map(b => b.url)
  };
})();