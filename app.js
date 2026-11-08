/* BrainPlay Kids — 3D memory & brain games (three.js r128)
   Structure: utils → Audio → Store → Stage (3D) → UI → Game base + helpers → games → registry/boot */
'use strict';

/* ================= utils ================= */
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const Ease = {
  linear: t => t,
  out: t => 1 - Math.pow(1 - t, 3),
  in: t => t * t * t,
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  bounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; },
  elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1,
};

/* Tiny tween engine (ms based). Tween.to(obj,{x:1},300,Ease.out) → Promise */
const Tween = {
  list: [],
  to(obj, props, dur, ease = Ease.out, delay = 0) {
    return new Promise(res => {
      const from = {}; for (const k in props) from[k] = obj[k];
      this.list.push({ obj, props, from, dur: Math.max(1, dur), ease, delay, t: 0, res });
    });
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      if (tw.delay > 0) { tw.delay -= dt; if (tw.delay > 0) continue; }
      tw.t += dt;
      const p = clamp(tw.t / tw.dur, 0, 1), e = tw.ease(p);
      for (const k in tw.props) tw.obj[k] = tw.from[k] + (tw.props[k] - tw.from[k]) * e;
      if (p >= 1) { this.list.splice(i, 1); tw.res(); }
    }
  },
  clear() { this.list.length = 0; },
};

/* ================= Audio (all synthesized, no files) ================= */
const Audio = {
  ctx: null, on: true, master: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
  },
  tone(freq, dur = 0.2, type = 'sine', vol = 0.6, when = 0, slide = 0) {
    if (!this.on || !this.ctx) return;
    const t0 = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
  },
  noise(dur = 0.12, vol = 0.3, when = 0) {
    if (!this.on || !this.ctx) return;
    const t0 = this.ctx.currentTime + when, n = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; s.buffer = buf; g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.master); s.start(t0);
  },
  pop() { this.tone(rand(500, 900), 0.12, 'sine', 0.5, 0, 400); this.noise(0.06, 0.25); },
  tap() { this.tone(660, 0.08, 'triangle', 0.35); },
  ding() { this.tone(880, 0.25, 'sine', 0.5); this.tone(1320, 0.35, 'sine', 0.35, 0.08); },
  good() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.45, i * 0.09)); },
  cheer() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.4, i * 0.1)); this.tone(1568, 0.6, 'sine', 0.3, 0.5); },
  oops() { this.tone(300, 0.25, 'sawtooth', 0.18, 0, -120); },
  whoosh() { this.noise(0.25, 0.18); },
  note(i, dur = 0.35) { const scale = [262, 294, 330, 392, 440, 523, 587, 659, 784]; this.tone(scale[i % scale.length] * (1 + Math.floor(i / scale.length)), dur, 'triangle', 0.45); },
  speak(text) {
    if (!this.on || !('speechSynthesis' in window)) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.95; u.pitch = 1.25; speechSynthesis.speak(u); } catch (e) { }
  },
};

/* ================= Store (progress in localStorage) ================= */
const Store = {
  key: 'brainplay.v1', data: null,
  load() { try { this.data = JSON.parse(localStorage.getItem(this.key) || '{}'); } catch (e) { this.data = {}; } if (!this.data.games) this.data.games = {}; if (this.data.sound === undefined) this.data.sound = true; return this.data; },
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { } },
  game(id) { return this.data.games[id] || (this.data.games[id] = { best: 1, stars: 0, plays: 0 }); },
  record(id, level, stars) { const g = this.game(id); g.best = Math.max(g.best, level); g.stars = Math.max(g.stars, stars); g.plays++; this.save(); },
};

/* ================= Stage: one shared three.js renderer ================= */
const HIT_MAT = () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.scene = new THREE.Scene();
    this.scene.background = srgb(0x7c5cff);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camera.position.set(0, 0, 24);
    this.fitW = 12; this.fitH = 12; this.tilt = 0;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x556688, 0.42));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5); dir.position.set(5, 9, 12); this.scene.add(dir);
    const rim = new THREE.DirectionalLight(0xffe7c2, 0.15); rim.position.set(-6, -3, 6); this.scene.add(rim);
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.game = null; this.drag = null; this.paused = false;
    this.buildBackdrop();
    this.clock = new THREE.Clock();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    document.addEventListener('visibilitychange', () => { this.paused = document.hidden; if (!this.paused) this.clock.getDelta(); });
    this.resize();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  buildBackdrop() {
    /* soft floating shapes far behind the play area = cheap depth */
    this.backdrop = new THREE.Group(); this.scene.add(this.backdrop);
    const geos = [new THREE.SphereGeometry(1, 20, 16), new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.TorusGeometry(1, .4, 12, 24), new THREE.OctahedronGeometry(1.2), new THREE.ConeGeometry(1, 2, 20)];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(pick(geos), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0.6 }));
      m.position.set(rand(-22, 22), rand(-16, 16), rand(-26, -10));
      const s = rand(0.6, 2.2); m.scale.setScalar(s);
      m.userData.v = { rx: rand(-.4, .4), ry: rand(-.4, .4), fy: rand(.2, .6), ph: rand(0, 6.28), y0: m.position.y };
      this.backdrop.add(m);
    }
  }
  setTheme(hex) {
    const c = new THREE.Color(hex), lin = srgb(hex); Tween.to(this.scene.background, { r: lin.r, g: lin.g, b: lin.b }, 500);
    document.documentElement.style.setProperty('--bg', '#' + c.getHexString());
    const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = '#' + c.getHexString();
  }
  fit(w, h, tilt = 0) { this.fitW = w; this.fitH = h; this.tilt = tilt; this.resize(); }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const margin = 1.12;
    const d = margin * Math.max(this.fitH / (2 * tan), this.fitW / (2 * tan * this.camera.aspect));
    this.camera.position.set(0, d * Math.sin(this.tilt) * 0.9, d * Math.cos(this.tilt));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.viewW = 2 * d * tan * this.camera.aspect; this.viewH = 2 * d * tan; // visible world size at z=0 (approx)
  }
  /* pointer → world point on z=0 plane and raycast hit */
  pointerInfo(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const point = new THREE.Vector3(); this.raycaster.ray.intersectPlane(this.dragPlane, point);
    return point;
  }
  hitTest(pickables) {
    if (!pickables || !pickables.length) return null;
    const hits = this.raycaster.intersectObjects(pickables, true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.pickable) o = o.parent;
      if (o && o.visible && !o.userData.disabled) return { obj: o, point: h.point };
    }
    return null;
  }
  onDown(e) {
    Audio.init();
    if (!this.game || this.game.locked) return;
    const point = this.pointerInfo(e);
    const hit = this.hitTest(this.game.pickables);
    if (hit && hit.obj.userData.draggable && !this.drag) {
      this.drag = { id: e.pointerId, obj: hit.obj, off: new THREE.Vector3().subVectors(hit.obj.position, point) };
      this.canvas.setPointerCapture && this.canvas.setPointerCapture(e.pointerId);
      this.game.onDragStart && this.game.onDragStart(hit.obj, point);
    } else if (hit && hit.obj.userData.tap) {
      hit.obj.userData.tap(hit.obj, hit.point, e);
    } else {
      this.game.onMiss && this.game.onMiss(point, e);
    }
  }
  onMove(e) {
    if (!this.drag || this.drag.id !== e.pointerId || !this.game) return;
    const point = this.pointerInfo(e).add(this.drag.off);
    this.game.onDrag && this.game.onDrag(this.drag.obj, point);
  }
  onUp(e) {
    if (!this.drag || this.drag.id !== e.pointerId) return;
    const d = this.drag; this.drag = null;
    const point = this.pointerInfo(e).add(d.off);
    this.game && this.game.onDrop && this.game.onDrop(d.obj, point);
  }
  loop() {
    requestAnimationFrame(this.loop);
    if (this.paused) return;
    const dt = Math.min(this.clock.getDelta() * 1000, 60), t = this.clock.elapsedTime;
    Tween.update(dt);
    for (const m of this.backdrop.children) { const v = m.userData.v; m.rotation.x += v.rx * dt / 1000; m.rotation.y += v.ry * dt / 1000; m.position.y = v.y0 + Math.sin(t * v.fy + v.ph) * 1.2; }
    if (this.game && this.game.alive) { try { this.game.update(dt, t); } catch (err) { console.error(err); } }
    this.renderer.render(this.scene, this.camera);
  }
}

