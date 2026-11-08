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
  emit(ev) { if (this.onEvent) this.onEvent(ev); },
  pop() { this.tone(rand(500, 900), 0.12, 'sine', 0.5, 0, 400); this.noise(0.06, 0.25); },
  tap() { this.tone(660, 0.08, 'triangle', 0.35); },
  ding() { this.emit('good'); this.tone(880, 0.25, 'sine', 0.5); this.tone(1320, 0.35, 'sine', 0.35, 0.08); },
  good() { this.emit('good'); [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.45, i * 0.09)); },
  cheer() { this.emit('cheer'); [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.4, i * 0.1)); this.tone(1568, 0.6, 'sine', 0.3, 0.5); },
  oops() { this.emit('oops'); this.tone(300, 0.25, 'sawtooth', 0.18, 0, -120); },
  whoosh() { this.emit('wow'); this.noise(0.25, 0.18); },
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
    this.mascot = new Mascot(0x3fc1ff); this.scene.add(this.mascot.group); this.mascotMode = 'home';
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
    this.placeMascot();
  }
  /* home: big, bottom-right; game: small, bottom-left corner, in front of the play area but never pickable */
  placeMascot() {
    if (!this.mascot) return;
    const portrait = this.viewH > this.viewW;
    if (this.mascotMode === 'home') this.mascot.place(portrait ? 0 : this.viewW * 0.28, -this.viewH / 2 + (portrait ? 3.2 : 2.6), 2, portrait ? 0.95 : 1.1);
    else this.mascot.place(-this.viewW / 2 + 1.25, -this.viewH / 2 + 1.55, 3, 0.5);
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
    if (this.mascot.group.visible) this.mascot.update(dt, t);
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
  if (bg !== 'rgba(0,0,0,0)') { g.fillStyle = bg; g.fillRect(0, 0, size, size); }
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
    this.pip = new Mascot(pick(PALETTE)); this.pip.place(0, 0, 0, 0.62); this.pip.group.userData.y0 = undefined; this.buddy = this.pip.group; this.buddy.visible = false; this.group.add(this.buddy);
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
    if (this.buddy.visible) { const y = this.buddy.position.y; this.pip.update(dt, t); this.buddy.position.y = y; }
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


/* =====================================================================
   Mascot "Bo" — an original 3D cartoon character with moods & animations.
   Lives on the home screen and in the corner of every game, reacting to play.
   ===================================================================== */
class Mascot {
  constructor(color = 0x3fc1ff) {
    const g = this.group = new THREE.Group(); this.color = color;
    const skin = mat(color, { roughness: .4 }), dark = mat(0x222244, { roughness: .3 }), white = mat(0xffffff, { roughness: .2 });
    // body + belly
    this.body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 32, 24), skin); this.body.scale.set(1, 0.85, 0.9); this.body.position.y = -1.0; g.add(this.body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 18), mat(0xfff3c4, { roughness: .6 })); belly.position.set(0, -1.05, 0.55); belly.scale.set(1, 0.85, 0.45); g.add(belly);
    // head
    this.head = new THREE.Group(); this.head.position.y = 0.55; g.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.05, 32, 24), skin); skull.scale.set(1.08, 1, 1); this.head.add(skull);
    // ears (on little stalks) — makes it an "original" character rather than a plain blob
    for (const sx of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.55, 10), skin); stalk.position.set(sx * 0.75, 0.95, 0); stalk.rotation.z = -sx * 0.5; this.head.add(stalk);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mat(0xffd93d, { roughness: .35 })); tip.position.set(sx * 0.9, 1.2, 0); this.head.add(tip);
    }
    // eyes: white, pupil, highlight; eyelids for blinking
    this.pupils = []; this.lids = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), white); eye.position.set(sx * 0.4, 0.12, 0.85); this.head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), dark); pupil.position.set(sx * 0.4, 0.12, 1.1); this.head.add(pupil); this.pupils.push(pupil);
      const hi = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), white); hi.position.set(sx * 0.4 + 0.06, 0.2, 1.22); this.head.add(hi);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2), skin); lid.position.set(sx * 0.4, 0.12, 0.86); lid.scale.y = 0.01; this.head.add(lid); this.lids.push(lid);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.09, 0.1), dark); brow.position.set(sx * 0.4, 0.55, 1.0); brow.userData.sx = sx; this.head.add(brow); (this.brows = this.brows || []).push(brow);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat(0xff8aa0, { roughness: .8 })); cheek.position.set(sx * 0.62, -0.18, 0.78); cheek.scale.z = 0.35; this.head.add(cheek);
    }
    // mouths: smile, big grin, frown, "o" — one visible at a time
    this.mouths = {
      happy: new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20, Math.PI), mat(0x662233)),
      grin: new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x662233)),
      sad: new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 20, Math.PI), mat(0x662233)),
      wow: new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 12), mat(0x662233)),
    };
    this.mouths.happy.rotation.z = Math.PI; this.mouths.happy.position.set(0, -0.3, 0.95);
    this.mouths.grin.position.set(0, -0.22, 0.9); this.mouths.grin.scale.set(1, 0.9, 0.5);
    this.mouths.sad.position.set(0, -0.5, 0.95);
    this.mouths.wow.position.set(0, -0.38, 0.95); this.mouths.wow.scale.set(1, 1.3, 0.5);
    for (const m of Object.values(this.mouths)) { m.visible = false; this.head.add(m); }
    // arms with hands, pivot at shoulder
    this.arms = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(sx * 0.85, -0.7, 0.1);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.8, 12), skin); arm.position.y = -0.35; pivot.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), skin); hand.position.y = -0.8; pivot.add(hand);
      pivot.rotation.z = sx * 0.35; pivot.userData.sx = sx; g.add(pivot); this.arms.push(pivot);
    }
    // feet
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), mat(0xffd93d, { roughness: .5 })); f.position.set(sx * 0.45, -1.85, 0.25); f.scale.set(1, 0.5, 1.3); g.add(f); }
    this.mood = 'happy'; this.setMood('happy'); this.t = 0; this.blinkT = 2; this.anim = null; this.animT = 0; this.lookX = 0; this.lookY = 0;
  }
  setMood(m) { this.mood = m; for (const k in this.mouths) this.mouths[k].visible = k === m; const tilt = m === 'sad' ? 0.35 : m === 'wow' ? -0.25 : m === 'grin' ? -0.1 : 0; for (const b of this.brows) { b.rotation.z = b.userData.sx * tilt; b.position.y = m === 'wow' ? 0.65 : 0.55; } }
  /* one-shot animations: 'wave' | 'jump' | 'sad' | 'wow' */
  play(name) { this.anim = name; this.animT = 0; if (name === 'jump') this.setMood('grin'); if (name === 'sad') this.setMood('sad'); if (name === 'wow') this.setMood('wow'); if (name === 'wave') this.setMood('happy'); }
  update(dt, t) {
    const s = dt / 1000; this.t += s;
    // idle breathing + bob
    const breathe = 1 + Math.sin(this.t * 2.2) * 0.025; this.body.scale.set(1 * breathe, 0.85 / breathe, 0.9 * breathe);
    if (this.group.userData.y0 !== undefined && !this.anim) this.group.position.y = this.group.userData.y0 + Math.sin(this.t * 1.8) * 0.06;
    this.head.rotation.z = Math.sin(this.t * 1.1) * 0.06; this.head.rotation.y = Math.sin(this.t * 0.7) * 0.15;
    // blinking
    this.blinkT -= s; if (this.blinkT < 0) { this.blinkT = rand(2, 5); this.blinking = 0.18; }
    if (this.blinking !== undefined) { this.blinking -= s; const k = this.blinking > 0 ? Math.sin((0.18 - this.blinking) / 0.18 * Math.PI) : 0; for (const l of this.lids) l.scale.y = Math.max(0.01, k); if (this.blinking <= 0) this.blinking = undefined; }
    // eyes drift / follow
    for (const p of this.pupils) { p.position.x += ((p.position.x < 0 ? -0.4 : 0.4) + this.lookX * 0.1 - p.position.x) * 0.1; p.position.y += (0.12 + this.lookY * 0.1 - p.position.y) * 0.1; }
    // arms default sway
    for (const a of this.arms) { a.rotation.z = a.userData.sx * (0.35 + Math.sin(this.t * 1.8 + a.userData.sx) * 0.08); a.rotation.x = 0; }
    if (!this.anim) return;
    this.animT += s; const T = this.animT;
    if (this.anim === 'wave') { const a = this.arms[1]; a.rotation.z = -2.6 + Math.sin(T * 14) * 0.45; if (T > 1.6) this.anim = null; }
    else if (this.anim === 'jump') {
      const dur = 1.1, p = Math.min(T / dur, 1), hops = Math.abs(Math.sin(p * Math.PI * 2)) * 0.9;
      this.group.position.y = (this.group.userData.y0 || 0) + hops; const sq = 1 + Math.sin(p * Math.PI * 4) * 0.08; this.group.scale.set(this.baseScale / sq, this.baseScale * sq, this.baseScale / sq);
      for (const a of this.arms) a.rotation.z = a.userData.sx * (2.5 + Math.sin(T * 12) * 0.3);
      if (p >= 1) { this.anim = null; this.group.scale.setScalar(this.baseScale); this.setMood('happy'); }
    }
    else if (this.anim === 'sad') { this.head.rotation.z = Math.sin(T * 6) * 0.12; this.head.rotation.x = 0.25; if (T > 1.5) { this.anim = null; this.head.rotation.x = 0; this.setMood('happy'); } }
    else if (this.anim === 'wow') { this.head.rotation.x = -0.15; for (const a of this.arms) a.rotation.z = a.userData.sx * 1.2; if (T > 1.2) { this.anim = null; this.head.rotation.x = 0; this.setMood('happy'); } }
  }
  place(x, y, z, scale) { this.group.position.set(x, y, z); this.group.userData.y0 = y; this.baseScale = scale; this.group.scale.setScalar(scale); }
}

