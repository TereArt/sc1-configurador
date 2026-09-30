import { buildJersey, CUTS } from './geometry.js';
import { Viewer } from './renderer.js';
import { TEMPLATES, drawTemplate } from './templates.js';
import { FONTS, composeTexture, trimColors } from './compose.js';
import { PRICE_MXN, PALETTE, SIZES, TRIMS } from './config.js';

const $ = (s) => document.querySelector(s);
const el = (tag, attrs = {}, html = '') => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v);
  }
  if (html) e.innerHTML = html;
  return e;
};

const first = TEMPLATES[0];
const st = {
  step: 0,
  cut: 'hombre',
  template: first.id,
  colors: { a: first.colors[0], b: first.colors[1], c: first.colors[2] },
  zone: 'a',
  collar: 'c',
  name: 'SHADY',
  number: '23',
  font: 'orbitron',
  textColor: '#f4f5f8',
  outline: true,
  sleeveTag: 'MX',
  size: null,
  qty: 1,
  family: 'Todas',
};
let logoImg = null;
let logoName = '';

// ---------- 3D ----------
const texCanvas = document.createElement('canvas');
let viewer = null;
try {
  viewer = new Viewer($('#gl'));
  viewer.setJersey(buildJersey(st.cut));
  viewer.onInteract = () => setSpin(false);
} catch (err) {
  $('#stage').insertAdjacentHTML('beforeend', '<p class="note" style="position:absolute;inset:auto 20px 60px;">Tu navegador no pudo iniciar la vista 3D (WebGL2). Puedes seguir diseñando y ver el archivo de impresión.</p>');
}

let pending = false;
function refresh() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    composeTexture(texCanvas, st, logoImg);
    if (viewer) {
      viewer.setTexture(texCanvas);
      viewer.setTrim(trimColors(st));
    }
    updateSummary();
  });
}

// Recomponer cuando carguen las fuentes web
function loadFont(id) {
  const f = FONTS.find((x) => x.id === id);
  if (!f || !document.fonts) return;
  const fam = f.css.split(',')[0];
  document.fonts.load(`${f.weight} 80px ${fam}`).then(refresh).catch(() => {});
}
if (document.fonts) {
  document.fonts.load("700 70px 'Chakra Petch'").then(refresh).catch(() => {});
  document.fonts.ready.then(refresh);
}

// ---------- pasos ----------
const stepBtns = [...document.querySelectorAll('.step')];
const panes = [...document.querySelectorAll('.pane')];
function goStep(i) {
  st.step = i;
  stepBtns.forEach((b, k) => {
    b.classList.toggle('is-on', k === i);
    b.setAttribute('aria-selected', k === i ? 'true' : 'false');
    b.classList.toggle('done', k < i);
  });
  panes.forEach((p, k) => p.classList.toggle('is-on', k === i));
  $('#btnNext').textContent = i === 4 ? 'Agregar al carrito' : 'Siguiente';
  if (viewer) viewer.showView(i === 3 ? 'espalda' : 'frente');
  setView(i === 3 ? 'espalda' : 'frente');
  $('.pane-wrap').scrollTop = 0;
}
stepBtns.forEach((b, k) => b.addEventListener('click', () => goStep(k)));

// ---------- vista ----------
function setView(v) {
  $('#vFront').classList.toggle('is-on', v === 'frente');
  $('#vBack').classList.toggle('is-on', v === 'espalda');
}
function setSpin(on) {
  if (viewer) viewer.autoRotate = on;
  $('#vSpin').classList.toggle('is-on', on);
  $('#vSpin').setAttribute('aria-pressed', on ? 'true' : 'false');
  if (on) setView('');
}
$('#vFront').addEventListener('click', () => { setSpin(false); viewer && viewer.showView('frente'); setView('frente'); });
$('#vBack').addEventListener('click', () => { setSpin(false); viewer && viewer.showView('espalda'); setView('espalda'); });
$('#vSpin').addEventListener('click', () => setSpin(!(viewer && viewer.autoRotate)));

// ---------- 1. corte ----------
document.querySelectorAll('.cut').forEach((b) =>
  b.addEventListener('click', () => {
    if (st.cut === b.dataset.cut) return;
    st.cut = b.dataset.cut;
    document.querySelectorAll('.cut').forEach((x) => x.classList.toggle('is-on', x === b));
    if (!SIZES[st.cut].some((s) => s[0] === st.size)) st.size = null;
    if (viewer) viewer.setJersey(buildJersey(st.cut));
    renderSizes();
    refresh();
  })
);

