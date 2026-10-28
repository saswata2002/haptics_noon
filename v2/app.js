// Haptics Lab · iteration 2 — the same haptics as iteration 1, as plain lists.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const scaleOf = (el) => el.getBoundingClientRect().width / el.offsetWidth || 1;
const shake = (el) => { el.classList.remove('is-shake'); void el.offsetWidth; el.classList.add('is-shake'); };

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

// ─── the catalogue ─────────────────────────────────────────────────────────────────────────
const NOTIFY_TAIL = { success: 110, warning: 170, error: 180 };   // how long iOS plays each one
const durationOf = (steps) => Math.max(...steps.map(([t, k]) => t + (NOTIFY_TAIL[k] || 0)));
const one = (k, i = 1) => [[0, k, i]];
const seq = (n, gap, f) => Array.from({ length: n }, (_, j) => [j * gap, ...f(j, n)]);
const rnd = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

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

// ─── player ────────────────────────────────────────────────────────────────────────────────
let timers = [], playingEl = null;
function stop() {
  timers.forEach(clearTimeout); timers = [];
  if (playingEl) playingEl.classList.remove('is-on');
  playingEl = null;
}
function play(steps, el = null) {
  stop();
  if (el) { el.classList.add('is-on'); playingEl = el; }
  steps.forEach(([t, k, i = 1]) => {
    const go = () => { buzz(k, i); if (el) { el.classList.remove('is-kick'); void el.offsetWidth; el.classList.add('is-kick'); } };
    t === 0 ? go() : timers.push(setTimeout(go, t));            // the first pulse stays inside the tap
  });
  timers.push(setTimeout(() => { if (el) el.classList.remove('is-on'); }, durationOf(steps) + 220));
}

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

// ─── build ─────────────────────────────────────────────────────────────────────────────────
const cap = (k) => k[0].toUpperCase() + k.slice(1);
const row = (list, id, name, right) => {
  const b = document.createElement('button');
  b.className = 'row'; b.dataset.fx = id;
  b.innerHTML = `<span>${name}</span>${right}`;
  list.append(b);
};
const DOT = { light: 6, medium: 9, heavy: 12, soft: 8, rigid: 10 };
const HUE = { success: '#34c759', warning: '#ff9f0a', error: '#ff3b30' };
let level = 1;

IMPACT.forEach((k) => row($('#impact'), k, cap(k), `<i class="dot" style="--d:${DOT[k]}px" aria-hidden="true"></i>`));
NOTIFY.forEach((k) => row($('#notify'), k, cap(k), `<i class="dot" style="--c:${HUE[k]}" aria-hidden="true"></i>`));
row($('#select'), 'selection', 'Tick', '<i class="dot" style="--d:4px" aria-hidden="true"></i>');
tap($('#impact'), '.row', (el) => play(one(el.dataset.fx, level), el));
tap($('#notify'), '.row', (el) => play(one(el.dataset.fx), el));
tap($('#select'), '.row', (el) => play(one('selection'), el));

// intensity for the impact rows
$('#levels').innerHTML = [0.2, 0.4, 0.6, 0.8, 1].map((i) =>
  `<button class="lv${i === 1 ? ' is-on' : ''}" role="radio" aria-checked="${i === 1}" data-i="${i}">${Math.round(i * 100)}%</button>`).join('');
tap($('#levels'), '.lv', (el) => {
  level = +el.dataset.i;
  $$('.lv').forEach((x) => { x.classList.toggle('is-on', x === el); x.setAttribute('aria-checked', x === el); });
  buzz('light', level);
});

const PAT = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));
PATTERNS.forEach((p) => row($('#patterns'), p.id, p.name, `<small>${(durationOf(p.steps) / 1000).toFixed(1)} s</small>`));
tap($('#patterns'), '.row', (el) => play(PAT[el.dataset.fx].steps, el));