/* ================= shared helpers for the second batch of games ================= */
/* centred grid positions: count items in rows of `cols`, spaced sx/sy, centred on (0, cy) */
function gridLayout(count, cols, sx, sy, cy = 0) {
  const rows = Math.ceil(count / cols), out = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(i / cols), inRow = r === rows - 1 ? count - r * cols : cols, c = i - r * cols;
    out.push({ x: (c - (inRow - 1) / 2) * sx, y: cy + ((rows - 1) / 2 - r) * sy });
  }
  return out;
}
/* a thin rounded tile with an emoji or text on the front face */
function tile(tex, color = 0xffffff, w = 2.2, h = 2.2, d = 0.4) {
  const side = mat(color, { roughness: .5 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, new THREE.MeshStandardMaterial({ map: tex, roughness: .5 }), side]);
  m.add(new THREE.Mesh(new THREE.SphereGeometry(Math.max(w, h) * 0.7, 8, 6), HIT_MAT()));
  return m;
}
const wobble = (o, t, i = 0, amp = 0.25) => { o.rotation.y = Math.sin(t * 1.6 + i) * amp; o.rotation.x = Math.sin(t * 1.1 + i * 1.3) * amp * 0.5; };

/* =====================================================================
   GAME 9 · Find the Animal (babies) — listening, words, recognition
   ===================================================================== */
const ANIMALS = [['dog', '🐶'], ['cat', '🐱'], ['cow', '🐮'], ['pig', '🐷'], ['frog', '🐸'], ['lion', '🦁'], ['monkey', '🐵'], ['chicken', '🐔'], ['duck', '🦆'], ['fish', '🐟'], ['bear', '🐻'], ['rabbit', '🐰']];
class FindAnimal extends Game {
  start() {
    this.stage.fit(12.5, 13);
    const n = [2, 2, 3, 3, 4, 4, 6, 6][Math.min(this.level, 8) - 1];
    this.set = shuffle(ANIMALS).slice(0, n); this.round = 0; this.rounds = 5; this.misses = 0; this.tiles = []; this.target = null;
    const cols = n <= 3 ? n : n === 4 ? 2 : 3, pos = gridLayout(n, cols, 3.6, 3.6, 0.4);
    this.set.forEach((a, i) => {
      const m = tile(emojiTexture(a[1], '#fff7e6'), PALETTE[i % PALETTE.length], 3, 3, 0.6);
      m.position.set(pos[i].x, pos[i].y, 0); m.userData.a = a; m.scale.setScalar(0.01);
      Tween.to(m.scale, { x: 1, y: 1, z: 1 }, 400, Ease.back, i * 90);
      this.pickable(m, { tap: o => this.tap(o) }); this.group.add(m); this.tiles.push(m);
    });
    setTimeout(() => this.alive && this.nextRound(), 900);
  }
  nextRound() {
    this.round++; UI.level(`Round ${this.round}/${this.rounds}`);
    this.target = pick(this.set.filter(a => a !== this.target));
    UI.say(`Where is the ${this.target[0]}? ${this.target[1]}`); Audio.speak(`Where is the ${this.target[0]}?`);
    this.locked = false;
  }
  async tap(m) {
    const a = m.userData.a; this.locked = true;
    if (a === this.target) {
      Audio.good(); UI.say(`Yes! The ${a[0]}! ${a[1]} 🎉`); Audio.speak(`Yes! The ${a[0]}!`);
      this.parts.push(...confetti(this.stage, this.group, 25, m.position.clone()));
      this.tw(m.position, { z: 1.5 }, 200).then(() => this.tw(m.position, { z: 0 }, 400, Ease.bounce));
      await this.sleep(1600);
      if (this.round >= this.rounds) this.finish(this.misses === 0 ? 3 : this.misses <= 2 ? 2 : 1, 'You know your animals!'); else this.nextRound();
    } else {
      this.misses++; Audio.tap(); UI.say(`That's the ${a[0]} ${a[1]}. Find the ${this.target[0]}! ${this.target[1]}`); Audio.speak(`That's the ${a[0]}. Where is the ${this.target[0]}?`);
      this.tw(m.rotation, { z: 0.2 }, 90).then(() => this.tw(m.rotation, { z: -0.2 }, 90)).then(() => this.tw(m.rotation, { z: 0 }, 90));
      await this.sleep(900); this.locked = false;
    }
  }
  update(dt, t) { super.update(dt, t); this.tiles.forEach((m, i) => { wobble(m, t, i, 0.18); m.position.y = (m.userData.y0 === undefined ? (m.userData.y0 = m.position.y) : m.userData.y0) + Math.sin(t * 2 + i) * 0.12; }); }
}