/* ================= Shared 3D helpers ================= */
const PALETTE = [0xff5e7a, 0xffa94d, 0xffd93d, 0x6bd968, 0x3fc1ff, 0x7c5cff, 0xff7ad9, 0x2fd6c4];
/* r128 has no colour management: hex colours are read as linear, so convert sRGB → linear or everything looks washed out */
const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();
const mat = (color, extra = {}) => { if (extra.emissive !== undefined) extra.emissive = srgb(extra.emissive); return new THREE.MeshStandardMaterial(Object.assign({ color: srgb(color), roughness: 0.45, metalness: 0.05 }, extra)); };
function roundedBoxGeo(w, h, d, r = 0.2, segs = 3) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - r * 0.6, bevelEnabled: true, bevelThickness: r * 0.3, bevelSize: r * 0.3, bevelSegments: segs, curveSegments: 6 });
  g.translate(0, 0, -d / 2); return g;
}
const SHAPES = {
  cube: () => new THREE.BoxGeometry(1.5, 1.5, 1.5),
  ball: () => new THREE.SphereGeometry(0.9, 28, 20),
  cone: () => new THREE.ConeGeometry(0.85, 1.7, 28),
  ring: () => new THREE.TorusGeometry(0.65, 0.3, 14, 28),
  gem: () => new THREE.OctahedronGeometry(1.0),
  can: () => new THREE.CylinderGeometry(0.7, 0.7, 1.6, 28),
  star: () => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.45 : 1; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 }); g.center(); return g; },
  heart: () => { const s = new THREE.Shape(); s.moveTo(0, -0.9); s.bezierCurveTo(0, -0.9, -1.3, 0, -0.65, 0.6); s.bezierCurveTo(-0.3, 0.95, 0, 0.6, 0, 0.45); s.bezierCurveTo(0, 0.6, 0.3, 0.95, 0.65, 0.6); s.bezierCurveTo(1.3, 0, 0, -0.9, 0, -0.9); const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: .08, bevelThickness: .08, bevelSegments: 2 }); g.center(); return g; },
};
const SHAPE_NAMES = Object.keys(SHAPES);
const COLOR_NAMES = { 0xff5e7a: 'red', 0xffa94d: 'orange', 0xffd93d: 'yellow', 0x6bd968: 'green', 0x3fc1ff: 'blue', 0x7c5cff: 'purple', 0xff7ad9: 'pink', 0x2fd6c4: 'teal' };

const texCache = new Map();
function emojiTexture(emoji, bg = '#ffffff', size = 256) {
  const key = emoji + bg; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect ? g.roundRect(0, 0, size, size, size * 0.14) : g.rect(0, 0, size, size); g.fill();
  g.font = `${size * 0.62}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(emoji, size / 2, size / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; texCache.set(key, t); return t;
}
function textTexture(text, bg = '#ffffff', fg = '#1f1b3a', size = 256) {
  const key = 'T' + text + bg + fg; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, size, size);
  g.fillStyle = fg; g.font = `bold ${size * 0.6}px Fredoka, Nunito, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, size / 2, size / 2 + size * 0.03);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; texCache.set(key, t); return t;
}
function patternTexture(color = '#7c5cff') {
  const key = 'P' + color; if (texCache.has(key)) return texCache.get(key);
  const size = 256, c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, size, size); g.fillStyle = 'rgba(255,255,255,.25)';
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { g.beginPath(); g.arc(32 + x * 48 + (y % 2) * 24, 32 + y * 48, 10, 0, 6.28); g.fill(); }
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 14; g.strokeRect(7, 7, size - 14, size - 14);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; texCache.set(key, t); return t;
}
/* a friendly little character made of spheres */
function makeBuddy(color = 0xffa94d) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 28, 22), mat(color)); g.add(body);
  const eyeW = new THREE.SphereGeometry(0.22, 14, 12), eyeB = new THREE.SphereGeometry(0.1, 10, 8);
  for (const s of [-1, 1]) {
    const w = new THREE.Mesh(eyeW, mat(0xffffff, { roughness: .2 })); w.position.set(s * 0.33, 0.2, 0.75); g.add(w);
    const b = new THREE.Mesh(eyeB, mat(0x222244, { roughness: .2 })); b.position.set(s * 0.33, 0.2, 0.95); g.add(b);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), mat(color)); ear.position.set(s * 0.7, 0.75, 0); g.add(ear);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 16, Math.PI), mat(0x662233)); mouth.position.set(0, -0.2, 0.8); mouth.rotation.z = Math.PI; g.add(mouth);
  const cheekG = new THREE.SphereGeometry(0.14, 10, 8);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(cheekG, mat(0xff8aa0)); c.position.set(s * 0.55, -0.1, 0.7); c.scale.z = 0.4; g.add(c); }
  return g;
}
/* confetti burst */
function confetti(stage, group, n = 70, origin = new THREE.Vector3()) {
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.06), parts = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat(pick(PALETTE))); m.position.copy(origin);
    m.userData.v = new THREE.Vector3(rand(-7, 7), rand(5, 14), rand(-2, 2)); m.userData.r = new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    m.userData.life = 2200; group.add(m); parts.push(m);
  }
  return parts;
}
function updateParticles(parts, dt) {
  const s = dt / 1000;
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = parts[i]; m.userData.life -= dt; m.userData.v.y -= 18 * s; m.position.addScaledVector(m.userData.v, s);
    m.rotation.x += m.userData.r.x * s; m.rotation.y += m.userData.r.y * s;
    if (m.userData.life < 400) m.scale.setScalar(Math.max(0.001, m.userData.life / 400));
    if (m.userData.life <= 0) { m.parent && m.parent.remove(m); parts.splice(i, 1); }
  }
}
function disposeGroup(g) {
  g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.map) { Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose(); } });
}

