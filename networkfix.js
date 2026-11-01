(() => {
  if (typeof window.Peer !== 'function') return;

  const BasePeer = window.Peer;
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
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
        iceCandidatePoolSize: 6,
        bundlePolicy: 'max-bundle',
        sdpSemantics: 'unified-plan'
      }
    };
  }

  function ReliablePeer(id, options) {
    if (id && typeof id === 'object') {
      options = id;
      id = undefined;
    }
    return new BasePeer(id, optionsWithFallback(options));
  }

  ReliablePeer.prototype = BasePeer.prototype;
  try { Object.setPrototypeOf(ReliablePeer, BasePeer); } catch (_) {}

  window.Peer = ReliablePeer;
  window.MidnightNetwork = {
    build: 'online-r6',
    signaling: '0.peerjs.com:443',
    iceServers
  };
})();