/* =====================================================================
   GAME 10 · How Many? (toddlers) — counting, number recognition
   ===================================================================== */
class HowMany extends Game {
  start() {
    this.stage.fit(12.5, 13);
    this.max = [3, 3, 4, 5, 5, 6, 8, 10][Math.min(this.level, 8) - 1]; this.round = 0; this.rounds = 4; this.mistakes = 0; this.objs = []; this.answers = [];
    this.nextRound();
  }
  clear() { for (const o of this.objs.concat(this.answers)) { this.unpick(o); this.group.remove(o); } this.objs = []; this.answers = []; }
  nextRound() {
    this.locked = true; this.round++; UI.level(`Round ${this.round}/${this.rounds}`); this.clear();
    const n = this.count = randInt(1, this.max), shape = pick(SHAPE_NAMES), color = pick(PALETTE);
    const cells = shuffle(gridLayout(12, 4, 2.6, 2.4, 1.6)).slice(0, n);
    cells.forEach((p, i) => {
      const m = new THREE.Mesh(SHAPES[shape](), mat(color, { roughness: .3 })); m.scale.setScalar(0.75);
      m.position.set(p.x + rand(-.3, .3), p.y + rand(-.3, .3), 0); m.userData.s = 0.75; m.scale.setScalar(0.01);
      Tween.to(m.scale, { x: .75, y: .75, z: .75 }, 300, Ease.back, i * 120); this.group.add(m); this.objs.push(m);
    });
    const opts = new Set([n]); while (opts.size < 3) opts.add(clamp(n + randInt(-2, 2), 1, Math.max(3, this.max)));
    shuffle([...opts]).forEach((v, i) => {
      const m = tile(textTexture(String(v), '#ffffff', '#1f1b3a'), 0xffffff, 2.3, 2.3, 0.6); m.position.set((i - 1) * 3.4, -4.3, 0); m.userData.v = v;
      m.scale.setScalar(0.01); Tween.to(m.scale, { x: 1, y: 1, z: 1 }, 300, Ease.back, 400 + i * 100);
      this.pickable(m, { tap: o => this.answer(o) }); this.group.add(m); this.answers.push(m);
    });
    UI.say(`How many ${shape}s? Count them! 👆`); Audio.speak('How many? Count them!');
    setTimeout(() => { this.locked = false; }, 700);
  }
  async answer(m) {
    this.locked = true;
    if (m.userData.v === this.count) {
      Audio.good(); UI.say(`Yes! ${this.count}! 🎉`); Audio.speak(`Yes! ${this.count}!`);
      this.parts.push(...confetti(this.stage, this.group, 25, m.position.clone()));
      for (let i = 0; i < this.objs.length; i++) { const o = this.objs[i]; this.tw(o.position, { z: 1.2 }, 150, Ease.out, i * 110).then(() => this.tw(o.position, { z: 0 }, 250, Ease.bounce)); Audio.note(i, 0.2); await this.sleep(110); }
      await this.sleep(1200);
      if (this.round >= this.rounds) this.finish(this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1, 'Super counting!'); else this.nextRound();
    } else {
      this.mistakes++; Audio.oops(); UI.say('Count again! 🔢'); Audio.speak('Count again');
      this.tw(m.rotation, { z: 0.2 }, 90).then(() => this.tw(m.rotation, { z: -0.2 }, 90)).then(() => this.tw(m.rotation, { z: 0 }, 90));
      await this.sleep(700); this.locked = false;
    }
  }
  update(dt, t) { super.update(dt, t); this.objs.forEach((o, i) => wobble(o, t, i, 0.5)); }
}

/* =====================================================================
   GAME 11 · Odd One Out (kids) — visual discrimination, attention
   ===================================================================== */
class OddOneOut extends Game {
  start() {
    this.stage.fit(13, 13);
    const L = Math.min(this.level, 8) - 1;
    this.count = [4, 4, 6, 6, 8, 9, 9, 12][L]; this.modes = L < 2 ? ['color'] : L < 4 ? ['shape'] : L < 6 ? ['color', 'shape'] : ['color', 'shape', 'size', 'tint'];
    this.round = 0; this.rounds = 5; this.mistakes = 0; this.items = [];
    this.nextRound();
  }
  nextRound() {
    this.locked = true; this.round++; UI.level(`Round ${this.round}/${this.rounds}`);
    for (const o of this.items) { this.unpick(o); this.group.remove(o); } this.items = [];
    const mode = pick(this.modes), shape = pick(SHAPE_NAMES), ci = randInt(0, PALETTE.length - 1), color = PALETTE[ci];
    let oddShape = shape, oddColor = color, oddScale = 1;
    if (mode === 'color') oddColor = pick(PALETTE.filter(c => c !== color));
    if (mode === 'shape') oddShape = pick(SHAPE_NAMES.filter(sn => sn !== shape));
    if (mode === 'size') oddScale = 0.72;
    if (mode === 'tint') oddColor = new THREE.Color(color).offsetHSL(0.07, 0, 0).getHex();
    const cols = this.count <= 4 ? 2 : this.count <= 6 ? 3 : this.count <= 9 ? 3 : 4, pos = gridLayout(this.count, cols, 3, 3, 0.3), oddIdx = randInt(0, this.count - 1);
    pos.forEach((p, i) => {
      const odd = i === oddIdx;
      const m = new THREE.Mesh(SHAPES[odd ? oddShape : shape](), mat(odd ? oddColor : color, { roughness: .3 }));
      m.position.set(p.x, p.y, 0); m.userData.odd = odd; m.userData.s = odd ? oddScale : 1; m.scale.setScalar(0.01);
      m.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), HIT_MAT()));
      Tween.to(m.scale, { x: m.userData.s, y: m.userData.s, z: m.userData.s }, 300, Ease.back, i * 50);
      this.pickable(m, { tap: o => this.tap(o) }); this.group.add(m); this.items.push(m);
    });
    UI.say('Tap the odd one out! 🔍'); if (this.round === 1) Audio.speak('Tap the odd one out');
    setTimeout(() => { this.locked = false; }, 500);
  }
  async tap(m) {
    if (m.userData.odd) {
      this.locked = true; Audio.ding(); UI.say(pick(['Found it! 🎉', 'Sharp eyes! 👀', 'Yes! ⭐']));
      this.parts.push(...confetti(this.stage, this.group, 25, m.position.clone()));
      this.tw(m.position, { z: 1.5 }, 200).then(() => this.tw(m.position, { z: 0 }, 400, Ease.bounce));
      await this.sleep(1100);
      if (this.round >= this.rounds) this.finish(this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1, 'Eagle eyes!'); else this.nextRound();
    } else {
      this.mistakes++; Audio.oops(); UI.say('Not that one! Look closer 🔍', 1200);
      this.tw(m.rotation, { z: 0.3 }, 80).then(() => this.tw(m.rotation, { z: -0.3 }, 80)).then(() => this.tw(m.rotation, { z: 0 }, 80));
    }
  }
  update(dt, t) { super.update(dt, t); for (const m of this.items) { m.rotation.y = t * 0.9; } }
}