/* ================= UI ================= */
const $ = s => document.querySelector(s);
const UI = {
  init() {
    this.home = $('#home'); this.hud = $('#hud'); this.sayEl = $('#say'); this.modal = $('#modal'); this.keypad = $('#keypad');
    this.sayTimer = null;
  },
  showHome() { this.home.classList.remove('hidden'); this.hud.classList.add('hidden'); this.modal.classList.add('hidden'); this.keypad.classList.add('hidden'); },
  showGame(name) { this.home.classList.add('hidden'); this.hud.classList.remove('hidden'); this.modal.classList.add('hidden'); $('#hud-name').textContent = name; this.score(''); this.level(''); this.say(''); },
  level(t) { $('#hud-level').textContent = t; $('#hud-level').style.display = t ? '' : 'none'; },
  score(t) { $('#hud-score').textContent = t; },
  say(text, ms = 0) {
    clearTimeout(this.sayTimer);
    if (!text) { this.sayEl.classList.add('empty'); return; }
    this.sayEl.textContent = text; this.sayEl.classList.remove('empty'); this.sayEl.classList.remove('pop'); void this.sayEl.offsetWidth; this.sayEl.classList.add('pop');
    if (ms) this.sayTimer = setTimeout(() => this.say(''), ms);
  },
  end({ emoji = '🎉', title = 'Great job!', stars = 3, text = '', next = true, again = true }) {
    $('#modal-emoji').textContent = emoji; $('#modal-title').textContent = title; $('#modal-text').textContent = text;
    $('#modal-stars').innerHTML = [1, 2, 3].map(i => `<span class="${i <= stars ? '' : 'dim'}">⭐</span>`).join('');
    $('#modal-next').classList.toggle('hidden', !next); $('#modal-again').classList.toggle('hidden', !again);
    this.modal.classList.remove('hidden');
  },
  showKeypad(onKey) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'];
    this.keypad.innerHTML = keys.map(k => `<button type="button" class="${k === 'OK' ? 'ok' : k === '⌫' ? 'del' : ''}" data-k="${k}">${k}</button>`).join('');
    this.keypad.onclick = e => { const b = e.target.closest('button'); if (b) { Audio.init(); Audio.tap(); onKey(b.dataset.k); } };
    this.keypad.classList.remove('hidden');
  },
  hideKeypad() { this.keypad.classList.add('hidden'); },
};

/* ================= Game base ================= */
class Game {
  constructor(stage, meta, level = 1) {
    this.stage = stage; this.meta = meta; this.level = level; this.alive = true; this.locked = false;
    this.group = new THREE.Group(); stage.scene.add(this.group);
    this.pickables = []; this.parts = [];
    this.maxLevel = meta.levels || 8;
  }
  /* promises that only resolve while the game is alive (prevents zombie async flows after exit) */
  sleep(ms) { return new Promise(r => setTimeout(() => { if (this.alive) r(); }, ms)); }
  tw(obj, props, dur, ease, delay) { return Tween.to(obj, props, dur, ease, delay).then(() => new Promise(r => { if (this.alive) r(); })); }
  pickable(obj, opts = {}) { obj.userData.pickable = true; Object.assign(obj.userData, opts); this.pickables.push(obj); return obj; }
  unpick(obj) { const i = this.pickables.indexOf(obj); if (i >= 0) this.pickables.splice(i, 1); obj.userData.pickable = false; }
  burst(origin, n = 60) { this.parts.push(...confetti(this.stage, this.group, n, origin)); }
  start() { }
  update(dt, t) { updateParticles(this.parts, dt); }
  /* called by App when the round is finished */
  finish(stars, text, opts = {}) {
    this.locked = true; Audio.cheer(); this.burst(new THREE.Vector3(0, -2, 2), 90);
    Store.record(this.meta.id, this.level + (this.level < this.maxLevel ? 1 : 0), stars);
    setTimeout(() => { if (this.alive) UI.end(Object.assign({ stars, text, title: stars === 3 ? 'Amazing!' : stars === 2 ? 'Great job!' : 'Nice try!', emoji: stars === 3 ? '🏆' : '🎉', next: this.level < this.maxLevel }, opts)); }, 900);
  }
  destroy() { this.alive = false; this.stage.scene.remove(this.group); disposeGroup(this.group); Tween.clear(); UI.hideKeypad(); UI.say(''); if ('speechSynthesis' in window) speechSynthesis.cancel(); }
}

/* =====================================================================
   GAME 1 · Bubble Pop (babies) — cause & effect, visual tracking
   ===================================================================== */
class BubblePop extends Game {
  start() {
    this.stage.fit(12, 14);
    this.pops = 0; this.target = 12 + this.level * 4; this.bubbles = [];
    for (let i = 0; i < 6 + this.level; i++) this.spawn(true);
    UI.score('🫧 0'); UI.say('Pop the bubbles! 🫧'); Audio.speak('Pop the bubbles!');
  }
  spawn(initial) {
    const type = Math.random() < 0.7 ? 'ball' : pick(['cube', 'star', 'heart', 'ring', 'gem']);
    const m = new THREE.Mesh(SHAPES[type](), mat(pick(PALETTE), { roughness: 0.25, transparent: true, opacity: 0.94 }));
    m.scale.setScalar(rand(1.0, 1.6));
    const W = this.stage.viewW / 2 - 1.5, H = this.stage.viewH / 2;
    m.position.set(rand(-W, W), initial ? rand(-H, H) : -H - 2, rand(-1, 1));
    m.userData.vy = rand(1.0, 1.8) + this.level * 0.15; m.userData.ph = rand(0, 6.28); m.userData.rot = rand(-1, 1);
    m.add(new THREE.Mesh(new THREE.SphereGeometry(1.45, 8, 6), HIT_MAT())); // generous hit area for little fingers
    this.pickable(m, { tap: o => this.pop(o) });
    this.group.add(m); this.bubbles.push(m);
  }
  pop(o) {
    if (o.userData.dead) return; o.userData.dead = true; this.unpick(o);
    Audio.pop(); Audio.note(this.pops % 9, 0.25);
    this.pops++; UI.score('🫧 ' + this.pops);
    this.parts.push(...confetti(this.stage, this.group, 12, o.position.clone()));
    const s = o.scale.x * 1.7;
    this.tw(o.scale, { x: s, y: s, z: s }, 110).then(() => { this.group.remove(o); this.bubbles.splice(this.bubbles.indexOf(o), 1); if (this.pops < this.target) this.spawn(false); });
    this.tw(o.material, { opacity: 0 }, 110);
    if (this.pops % 10 === 0 && this.pops < this.target) { Audio.good(); const w = pick(['Yay! 🎉', 'Wow! ⭐', 'So good! 👏', 'Pop pop pop! 🫧']); UI.say(w, 1500); Audio.speak(w.replace(/[^a-z! ]/gi, '')); }
    if (this.pops >= this.target) this.finish(3, `You popped ${this.pops} bubbles!`);
  }
  update(dt, t) {
    super.update(dt, t);
    const H = this.stage.viewH / 2, W = this.stage.viewW / 2 - 1.5, s = dt / 1000;
    for (const b of this.bubbles) {
      if (b.userData.dead) continue;
      b.position.y += b.userData.vy * s; b.position.x += Math.sin(t * 1.4 + b.userData.ph) * 0.6 * s;
      b.rotation.y += b.userData.rot * s; b.rotation.x += 0.3 * s;
      if (b.position.y > H + 2) { b.position.y = -H - 2; b.position.x = rand(-W, W); }
    }
  }
}

