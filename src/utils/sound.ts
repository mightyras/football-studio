let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Synthesised football kick sound — noise burst + bass tone sweep.
 * Uses Web Audio API, no external audio files needed.
 */
export function playKickSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  // Resume if suspended (autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // --- Noise burst (the "thud") ---
  const bufferSize = ctx.sampleRate * 0.06; // 60ms
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize); // decaying noise
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 800;
  bandpass.Q.value = 1.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

  noiseSource.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSource.start(now);
  noiseSource.stop(now + 0.06);

  // --- Bass tone sweep (the impact) ---
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.3, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.08);
}

/**
 * Synthesised "ball hitting net" sound — higher-frequency noise burst
 * through a bandpass filter, simulating the mesh catching the ball.
 */
export function playGoalNetSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;

  // Net impact: sharper, higher-frequency noise burst than kick
  const bufferSize = Math.ceil(ctx.sampleRate * 0.08); // 80ms
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 2000;
  bandpass.Q.value = 1.0;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  noiseSource.connect(bandpass);
  bandpass.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSource.start(now);
  noiseSource.stop(now + 0.08);
}

/**
 * Synthesised crowd roar — layered filtered noise bands to simulate
 * a stadium crowd reacting to a goal. Multiple frequency bands give
 * the impression of voices, clapping and general stadium ambience.
 */
export function playCrowdRoar(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  const duration = 2.0;

  // Shared noise buffer (reused by all layers)
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  // Master gain for the whole crowd effect
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.001, now);
  masterGain.gain.exponentialRampToValueAtTime(0.35, now + 0.15);
  masterGain.gain.setValueAtTime(0.35, now + 0.8);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  masterGain.connect(ctx.destination);

  // Layer 1: Low rumble (body of the roar, 200-600Hz)
  const src1 = ctx.createBufferSource();
  src1.buffer = noiseBuffer;
  const bp1 = ctx.createBiquadFilter();
  bp1.type = 'bandpass';
  bp1.frequency.value = 400;
  bp1.Q.value = 0.5;
  const g1 = ctx.createGain();
  g1.gain.value = 0.5;
  src1.connect(bp1);
  bp1.connect(g1);
  g1.connect(masterGain);
  src1.start(now);
  src1.stop(now + duration);

  // Layer 2: Mid-range voices/cheering (800-2500Hz)
  const noiseBuffer2 = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data2 = noiseBuffer2.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data2[i] = Math.random() * 2 - 1;
  }
  const src2 = ctx.createBufferSource();
  src2.buffer = noiseBuffer2;
  const bp2 = ctx.createBiquadFilter();
  bp2.type = 'bandpass';
  bp2.frequency.value = 1500;
  bp2.Q.value = 0.7;
  const g2 = ctx.createGain();
  g2.gain.value = 0.35;
  src2.connect(bp2);
  bp2.connect(g2);
  g2.connect(masterGain);
  src2.start(now);
  src2.stop(now + duration);

  // Layer 3: High shimmer / clapping texture (2500-5000Hz)
  const noiseBuffer3 = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data3 = noiseBuffer3.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data3[i] = Math.random() * 2 - 1;
  }
  const src3 = ctx.createBufferSource();
  src3.buffer = noiseBuffer3;
  const bp3 = ctx.createBiquadFilter();
  bp3.type = 'bandpass';
  bp3.frequency.value = 3500;
  bp3.Q.value = 0.8;
  const g3 = ctx.createGain();
  g3.gain.value = 0.15;
  src3.connect(bp3);
  bp3.connect(g3);
  g3.connect(masterGain);
  src3.start(now);
  src3.stop(now + duration);
}