/* =====================================================================
   GAME 12 · Catch the Fruit (kids) — go/no-go, impulse control, speed
   ===================================================================== */
const FRUIT = ['🍎', '🍌', '🍓', '🍇', '🍊', '🍉', '🍍', '🥝'], BAD = ['💣', '🪨', '🧦'];
class CatchFruit extends Game {
  start() {
    this.stage.fit(12, 14);
    this.score = 0; this.timeLeft = 30000; this.items = []; this.spawnT = 0; this.ended = false;
    this.speed = 2.2 + this.level * 0.35; this.badRate = Math.min(0.45, 0.2 + this.level * 0.03); this.interval = Math.max(380, 900 - this.level * 60);
    this.target = 10 + this.level * 4;
    UI.score('🍎 0'); UI.say('Tap the fruit, not the junk! 🍎🚫💣'); Audio.speak('Tap the fruit, not the junk!');
  }
  spawn() {
    const bad = Math.random() < this.badRate, e = bad ? pick(BAD) : pick(FRUIT);
    const m = tile(emojiTexture(e, bad ? '#e8e8f0' : '#fffbe6'), bad ? 0x777788 : pick(PALETTE), 2.2, 2.2, 0.5);
    const W = this.stage.viewW / 2 - 1.6;
    m.position.set(rand(-W, W), -this.stage.viewH / 2 - 1.5, 0); m.userData.bad = bad; m.userData.vy = this.speed * rand(0.85, 1.25); m.userData.spin = rand(-1.5, 1.5);
    this.pickable(m, { tap: o => this.tap(o) }); this.group.add(m); this.items.push(m);
  }
  remove(m) { this.unpick(m); this.group.remove(m); const i = this.items.indexOf(m); if (i >= 0) this.items.splice(i, 1); }
  tap(m) {
    if (m.userData.dead) return; m.userData.dead = true;
    if (m.userData.bad) {
      this.score = Math.max(0, this.score - 2); Audio.oops(); UI.say('Oh no! Not that! 💥', 900);
      this.tw(this.group.position, { x: 0.35 }, 50).then(() => this.tw(this.group.position, { x: -0.35 }, 50)).then(() => this.tw(this.group.position, { x: 0 }, 50));
      this.tw(m.scale, { x: 0.01, y: 0.01, z: 0.01 }, 200, Ease.in).then(() => this.remove(m));
    } else {
      this.score++; Audio.pop(); Audio.note(this.score % 9, 0.15);
      this.parts.push(...confetti(this.stage, this.group, 8, m.position.clone()));
      this.tw(m.scale, { x: 1.5, y: 1.5, z: 1.5 }, 120).then(() => this.remove(m));
    }
    UI.score('🍎 ' + this.score);
  }
  update(dt, t) {
    super.update(dt, t);
    if (this.ended) return;
    this.timeLeft -= dt; UI.level(`⏱ ${Math.max(0, Math.ceil(this.timeLeft / 1000))}s`);
    this.spawnT -= dt; if (this.spawnT <= 0) { this.spawn(); this.spawnT = this.interval; }
    const H = this.stage.viewH / 2 + 2, s = dt / 1000;
    for (const m of this.items.slice()) { if (m.userData.dead) continue; m.position.y += m.userData.vy * s; m.rotation.z += m.userData.spin * s; m.rotation.y = Math.sin(t * 2 + m.position.x) * 0.3; if (m.position.y > H) this.remove(m); }
    if (this.timeLeft <= 0) { this.ended = true; this.locked = true; for (const m of this.items.slice()) this.remove(m); const r = this.score / this.target; this.finish(r >= 1 ? 3 : r >= 0.6 ? 2 : 1, `You caught ${this.score} fruit! (goal ${this.target})`); }
  }
}

/* =====================================================================
   GAME 13 · Math Pop (big kids) — mental arithmetic under light time pressure
   ===================================================================== */
class MathPop extends Game {
  start() {
    this.stage.fit(12, 13);
    this.round = 0; this.rounds = 6; this.mistakes = 0; this.bubbles = [];
    this.nextRound();
  }
  question() {
    const L = Math.min(this.level, 8), ops = L <= 2 ? ['+'] : L <= 4 ? ['+', '-'] : L <= 6 ? ['×'] : ['+', '-', '×'];
    const op = pick(ops), big = L % 2 === 0 || L >= 7; let a, b, ans;
    if (op === '+') { a = randInt(1, big ? 20 : 9); b = randInt(1, big ? 20 : 9); ans = a + b; }
    else if (op === '-') { a = randInt(2, big ? 20 : 10); b = randInt(1, a - 1); ans = a - b; }
    else { a = randInt(2, big ? 10 : 5); b = randInt(2, big ? 10 : 5); ans = a * b; }
    return { text: `${a} ${op} ${b} = ?`, ans };
  }
  nextRound() {
    this.locked = true; this.round++; UI.level(`${this.round}/${this.rounds}`);
    for (const o of this.bubbles) { this.unpick(o); this.group.remove(o); } this.bubbles = [];
    const q = this.q = this.question();
    const opts = new Set([q.ans]); while (opts.size < 4) { const d = q.ans + pick([-10, -3, -2, -1, 1, 2, 3, 10]); if (d >= 0 && d !== q.ans) opts.add(d); }
    const pos = gridLayout(4, 2, 4.2, 4, -0.8);
    shuffle([...opts]).forEach((v, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.5, 32, 24), mat(PALETTE[(i * 2 + this.round) % PALETTE.length], { roughness: .25 }));
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: textTexture(String(v), 'rgba(0,0,0,0)', '#ffffff'), transparent: true })); label.position.z = 1.45; m.add(label);
      m.add(new THREE.Mesh(new THREE.SphereGeometry(1.9, 8, 6), HIT_MAT()));
      m.position.set(pos[i].x, pos[i].y, 0); m.userData.v = v; m.userData.ph = rand(0, 6.28); m.userData.y0 = pos[i].y; m.scale.setScalar(0.01);
      Tween.to(m.scale, { x: 1, y: 1, z: 1 }, 300, Ease.back, i * 80);
      this.pickable(m, { tap: o => this.answer(o) }); this.group.add(m); this.bubbles.push(m);
    });
    UI.say(q.text); if (this.round === 1) Audio.speak('Pop the right answer');
    setTimeout(() => { this.locked = false; }, 400);
  }
  async answer(m) {
    if (m.userData.v === this.q.ans) {
      this.locked = true; Audio.pop(); Audio.good(); UI.say(`${this.q.text.replace('?', this.q.ans)} ✅`);
      this.parts.push(...confetti(this.stage, this.group, 30, m.position.clone()));
      this.tw(m.scale, { x: 1.6, y: 1.6, z: 1.6 }, 150).then(() => this.tw(m.scale, { x: 0.01, y: 0.01, z: 0.01 }, 150));
      await this.sleep(1200);
      if (this.round >= this.rounds) this.finish(this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1, 'Maths whizz!'); else this.nextRound();
    } else {
      this.mistakes++; Audio.oops(); UI.say(`Not ${m.userData.v}. ${this.q.text}`);
      this.tw(m.scale, { x: 0.01, y: 0.01, z: 0.01 }, 200, Ease.in).then(() => { this.unpick(m); this.group.remove(m); });
    }
  }
  update(dt, t) { super.update(dt, t); for (const b of this.bubbles) { b.position.y = b.userData.y0 + Math.sin(t * 1.3 + b.userData.ph) * 0.35; b.rotation.y = Math.sin(t + b.userData.ph) * 0.2; } }
}