/* =====================================================================
   GAME 2 · Peekaboo Pip (babies/toddlers) — object permanence, attention
   ===================================================================== */
class Peekaboo extends Game {
  start() {
    this.stage.fit(13, 10, 0.3);
    const cfg = [{ cups: 2, sw: 0, spd: 900 }, { cups: 2, sw: 2, spd: 850 }, { cups: 3, sw: 2, spd: 850 }, { cups: 3, sw: 4, spd: 650 }, { cups: 3, sw: 6, spd: 520 }, { cups: 4, sw: 6, spd: 520 }, { cups: 4, sw: 8, spd: 420 }, { cups: 4, sw: 10, spd: 360 }];
    this.cfg = cfg[Math.min(this.level, 8) - 1]; this.round = 0; this.rounds = 5; this.misses = 0;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), mat(0xffffff, { transparent: true, opacity: 0.25 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -1.35; this.group.add(floor);
    this.buddy = makeBuddy(pick(PALETTE)); this.buddy.visible = false; this.group.add(this.buddy);
    this.cups = [];
    const n = this.cfg.cups, spacing = n > 3 ? 3.1 : 3.8;
    for (let i = 0; i < n; i++) {
      const cup = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 2.7, 36, 1, false), mat(PALETTE[(i * 2 + 1) % PALETTE.length], { roughness: .35 })); cup.add(body);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.12, 10, 36), mat(0xffffff)); rim.rotation.x = Math.PI / 2; rim.position.y = -1.3; cup.add(rim);
      const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.5, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18 })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = -1.34; this.group.add(shadow);
      cup.userData.shadow = shadow;
      cup.position.set((i - (n - 1) / 2) * spacing, 0, 0);
      this.pickable(cup, { tap: o => this.tapCup(o) });
      this.group.add(cup); this.cups.push(cup);
    }
    this.playRound();
  }
  async playRound() {
    this.locked = true; this.round++; UI.level(`Round ${this.round}/${this.rounds}`);
    const b = this.buddy; b.visible = true; b.position.set(0, 3.6, 2); b.scale.setScalar(0.01);
    this.tw(b.scale, { x: 1, y: 1, z: 1 }, 450, Ease.back);
    UI.say('Peekaboo! 👋'); Audio.speak('Peekaboo!'); Audio.ding();
    await this.sleep(1100);
    const cup = this.hideCup = pick(this.cups);
    await this.tw(cup.position, { y: 3.2 }, 400, Ease.out);
    await this.tw(b.position, { x: cup.position.x, y: 0, z: 0 }, 600, Ease.inOut);
    await this.tw(cup.position, { y: 0 }, 350, Ease.bounce);
    b.visible = false; Audio.tap();
    await this.sleep(300);
    for (let k = 0; k < this.cfg.sw; k++) {
      const [a, c] = shuffle(this.cups).slice(0, 2);
      const ax = a.position.x, cx = c.position.x;
      Audio.whoosh();
      await Promise.all([this.arc(a, cx), this.arc(c, ax)]);
    }
    UI.say('Where is Pip? 🤔'); Audio.speak('Where is Pip?');
    this.locked = false;
  }
  arc(cup, toX) {
    const spd = this.cfg.spd;
    this.tw(cup.position, { z: cup.position.z + (Math.random() < .5 ? 2.2 : -2.2) }, spd / 2, Ease.out).then(() => this.tw(cup.position, { z: 0 }, spd / 2, Ease.in));
    return this.tw(cup.position, { x: toX }, spd, Ease.inOut);
  }
  async tapCup(cup) {
    this.locked = true;
    await this.tw(cup.position, { y: 3.2 }, 350, Ease.out);
    if (cup === this.hideCup) {
      const b = this.buddy; b.visible = true; b.position.set(cup.position.x, 0, 0);
      Audio.good(); UI.say('You found me! 🎉'); Audio.speak('You found me!');
      this.tw(b.position, { y: 1.2 }, 300, Ease.out).then(() => this.tw(b.position, { y: 0 }, 400, Ease.bounce));
      this.parts.push(...confetti(this.stage, this.group, 30, b.position.clone()));
      await this.sleep(1500);
      if (this.round >= this.rounds) { this.finish(this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1, `You found Pip ${this.rounds} times!`); return; }
      await this.tw(b.scale, { x: 0.01, y: 0.01, z: 0.01 }, 300, Ease.in); b.visible = false;
      await this.tw(cup.position, { y: 0 }, 300, Ease.bounce);
      this.playRound();
    } else {
      this.misses++; Audio.oops(); UI.say('Not here! Try again 🙈'); Audio.speak('Not here!');
      await this.sleep(800);
      await this.tw(cup.position, { y: 0 }, 300, Ease.bounce);
      if (this.misses >= 2) { const h = this.hideCup; this.tw(h.rotation, { z: 0.15 }, 120).then(() => this.tw(h.rotation, { z: -0.15 }, 120)).then(() => this.tw(h.rotation, { z: 0 }, 120)); }
      this.locked = false;
    }
  }
  update(dt, t) {
    super.update(dt, t);
    if (this.buddy.visible) this.buddy.rotation.y = Math.sin(t * 3) * 0.25;
    for (const c of this.cups) { c.userData.shadow.position.x = c.position.x; c.userData.shadow.position.z = c.position.z; c.userData.shadow.scale.setScalar(1 - c.position.y * 0.15); }
  }
}

/* =====================================================================
   GAME 3 · Shape Sorter (toddlers) — shapes, matching, fine motor
   ===================================================================== */
