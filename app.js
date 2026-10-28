// Haptics Lab — every button plays a different iOS haptic.
//
// A haptic is a list of steps [ms, kind, intensity]. Kinds are iOS's own vocabulary:
// light · medium · heavy · soft · rigid (UIImpactFeedbackGenerator), selection
// (UISelectionFeedbackGenerator) and success · warning · error (UINotificationFeedbackGenerator).
// In Vercel Sim each step goes straight to the native bridge with its intensity, so the iPhone's
// Taptic Engine plays it; elsewhere phone.js's window.haptic falls back (vibrate / Safari tick).
// Steps are ≥ 40ms apart: the Sim folds two pulses within 35ms into one.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NS = 'http://www.w3.org/2000/svg';
// px moved on screen → CSS px (the desktop frame may be scaled to fit the window)
const scaleOf = (el) => el.getBoundingClientRect().width / el.offsetWidth || 1;
const shake = (el) => { el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake'); };
const toast = (() => {
  const t = document.getElementById('toast'); let h;
  return (msg) => { t.textContent = msg; t.classList.add('on'); clearTimeout(h); h = setTimeout(() => t.classList.remove('on'), 1400); };
})();

// ─── engine ────────────────────────────────────────────────────────────────────────────────
const bridge = () => window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.haptic;
const IMPACT = ['light', 'medium', 'heavy', 'soft', 'rigid'];
const NOTIFY = ['success', 'warning', 'error'];

function buzz(kind, i = 1) {
  const h = bridge();
  if (h) {
    try { h.postMessage(i < 1 && IMPACT.includes(kind) ? { type: kind, intensity: +i.toFixed(2) } : kind); } catch (_) {}
    return;
  }
  if (window.haptic) window.haptic(kind);
}

{
  const chip = $('#engine'), label = $('b', chip);
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (bridge()) { chip.classList.add('is-native'); label.textContent = 'Taptic Engine connected'; }
  else if (ios) label.textContent = 'Safari · system ticks only';
  else if (navigator.vibrate) label.textContent = 'Vibration only · approximate';
  else label.textContent = 'Preview only · open in Vercel Sim to feel it';
}

// ─── what each kind looks and codes like ───────────────────────────────────────────────────
const COLOR = Object.fromEntries([...IMPACT, 'selection', ...NOTIFY].map((k) => [k, `var(--c-${k})`]));
const WEIGHT = { selection: 0.32, light: 0.5, soft: 0.58, medium: 0.72, rigid: 0.8, heavy: 1 };
// the shape of the system notification haptics, for drawing only (iOS plays them as one call)
const NOTIFY_SHAPE = { success: [[0, 0.55], [110, 1]], warning: [[0, 1], [170, 0.6]], error: [[0, 0.8], [90, 0.8], [180, 1]] };
// Core Haptics transient [intensity, sharpness] that feels closest to each UIKit style
const CH = { selection: [0.45, 0.9], light: [0.55, 0.55], soft: [0.65, 0.1], medium: [0.8, 0.45], rigid: [0.85, 1], heavy: [1, 0.3] };

// expand steps to drawable bars: [ms, kind, height 0…1]
const barsOf = (steps) => steps.flatMap(([t, k, i = 1]) =>
  NOTIFY.includes(k) ? NOTIFY_SHAPE[k].map(([dt, h]) => [t + dt, k, h]) : [[t, k, WEIGHT[k] * i]]);

const durationOf = (steps) => Math.max(...barsOf(steps).map((b) => b[0]));

const swiftCall = (k, i = 1) =>
  k === 'selection' ? 'UISelectionFeedbackGenerator().selectionChanged()'
  : NOTIFY.includes(k) ? `UINotificationFeedbackGenerator().notificationOccurred(.${k})`
  : `UIImpactFeedbackGenerator(style: .${k}).impactOccurred(${i < 1 ? `intensity: ${i.toFixed(2)}` : ''})`;

function swiftFull(fx) {
  if (fx.steps.length === 1) {
    const [, k, i = 1] = fx.steps[0];
    const make = k === 'selection' ? 'UISelectionFeedbackGenerator()' : NOTIFY.includes(k) ? 'UINotificationFeedbackGenerator()' : `UIImpactFeedbackGenerator(style: .${k})`;
    const fire = k === 'selection' ? 'selectionChanged()' : NOTIFY.includes(k) ? `notificationOccurred(.${k})` : `impactOccurred(${i < 1 ? `intensity: ${i.toFixed(2)}` : ''})`;
    return `// Haptics Lab — ${fx.name}\nimport UIKit\n\nlet generator = ${make}\ngenerator.prepare()          // wake the Taptic Engine just before\ngenerator.${fire}\n`;
  }
  const ev = barsOf(fx.steps).map(([t, k, h]) => {
    const [ci, cs] = CH[k] || [h, 0.5];
    const inten = NOTIFY.includes(k) ? h : ci * (h / WEIGHT[k]);
    return `    .init(eventType: .hapticTransient, parameters: [\n        .init(parameterID: .hapticIntensity, value: ${Math.min(1, inten).toFixed(2)}),\n        .init(parameterID: .hapticSharpness, value: ${(NOTIFY.includes(k) ? 0.5 : cs).toFixed(2)})],\n        relativeTime: ${(t / 1000).toFixed(3)})`;
  });
  return `// Haptics Lab — ${fx.name}\nimport CoreHaptics\n\nlet events: [CHHapticEvent] = [\n${ev.join(',\n')}\n]\n\nlet engine = try CHHapticEngine()\ntry engine.start()\nlet player = try engine.makePlayer(with: CHHapticPattern(events: events, parameters: []))\ntry player.start(atTime: CHHapticTimeImmediate)\n`;
}

// ─── the haptic catalogue ──────────────────────────────────────────────────────────────────
const one = (k, i = 1) => [[0, k, i]];
const seq = (n, gap, f) => Array.from({ length: n }, (_, j) => [j * gap, ...f(j, n)]);
const rnd = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

const ICON = {   // impact keys draw on a 36 grid (filled), notification marks on a 24 grid (stroked)
  light: '<circle cx="18" cy="18" r="5"/>',
  medium: '<circle cx="18" cy="18" r="8.5"/>',
  heavy: '<circle cx="18" cy="18" r="12.5"/>',
  soft: '<circle cx="18" cy="18" r="13" opacity=".14"/><circle cx="18" cy="18" r="9" opacity=".3"/><circle cx="18" cy="18" r="5"/>',
  rigid: '<path d="M18 6.5 29.5 18 18 29.5 6.5 18Z"/>',
  selection: '<rect x="7" y="12" width="3" height="12" rx="1.5"/><rect x="13.5" y="8" width="3" height="20" rx="1.5"/><rect x="20" y="8" width="3" height="20" rx="1.5"/><rect x="26.5" y="12" width="3" height="12" rx="1.5"/>',
  success: '<path d="m6.5 12.5 3.8 3.8 7.2-8"/>',
  warning: '<path d="M12 6.5v7M12 17.5v.01"/>',
  error: '<path d="m7.5 7.5 9 9M16.5 7.5l-9 9"/>',
};

const BASIC = [
  { id: 'light', name: 'Light', sub: '.light', steps: one('light') },
  { id: 'medium', name: 'Medium', sub: '.medium', steps: one('medium') },
  { id: 'heavy', name: 'Heavy', sub: '.heavy', steps: one('heavy') },
  { id: 'soft', name: 'Soft', sub: '.soft', steps: one('soft') },
  { id: 'rigid', name: 'Rigid', sub: '.rigid', steps: one('rigid') },
  { id: 'selection', name: 'Selection', sub: '.changed()', steps: one('selection') },
];
const NOTIFS = NOTIFY.map((k) => ({ id: k, name: k[0].toUpperCase() + k.slice(1), sub: `.${k}`, steps: one(k) }));

const PATTERNS = (() => {
  const r1 = rnd(7), r2 = rnd(42);
  let t = 0;
  const rain = []; for (t = 0; t < 1600; t += 50 + Math.round(r1() * 130)) rain.push([t, r1() > 0.5 ? 'soft' : 'light', 0.15 + r1() * 0.45]);
  const type = []; for (t = 0; type.length < 10; t += 70 + Math.round(r2() * 80)) type.push([t, 'light', 0.5 + r2() * 0.4]);
  type.push([t + 160, 'success']);
  const rumble = seq(12, 50, (j) => ['soft', 0.1 + j * 0.035]);
  return [
    { id: 'double', name: 'Double tap', steps: [[0, 'rigid'], [120, 'rigid']] },
    { id: 'triple', name: 'Triple tap', steps: seq(3, 110, () => ['light']) },
    { id: 'heart', name: 'Heartbeat', steps: [[0, 'heavy'], [150, 'medium', 0.55], [800, 'heavy'], [950, 'medium', 0.55]] },
    { id: 'rampup', name: 'Ramp up', steps: seq(8, 70, (j, n) => ['rigid', 0.15 + (0.85 * j) / (n - 1)]) },
    { id: 'rampdown', name: 'Ramp down', steps: seq(8, 70, (j, n) => ['heavy', 1 - (0.85 * j) / (n - 1)]) },
    { id: 'ratchet', name: 'Ratchet', steps: seq(10, 60, () => ['selection']) },
    { id: 'drum', name: 'Drumroll', steps: [...seq(16, 45, (j, n) => ['light', 0.3 + (0.7 * j) / (n - 1)]), [16 * 45 + 60, 'heavy']] },
    { id: 'ball', name: 'Bouncing ball', steps: [0, 420, 720, 930, 1080, 1185, 1255].map((ms, j) => [ms, 'heavy', [1, 0.75, 0.55, 0.4, 0.28, 0.2, 0.14][j]]) },
    { id: 'coin', name: 'Coin drop', steps: [0, 260, 440, 560, 650, 715, 765, 805].map((ms, j) => [ms, 'rigid', [1, 0.7, 0.55, 0.45, 0.35, 0.28, 0.22, 0.18][j]]) },
    { id: 'knock', name: 'Shave & a haircut', steps: [0, 300, 450, 600, 900].map((ms) => [ms, 'medium', 0.85]).concat([[1500, 'heavy'], [1800, 'heavy']]) },
    { id: 'boom', name: 'Explosion', steps: [[0, 'heavy'], [50, 'heavy', 0.9], [100, 'medium', 0.8], [160, 'medium', 0.6], [230, 'soft', 0.5], [320, 'soft', 0.35], [430, 'soft', 0.22], [560, 'soft', 0.12]] },
    { id: 'purr', name: 'Purr', steps: seq(18, 55, (j) => ['soft', j % 2 ? 0.25 : 0.45]) },
    { id: 'sos', name: 'SOS', steps: [0, 160, 320].map((ms) => [ms, 'light']).concat([620, 900, 1180].flatMap((ms) => [[ms, 'heavy'], [ms + 60, 'medium', 0.7]]), [1480, 1640, 1800].map((ms) => [ms, 'light'])) },
    { id: 'count', name: 'Countdown 3·2·1', steps: [[0, 'medium', 0.8], [700, 'medium', 0.8], [1400, 'medium', 0.8], [2100, 'success']] },
    { id: 'zip', name: 'Zipper', steps: seq(22, 40, () => ['selection']) },
    { id: 'rain', name: 'Rain', steps: rain },
    { id: 'gallop', name: 'Gallop', steps: [0, 520, 1040].flatMap((s) => [[s, 'light', 0.6], [s + 90, 'medium', 0.8], [s + 180, 'heavy']]) },
    { id: 'thunder', name: 'Thunder', steps: [...rumble, [650, 'heavy'], [710, 'heavy', 0.6], [790, 'soft', 0.4], [870, 'soft', 0.25], [950, 'soft', 0.15]] },
    { id: 'safe', name: 'Safe cracker', steps: [...seq(6, 90, () => ['selection']), [610, 'rigid'], [850, 'success']] },
    { id: 'type', name: 'Typewriter', steps: type },
    { id: 'boing', name: 'Spring boing', steps: seq(7, 70, (j) => [j % 2 ? 'soft' : 'rigid', [1, 0.7, 0.6, 0.45, 0.35, 0.25, 0.15][j]]) },
    { id: 'level', name: 'Level up', steps: [[0, 'light', 0.5], [90, 'medium', 0.7], [180, 'heavy'], [320, 'success']] },
    { id: 'sonar', name: 'Sonar ping', steps: [0, 700, 1400].flatMap((s) => [[s, 'soft'], [s + 180, 'soft', 0.3]]) },
    { id: 'burst', name: 'Burst fire', steps: seq(10, 60, () => ['rigid']) },
  ].map((p) => ({ ...p, sub: `${p.steps.length} pulses · ${(durationOf(p.steps) / 1000).toFixed(2)} s` }));
})();

// ─── waveforms ─────────────────────────────────────────────────────────────────────────────
function drawWave(svg, steps, W, H = 28) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.textContent = '';
  const bars = barsOf(steps), T = Math.max(durationOf(steps), 240);
  const bw = Math.max(1.8, Math.min(5, W / (bars.length * 2.4)));
  bars.forEach(([t, k, h]) => {
    const w = k === 'soft' ? bw * 1.5 : k === 'rigid' || k === 'selection' ? bw * 0.75 : bw;
    const bh = 3 + Math.min(1, h) * (H - 3);
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', (bw / 2 + (t / T) * (W - bw * 2)).toFixed(2));
    r.setAttribute('y', ((H - bh) / 2).toFixed(2));
    r.setAttribute('width', w.toFixed(2)); r.setAttribute('height', bh.toFixed(2));
    r.setAttribute('rx', Math.min(w / 2, 2).toFixed(2));
    r.dataset.t = t;
    svg.append(r);
  });
}