/* =====================================================================
   GAME 14 · Spin Match (big kids) — mental rotation with 3D polycubes
   ===================================================================== */
const POLYCUBES = [
  [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1]],
  [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [2, 1, 1]],
  [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 1, 1], [1, 2, 1]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0], [0, 1, 0], [0, 1, 1]],
  [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 0], [2, 1, 1], [2, 2, 1]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 1, 1], [2, 1, 2]],
];
const cubeKey = cells => { const mx = Math.min(...cells.map(c => c[0])), my = Math.min(...cells.map(c => c[1])), mz = Math.min(...cells.map(c => c[2])); return cells.map(c => [c[0] - mx, c[1] - my, c[2] - mz]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).map(c => c.join(',')).join('|'); };
const rotX = c => [c[0], -c[2], c[1]], rotY = c => [c[2], c[1], -c[0]], rotZ = c => [-c[1], c[0], c[2]];
function allRotations(cells) {
  const out = new Set(); let a = cells;
  for (let i = 0; i < 4; i++) { let b = a; for (let j = 0; j < 4; j++) { let c = b; for (let k = 0; k < 4; k++) { out.add(cubeKey(c)); c = c.map(rotZ); } b = b.map(rotY); } a = a.map(rotX); }
  return out;
}
const isChiral = cells => !allRotations(cells).has(cubeKey(cells.map(c => [-c[0], c[1], c[2]])));
const CHIRAL = POLYCUBES.filter(isChiral);
class SpinMatch extends Game {
  start() {
    this.stage.fit(13, 13);
    const L = Math.min(this.level, 8) - 1;
    this.nCand = L < 2 ? 2 : 3; this.pool = CHIRAL.filter(c => L < 3 ? c.length <= 5 : L < 6 ? c.length <= 6 : true);
    this.round = 0; this.rounds = 5; this.mistakes = 0; this.objs = [];
    this.nextRound();
  }
  build(cells, color) {
    const g = new THREE.Group(), inner = new THREE.Group(), u = 0.8, geo = new THREE.BoxGeometry(u * 0.96, u * 0.96, u * 0.96), m = mat(color, { roughness: .4 });
    const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length, cy = cells.reduce((s, c) => s + c[1], 0) / cells.length, cz = cells.reduce((s, c) => s + c[2], 0) / cells.length;
    for (const c of cells) { const b = new THREE.Mesh(geo, m); b.position.set((c[0] - cx) * u, (c[1] - cy) * u, (c[2] - cz) * u); inner.add(b); }
    g.add(inner); g.userData.inner = inner; g.add(new THREE.Mesh(new THREE.SphereGeometry(2.1, 8, 6), HIT_MAT()));
    return g;
  }
  nextRound() {
    this.locked = true; this.round++; UI.level(`Round ${this.round}/${this.rounds}`);
    for (const o of this.objs) { this.unpick(o); this.group.remove(o); } this.objs = [];
    const cells = pick(this.pool), mirror = cells.map(c => [-c[0], c[1], c[2]]), color = pick(PALETTE);
    this.targetObj = this.build(cells, color); this.targetObj.position.set(0, 3.6, 0); this.group.add(this.targetObj); this.objs.push(this.targetObj);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.07, 8, 48), mat(0xffffff)); ring.position.set(0, 3.6, -1); this.group.add(ring); this.objs.push(ring);
    const xs = this.nCand === 2 ? [-2.6, 2.6] : [-4.2, 0, 4.2], rightIdx = randInt(0, this.nCand - 1);
    for (let i = 0; i < this.nCand; i++) {
      const o = this.build(i === rightIdx ? cells : mirror, color);
      o.userData.inner.rotation.set(randInt(0, 3) * Math.PI / 2, randInt(0, 3) * Math.PI / 2, randInt(0, 3) * Math.PI / 2);
      o.position.set(xs[i], -2.4, 0); o.userData.right = i === rightIdx; o.userData.ph = rand(0, 6.28); o.scale.setScalar(0.01);
      Tween.to(o.scale, { x: 1, y: 1, z: 1 }, 300, Ease.back, i * 100);
      this.pickable(o, { tap: m => this.choose(m) }); this.group.add(o); this.objs.push(o);
    }
    UI.say('Which one is the SAME shape as the top one? (Not a mirror!) 🔄'); if (this.round === 1) Audio.speak('Which one is the same shape as the top one? Careful, some are mirror images.');
    setTimeout(() => { this.locked = false; }, 500);
  }
  async choose(o) {
    if (o.userData.right) {
      this.locked = true; Audio.good(); UI.say('Yes! Same shape! 🎉');
      this.parts.push(...confetti(this.stage, this.group, 30, o.position.clone()));
      await this.sleep(1200);
      if (this.round >= this.rounds) this.finish(this.mistakes === 0 ? 3 : this.mistakes <= 2 ? 2 : 1, 'Master of rotation!'); else this.nextRound();
    } else {
      this.mistakes++; Audio.oops(); UI.say('That one is a mirror image! Try again 🪞', 1500);
      this.tw(o.position, { x: o.position.x + 0.3 }, 60).then(() => this.tw(o.position, { x: o.position.x - 0.6 }, 60)).then(() => this.tw(o.position, { x: o.position.x + 0.3 }, 60));
    }
  }
  update(dt, t) { super.update(dt, t); for (const o of this.objs) if (o.userData.inner) { o.rotation.y = t * 0.6 + (o.userData.ph || 0); o.rotation.x = Math.sin(t * 0.5 + (o.userData.ph || 0)) * 0.35; } }
}


/* a wide text texture for words/phrases (auto-fits the font to the width) */
function wordTexture(text, bg = '#ffffff', fg = '#1f1b3a') {
  const key = 'W' + text + bg + fg; if (texCache.has(key)) return texCache.get(key);
  const w = 512, h = 256, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  if (bg !== 'rgba(0,0,0,0)') { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  let size = 150; g.font = `bold ${size}px Fredoka, Nunito, system-ui, sans-serif`;
  while (g.measureText(text).width > w * 0.88 && size > 30) { size -= 6; g.font = `bold ${size}px Fredoka, Nunito, system-ui, sans-serif`; }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + size * 0.05);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; texCache.set(key, t); return t;
}
const flashTile = (m, color, ms = 250) => { const side = m.material[0], old = side.color.clone(); side.color.set(color).convertSRGBToLinear(); setTimeout(() => side.color.copy(old), ms); };