// ---------- 2. diseño ----------
const families = ['Todas', ...new Set(TEMPLATES.map((t) => t.family))];
function renderFilters() {
  const box = $('#filters');
  box.innerHTML = '';
  families.forEach((f) => {
    const b = el('button', { type: 'button', class: 'chip' + (st.family === f ? ' is-on' : '') }, f);
    b.addEventListener('click', () => {
      st.family = f;
      renderFilters();
      renderDesigns();
    });
    box.append(b);
  });
}

function shirtPath(ctx, s) {
  const p = new Path2D('M36 10 L14 22 L4 48 L22 56 L28 44 L28 94 L72 94 L72 44 L78 56 L96 48 L86 22 L64 10 C60 18 55 21 50 21 C45 21 40 18 36 10 Z');
  ctx.save();
  ctx.scale(s / 100, s / 100);
  return p;
}

function drawThumb(canvas, t, colors) {
  const S = 180;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, S, S);
  const path = shirtPath(ctx, S);
  ctx.clip(path);
  ctx.save();
  ctx.scale(100 / 1024, 100 / 1000);
  drawTemplate(ctx, t.id, 1024, 1000, colors, 'front', 11);
  ctx.restore();
  ctx.restore();
  ctx.save();
  ctx.scale(S / 100, S / 100);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke(path);
  ctx.restore();
}

function renderDesigns() {
  const box = $('#designs');
  box.innerHTML = '';
  TEMPLATES.filter((t) => st.family === 'Todas' || t.family === st.family).forEach((t) => {
    const b = el('button', { type: 'button', class: 'design' + (st.template === t.id ? ' is-on' : ''), 'aria-pressed': st.template === t.id ? 'true' : 'false' });
    const c = el('canvas', { 'aria-hidden': 'true' });
    const useColors = st.template === t.id ? st.colors : { a: t.colors[0], b: t.colors[1], c: t.colors[2] };
    drawThumb(c, t, useColors);
    b.append(c, el('span', {}, `${t.name}<small>${t.family}</small>`));
    b.addEventListener('click', () => {
      st.template = t.id;
      st.colors = { a: t.colors[0], b: t.colors[1], c: t.colors[2] };
      renderDesigns();
      renderZones();
      renderPalette();
      renderTrims();
      renderTextPalette();
      refresh();
    });
    box.append(b);
  });
}

// ---------- 3. colores ----------
const ZONES = [['a', 'Principal'], ['b', 'Secundario'], ['c', 'Acento']];
function renderZones() {
  const box = $('#zones');
  box.innerHTML = '';
  ZONES.forEach(([k, label]) => {
    const b = el('button', { type: 'button', class: 'zone' + (st.zone === k ? ' is-on' : '') });
    b.append(el('i', { style: `background:${st.colors[k]}` }), el('span', {}, label));
    b.addEventListener('click', () => {
      st.zone = k;
      renderZones();
      renderPalette();
    });
    box.append(b);
  });
}
function renderPalette() {
  const box = $('#palette');
  box.innerHTML = '';
  PALETTE.forEach(([name, hex]) => {
    const on = st.colors[st.zone].toLowerCase() === hex.toLowerCase();
    const b = el('button', { type: 'button', class: 'sw' + (on ? ' is-on' : ''), style: `background:${hex}`, title: name, 'aria-label': name, 'aria-pressed': on ? 'true' : 'false' });
    b.addEventListener('click', () => {
      st.colors[st.zone] = hex;
      renderZones();
      renderPalette();
      renderTrims();
      renderDesigns();
      refresh();
    });
    box.append(b);
  });
}
function renderTrims() {
  const box = $('#trims');
  box.innerHTML = '';
  const tc = trimColors(st);
  TRIMS.forEach(([k, label]) => {
    const color = k === 'c' ? st.colors.c : k === 'b' ? st.colors.b : k === 'blanco' ? '#f4f5f8' : '#0b0d12';
    const b = el('button', { type: 'button', class: st.collar === k ? 'is-on' : '' });
    b.append(el('i', { style: `background:${color}` }), document.createTextNode(label));
    b.addEventListener('click', () => {
      st.collar = k;
      renderTrims();
      refresh();
    });
    box.append(b);
  });
  return tc;
}
$('#resetColors').addEventListener('click', () => {
  const t = TEMPLATES.find((x) => x.id === st.template);
  st.colors = { a: t.colors[0], b: t.colors[1], c: t.colors[2] };
  renderZones();
  renderPalette();
  renderTrims();
  refresh();
});