// ─── player ────────────────────────────────────────────────────────────────────────────────
let timers = [], playingEl = null;

function kick(el, k) {
  if (!el) return;
  el.style.setProperty('--k', k.toFixed(2));
  el.classList.remove('is-kick'); void el.offsetWidth; el.classList.add('is-kick');
}

function light(svg) {
  $$('rect', svg).forEach((r) => {
    const t = +r.dataset.t;
    timers.push(setTimeout(() => r.classList.add('on'), t), setTimeout(() => r.classList.remove('on'), t + 140));
  });
}

function stop() {
  timers.forEach(clearTimeout); timers = [];
  $$('rect.on').forEach((r) => r.classList.remove('on'));
  if (playingEl) playingEl.classList.remove('is-playing');
  playingEl = null;
}

function play(fx, el = null) {
  stop();
  const wave = el && $('.wave', el);
  if (wave) light(wave);
  if (el) { el.classList.add('is-playing'); playingEl = el; }
  fx.steps.forEach(([t, k, i = 1]) => {
    const go = () => { buzz(k, i); kick(el, Math.min(1, (WEIGHT[k] || 0.9) * i)); };
    t === 0 ? go() : timers.push(setTimeout(go, t));            // the first pulse stays inside the tap
  });
  timers.push(setTimeout(() => { if (el) el.classList.remove('is-playing'); }, durationOf(fx.steps) + 260));
}