/* =====================================================================
   GAME 15 · N-Back (adults) — the classic working-memory trainer
   ===================================================================== */
const NB_COLORS = [0xff5e7a, 0x3fc1ff, 0xffd93d, 0x6bd968];
class NBack extends Game {
  start() {
    this.stage.fit(12, 14);
    const L = Math.min(this.level, 8) - 1;
    this.n = [1, 1, 2, 2, 2, 3, 3, 3][L]; this.dual = L >= 3; this.trials = 16 + this.n * 2; this.showMs = Math.max(900, 1500 - L * 60); this.gapMs = 900;
    this.hits = 0; this.fa = 0; this.misses = 0; this.i = -1; this.answered = { pos: false, col: false }; this.ended = false;
    this.cells = gridLayout(9, 3, 2.4, 2.4, 2.2);
    this.cells.forEach(p => { const c = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.1, 0.25), mat(0xffffff, { transparent: true, opacity: 0.35, roughness: .8 })); c.position.set(p.x, p.y, -0.3); this.group.add(c); });
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.8, 28, 20), mat(NB_COLORS[0], { roughness: .3 })); this.dot.visible = false; this.group.add(this.dot);
    // sequence with ~1/3 planned matches
    this.seq = [];
    for (let k = 0; k < this.trials; k++) {
      let p = randInt(0, 8), c = this.dual ? randInt(0, 3) : 0;
      if (k >= this.n) { if (Math.random() < 0.33) p = this.seq[k - this.n].p; else if (p === this.seq[k - this.n].p) p = (p + 1) % 9; if (this.dual) { if (Math.random() < 0.33) c = this.seq[k - this.n].c; else if (c === this.seq[k - this.n].c) c = (c + 1) % 4; } }
      this.seq.push({ p, c });
    }
    this.btnPos = this.makeBtn('POSITION', this.dual ? -3 : 0, 'pos'); if (this.dual) this.btnCol = this.makeBtn('COLOUR', 3, 'col');
    UI.score('✔ 0  ✖ 0');
    UI.say(this.dual ? `Dual ${this.n}-back: tap when the POSITION or COLOUR matches ${this.n} step${this.n > 1 ? 's' : ''} back` : `${this.n}-back: tap POSITION when the spot is where it was ${this.n} step${this.n > 1 ? 's' : ''} back`);
    setTimeout(() => this.alive && this.run(), 2500);
  }
  makeBtn(label, x, key) { const m = tile(wordTexture(label, '#ffffff', '#1f1b3a'), 0xdcdcee, 5.4, 2.0, 0.5); m.position.set(x, -4.6, 0); m.userData.key = key; this.pickable(m, { tap: o => this.press(o) }); this.group.add(m); return m; }
  press(m) {
    const key = m.userData.key; if (this.i < 0 || this.answered[key] || this.ended) return;
    this.answered[key] = true;
    const match = this.i >= this.n && (key === 'pos' ? this.seq[this.i].p === this.seq[this.i - this.n].p : this.seq[this.i].c === this.seq[this.i - this.n].c);
    if (match) { this.hits++; Audio.ding(); flashTile(m, 0x6bd968); } else { this.fa++; Audio.oops(); flashTile(m, 0xff5e7a); }
    UI.score(`✔ ${this.hits}  ✖ ${this.fa + this.misses}`);
  }
  async run() {
    for (let k = 0; k < this.trials && this.alive; k++) {
      this.i = k; this.answered = { pos: false, col: false }; UI.level(`${k + 1}/${this.trials}`);
      const st = this.seq[k]; this.dot.position.set(this.cells[st.p].x, this.cells[st.p].y, 0.6); this.dot.material.color.copy(srgb(NB_COLORS[st.c])); this.dot.visible = true; this.dot.scale.setScalar(0.01);
      this.tw(this.dot.scale, { x: 1, y: 1, z: 1 }, 180, Ease.back); Audio.tap();
      await this.sleep(this.showMs); this.dot.visible = false; await this.sleep(this.gapMs);
      if (k >= this.n) {
        const pm = st.p === this.seq[k - this.n].p, cm = this.dual && st.c === this.seq[k - this.n].c;
        if (pm && !this.answered.pos) { this.misses++; flashTile(this.btnPos, 0xffd93d, 300); }
        if (cm && !this.answered.col) { this.misses++; flashTile(this.btnCol, 0xffd93d, 300); }
        UI.score(`✔ ${this.hits}  ✖ ${this.fa + this.misses}`);
      }
    }
    if (!this.alive) return; this.ended = true;
    const total = this.hits + this.misses + this.fa, acc = total ? this.hits / total : 1;
    this.finish(acc >= 0.85 ? 3 : acc >= 0.6 ? 2 : 1, `${this.n}-back · ${this.hits} hits, ${this.misses} missed, ${this.fa} false alarms (${Math.round(acc * 100)}%)`);
  }
}

/* =====================================================================
   GAME 16 · Stroop (adults) — inhibition: tap the ink colour, not the word
   ===================================================================== */
const STROOP = [['RED', 0xff3b5c], ['BLUE', 0x2f7cff], ['GREEN', 0x2ec267], ['YELLOW', 0xffd000], ['PURPLE', 0x9b5cff], ['ORANGE', 0xff8a2a]];
class Stroop extends Game {
  start() {
    this.stage.fit(12.5, 13);
    const L = Math.min(this.level, 8) - 1;
    this.set = STROOP.slice(0, L < 4 ? 4 : 6); this.trials = 20; this.congruent = Math.max(0.15, 0.5 - L * 0.05); this.i = 0; this.mistakes = 0; this.times = []; this.ended = false;
    this.word = null; this.pads = [];
    const pos = gridLayout(this.set.length, this.set.length <= 4 ? 4 : 3, 3.0, 2.9, this.set.length <= 4 ? -2.6 : -2.8);
    this.set.forEach((c, i) => { const m = new THREE.Mesh(roundedBoxGeo(2.6, 2.3, 0.7, 0.45), mat(c[1], { roughness: .35 })); m.position.set(pos[i].x, pos[i].y, 0); m.userData.c = c; this.pickable(m, { tap: o => this.tap(o) }); this.group.add(m); this.pads.push(m); });
    UI.say('Tap the colour of the INK, not what the word says 🎨'); Audio.speak('Tap the ink colour, not the word');
    setTimeout(() => this.alive && this.next(), 2200);
  }
  next() {
    if (this.word) { this.group.remove(this.word); this.word = null; }
    if (this.i >= this.trials) { this.ended = true; this.locked = true; const avg = this.times.reduce((a, b) => a + b, 0) / this.times.length / 1000; this.finish(this.mistakes === 0 && avg < 1.3 ? 3 : this.mistakes <= 2 ? 2 : 1, `${this.trials - this.mistakes}/${this.trials} correct · ${avg.toFixed(2)}s per word`); return; }
    const ink = pick(this.set), text = Math.random() < this.congruent ? ink : pick(this.set.filter(c => c !== ink));
    this.ink = ink; UI.level(`${this.i + 1}/${this.trials}`);
    this.word = tile(wordTexture(text[0], '#ffffff', '#' + new THREE.Color(ink[1]).getHexString()), 0xffffff, 7, 3.2, 0.5); this.word.position.set(0, 2.6, 0); this.word.scale.setScalar(0.01);
    Tween.to(this.word.scale, { x: 1, y: 1, z: 1 }, 150, Ease.back); this.group.add(this.word); this.t0 = performance.now(); this.locked = false;
  }
  tap(m) {
    if (this.locked || this.ended) return; this.locked = true; this.times.push(performance.now() - this.t0); this.i++;
    if (m.userData.c === this.ink) { Audio.tap(); this.tw(m.position, { z: 0.6 }, 80).then(() => this.tw(m.position, { z: 0 }, 120)); }
    else { this.mistakes++; Audio.oops(); UI.say(`That was ${this.ink[0]} ink`, 900); this.tw(this.group.position, { x: 0.3 }, 50).then(() => this.tw(this.group.position, { x: -0.3 }, 50)).then(() => this.tw(this.group.position, { x: 0 }, 50)); }
    UI.score(`✖ ${this.mistakes}`); setTimeout(() => this.alive && this.next(), 220);
  }
}

