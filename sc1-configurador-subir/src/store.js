import { create } from 'zustand';
import { PATTERNS } from './lib/patterns.js';

const first = PATTERNS[0];

// Estado único del configurador. Todo lo que define el jersey vive aquí.
export const useStore = create((set, get) => ({
  step: 0,
  cut: 'hombre',
  template: first.id,
  colors: { a: first.colors[0], b: first.colors[1], c: first.colors[2] },
  zone: 'a',
  collar: first.collar || 'c',
  collar2: first.collar === 'blanco' ? 'c' : 'b', // telita del doble cuello
  cuff: null, // color de puños (null = igual al cuello); acepta clave de paleta o '#hex'
  collarType: 'redondo', // 'redondo' | 'v' | 'doble'
  weave: 'tecnodry', // tipo de tejido
  logoPos: 'izq', // 'der' | 'centro' | 'izq' (del jugador)
  logoSize: 1,
  logoXY: null, // posición libre del logo del pecho { x, y } (fracción de la pieza); null = según logoPos
  logoSX: 1, // estiramiento libre del logo del pecho (esquinas)
  logoSY: 1,
  selKey: null, // elemento seleccionado (se muestran sus esquinas para deformarlo)
  dragKey: null, // elemento que se está arrastrando en el visor
  hoverKey: null,
  moveHint: true,
  examplesDone: false, // ya se pusieron los logos de ejemplo del jersey inicial // aviso de "arrastra los logos" en el paso de logos
  sleeveLeft: { kind: 'flag', flag: 'mx' }, // manga izquierda del jugador
  sleeveRight: { kind: 'none' },
  sponsors: [], // [{ id, kind: 'text' | 'logo', text, logo, pos }] — ver SPONSOR_POS
  name: 'SHADY',
  number: '23',
  font: 'teko',
  textColor: '#f4f5f8',
  outline: true,
  size: null,
  qty: 1,
  notes: '', // comentarios para el taller
  family: 'Todas',
  logo: null, // { img: HTMLImageElement, name: string }
  fontsVersion: 0,

  // prenda 3D activa (procedural o .glb) y calidad del render
  garment: null,
  garmentStatus: 'ready', // 'loading' | 'ready' | 'error'
  garmentError: null,
  customModel: null, // { url, name } modelo .glb cargado por el usuario
  // en celulares arranca en calidad ligera
  quality: typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 900px), (pointer: coarse)').matches ? 'baja' : 'alta',
  diag: null,

  // cámara
  view: 'frente',
  viewNonce: 0,
  spin: false,

  // interfaz
  modal: null, // { kind: 'print' | 'cart', data }
  sizeNudge: 0,

  set: (p) => set(p),
  goStep: (i) => {
    set({ step: i, selKey: null, hoverKey: null });
    get().showView(i === 4 ? 'espalda' : 'frente');
  },
  showView: (v) => set((s) => ({ view: v, viewNonce: s.viewNonce + 1, spin: false })),
  pickTemplate: (id) => {
    const t = PATTERNS.find((x) => x.id === id);
    set({ template: id, colors: { a: t.colors[0], b: t.colors[1], c: t.colors[2] }, ...(t.collar ? { collar: t.collar, collar2: t.collar === 'blanco' ? 'c' : 'b' } : {}) });
  },
  // mover o escalar un elemento: key = 'logo' | 'sleeveLeft' | 'sleeveRight' | 'sp:<id>'
  moveItem: (key, patch) =>
    set((s) => {
      if (key === 'logo')
        return {
          ...(patch.xy !== undefined ? { logoXY: patch.xy } : {}),
          ...(patch.scale !== undefined ? { logoSize: patch.scale } : {}),
          ...(patch.sx !== undefined ? { logoSX: patch.sx } : {}),
          ...(patch.sy !== undefined ? { logoSY: patch.sy } : {}),
        };
      if (key === 'sleeveLeft' || key === 'sleeveRight') return { [key]: { ...s[key], ...patch } };
      if (key.startsWith('sp:')) return { sponsors: s.sponsors.map((x) => ('sp:' + x.id === key ? { ...x, ...patch } : x)) };
      return {};
    }),
  itemStretch: (key) => {
    const s = get();
    if (key === 'logo') return { sx: s.logoSX || 1, sy: s.logoSY || 1 };
    const it = key === 'sleeveLeft' || key === 'sleeveRight' ? s[key] : s.sponsors.find((x) => 'sp:' + x.id === key);
    return { sx: (it && it.sx) || 1, sy: (it && it.sy) || 1 };
  },
  itemScale: (key) => {
    const s = get();
    if (key === 'logo') return s.logoSize || 1;
    if (key === 'sleeveLeft' || key === 'sleeveRight') return s[key].scale || 1;
    const sp = s.sponsors.find((x) => 'sp:' + x.id === key);
    return (sp && sp.scale) || 1;
  },
  setColor: (hex) => set((s) => ({ colors: { ...s.colors, [s.zone]: hex } })),
  resetColors: () => get().pickTemplate(get().template),
}));

// Referencia al renderer para tomar la foto del jersey (no reactiva)
export const glRef = { current: null };