class ShapeSorter extends Game {
  start() {
    this.stage.fit(12.5, 13);
    const n = Math.min(3 + Math.floor((this.level - 1) / 2), 6);
    const names = shuffle(SHAPE_NAMES).slice(0, n), colors = shuffle(PALETTE).slice(0, n);
    this.done = 0; this.n = n; this.wrong = 0; this.targets = []; this.shapes = [];
    const rowPos = (count, yTop, yBot, i) => { if (count <= 4) return { x: (i - (count - 1) / 2) * 3, y: yTop }; const per = Math.ceil(count / 2), r = i < per ? 0 : 1, c = r ? i - per : i, cnt = r ? count - per : per; return { x: (c - (cnt - 1) / 2) * 3, y: r ? yBot : yTop }; };
    const tOrder = shuffle(names);
    tOrder.forEach((name, i) => {
      const p = rowPos(n, n <= 4 ? 3.2 : 4.6, 1.9, i);
      const t = new THREE.Mesh(SHAPES[name](), new THREE.MeshStandardMaterial({ color: srgb(0x1a1240), transparent: true, opacity: 0.4, roughness: 1 }));
      t.position.set(p.x, p.y, -0.2); t.scale.setScalar(1.12); t.userData.name = name; this.group.add(t); this.targets.push(t);
    });
    names.forEach((name, i) => {
      const p = rowPos(n, n <= 4 ? -3.2 : -2.2, -4.9, i);
      const s = new THREE.Mesh(SHAPES[name](), mat(colors[i], { roughness: .3 }));
      s.position.set(p.x, p.y, 0); s.userData.name = name; s.userData.home = s.position.clone();
      s.add(new THREE.Mesh(new THREE.SphereGeometry(1.35, 8, 6), HIT_MAT()));
      this.pickable(s, { draggable: true }); this.group.add(s); this.shapes.push(s);
    });
    UI.score(`0 / ${n}`); UI.say('Drag each shape onto its shadow! 👆'); Audio.speak('Drag each shape onto its shadow');
  }
  onDragStart(o) { o.position.z = 1.6; Tween.to(o.scale, { x: 1.15, y: 1.15, z: 1.15 }, 150); Audio.tap(); }
  onDrag(o, p) { o.position.x = p.x; o.position.y = p.y; }
  onDrop(o, p) {
    const t = this.targets.find(t => t.userData.name === o.userData.name);
    const dx = o.position.x - t.position.x, dy = o.position.y - t.position.y;
    if (Math.hypot(dx, dy) < 1.5) {
      this.unpick(o); o.userData.placed = true; this.done++; UI.score(`${this.done} / ${this.n}`);
      Audio.ding(); this.parts.push(...confetti(this.stage, this.group, 18, t.position.clone()));
      this.tw(o.position, { x: t.position.x, y: t.position.y, z: 0.1 }, 220, Ease.out); this.tw(o.scale, { x: 1, y: 1, z: 1 }, 220);
      this.tw(t.material, { opacity: 0 }, 300);
      UI.say(pick(['Yes! ⭐', 'Perfect! 🎉', 'Nice! 👏']), 1200);
      if (this.done === this.n) this.finish(this.wrong === 0 ? 3 : this.wrong <= 2 ? 2 : 1, 'All shapes sorted!');
    } else {
      const near = this.targets.some(t2 => Math.hypot(o.position.x - t2.position.x, o.position.y - t2.position.y) < 1.5);
      if (near) { this.wrong++; Audio.oops(); UI.say('Hmm, not that one! 🤔', 1200); }
      const h = o.userData.home; this.tw(o.position, { x: h.x, y: h.y, z: 0 }, 450, Ease.back); this.tw(o.scale, { x: 1, y: 1, z: 1 }, 200);
    }
  }
  update(dt, t) {
    super.update(dt, t);
    this.shapes.forEach((s, i) => { s.rotation.y = Math.sin(t * 1.5 + i) * 0.35; if (s.userData.placed) s.rotation.y = t * 1.2; });
    this.targets.forEach((s, i) => { s.rotation.y = Math.sin(t * 1.5 + i) * 0.35; });
  }
}

/* =====================================================================
   GAME 4 · Match Pairs (toddlers/kids) — visual memory
   ===================================================================== */
const EMOJIS = ['🐶', '🐱', '🦊', '🐸', '🐵', '🦁', '🐼', '🐨', '🐷', '🐰', '🦄', '🐙', '🍎', '🍌', '🍓', '🚗', '⭐', '🌈', '🍕', '🎈', '🚀', '🐢', '🦋', '🌻'];
class MatchPairs extends Game {
  start() {
    const grids = [[2, 2], [3, 2], [4, 2], [4, 3], [4, 4], [5, 4], [6, 4], [6, 5]];
    const [cols, rows] = grids[Math.min(this.level, 8) - 1], pairs = cols * rows / 2;
    const cw = 2.2, ch = 2.6; this.stage.fit(cols * cw + 0.6, rows * ch + 0.6);
    const faces = shuffle(EMOJIS).slice(0, pairs), deck = shuffle(faces.concat(faces));
    this.open = []; this.matched = 0; this.pairs = pairs; this.moves = 0; this.cards = [];
    const geo = new THREE.BoxGeometry(2, 2.4, 0.16), backTex = patternTexture('#' + new THREE.Color(pick(PALETTE)).getHexString());
    const side = mat(0xffffff);
    deck.forEach((emoji, i) => {
      const r = Math.floor(i / cols), c = i % cols;
      const m = new THREE.Mesh(geo, [side, side, side, side, new THREE.MeshStandardMaterial({ map: backTex, roughness: .5 }), new THREE.MeshStandardMaterial({ map: emojiTexture(emoji), roughness: .5 })]);
      m.position.set((c - (cols - 1) / 2) * cw, ((rows - 1) / 2 - r) * ch, 0);
      m.userData.emoji = emoji; m.scale.setScalar(0.01);
      Tween.to(m.scale, { x: 1, y: 1, z: 1 }, 400, Ease.back, i * 40);
      this.pickable(m, { tap: o => this.flip(o) }); this.group.add(m); this.cards.push(m);
    });
    UI.score('🔁 0'); UI.say('Find the matching pairs! 🐾');
  }
  async flip(card) {
    if (card.userData.open || card.userData.done || this.open.length >= 2) return;
    card.userData.open = true; this.open.push(card); Audio.tap();
    this.tw(card.rotation, { y: Math.PI }, 350, Ease.back); this.tw(card.position, { z: 1 }, 175).then(() => this.tw(card.position, { z: 0 }, 175));
    if (this.open.length < 2) return;
    this.moves++; UI.score('🔁 ' + this.moves);
    const [a, b] = this.open;
    await this.sleep(500);
    if (a.userData.emoji === b.userData.emoji) {
      a.userData.done = b.userData.done = true; this.matched++; Audio.ding();
      for (const c of [a, b]) { this.unpick(c); this.tw(c.scale, { x: 1.15, y: 1.15, z: 1.15 }, 150).then(() => this.tw(c.scale, { x: 1, y: 1, z: 1 }, 200)); this.parts.push(...confetti(this.stage, this.group, 8, c.position.clone())); }
      this.open = [];
      if (this.matched === this.pairs) { const r = this.moves / this.pairs; this.finish(r <= 1.6 ? 3 : r <= 2.4 ? 2 : 1, `All ${this.pairs} pairs in ${this.moves} tries!`); }
      else UI.say(pick(['Match! 🎉', 'Yes! ⭐', 'Great memory! 🧠']), 1000);
    } else {
      await this.sleep(400);
      for (const c of [a, b]) { c.userData.open = false; this.tw(c.rotation, { y: 0 }, 350, Ease.back); }
      this.open = [];
    }
  }
  update(dt, t) { super.update(dt, t); for (const c of this.cards) if (c.userData.done) c.rotation.y += dt / 900; }
}

/* =====================================================================
   GAME 5 · Follow the Lights (kids) — sequence memory (Simon)
   ===================================================================== */