const fxOf = (k, i = 1, name) => ({ name: name || `${k[0].toUpperCase() + k.slice(1)}${i < 1 ? ` · ${Math.round(i * 100)}%` : ''}`, steps: one(k, i) });

// a tap fires on the finger's lift (≤ 10px drift), like phone.js does for data-haptic, so the
// haptic lands with the touch instead of with the later click. Mouse and keyboard → click.
function tap(root, selector, fn) {
  let down = null, felt = null;
  root.addEventListener('pointerdown', (e) => { down = e.pointerType === 'mouse' || !e.isPrimary ? null : { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() }; });
  root.addEventListener('pointercancel', () => { down = null; });
  root.addEventListener('pointerup', (e) => {
    const p = down; down = null;
    if (!p || e.pointerId !== p.id || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 || performance.now() - p.t > 700) return;
    const el = e.target.closest(selector); if (!el || !root.contains(el)) return;
    felt = { el, t: performance.now() }; fn(el, e);
  });
  root.addEventListener('click', (e) => {
    const el = e.target.closest(selector); if (!el || !root.contains(el)) return;
    if (felt && felt.el === el && performance.now() - felt.t < 900) { felt = null; return; }
    fn(el, e);
  });
}

// ─── build the controls ────────────────────────────────────────────────────────────────────
const CAT = {};
const cap = (k) => k[0].toUpperCase() + k.slice(1);

