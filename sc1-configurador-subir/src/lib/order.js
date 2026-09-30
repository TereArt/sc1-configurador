import { PRICE_MXN } from './config.js';
import { lastPanels } from './texture.js';

export const money = (n) => '$' + n.toLocaleString('es-MX');

export function designConfig(s) {
  return {
    corte: s.cut,
    talla: s.size,
    piezas: s.qty,
    plantilla: s.template,
    colores: { ...s.colors },
    cuello: s.collar,
    nombre: s.name,
    numero: s.number,
    fuente: s.font,
    colorTexto: s.textColor,
    contorno: s.outline,
    cuelloTipo: s.collarType,
    cuello2: s.collar2,
    punos: s.cuff || s.collar,
    tejido: 'Tecno Dry',
    logo: s.logo ? (s.logo.demo ? 'ejemplo (sin logo del cliente)' : s.logo.name) : null,
    logoLibre: s.logoXY || null,
    tamanoLogo: s.logoSize,
    estiramientoLogo: s.logoSX !== 1 || s.logoSY !== 1 ? { ancho: s.logoSX, alto: s.logoSY } : undefined,
    // fotos convertidas automáticamente: el equipo de diseño las vectoriza a mano para imprimir
    vectorizacionProfesional: [s.logo, s.sleeveLeft && s.sleeveLeft.logo, s.sleeveRight && s.sleeveRight.logo, ...(s.sponsors || []).map((x) => x.logo)].some((l) => l && l.original),
    logoPosicion: s.logoPos,
    mangaIzquierda: s.sleeveLeft && { ...s.sleeveLeft, logo: s.sleeveLeft.logo ? s.sleeveLeft.logo.name : undefined },
    mangaDerecha: s.sleeveRight && { ...s.sleeveRight, logo: s.sleeveRight.logo ? s.sleeveRight.logo.name : undefined },
    patrocinadores: (s.sponsors || []).map((x) => ({ lugar: x.pos, posicion: x.xy || undefined, tamano: x.scale || 1, estiramiento: x.sx || x.sy ? { ancho: x.sx || 1, alto: x.sy || 1 } : undefined, ejemplo: x.demo || undefined, tipo: x.kind, texto: x.kind === 'text' ? x.text : undefined, logo: x.logo ? x.logo.name : undefined })),
    notas: s.notes || '',
  };
}

export function designCode(cfg) {
  const str = JSON.stringify({ ...cfg, talla: null, piezas: null });
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return 'SC1-' + h.toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

// Vista reducida del archivo de impresión (frente, espalda y mangas)
export function printPreview() {
  // piezas planas: frente y espalda arriba, mangas abajo (respetando proporciones)
  const P = lastPanels;
  const c = document.createElement('canvas');
  c.width = 1040;
  c.height = 760;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  if (!P) return c.toDataURL('image/jpeg', 0.9);
  const fit = (img, x, y, w, h) => {
    const r = Math.min(w / img.width, h / img.height);
    ctx.drawImage(img, x + (w - img.width * r) / 2, y + (h - img.height * r) / 2, img.width * r, img.height * r);
  };
  fit(P.front, 0, 0, 512, 500);
  fit(P.back, 528, 0, 512, 500);
  fit(P.sleeveR, 0, 520, 512, 240);
  fit(P.sleeveL, 528, 520, 512, 240);
  return c.toDataURL('image/jpeg', 0.9);
}

export function snapshot(gl, w = 420) {
  if (!gl) return '';
  const src = gl.domElement;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.round((w * src.height) / src.width);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

// Wix: la página de sc1.gg escucha este mensaje y agrega el producto al carrito (ver README)
export function sendToWix(payload) {
  const embedded = window.parent !== window && new URLSearchParams(location.search).has('embed');
  if (embedded) window.parent.postMessage({ type: 'sc1:add-to-cart', precioMXN: PRICE_MXN, ...payload }, '*');
  return embedded;
}

// Cotización de equipo: se manda a la página de Wix (si está incrustado) o por correo
export function sendQuote(payload) {
  const embedded = window.parent !== window && new URLSearchParams(location.search).has('embed');
  if (embedded) window.parent.postMessage({ type: 'sc1:quote', ...payload }, '*');
  return embedded;
}