class Simon extends Game {
  start() {
    const layout = this.level < 3 ? [2, 2] : this.level < 6 ? [3, 2] : [3, 3];
    const [cols, rows] = layout, gap = 3.1; this.stage.fit(cols * gap + 0.6, rows * gap + 0.6);
    this.pads = []; this.seq = []; this.idx = 0; this.mistakes = 0; this.target = 3 + this.level; this.speed = Math.max(260, 620 - this.level * 45);
    const geo = roundedBoxGeo(2.7, 2.7, 0.9, 0.55);
    for (let i = 0; i < cols * rows; i++) {
      const color = PALETTE[i % PALETTE.length];
      const m = new THREE.Mesh(geo, mat(color, { emissive: color, emissiveIntensity: 0, roughness: .35 }));
      m.position.set((i % cols - (cols - 1) / 2) * gap, ((rows - 1) / 2 - Math.floor(i / cols)) * gap, 0);
      m.userData.i = i; this.pickable(m, { tap: o => this.press(o) }); this.group.add(m); this.pads.push(m);
    }
    UI.score('🎵 0'); setTimeout(() => this.alive && this.extend(), 600);
  }
  light(pad, ms) {
    pad.material.emissiveIntensity = 0.75; Tween.to(pad.position, { z: 0.8 }, 80); Tween.to(pad.scale, { x: 1.08, y: 1.08, z: 1.08 }, 80);
    Audio.note(pad.userData.i, ms / 1000 + 0.1);
    return this.sleep(ms).then(() => { pad.material.emissiveIntensity = 0; this.tw(pad.position, { z: 0 }, 120); this.tw(pad.scale, { x: 1, y: 1, z: 1 }, 120); });
  }
  async extend() { this.seq.push(pick(this.pads)); UI.score('🎵 ' + this.seq.length); await this.play(); }
  async play() {
    this.locked = true; UI.say('Watch and listen... 👀');
    await this.sleep(700);
    for (const p of this.seq) { await this.light(p, this.speed); await this.sleep(this.speed * 0.45); }
    UI.say('Your turn! Repeat it 👆'); this.idx = 0; this.locked = false;
  }
  async press(pad) {
    this.locked = true; this.light(pad, 220);
    if (pad === this.seq[this.idx]) {
      this.idx++;
      if (this.idx === this.seq.length) {
        if (this.seq.length >= this.target) { this.finish(this.mistakes === 0 ? 3 : this.mistakes === 1 ? 2 : 1, `You remembered ${this.seq.length} steps in a row!`); return; }
        Audio.good(); UI.say(pick(['Yes! One more 🎵', 'Great! Keep going ⭐', 'Perfect! 🧠']), 900);
        await this.sleep(900); this.extend();
      } else this.locked = false;
    } else {
      this.mistakes++; Audio.oops();
      this.tw(this.group.position, { x: 0.3 }, 60).then(() => this.tw(this.group.position, { x: -0.3 }, 60)).then(() => this.tw(this.group.position, { x: 0 }, 60));
      if (this.mistakes >= 3) { this.finish(1, `You remembered ${Math.max(0, this.seq.length - 1)} steps. Try again!`, { next: false, title: 'Good try!', emoji: '💪' }); return; }
      UI.say('Oops! Watch again 👀'); await this.sleep(900); this.play();
    }
  }
}

/* =====================================================================
   GAME 6 · What's Missing? (kids) — attention & recall
   ===================================================================== */
class WhatsMissing extends Game {
  start() {
    this.stage.fit(13, 13);
    this.n = [3, 3, 4, 4, 5, 5, 6, 6][Math.min(this.level, 8) - 1]; this.round = 0; this.rounds = 3; this.mistakes = 0;
    this.items = []; this.cands = [];
    this.nextRound();
  }
  layout(count, i, yTop, yBot) { if (count <= 4) return { x: (i - (count - 1) / 2) * 3, y: yTop }; const per = Math.ceil(count / 2), r = i < per ? 0 : 1, c = r ? i - per : i, cnt = r ? count - per : per; return { x: (c - (cnt - 1) / 2) * 3, y: r ? yBot : yTop }; }
  clearAll() { for (const o of this.items.concat(this.cands)) { this.unpick(o); this.group.remove(o); } this.items = []; this.cands = []; }
  async nextRound() {
    this.locked = true; this.round++; UI.level(`Round ${this.round}/${this.rounds}`); this.clearAll();
    const names = shuffle(SHAPE_NAMES).slice(0, this.n + 2), colors = shuffle(PALETTE);
    const all = names.map((s, i) => ({ shape: s, color: colors[i] }));
    const shown = all.slice(0, this.n), decoys = all.slice(this.n);
    const make = d => { const m = new THREE.Mesh(SHAPES[d.shape](), mat(d.color, { roughness: .3 })); m.userData.d = d; m.add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), HIT_MAT())); return m; };
    shown.forEach((d, i) => { const p = this.layout(this.n, i, this.n <= 4 ? 2.2 : 3.4, 0.6); const m = make(d); m.position.set(p.x, p.y, 0); m.scale.setScalar(0.01); Tween.to(m.scale, { x: 1, y: 1, z: 1 }, 350, Ease.back, i * 80); this.group.add(m); this.items.push(m); });
    UI.say('Remember these! 👀'); Audio.speak('Remember these');
    await this.sleep(2200 + this.n * 450);
    Audio.whoosh(); UI.say('');
    await Promise.all(this.items.map(m => this.tw(m.scale, { x: 0.01, y: 0.01, z: 0.01 }, 250, Ease.in)));
    this.missing = pick(shown);
    const rest = shuffle(shown.filter(d => d !== this.missing));
    this.items.forEach(m => this.group.remove(m)); this.items = [];
    rest.forEach((d, i) => { const p = this.layout(this.n, i, this.n <= 4 ? 2.2 : 3.4, 0.6); const m = make(d); m.position.set(p.x, p.y, 0); m.scale.setScalar(0.01); Tween.to(m.scale, { x: 1, y: 1, z: 1 }, 350, Ease.back, i * 80); this.group.add(m); this.items.push(m); });
    await this.sleep(500);
    const options = shuffle([this.missing, ...decoys]);
    options.forEach((d, i) => {
      const m = make(d); m.position.set((i - 1) * 3.6, -4.2, 0); m.scale.setScalar(0.01); Tween.to(m.scale, { x: 1, y: 1, z: 1 }, 350, Ease.back, i * 80);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 40), mat(0xffffff)); ring.position.copy(m.position); ring.position.z = -0.8; this.group.add(ring); this.cands.push(ring);
      this.pickable(m, { tap: o => this.choose(o) }); this.group.add(m); this.cands.push(m);
    });
    UI.say("Which one is missing? 🤔"); Audio.speak('Which one is missing?');
    this.locked = false;
  }
  async choose(m) {
    if (m.userData.d === this.missing) {
      this.locked = true; Audio.ding(); UI.say(`Yes! The ${COLOR_NAMES[this.missing.color]} ${this.missing.shape} 🎉`);
      this.parts.push(...confetti(this.stage, this.group, 25, m.position.clone()));
      this.tw(m.position, { y: m.position.y + 1 }, 250).then(() => this.tw(m.position, { y: m.position.y - 1 }, 350, Ease.bounce));
      await this.sleep(1300);
      if (this.round >= this.rounds) this.finish(this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1, 'Super spotting!'); else this.nextRound();
    } else {
      this.mistakes++; Audio.oops(); UI.say('Not that one! Look again 🔍', 1200);
      this.tw(m.rotation, { z: 0.3 }, 80).then(() => this.tw(m.rotation, { z: -0.3 }, 80)).then(() => this.tw(m.rotation, { z: 0 }, 80));
    }
  }
  update(dt, t) { super.update(dt, t); this.items.forEach((m, i) => { m.rotation.y = Math.sin(t * 1.4 + i) * 0.4; m.rotation.x = Math.sin(t * 1.1 + i) * 0.15; }); this.cands.forEach((m, i) => { if (m.userData.d) m.rotation.y = t * 0.8 + i; }); }
}