// basics: the nine system haptics as 3 × 3 keys
[...BASIC, ...NOTIFS].forEach((fx) => {
  const n = NOTIFY.includes(fx.id);
  const b = document.createElement('button');
  b.className = 'key'; b.dataset.fx = fx.id;
  b.innerHTML = `<span class="key__g${n ? ' key__g--n' : ''}" style="--c:${COLOR[fx.id]}" aria-hidden="true"><svg viewBox="0 0 ${n ? 24 : 36} ${n ? 24 : 36}">${ICON[fx.id]}</svg></span><b>${fx.name}</b>`;
  CAT[fx.id] = fx;
  $('#g-basic').append(b);
});
tap($('#g-basic'), '.key', (el) => play(CAT[el.dataset.fx], el));

// patterns: one list, name on the left, a small waveform and the length on the right
PATTERNS.forEach((fx) => {
  const b = document.createElement('button');
  b.className = 'pat'; b.dataset.fx = fx.id;
  b.innerHTML = `<b>${fx.name}</b><svg class="wave" aria-hidden="true"></svg><small>${(durationOf(fx.steps) / 1000).toFixed(1)} s</small>`;
  drawWave($('.wave', b), fx.steps, 72, 18);
  CAT[fx.id] = fx;
  $('#g-patterns').append(b);
});
tap($('#g-patterns'), '.pat', (el) => play(CAT[el.dataset.fx], el));