// ---------- 4. personaliza ----------
const inName = $('#inName');
inName.addEventListener('input', () => {
  st.name = inName.value.toUpperCase().replace(/[^A-Z0-9ÑÁÉÍÓÚÜ _.\-]/g, '');
  if (inName.value !== st.name) inName.value = st.name;
  $('#nameCount').textContent = st.name.length;
  $('#watermark').textContent = st.name || 'SC1';
  refresh();
});
inName.addEventListener('focus', () => { viewer && viewer.showView('espalda'); setView('espalda'); setSpin(false); });
const inNum = $('#inNum');
inNum.addEventListener('input', () => {
  st.number = inNum.value.replace(/\D/g, '').slice(0, 2);
  if (inNum.value !== st.number) inNum.value = st.number;
  refresh();
});
inNum.addEventListener('focus', () => { viewer && viewer.showView('espalda'); setView('espalda'); setSpin(false); });
$('#inOutline').addEventListener('change', (e) => {
  st.outline = e.target.checked;
  refresh();
});
const inTag = $('#inTag');
inTag.addEventListener('input', () => {
  st.sleeveTag = inTag.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  if (inTag.value !== st.sleeveTag) inTag.value = st.sleeveTag;
  refresh();
});
inTag.addEventListener('focus', () => { viewer && viewer.showView('lado'); setView(''); setSpin(false); });

function renderFonts() {
  const box = $('#fonts');
  box.innerHTML = '';
  FONTS.forEach((f) => {
    const b = el('button', { type: 'button', class: 'font' + (st.font === f.id ? ' is-on' : ''), style: `font-family:${f.css};font-weight:${f.weight};font-size:${Math.round(18 * f.scale)}px`, title: f.label, 'aria-label': f.label }, (st.name || 'SC1').slice(0, 8));
    b.addEventListener('click', () => {
      st.font = f.id;
      renderFonts();
      loadFont(f.id);
      refresh();
    });
    box.append(b);
  });
}
inName.addEventListener('change', renderFonts);

function renderTextPalette() {
  const box = $('#textPalette');
  box.innerHTML = '';
  const opts = ['#f4f5f8', '#0b0d12', '#d9a92b', '#ffd60a', '#35e0ff', '#2ee6a6', '#ff3da6', '#e11d2e', '#2f6bff', '#b8bec9', st.colors.b, st.colors.c];
  [...new Set(opts.map((x) => x.toLowerCase()))].slice(0, 12).forEach((hex) => {
    const name = (PALETTE.find((p) => p[1].toLowerCase() === hex) || ['Color'])[0];
    const on = st.textColor.toLowerCase() === hex;
    const b = el('button', { type: 'button', class: 'sw' + (on ? ' is-on' : ''), style: `background:${hex}`, title: name, 'aria-label': name, 'aria-pressed': on ? 'true' : 'false' });
    b.addEventListener('click', () => {
      st.textColor = hex;
      renderTextPalette();
      refresh();
    });
    box.append(b);
  });
}

$('#inLogo').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    $('#logoTxt').textContent = 'El archivo pesa más de 5 MB';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      logoImg = img;
      logoName = file.name;
      $('#logoTxt').textContent = file.name;
      $('#logoClear').hidden = false;
      viewer && viewer.showView('frente');
      setView('frente');
      refresh();
    };
    img.onerror = () => { $('#logoTxt').textContent = 'No se pudo leer la imagen'; };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
});
$('#logoClear').addEventListener('click', () => {
  logoImg = null;
  logoName = '';
  $('#inLogo').value = '';
  $('#logoTxt').textContent = 'Subir PNG o SVG';
  $('#logoClear').hidden = true;
  refresh();
});

// ---------- 5. talla ----------
function renderSizes() {
  $('#sizeCut').textContent = '· ' + CUTS[st.cut].label;
  const box = $('#sizes');
  box.innerHTML = '';
  const tb = $('#guide tbody');
  tb.innerHTML = '';
  SIZES[st.cut].forEach(([s, chest, len]) => {
    const b = el('button', { type: 'button', class: 'size' + (st.size === s ? ' is-on' : ''), 'aria-pressed': st.size === s ? 'true' : 'false' }, s);
    b.addEventListener('click', () => {
      st.size = s;
      renderSizes();
      updateSummary();
    });
    box.append(b);
    const tr = el('tr', { class: st.size === s ? 'is-on' : '' }, `<td>${s}</td><td>${chest} cm</td><td>${len} cm</td>`);
    tb.append(tr);
  });
}
$('#qMinus').addEventListener('click', () => { st.qty = Math.max(1, st.qty - 1); $('#qty').textContent = st.qty; updateSummary(); });
$('#qPlus').addEventListener('click', () => { st.qty = Math.min(50, st.qty + 1); $('#qty').textContent = st.qty; updateSummary(); });

// ---------- resumen ----------
const money = (n) => '$' + n.toLocaleString('es-MX');
function updateSummary() {
  const t = TEMPLATES.find((x) => x.id === st.template);
  const cut = CUTS[st.cut].label;
  $('#sumLine').textContent = `${t.name} · ${cut} · ${st.size ? 'Talla ' + st.size : 'Sin talla'}${st.qty > 1 ? ' · ' + st.qty + ' piezas' : ''}`;
  $('#price').textContent = money(PRICE_MXN * st.qty);
  $('#stageTag').textContent = `${t.name} · ${cut}`;
}