/* =====================================================================
   GAME 7 · Memory Grid (big kids) — spatial working memory
   ===================================================================== */
class MemoryGrid extends Game {
  start() {
    const L = Math.min(this.level, 8) - 1;
    this.n = [3, 3, 4, 4, 4, 5, 5, 5][L]; this.k = [3, 4, 4, 5, 6, 6, 7, 8][L]; this.round = 0; this.rounds = 3; this.mistakes = 0;
    const gap = 2.1; this.stage.fit(this.n * gap + 0.8, this.n * gap + 0.8);
    this.tiles = []; const geo = roundedBoxGeo(1.8, 1.8, 0.5, 0.3);
    for (let i = 0; i < this.n * this.n; i++) {
      const m = new THREE.Mesh(geo, mat(0xffffff, { emissive: 0xffd93d, emissiveIntensity: 0, roughness: .5 }));
      m.position.set((i % this.n - (this.n - 1) / 2) * gap, ((this.n - 1) / 2 - Math.floor(i / this.n)) * gap, 0);
      m.scale.setScalar(0.01); Tween.to(m.scale, { x: 1, y: 1, z: 1 }, 300, Ease.back, i * 25);
      this.pickable(m, { tap: o => this.tap(o) }); this.group.add(m); this.tiles.push(m);
    }
    setTimeout(() => this.alive && this.nextRound(), 700);
  }
  setTile(m, color, intensity, z = 0) { m.material.color.set(color).convertSRGBToLinear(); m.material.emissive.set(color).convertSRGBToLinear(); m.material.emissiveIntensity = intensity; Tween.to(m.position, { z }, 120); }
  async nextRound() {
    this.locked = true; this.round++; UI.level(`Round ${this.round}/${this.rounds}`); UI.score(`🟨 ${this.k}`);
    for (const t of this.tiles) { this.setTile(t, 0xffffff, 0); t.userData.lit = false; t.userData.hit = false; }
    this.set = new Set(shuffle(this.tiles).slice(0, this.k)); this.found = 0;
    UI.say('Watch the tiles! 👀'); await this.sleep(600);
    for (const t of this.set) { this.setTile(t, 0xffb300, 0.45, 0.6); Audio.tap(); await this.sleep(70); }
    await this.sleep(1000 + this.k * 180);
    for (const t of this.set) this.setTile(t, 0xffffff, 0);
    UI.say(`Tap the ${this.k} tiles that lit up 👆`); this.locked = false;
  }
  async tap(t) {
    if (t.userData.hit) return; t.userData.hit = true;
    if (this.set.has(t)) {
      this.setTile(t, 0x6bd968, 0.6, 0.4); Audio.note(this.found, 0.2); this.found++;
      if (this.found === this.k) {
        this.locked = true; Audio.good(); UI.say(pick(['Perfect! 🧠', 'All of them! ⭐', 'Brilliant! 🎉']));
        await this.sleep(1000);
        if (this.round >= this.rounds) this.finish(this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1, `You remembered ${this.k} tiles at once!`); else this.nextRound();
      }
    } else {
      this.mistakes++; this.setTile(t, 0xff5e7a, 0.6, 0.2); Audio.oops();
      this.sleep(500).then(() => { this.setTile(t, 0xffffff, 0); t.userData.hit = false; });
    }
  }
}

/* =====================================================================
   GAME 8 · Number Recall (big kids) — digit span, forward & backward
   ===================================================================== */
class NumberRecall extends Game {
  start() {
    this.stage.fit(11, 9);
    const L = Math.min(this.level, 8) - 1;
    this.len = [3, 4, 5, 6, 3, 4, 5, 6][L]; this.backwards = L >= 4; this.round = 0; this.rounds = 3; this.mistakes = 0; this.cubes = [];
    UI.level(this.backwards ? '🔁 Backwards' : '➡️ Forward');
    setTimeout(() => this.alive && this.nextRound(), 500);
  }
  clearCubes() { for (const c of this.cubes) this.group.remove(c); this.cubes = []; }
  /* digit only on the front face; the other five faces are plain colour */
  cubeMats(tex, color) { const side = mat(color, { roughness: .4 }); return [side, side, side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: .4 }), side]; }
  async nextRound() {
    this.locked = true; this.round++; UI.score(`Round ${this.round}/${this.rounds}`); UI.hideKeypad(); this.clearCubes();
    this.digits = Array.from({ length: this.len }, () => randInt(0, 9)); this.typed = '';
    UI.say(this.backwards ? 'Remember the numbers — type them BACKWARDS 🔁' : 'Remember the numbers ➡️');
    await this.sleep(1200);
    const geo = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    for (let i = 0; i < this.digits.length; i++) {
      const tex = textTexture(String(this.digits[i]), '#' + new THREE.Color(PALETTE[i % PALETTE.length]).getHexString(), '#ffffff');
      const c = new THREE.Mesh(geo, this.cubeMats(tex, PALETTE[i % PALETTE.length]));
      c.position.set(0, 0.5, 0); c.scale.setScalar(0.01); c.rotation.set(0.25, -0.5, 0); this.group.add(c); this.cubes.push(c);
      Audio.note(this.digits[i], 0.3);
      await this.tw(c.scale, { x: 1, y: 1, z: 1 }, 250, Ease.back); await this.tw(c.rotation, { y: 0.35 }, 500, Ease.inOut);
      await this.sleep(150);
      await this.tw(c.scale, { x: 0.01, y: 0.01, z: 0.01 }, 180, Ease.in); this.group.remove(c);
    }
    this.cubes = []; UI.say(this.backwards ? 'Type them backwards 🔁' : 'Type the numbers ⌨️');
    UI.showKeypad(k => this.key(k)); this.locked = false;
  }
  key(k) {
    if (this.locked) return;
    if (k === '⌫') this.typed = this.typed.slice(0, -1);
    else if (k === 'OK') { this.check(); return; }
    else if (this.typed.length < this.len) this.typed += k;
    this.showTyped();
  }
  showTyped() {
    this.clearCubes(); const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6), n = this.typed.length;
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(geo, this.cubeMats(textTexture(this.typed[i], '#ffffff', '#1f1b3a'), 0xffffff));
      c.position.set((i - (n - 1) / 2) * 1.9, 1.8, 0); c.rotation.set(0.2, -0.3, 0); this.group.add(c); this.cubes.push(c);
    }
    UI.say(this.typed ? this.typed.split('').join(' ') : (this.backwards ? 'Type them backwards 🔁' : 'Type the numbers ⌨️'));
  }
  async check() {
    const want = (this.backwards ? this.digits.slice().reverse() : this.digits).join('');
    this.locked = true;
    if (this.typed === want) {
      Audio.good(); UI.say('Correct! 🎉'); this.parts.push(...confetti(this.stage, this.group, 40, new THREE.Vector3(0, 1, 0)));
      await this.sleep(1200);
      if (this.round >= this.rounds) { UI.hideKeypad(); this.finish(this.mistakes === 0 ? 3 : this.mistakes === 1 ? 2 : 1, `${this.len} digits ${this.backwards ? 'backwards' : ''} — amazing memory!`); }
      else this.nextRound();
    } else {
      this.mistakes++; Audio.oops(); UI.say(`It was ${want.split('').join(' ')} — try the next one!`);
      await this.sleep(1800);
      if (this.round >= this.rounds) { UI.hideKeypad(); this.finish(1, 'Keep practising — you will get it!', { title: 'Good try!', emoji: '💪' }); } else this.nextRound();
    }
  }
}

