// Tiny WebAudio synth for game sounds — no audio files needed.
window.GameAudio = (function () {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, opts) {
    opts = opts || {};
    const c = ensure();
    if (!c || muted) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (opts.slide) {
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + opts.slide), c.currentTime + dur);
    }
    g.gain.setValueAtTime(opts.vol || 0.14, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.05);
  }

  function noise(dur, vol, filterFreq) {
    const c = ensure();
    if (!c || muted) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq || 1200;
    const g = c.createGain();
    g.gain.value = vol || 0.2;
    src.connect(filt);
    filt.connect(g);
    g.connect(c.destination);
    src.start();
  }

  return {
    unlock: ensure,
    toggleMute() { muted = !muted; return muted; },
    isMuted() { return muted; },
    eat()   { tone(520, 0.08); setTimeout(() => tone(780, 0.1), 70); },
    yuck()  { tone(300, 0.12, { slide: -160 }); setTimeout(() => tone(180, 0.18, { slide: -90 }), 110); },
    knock() { noise(0.12, 0.25, 3000); tone(160, 0.08, { type: 'triangle', vol: 0.2 }); },
    jump()  { tone(330, 0.12, { type: 'sine', slide: 240, vol: 0.07 }); },
    warn()  { tone(880, 0.09, { vol: 0.12 }); setTimeout(() => tone(880, 0.09, { vol: 0.12 }), 150); },
    splash() { noise(0.4, 0.32, 900); tone(220, 0.25, { type: 'sine', slide: -120, vol: 0.1 }); },
    thud()  { tone(90, 0.25, { type: 'triangle', vol: 0.3, slide: -40 }); noise(0.15, 0.22, 500); },
    meow()  { tone(640, 0.28, { type: 'sawtooth', vol: 0.055, slide: -280 }); },
    over()  { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.2, { type: 'triangle', vol: 0.14 }), i * 170)); }
  };
})();