// segmented controls: the pill follows the chosen segment
function segmented(seg, onPick) {
  const bs = $$('.seg__b', seg);
  bs.forEach((b, j) => b.addEventListener('click', () => {
    bs.forEach((x) => x.classList.toggle('is-on', x === b));
    seg.style.setProperty('--seg', j);
    onPick(b, j);
  }));
}

// strength: one style at five levels
{
  const LEVELS = [0.2, 0.4, 0.6, 0.8, 1];
  let style = 'light';
  $('#levels').innerHTML = LEVELS.map((i, j) =>
    `<button class="lv" data-i="${i}" aria-label="${Math.round(i * 100)}%"><span class="lv__bars" aria-hidden="true">${LEVELS.map((_, m) => `<i class="${m <= j ? 'on' : ''}" style="height:${6 + m * 4}px"></i>`).join('')}</span><span>${Math.round(i * 100)}%</span></button>`).join('');
  tap($('#levels'), '.lv', (el) => play(fxOf(style, +el.dataset.i), el));
  segmented($('#style-seg'), (b) => { style = b.dataset.k; play(fxOf('selection', 1, `Style · ${cap(style)}`)); });
}

// tabs: one section group at a time; the pill slides to the chosen tab
{
  const sc = $('#scroll'), chips = $('#chips'), cs = $$('.chip', chips);
  const stuck = () => chips.classList.toggle('is-stuck', (chips.getBoundingClientRect().top - sc.getBoundingClientRect().top) / scaleOf(sc) <= parseFloat(getComputedStyle(sc).paddingTop) + 1);
  tap(chips, '.chip', (c) => {
    if (c.classList.contains('is-on')) return;
    cs.forEach((x, n) => { x.classList.toggle('is-on', x === c); x.setAttribute('aria-selected', x === c); if (x === c) chips.style.setProperty('--seg', n); });
    $$('.sec').forEach((s) => s.classList.toggle('is-on', s.dataset.tab === c.dataset.to));
    buzz('selection');
    // keep the tabs where they are if they're stuck, otherwise start the new tab from the top
    const top = chips.offsetTop - parseFloat(getComputedStyle(sc).paddingTop);
    sc.scrollTop = Math.min(sc.scrollTop, Math.max(0, top));
    stuck();
  });
  sc.addEventListener('scroll', stuck, { passive: true }); stuck();
}