/* =====================================================================
   GAME 17 · Mental Chain (adults) — chained arithmetic held in working memory
   ===================================================================== */
class MentalChain extends Game {
  start() {
    this.stage.fit(11, 10);
    const L = Math.min(this.level, 8) - 1;
    this.steps = [3, 4, 4, 5, 5, 6, 7, 8][L]; this.showMs = Math.max(700, 1400 - L * 90); this.hard = L >= 2; this.round = 0; this.rounds = 3; this.mistakes = 0; this.cur = null;
    setTimeout(() => this.alive && this.nextRound(), 400);
  }
  async nextRound() {
    this.locked = true; this.round++; UI.score(`Round ${this.round}/${this.rounds}`); UI.hideKeypad(); UI.level(`${this.steps} steps`);
    let v = randInt(2, this.hard ? 30 : 12); const chain = [String(v)];
    for (let k = 0; k < this.steps; k++) {
      const ops = this.hard ? ['+', '+', '-', '×', '÷'] : ['+', '+', '-'];
      let op = pick(ops), b; 
      if (op === '×') { b = randInt(2, 3); v *= b; } else if (op === '÷') { const d = [2, 3, 4, 5].filter(x => v % x === 0 && v / x > 0); if (!d.length) { op = '+'; b = randInt(2, 9); v += b; } else { b = pick(d); v /= b; } }
      else if (op === '-') { b = randInt(1, Math.min(9, v - 1)); if (b < 1) { op = '+'; b = randInt(2, 9); v += b; } else v -= b; } else { b = randInt(2, this.hard ? 19 : 9); v += b; }
      if (v > 400) { v -= 300; chain.push('− 300'); }
      chain.push(`${op} ${b}`);
    }
    this.answer = v; this.typed = '';
    UI.say('Follow the chain in your head…'); await this.sleep(1000);
    for (const step of chain) {
      if (this.cur) this.group.remove(this.cur);
      this.cur = tile(wordTexture(step, '#ffffff', '#1f1b3a'), pick(PALETTE), 5, 2.6, 0.7); this.cur.position.set(0, 1.2, 0); this.cur.scale.setScalar(0.01); this.cur.rotation.set(0.15, -0.3, 0); this.group.add(this.cur);
      Audio.tap(); await this.tw(this.cur.scale, { x: 1, y: 1, z: 1 }, 180, Ease.back); await this.sleep(this.showMs);
      await this.tw(this.cur.scale, { x: 0.01, y: 0.01, z: 0.01 }, 120, Ease.in);
    }
    this.group.remove(this.cur); this.cur = null;
    UI.say('= ?  Type the result'); UI.showKeypad(k => this.key(k)); this.locked = false;
  }
  key(k) {
    if (this.locked) return;
    if (k === '⌫') this.typed = this.typed.slice(0, -1); else if (k === 'OK') { this.check(); return; } else if (this.typed.length < 4) this.typed += k;
    UI.say(this.typed ? '= ' + this.typed : '= ?  Type the result');
  }
  async check() {
    if (!this.typed) return; this.locked = true; UI.hideKeypad();
    if (Number(this.typed) === this.answer) { Audio.good(); UI.say(`Correct! = ${this.answer} ✅`); this.parts.push(...confetti(this.stage, this.group, 40, new THREE.Vector3(0, 1, 0))); }
    else { this.mistakes++; Audio.oops(); UI.say(`It was ${this.answer} (you typed ${this.typed})`); }
    await this.sleep(1600);
    if (this.round >= this.rounds) this.finish(this.mistakes === 0 ? 3 : this.mistakes === 1 ? 2 : 1, `${this.rounds - this.mistakes}/${this.rounds} chains of ${this.steps} steps`); else this.nextRound();
  }
  destroy() { UI.hideKeypad(); super.destroy(); }
}

/* =====================================================================
   GAME 18 · Schulte Table (adults) — attention span & peripheral vision
   ===================================================================== */
class Schulte extends Game {
  start() {
    const L = Math.min(this.level, 8) - 1;
    this.n = [3, 4, 4, 5, 5, 5, 6, 6][L]; this.reverse = L === 5 || L === 7; const N = this.n * this.n, gap = this.n >= 6 ? 1.9 : 2.1;
    this.stage.fit(this.n * gap + 0.8, this.n * gap + 2.2);
    this.next = this.reverse ? N : 1; this.errors = 0; this.started = false; this.t0 = 0; this.elapsed = 0; this.done = false;
    const nums = shuffle(Array.from({ length: N }, (_, i) => i + 1)), pos = gridLayout(N, this.n, gap, gap, 0.4);
    this.tiles = nums.map((v, i) => { const m = tile(textTexture(String(v), '#ffffff', '#1f1b3a'), 0xffffff, gap * 0.86, gap * 0.86, 0.4); m.position.set(pos[i].x, pos[i].y, 0); m.userData.v = v; this.pickable(m, { tap: o => this.tap(o) }); this.group.add(m); return m; });
    UI.say(this.reverse ? `Tap ${N} down to 1 as fast as you can — keep your eyes on the centre!` : `Tap 1 to ${N} in order as fast as you can — keep your eyes on the centre!`);
    UI.score('⏱ 0.0s');
  }
  tap(m) {
    if (this.done) return;
    if (!this.started) { this.started = true; this.t0 = performance.now(); UI.say(''); }
    if (m.userData.v === this.next) {
      Audio.tap(); this.unpick(m); m.material[0].color.set(0x6bd968).convertSRGBToLinear(); this.tw(m.position, { z: -0.35 }, 120);
      this.next += this.reverse ? -1 : 1;
      if (this.reverse ? this.next < 1 : this.next > this.n * this.n) { this.done = true; this.elapsed = (performance.now() - this.t0) / 1000 + this.errors; const per = this.elapsed / (this.n * this.n); this.finish(per < 0.9 ? 3 : per < 1.5 ? 2 : 1, `${this.elapsed.toFixed(1)}s for ${this.n}×${this.n}${this.errors ? ` (incl. +${this.errors}s penalties)` : ''}`); }
    } else { this.errors++; Audio.oops(); flashTile(m, 0xff5e7a, 200); UI.say(`Next is ${this.next} (+1s)`, 700); }
  }
  update(dt, t) { super.update(dt, t); if (this.started && !this.done) UI.score(`⏱ ${((performance.now() - this.t0) / 1000).toFixed(1)}s`); }
}

