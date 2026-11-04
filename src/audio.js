/**
 * Tiny procedural sound engine. No audio assets, no network.
 * Everything is synthesised from oscillators and noise buffers.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.started = false;
    this.noise = null;
    this.crowd = null;
    this.crowdGain = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.enabled ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    this.noise = this.makeNoise(2.5, 0.5);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.master) {
      this.master.gain.setTargetAtTime(enabled ? 0.8 : 0, this.ctx.currentTime, 0.03);
    }
    if (enabled) this.init();
  }

  makeNoise(seconds, decay = 1) {
    const rate = this.ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = this.ctx.createBuffer(1, length, rate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const white = Math.random() * 2 - 1;
      last = last * 0.86 + white * 0.14;
      data[i] = last * Math.pow(1 - t, decay);
    }
    return buffer;
  }

  startCrowd() {
    this.init();
    if (!this.ctx || this.crowd) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoise(6, 0.05);
    src.loop = true;
    const low = this.ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 680;
    const high = this.ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 120;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.028;
    src.connect(low).connect(high).connect(gain).connect(this.master);
    src.start();
    this.crowd = src;
    this.crowdGain = gain;
    this.started = true;
  }

  stopCrowd() {
    if (!this.crowd) return;
    try {
      this.crowd.stop();
    } catch {
      /* already stopped */
    }
    this.crowd = null;
    this.crowdGain = null;
  }

  cheer(intensity = 1) {
    if (!this.ctx || !this.crowdGain) return;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.cancelScheduledValues(t);
    this.crowdGain.gain.setTargetAtTime(0.035 + 0.085 * intensity, t, 0.08);
    this.crowdGain.gain.setTargetAtTime(0.028, t + 0.7, 1.4);
  }

  tone({ freq = 100, endFreq = 45, type = "sine", dur = 0.3, gain = 0.3, attack = 0.004, delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  burst({ dur = 0.12, freq = 1100, q = 0.8, gain = 0.24, type = "bandpass", delay = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(120, freq * 0.28), t + dur);
    filter.Q.value = q;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t, 0.2, dur + 0.02);
    src.stop(t + dur + 0.03);
  }

  punch(power = 1, blocked = false, delay = 0) {
    if (!this.ctx) return;
    if (blocked) {
      this.burst({ dur: 0.11, freq: 2400, q: 1.2, gain: 0.2, delay });
      this.tone({ freq: 160, endFreq: 90, type: "square", dur: 0.08, gain: 0.08, delay });
      return;
    }
    this.tone({ freq: 105 + power * 22, endFreq: 42, type: "sine", dur: 0.22, gain: 0.32 * power, delay });
    this.burst({ dur: 0.13, freq: 1500, q: 0.7, gain: 0.2 * power, delay });
    this.tone({ freq: 230, endFreq: 80, type: "triangle", dur: 0.09, gain: 0.12, delay });
  }

  kick() {
    if (!this.ctx) return;
    this.burst({ dur: 0.17, freq: 900, q: 1.1, gain: 0.24 });
    this.tone({ freq: 92, endFreq: 34, type: "sine", dur: 0.34, gain: 0.28 });
  }

  whoosh(heavy = false) {
    if (!this.ctx) return;
    this.burst({ dur: heavy ? 0.16 : 0.1, freq: heavy ? 760 : 1250, q: 0.7, gain: 0.075, type: "bandpass" });
  }

  takedown() {
    if (!this.ctx) return;
    this.tone({ freq: 76, endFreq: 30, type: "sine", dur: 0.45, gain: 0.42 });
    this.burst({ dur: 0.3, freq: 560, q: 0.5, gain: 0.26, type: "lowpass" });
    this.cheer(0.65);
  }

  bell(count = 1) {
    this.init();
    if (!this.ctx) return;
    for (let i = 0; i < count; i++) {
      const delay = i * 0.48;
      [1, 2.01, 3.03, 4.18].forEach((mult, index) => {
        this.tone({
          freq: 690 * mult,
          endFreq: 690 * mult * 0.996,
          type: "sine",
          dur: 1.15 - index * 0.16,
          gain: 0.16 / (index + 1),
          attack: 0.003,
          delay,
        });
      });
    }
    this.cheer(0.8);
  }

  ko() {
    if (!this.ctx) return;
    this.tone({ freq: 58, endFreq: 24, type: "sine", dur: 1.6, gain: 0.5 });
    this.burst({ dur: 0.9, freq: 320, q: 0.4, gain: 0.22, type: "lowpass" });
    this.cheer(1.5);
  }

  ui(up = true) {
    if (!this.ctx) return;
    this.tone({ freq: up ? 740 : 440, endFreq: up ? 940 : 360, type: "triangle", dur: 0.07, gain: 0.055 });
  }

  step() {
    if (!this.ctx) return;
    this.burst({ dur: 0.05, freq: 210, q: 0.8, gain: 0.035, type: "lowpass" });
  }
}