// segmented control row: the kit plays data-haptic="selection" on the lift; this only moves the pill
segmented($('#seg'), () => {});

// toggles
tap(document.querySelector('.device'), '.tg', (el) => {
  const on = el.getAttribute('aria-checked') !== 'true';
  el.setAttribute('aria-checked', on);
  const k = on ? el.dataset.on : el.dataset.off;
  play(fxOf(k, 1, `Toggle ${on ? 'on' : 'off'} · ${k}`));
});
// native switch: Safari (and the Sim) play the system tick themselves
{
  const sw = $('.native-sw');
  if (!('switch' in HTMLInputElement.prototype)) Object.assign(sw.style, { width: '22px', height: '22px' });
}

// detent slider: 0…10
{
  const s = $('#slider'), out = $('#sl-val'), N = 10;
  $('.slider__ticks', s).innerHTML = '<i></i>'.repeat(N + 1);
  let step = 5, drag = null;
  const set = (v) => s.style.setProperty('--v', v);
  const at = (e) => { const r = s.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left - 14 * scaleOf(s)) / (r.width - 28 * scaleOf(s)))); };
  const move = (e) => {
    const v = at(e), n = Math.round(v * N);
    set(v);
    if (n !== step) {
      step = n; out.textContent = n;
      const edge = n === 0 || n === N;
      play(fxOf(edge ? 'rigid' : 'selection', 1, `Slider · ${n}${edge ? ' (end stop)' : ''}`));
    }
  };
  s.addEventListener('pointerdown', (e) => { drag = e.pointerId; s.setPointerCapture(e.pointerId); s.classList.remove('is-snap'); s.classList.add('is-drag'); move(e); });
  s.addEventListener('pointermove', (e) => { if (e.pointerId === drag) move(e); });
  const end = (e) => { if (e.pointerId !== drag) return; drag = null; s.classList.remove('is-drag'); s.classList.add('is-snap'); set(step / N); };
  s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end);
}

// stepper 0…5
{
  const st = $('#stepper'), out = $('output', st); let q = 1;
  tap(st, 'button', (b) => {
    const n = q + +b.dataset.d;
    if (n < 0 || n > 5) { shake(out); play(fxOf('warning', 1, `Quantity limit · ${q}`)); return; }
    q = n; out.textContent = q;
    play(fxOf('light', 0.5 + q * 0.1, `Quantity · ${q}`));
  });
}

