// Tiny synthesised blips; the audio context starts on the first click.
let ac = null;

export function unlockAudio() {
  if (!ac) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) ac = new Ctx();
  } else if (ac.state === 'suspended') ac.resume();
}

function tone(freq, start, dur, type = 'square', vol = 0.05, endFreq = freq) {
  const t = ac.currentTime + start;
  const o = ac.createOscillator();
  const v = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  v.gain.setValueAtTime(vol, t);
  v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(v).connect(ac.destination);
  o.start(t);
  o.stop(t + dur);
}

function noise(start, dur, vol) {
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = ac.createBufferSource();
  const v = ac.createGain();
  v.gain.value = vol;
  src.buffer = buf;
  src.connect(v).connect(ac.destination);
  src.start(ac.currentTime + start);
}

export function sfx(name) {
  if (!ac) return;
  switch (name) {
    case 'card': noise(0, 0.05, 0.25); break;
    case 'slap': noise(0, 0.18, 0.9); tone(110, 0, 0.25, 'sine', 0.4, 40); break;
    case 'click': tone(660, 0, 0.04, 'square', 0.03); break;
    case 'win': tone(392, 0, 0.09); tone(523, 0.09, 0.14); break;
    case 'lose': tone(330, 0, 0.1); tone(247, 0.1, 0.16); break;
    case 'tie': tone(330, 0, 0.08); tone(330, 0.1, 0.08); break;
    case 'coin': tone(988, 0, 0.06, 'square', 0.04); tone(1319, 0.06, 0.12, 'square', 0.04); break;
  }
}