/* ================= Registry & App ================= */
const BANDS = [
  { id: 'baby', label: 'Babies', age: '0–2', emoji: '👶', color: 0xff6f9c },
  { id: 'toddler', label: 'Toddlers', age: '2–4', emoji: '🧒', color: 0xff9f43 },
  { id: 'kid', label: 'Kids', age: '4–7', emoji: '🦸', color: 0x2fb5f0 },
  { id: 'big', label: 'Big Kids', age: '7–12', emoji: '🧠', color: 0x7c5cff },
  { id: 'adult', label: 'Adults', age: '13+', emoji: '🧑', color: 0x1f6f8b },
];
const GAMES = [
  { id: 'bubbles', title: 'Bubble Pop', emoji: '🫧', band: 'baby', skill: 'Cause & effect · visual tracking', cls: BubblePop, levels: 8 },
  { id: 'peekaboo', title: 'Peekaboo Pip', emoji: '🙈', band: 'baby', skill: 'Object permanence · attention', cls: Peekaboo, levels: 8, hideMascot: true },
  { id: 'sorter', title: 'Shape Sorter', emoji: '🔷', band: 'toddler', skill: 'Shapes · matching · fine motor', cls: ShapeSorter, levels: 8 },
  { id: 'pairs', title: 'Match Pairs', emoji: '🐶', band: 'toddler', skill: 'Visual memory', cls: MatchPairs, levels: 8 },
  { id: 'simon', title: 'Follow the Lights', emoji: '🎵', band: 'kid', skill: 'Sequence memory', cls: Simon, levels: 8 },
  { id: 'missing', title: "What's Missing?", emoji: '🔍', band: 'kid', skill: 'Attention · recall', cls: WhatsMissing, levels: 8 },
  { id: 'grid', title: 'Memory Grid', emoji: '🟨', band: 'big', skill: 'Spatial working memory', cls: MemoryGrid, levels: 8 },
  { id: 'digits', title: 'Number Recall', emoji: '🔢', band: 'big', skill: 'Digit span · working memory', cls: NumberRecall, levels: 8 },
  { id: 'animals', title: 'Find the Animal', emoji: '🐮', band: 'baby', skill: 'Listening · first words', cls: FindAnimal, levels: 8 },
  { id: 'howmany', title: 'How Many?', emoji: '🔢', band: 'toddler', skill: 'Counting · numbers', cls: HowMany, levels: 8 },
  { id: 'odd', title: 'Odd One Out', emoji: '🔍', band: 'kid', skill: 'Visual discrimination · attention', cls: OddOneOut, levels: 8 },
  { id: 'fruit', title: 'Catch the Fruit', emoji: '🍎', band: 'kid', skill: 'Impulse control · reaction speed', cls: CatchFruit, levels: 8 },
  { id: 'math', title: 'Math Pop', emoji: '➕', band: 'big', skill: 'Mental arithmetic', cls: MathPop, levels: 8 },
  { id: 'spin', title: 'Spin Match', emoji: '🔄', band: 'big', skill: 'Mental rotation · spatial reasoning', cls: SpinMatch, levels: 8 },
  { id: 'nback', title: 'N-Back', emoji: '🧩', band: 'adult', skill: 'Working memory (single & dual)', cls: NBack, levels: 8, hideMascot: true },
  { id: 'stroop', title: 'Stroop', emoji: '🎨', band: 'adult', skill: 'Inhibition · processing speed', cls: Stroop, levels: 8, hideMascot: true },
  { id: 'chain', title: 'Mental Chain', emoji: '🔗', band: 'adult', skill: 'Working memory · arithmetic', cls: MentalChain, levels: 8, hideMascot: true },
  { id: 'schulte', title: 'Schulte Table', emoji: '🔢', band: 'adult', skill: 'Attention · peripheral vision', cls: Schulte, levels: 8, hideMascot: true },
];

const App = {
  init() {
    Store.load(); UI.init();
    this.stage = new Stage($('#stage'));
    this.band = Store.data.band || 'toddler'; this.current = null; this.stage.placeMascot();
    Audio.on = Store.data.sound !== false; this.updateSoundBtn();
    Audio.onEvent = ev => { const m = this.stage.mascot; if (ev === 'cheer' || ev === 'good') m.play('jump'); else if (ev === 'oops') m.play('sad'); else if (ev === 'wow') m.play('wow'); };
    setInterval(() => { const m = this.stage.mascot; if (m.group.visible && !m.anim && Math.random() < 0.5) m.play('wave'); }, 4000);
    this.renderHome();
    $('#btn-sound').onclick = () => { Audio.init(); Audio.on = !Audio.on; Store.data.sound = Audio.on; Store.save(); this.updateSoundBtn(); if (Audio.on) Audio.ding(); };
    $('#btn-back').onclick = () => this.goHome();
    $('#modal-home').onclick = () => this.goHome();
    $('#modal-again').onclick = () => this.startGame(this.current.meta, this.current.level);
    $('#modal-next').onclick = () => this.startGame(this.current.meta, Math.min(this.current.level + 1, this.current.meta.levels));
    this.setupInstall();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => { });
      /* a new version took over: reload now if on the menu, otherwise when the player returns to it */
      const had = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had) return; if (this.current) this.updateReady = true; else location.reload(); });
    }
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
    this.stage.mascotMode = 'game'; this.stage.mascot.group.visible = !meta.hideMascot; this.stage.placeMascot(); this.stage.mascot.play('wave');
    this.stage.setTheme(BANDS.find(b => b.id === meta.band).color);
    const game = new meta.cls(this.stage, meta, clamp(level, 1, meta.levels));
    this.current = game; this.stage.game = game;
    $('#hud-level').textContent = ''; document.title = `${meta.title} · BrainPlay`;
    try { game.start(); } catch (err) { console.error(err); }
    if (!$('#hud-level').textContent) UI.level(`Level ${game.level}`);
  },
  goHome() {
    if (this.current) { this.current.destroy(); this.current = null; this.stage.game = null; }
    this.stage.mascotMode = 'home'; this.stage.mascot.group.visible = true; this.stage.fit(12, 12, 0); this.stage.mascot.play('wave'); document.title = 'BrainPlay Kids';
    this.renderHome(); UI.showHome();
    if (this.updateReady) location.reload();
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