// stars: stronger per star, success at 5
{
  const bs = $$('#stars button');
  bs.forEach((b) => { b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.2 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.8l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7Z"/></svg>'; });
  tap($('#stars'), 'button', (b) => {
    const n = bs.indexOf(b) + 1;
    bs.forEach((x, j) => {
      x.classList.toggle('on', j < n);
      x.classList.remove('pop');
      if (j < n) setTimeout(() => { x.classList.add('pop'); setTimeout(() => x.classList.remove('pop'), 180); }, j * 40);
    });
    const i = 0.3 + n * 0.14;
    play(n === 5 ? { name: 'Rating · 5 stars', steps: [[0, 'medium', 1], [140, 'success']] } : fxOf('light', Math.min(1, i), `Rating · ${n} star${n > 1 ? 's' : ''}`));
  });
}

// action row
{
  let armed = null;
  const pop = (el) => { el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 200); };
  tap($('#actions'), '.act', (el) => {
    const a = el.dataset.act;
    if (a === 'like' || a === 'save') {
      const on = el.getAttribute('aria-pressed') !== 'true';
      el.setAttribute('aria-pressed', on); if (on) pop(el);
      if (a === 'like') play(on ? { name: 'Like', steps: [[0, 'medium'], [110, 'soft', 0.6]] } : fxOf('soft', 0.4, 'Unlike'), el);
      else play(on ? fxOf('rigid', 0.8, 'Save') : fxOf('light', 0.4, 'Unsave'), el);
    } else if (a === 'cart') {
      pop(el); toast('Added to bag');
      play({ name: 'Add to bag', steps: [[0, 'rigid'], [140, 'success']] }, el);
    } else if (a === 'copy') {
      toast('Copied'); play(fxOf('light', 0.7, 'Copy'), el);
    } else if (a === 'del') {
      clearTimeout(armed);
      if (!el.classList.contains('is-armed')) {
        el.classList.add('is-armed'); toast('Tap again to delete');
        play(fxOf('warning', 1, 'Delete · confirm?'), el);
        armed = setTimeout(() => el.classList.remove('is-armed'), 2500);
      } else {
        el.classList.remove('is-armed'); toast('Deleted'); shake(el);
        play(fxOf('error', 1, 'Delete'), el);
      }
    }
  });
}

// hold to confirm: pulses get faster and stronger, success when full, soft when let go early
{
  const h = $('#hold'), label = $('span', h), HOLD = 1400;
  let raf = 0, t0 = 0, next = 0, done = false;
  const setP = (p) => h.style.setProperty('--p', p.toFixed(3));
  const loop = (now) => {
    const e = now - t0, p = Math.min(1, e / HOLD);
    setP(p);
    if (e >= next) { buzz(p > 0.6 ? 'rigid' : 'light', 0.25 + 0.75 * p); kick(h, 0.3 + p * 0.5); next += Math.max(45, 190 - 145 * p); }
    if (p >= 1) { done = true; h.classList.add('is-done'); label.textContent = 'Confirmed'; play({ name: 'Hold · confirmed', steps: [[0, 'success']] }); setTimeout(reset, 1400); return; }
    raf = requestAnimationFrame(loop);
  };
  const reset = () => { done = false; h.classList.remove('is-done'); label.textContent = 'Hold to confirm'; h.style.transition = ''; setP(0); };
  h.addEventListener('pointerdown', (e) => {
    if (done) return;
    h.setPointerCapture(e.pointerId); stop();
    $('.hold__fill', h).style.transition = 'none';
    t0 = performance.now(); next = 0; raf = requestAnimationFrame(loop);
  });
  const let_go = () => {
    if (!raf || done) { raf = 0; return; }
    cancelAnimationFrame(raf); raf = 0;
    const fill = $('.hold__fill', h);
    fill.style.transition = 'transform .4s cubic-bezier(.3, 1, .5, 1)'; setP(0);
    play(fxOf('soft', 0.5, 'Hold · let go early'));
  };
  h.addEventListener('pointerup', let_go); h.addEventListener('pointercancel', let_go);
  h.addEventListener('contextmenu', (e) => e.preventDefault());
}

// slide to unlock
{
  const u = $('#unlock'), knob = $('.unlock__knob', u), txt = $('.unlock__txt', u);
  let drag = null, x0 = 0, x = 0, dec = 0, done = false;
  const max = () => u.offsetWidth - 52;
  const setX = (v) => { x = v; u.style.setProperty('--x', `${v}px`); };
  const back = (fx) => { u.classList.add('is-back'); setX(0); dec = 0; if (fx) play(fx); };
  const finish = () => {
    done = true; drag = null; setX(max()); u.classList.add('is-done'); txt.textContent = 'unlocked';
    play({ name: 'Unlocked', steps: [[0, 'rigid'], [90, 'success']] });
    setTimeout(() => { u.classList.remove('is-done'); txt.textContent = 'slide to unlock'; back(fxOf('soft', 0.4, 'Relock')); done = false; }, 1500);
  };
  knob.style.touchAction = 'none';
  u.addEventListener('pointerdown', (e) => {
    if (done || !knob.contains(e.target)) return;
    drag = e.pointerId; u.setPointerCapture(e.pointerId); u.classList.remove('is-back');
    x0 = e.clientX / scaleOf(u) - x;
    play(fxOf('light', 0.6, 'Unlock · grab'));
  });
  u.addEventListener('pointermove', (e) => {
    if (e.pointerId !== drag) return;
    const v = Math.max(0, Math.min(max(), e.clientX / scaleOf(u) - x0));
    setX(v);
    const d = Math.floor((v / max()) * 10);
    if (d !== dec) { dec = d; if (d < 10) play(fxOf('selection', 1, `Unlock · ${d * 10}%`)); }
    if (v >= max()) finish();
  });
  const end = (e) => { if (e.pointerId !== drag) return; drag = null; x >= max() * 0.94 ? finish() : back(fxOf('soft', 0.35, 'Unlock · released')); };
  u.addEventListener('pointerup', end); u.addEventListener('pointercancel', end);
}

// passcode: light per digit, success on 2580, error otherwise
{
  const pad = $('#pin-pad'), dots = $$('#pin-dots i'), wrap = $('#pin-dots');
  const L = ['', 'ABC', 'DEF', 'GHI', 'JKL', 'MNO', 'PQRS', 'TUV', 'WXYZ'];
  pad.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="pkey" data-n="${n}"><b>${n}</b><small>${L[n - 1]}</small></button>`).join('')
    + '<span></span><button class="pkey" data-n="0"><b>0</b><small></small></button>'
    + '<button class="pkey pkey--ghost" data-n="del" aria-label="Delete"><svg viewBox="0 0 24 24"><path d="M9 5h10.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7Z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/></svg></button>';
  let code = '', busy = false;
  const paint = () => dots.forEach((d, j) => d.classList.toggle('on', j < code.length));
  tap(pad, '.pkey', (k) => {
    if (busy) return;
    const n = k.dataset.n;
    if (n === 'del') {
      if (!code) { play(fxOf('selection', 1, 'Passcode · nothing to delete')); return; }
      code = code.slice(0, -1); paint(); play(fxOf('rigid', 0.5, 'Passcode · delete'), k); return;
    }
    code += n; paint();
    if (code.length < 4) { play(fxOf('light', 0.8, `Passcode · ${'•'.repeat(code.length)}`), k); return; }
    busy = true;
    if (code === '2580') {
      wrap.classList.add('ok'); play({ name: 'Passcode · correct', steps: [[0, 'success']] });
      setTimeout(() => { wrap.classList.remove('ok'); code = ''; paint(); busy = false; }, 1000);
    } else {
      wrap.classList.add('bad'); shake(wrap); play({ name: 'Passcode · wrong', steps: [[0, 'error']] });
      setTimeout(() => { wrap.classList.remove('bad'); code = ''; paint(); busy = false; }, 600);
    }
  });
}

// for checks: window.__haptics.catalogue / swift(id)
window.__haptics = { BASIC, NOTIFS, PATTERNS, swift: (id) => swiftFull(CAT[id]), barsOf };
