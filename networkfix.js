(() => {
  if (typeof window.Peer !== 'function') return;

  const BasePeer = window.Peer;
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua);
  const isEmbeddedBrowser = /(FBAN|FBAV|Instagram|Messenger|Line\/|Twitter|Snapchat|TikTok|ChatGPT)/i.test(ua);

  const iceServers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:80?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ];

  function optionsWithFallback(options = {}) {
    return {
      host: '0.peerjs.com',
      port: 443,
      path: '/',
      secure: true,
      debug: 1,
      ...options,
      config: {
        ...(options.config || {}),
        iceServers,
        iceTransportPolicy: 'all',
        sdpSemantics: 'unified-plan'
      }
    };
  }

  function clearConnectionError() {
    const e = document.querySelector('#error');
    if (e) {
      e.hidden = true;
      e.textContent = '';
    }
  }

  function setRetryStatus(attempt) {
    const s = document.querySelector('#status');
    if (s) s.textContent = `Connecting… mobile retry ${attempt}/3`;
  }

  function patchOutgoingConnections(peer) {
    const rawConnect = peer.connect.bind(peer);
    const active = new Map();

    peer.connect = function(targetId, options = {}) {
      const handlers = new Map();
      const queued = [];
      let current = null;
      let attempt = 0;
      let closed = false;
      let openedOnce = false;
      let retryTimer = null;
      let watchdog = null;

      const emit = (name, ...args) => {
        (handlers.get(name) || []).slice().forEach(fn => {
          try { fn(...args); } catch (err) { console.error(err); }
        });
      };

      const facade = {
        peer: targetId,
        metadata: options.metadata,
        open: false,
        on(name, fn) {
          if (!handlers.has(name)) handlers.set(name, []);
          handlers.get(name).push(fn);
          return facade;
        },
        send(data) {
          if (current?.open) current.send(data);
          else queued.push(data);
        },
        close() {
          closed = true;
          clearTimeout(retryTimer);
          clearTimeout(watchdog);
          try { current?.close(); } catch (_) {}
          if (facade.open) {
            facade.open = false;
            emit('close');
          }
        },
        _retry(reason) {
          if (closed || facade.open) return;
          if (attempt >= 3) {
            emit('error', reason instanceof Error ? reason : new Error('Unable to connect to the room.'));
            return;
          }
          if (retryTimer) return;
          clearTimeout(watchdog);
          try { current?.close(); } catch (_) {}
          retryTimer = setTimeout(() => {
            retryTimer = null;
            start();
          }, 450 + attempt * 450);
        }
      };

      active.set(targetId, facade);

      function start() {
        if (closed) return;
        attempt += 1;
        if (attempt > 1) setRetryStatus(attempt);

        try {
          current = rawConnect(targetId, {
            ...options,
            reliable: true,
            serialization: options.serialization || 'json'
          });
        } catch (err) {
          facade._retry(err);
          return;
        }

        current.on('open', () => {
          clearTimeout(watchdog);
          clearTimeout(retryTimer);
          facade.open = true;
          openedOnce = true;
          clearConnectionError();
          emit('open');
          while (queued.length && current?.open) {
            try { current.send(queued.shift()); } catch (_) { break; }
          }
        });

        current.on('data', data => emit('data', data));
        current.on('error', err => {
          if (!facade.open && !openedOnce) facade._retry(err);
          else emit('error', err);
        });
        current.on('close', () => {
          if (!openedOnce && !closed) facade._retry(new Error('Connection closed during handshake.'));
          else if (!closed) {
            facade.open = false;
            emit('close');
          }
        });

        watchdog = setTimeout(() => {
          if (!facade.open && !closed) facade._retry(new Error('WebRTC handshake timed out.'));
        }, attempt === 1 ? 3300 : 4300);
      }

      start();
      return facade;
    };

    peer.on('error', err => {
      if (err?.type === 'peer-unavailable') {
        active.forEach(facade => {
          if (!facade.open) facade._retry(err);
        });
      }
    });

    peer.on('disconnected', () => {
      setTimeout(() => {
        try {
          if (!peer.destroyed && peer.disconnected) peer.reconnect();
        } catch (_) {}
      }, 700);
    });
  }

  function ReliablePeer(id, options) {
    if (id && typeof id === 'object') {
      options = id;
      id = undefined;
    }
    const p = new BasePeer(id, optionsWithFallback(options));
    patchOutgoingConnections(p);
    return p;
  }

  ReliablePeer.prototype = BasePeer.prototype;
  try { Object.setPrototypeOf(ReliablePeer, BasePeer); } catch (_) {}
  window.Peer = ReliablePeer;

  window.MidnightNetwork = {
    build: 'mobile-online-r7',
    signaling: '0.peerjs.com:443',
    iceServers,
    isIOS,
    isEmbeddedBrowser,
    supportsWebRTC: !!window.RTCPeerConnection
  };

  addEventListener('DOMContentLoaded', () => {
    if (isIOS && isEmbeddedBrowser) {
      const e = document.querySelector('#error');
      if (e) {
        e.hidden = false;
        e.textContent = 'iPhone multiplayer works best in Safari. If this page opened inside ChatGPT, Messenger, Instagram, or another app, use Share → Open in Safari before joining a room.';
      }
    } else if (!window.RTCPeerConnection) {
      const e = document.querySelector('#error');
      if (e) {
        e.hidden = false;
        e.textContent = 'This browser does not provide WebRTC multiplayer. Open the game in Safari, Chrome, or Edge.';
      }
    }
  });
})();