// tabs: one section at a time
{
  const sc = $('#scroll'), tabs = $('#tabs');
  const stuck = () => tabs.classList.toggle('is-stuck', (tabs.getBoundingClientRect().top - sc.getBoundingClientRect().top) / scaleOf(sc) <= parseFloat(getComputedStyle(sc).paddingTop) + 1);
  tap(tabs, '.tab', (t) => {
    if (t.classList.contains('is-on')) return;
    $$('.tab', tabs).forEach((x) => { x.classList.toggle('is-on', x === t); x.setAttribute('aria-selected', x === t); });
    $$('.sec').forEach((s) => s.classList.toggle('is-on', s.dataset.tab === t.dataset.to));
    buzz('selection');
    sc.scrollTop = Math.min(sc.scrollTop, Math.max(0, tabs.offsetTop - parseFloat(getComputedStyle(sc).paddingTop)));
    stuck();
  });
  sc.addEventListener('scroll', stuck, { passive: true }); stuck();
}

// switch: soft on, rigid off
tap($('#sw').parentElement, '.sw', (el) => {
  const on = el.getAttribute('aria-checked') !== 'true';
  el.setAttribute('aria-checked', on);
  play(one(on ? 'soft' : 'rigid'));
});

// stepper 0…5, warning at the limits
{
  const st = $('#stepper'), out = $('output', st); let q = 1;
  tap(st, 'button', (b) => {
    const n = q + +b.dataset.d;
    if (n < 0 || n > 5) { shake(out); play(one('warning')); return; }
    q = n; out.textContent = q;
    play(one('light', 0.5 + q * 0.1));
  });
}

// detent slider 0…10: a tick per step, rigid at the ends
{
  const s = $('#slider'), out = $('#sl-val'), N = 10;
  let step = 5, drag = null;
  const set = (v) => s.style.setProperty('--v', v);
  const at = (e) => { const r = s.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left - 10 * scaleOf(s)) / (r.width - 20 * scaleOf(s)))); };
  const move = (e) => {
    const v = at(e), n = Math.round(v * N);
    set(v);
    if (n !== step) { step = n; out.textContent = n; buzz(n === 0 || n === N ? 'rigid' : 'selection'); }
  };
  s.addEventListener('pointerdown', (e) => { drag = e.pointerId; s.setPointerCapture(e.pointerId); s.classList.remove('is-snap'); s.classList.add('is-drag'); move(e); });
  s.addEventListener('pointermove', (e) => { if (e.pointerId === drag) move(e); });
  const end = (e) => { if (e.pointerId !== drag) return; drag = null; s.classList.remove('is-drag'); s.classList.add('is-snap'); set(step / N); };
  s.addEventListener('pointerup', end); s.addEventListener('pointercancel', end);
}

// hold to confirm: pulses get faster and stronger, success when full, soft when let go early
{
  const h = $('#hold'), label = $('span', h), fill = $('.hold__fill', h), HOLD = 1400;
  let raf = 0, t0 = 0, next = 0, done = false;
  const setP = (p) => h.style.setProperty('--p', p.toFixed(3));
  const loop = (now) => {
    const e = now - t0, p = Math.min(1, e / HOLD);
    setP(p);
    if (e >= next) { buzz(p > 0.6 ? 'rigid' : 'light', 0.25 + 0.75 * p); next += Math.max(45, 190 - 145 * p); }
    if (p >= 1) { done = true; raf = 0; h.classList.add('is-done'); label.textContent = 'Confirmed'; buzz('success'); setTimeout(reset, 1400); return; }
    raf = requestAnimationFrame(loop);
  };
  const reset = () => { done = false; h.classList.remove('is-done'); label.textContent = 'Hold to confirm'; fill.style.transition = 'transform .4s cubic-bezier(.3, 1, .5, 1)'; setP(0); };
  h.addEventListener('pointerdown', (e) => {
    if (done) return;
    h.setPointerCapture(e.pointerId); stop();
    fill.style.transition = 'none';
    t0 = performance.now(); next = 0; raf = requestAnimationFrame(loop);
  });
  const letGo = () => {
    if (!raf || done) return;
    cancelAnimationFrame(raf); raf = 0;
    fill.style.transition = 'transform .4s cubic-bezier(.3, 1, .5, 1)'; setP(0);
    buzz('soft', 0.5);
  };
  h.addEventListener('pointerup', letGo); h.addEventListener('pointercancel', letGo);
  h.addEventListener('contextmenu', (e) => e.preventDefault());
}