function designConfig() {
  return {
    corte: st.cut,
    talla: st.size,
    piezas: st.qty,
    plantilla: st.template,
    colores: { ...st.colors },
    cuello: st.collar,
    nombre: st.name,
    numero: st.number,
    fuente: st.font,
    colorTexto: st.textColor,
    contorno: st.outline,
    manga: st.sleeveTag,
    logo: logoName || null,
  };
}
function designCode(cfg) {
  const s = JSON.stringify({ ...cfg, talla: null, piezas: null });
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 'SC1-' + h.toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

// ---------- modal ----------
function openModal(title, body) {
  $('#modalTitle').textContent = title;
  const mb = $('#modalBody');
  mb.innerHTML = '';
  mb.append(body);
  $('#modal').hidden = false;
  $('#modalX').focus();
}
function closeModal() { $('#modal').hidden = true; }
$('#modalX').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

$('#btnPrint').addEventListener('click', () => {
  composeTexture(texCanvas, st, logoImg);
  const small = document.createElement('canvas');
  small.width = 1024;
  small.height = 720;
  const c = small.getContext('2d');
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, 1024, 720);
  c.drawImage(texCanvas, 0, 0, 2048, 1440, 0, 0, 1024, 720);
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:12px' });
  wrap.append(
    el('img', { class: 'print-img', src: small.toDataURL('image/jpeg', 0.9), alt: 'Archivo de impresión: frente, espalda y mangas del jersey' }),
    el('p', { class: 'print-legend' }, '<span>Arriba izq.: frente</span><span>Arriba der.: espalda</span><span>Abajo: mangas</span>'),
    el('p', { class: 'note' }, `Esto es lo que recibe el taller al pagar: el diseño plano de cada pieza (2048 × 2048 px en este prototipo). En producción se exporta a 300 dpi sobre el patrón de corte real. Código de diseño: <b>${designCode(designConfig())}</b>`)
  );
  openModal('Archivo de impresión', wrap);
});

function addToCart() {
  if (!st.size) {
    goStep(4);
    const s = $('#sizes');
    s.classList.remove('need');
    void s.offsetWidth;
    s.classList.add('need');
    $('#sumLine').textContent = 'Elige tu talla para continuar';
    return;
  }
  const cfg = designConfig();
  const code = designCode(cfg);
  const preview = viewer ? viewer.snapshot(420) : '';
  const payload = { type: 'sc1:add-to-cart', code, precioMXN: PRICE_MXN, ...cfg, preview };
  // Integración con Wix: el sitio escucha este mensaje y agrega el producto al carrito
  if (window.parent !== window && new URLSearchParams(location.search).has('embed')) {
    window.parent.postMessage(payload, '*');
  }
  const t = TEMPLATES.find((x) => x.id === st.template);
  const wrap = el('div', { style: 'display:flex;flex-direction:column;gap:14px' });
  const order = el('div', { class: 'order' });
  if (preview) order.append(el('img', { src: preview, alt: 'Vista de tu jersey' }));
  order.append(
    el('dl', {}, `
      <dt>Diseño</dt><dd>${t.name}</dd>
      <dt>Corte</dt><dd>${CUTS[st.cut].label}</dd>
      <dt>Talla</dt><dd>${st.size}</dd>
      <dt>Nombre</dt><dd>${st.name || '—'}</dd>
      <dt>Número</dt><dd>${st.number || '—'}</dd>
      <dt>Piezas</dt><dd>${st.qty}</dd>
      <dt>Total</dt><dd>${money(PRICE_MXN * st.qty)} MXN</dd>
      <dt>Código</dt><dd>${code}</dd>`)
  );
  const json = { ...cfg, code };
  wrap.append(
    order,
    el('p', { class: 'note' }, 'En sc1.gg este botón agrega el jersey al carrito de Wix con estos datos, y el taller recibe el archivo de impresión al confirmarse el pago.'),
    el('pre', { class: 'code' }, JSON.stringify(json, null, 2).replace(/</g, '&lt;'))
  );
  openModal('Listo para el carrito', wrap);
}

$('#btnNext').addEventListener('click', () => {
  if (st.step < 4) goStep(st.step + 1);
  else addToCart();
});

// ---------- inicio ----------
renderFilters();
renderDesigns();
renderZones();
renderPalette();
renderTrims();
renderFonts();
renderTextPalette();
renderSizes();
loadFont(st.font);
refresh();
if (viewer) viewer.showView('frente');
window.__sc1 = { st, goStep, refresh };