/* ================= Registry & App ================= */
const BANDS = [
  { id: 'baby', label: 'Babies', age: '0–2', emoji: '👶', color: 0xff6f9c },
  { id: 'toddler', label: 'Toddlers', age: '2–4', emoji: '🧒', color: 0xff9f43 },
  { id: 'kid', label: 'Kids', age: '4–7', emoji: '🦸', color: 0x2fb5f0 },
  { id: 'big', label: 'Big Kids', age: '7–12', emoji: '🧠', color: 0x7c5cff },
];
const GAMES = [
  { id: 'bubbles', title: 'Bubble Pop', emoji: '🫧', band: 'baby', skill: 'Cause & effect · visual tracking', cls: BubblePop, levels: 8 },
  { id: 'peekaboo', title: 'Peekaboo Pip', emoji: '🙈', band: 'baby', skill: 'Object permanence · attention', cls: Peekaboo, levels: 8 },
  { id: 'sorter', title: 'Shape Sorter', emoji: '🔷', band: 'toddler', skill: 'Shapes · matching · fine motor', cls: ShapeSorter, levels: 8 },
  { id: 'pairs', title: 'Match Pairs', emoji: '🐶', band: 'toddler', skill: 'Visual memory', cls: MatchPairs, levels: 8 },
  { id: 'simon', title: 'Follow the Lights', emoji: '🎵', band: 'kid', skill: 'Sequence memory', cls: Simon, levels: 8 },
  { id: 'missing', title: "What's Missing?", emoji: '🔍', band: 'kid', skill: 'Attention · recall', cls: WhatsMissing, levels: 8 },
  { id: 'grid', title: 'Memory Grid', emoji: '🟨', band: 'big', skill: 'Spatial working memory', cls: MemoryGrid, levels: 8 },
  { id: 'digits', title: 'Number Recall', emoji: '🔢', band: 'big', skill: 'Digit span · working memory', cls: NumberRecall, levels: 8 },
];

const App = {
  init() {
    Store.load(); UI.init();
    this.stage = new Stage($('#stage'));
    this.band = Store.data.band || 'toddler'; this.current = null;
    Audio.on = Store.data.sound !== false; this.updateSoundBtn();
    this.renderHome();
    $('#btn-sound').onclick = () => { Audio.init(); Audio.on = !Audio.on; Store.data.sound = Audio.on; Store.save(); this.updateSoundBtn(); if (Audio.on) Audio.ding(); };
    $('#btn-back').onclick = () => this.goHome();
    $('#modal-home').onclick = () => this.goHome();
    $('#modal-again').onclick = () => this.startGame(this.current.meta, this.current.level);
    $('#modal-next').onclick = () => this.startGame(this.current.meta, Math.min(this.current.level + 1, this.current.meta.levels));
    this.setupInstall();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && this.current) this.goHome(); });
  },
  updateSoundBtn() { $('#btn-sound').textContent = Audio.on ? '🔊' : '🔇'; },
  renderHome() {
    const bands = $('#bands');
    bands.innerHTML = BANDS.map(b => `<button type="button" class="band ${b.id === this.band ? 'active' : ''}" data-band="${b.id}"><span class="b-emoji">${b.emoji}</span><span>${b.label}</span><span class="b-age">${b.age} yrs</span></button>`).join('');
    bands.onclick = e => { const b = e.target.closest('.band'); if (!b) return; Audio.init(); Audio.tap(); this.band = b.dataset.band; Store.data.band = this.band; Store.save(); this.renderHome(); };
    const band = BANDS.find(b => b.id === this.band);
    this.stage.setTheme(band.color);
    const games = $('#games');
    games.innerHTML = GAMES.filter(g => g.band === this.band).map(g => {
      const p = Store.game(g.id), stars = [1, 2, 3].map(i => `<span class="${i <= p.stars ? '' : 'empty'}">★</span>`).join('');
      return `<button type="button" class="game-card" data-game="${g.id}"><span class="g-emoji" style="background:#${new THREE.Color(band.color).getHexString()}22">${g.emoji}</span><span><span class="g-title">${g.title}</span><div class="g-skill">${g.skill}</div><div class="g-stars">${stars} <span style="color:var(--muted);letter-spacing:0">· Level ${p.best}/${g.levels}</span></div></span><span class="g-age">${band.age}</span></button>`;
    }).join('');
    games.onclick = e => { const c = e.target.closest('.game-card'); if (!c) return; const g = GAMES.find(x => x.id === c.dataset.game); this.startGame(g, Store.game(g.id).best); };
  },
  startGame(meta, level = 1) {
    Audio.init();
    if (this.current) this.current.destroy();
    this.stage.drag = null;
    UI.showGame(`${meta.emoji} ${meta.title}`);
    this.stage.setTheme(BANDS.find(b => b.id === meta.band).color);
    const game = new meta.cls(this.stage, meta, clamp(level, 1, meta.levels));
    this.current = game; this.stage.game = game;
    $('#hud-level').textContent = ''; document.title = `${meta.title} · BrainPlay`;
    try { game.start(); } catch (err) { console.error(err); }
    if (!$('#hud-level').textContent) UI.level(`Level ${game.level}`);
  },
  goHome() {
    if (this.current) { this.current.destroy(); this.current = null; this.stage.game = null; }
    this.stage.fit(12, 12, 0); document.title = 'BrainPlay Kids';
    this.renderHome(); UI.showHome();
  },
  setupInstall() {
    const btn = $('#btn-install');
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream, standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    if (isIOS && !standalone) $('#ios-hint').classList.remove('hidden');
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault(); this.installEvt = e; btn.classList.remove('hidden');
      btn.onclick = async () => { btn.disabled = true; this.installEvt.prompt(); const r = await this.installEvt.userChoice; if (r.outcome === 'accepted') btn.classList.add('hidden'); btn.disabled = false; this.installEvt = null; };
    });
    window.addEventListener('appinstalled', () => { btn.classList.add('hidden'); $('#ios-hint').classList.add('hidden'); });
  },
};
window.addEventListener('DOMContentLoaded', () => App.init());
