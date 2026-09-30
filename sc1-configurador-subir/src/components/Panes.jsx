import { useMemo } from 'react';
import LogoUpload from './LogoUpload.jsx';
import { isDemoState } from '../lib/examples.js';
import { useStore } from '../store.js';
import { PATTERNS, patternSVG } from '../lib/patterns.js';
import { FONTS, FLAGS, SPONSOR_POS, MAX_SPONSORS } from '../lib/compose.js';
import { PALETTE, SIZES, TRIMS } from '../lib/config.js';
import { CUTS } from '../lib/geometry.js';

const cx = (...c) => c.filter(Boolean).join(' ');

// ---------- piezas reutilizables ----------
function Seg({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([k, l, color]) => (
        <button key={k} type="button" className={value === k ? 'is-on' : ''} aria-pressed={value === k} onClick={() => onChange(k)}>
          {color && <i style={{ background: color }} />}
          {l}
        </button>
      ))}
    </div>
  );
}

// ---------- 1. Corte y cuello ----------
const COLLARS = [
  ['redondo', 'Cuello redondo', 'M8 10 Q32 34 56 10'],
  ['v', 'Cuello V', 'M8 10 L32 38 L56 10'],
  ['doble', 'Doble cuello', 'M8 10 L32 38 L56 10'],
];

export function CutPane() {
  const cut = useStore((s) => s.cut);
  const collarType = useStore((s) => s.collarType);
  const set = useStore((s) => s.set);
  const choose = (c) => {
    const { size } = useStore.getState();
    set({ cut: c, size: SIZES[c].some((x) => x[0] === size) ? size : null });
  };
  return (
    <>
      <h2>Corte y cuello</h2>
      <div className="cuts">
        <button type="button" className={cx('cut', cut === 'hombre' && 'is-on')} aria-pressed={cut === 'hombre'} onClick={() => choose('hombre')}>
          <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 8l-14 8 5 13 6-3v30h26V26l6 3 5-13-14-8c-2 5-6 7-10 7s-8-2-10-7z" /></svg>
          <span className="cut-name">Hombre</span>
          <span className="cut-sub">Corte regular · XS a 3XL</span>
        </button>
        <button type="button" className={cx('cut', cut === 'mujer' && 'is-on')} aria-pressed={cut === 'mujer'} onClick={() => choose('mujer')}>
          <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 9l-12 7 4 12 6-3c1 6-2 10-2 14l1 17h28l1-17c0-4-3-8-2-14l6 3 4-12-12-7c-2 4-5 6-9 6s-7-2-9-6z" /></svg>
          <span className="cut-name">Mujer</span>
          <span className="cut-sub">Entallado · XS a 2XL</span>
        </button>
      </div>
      <div className="field">
        <span className="label">Tipo de cuello</span>
        <div className="collars" role="group" aria-label="Tipo de cuello">
          {COLLARS.map(([k, label, d]) => (
            <button key={k} type="button" className={cx('collar', collarType === k && 'is-on')} aria-pressed={collarType === k} onClick={() => set({ collarType: k })}>
              <svg viewBox="0 0 64 48" aria-hidden="true">
                <path d={d} fill="none" stroke="var(--blue)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
                {k === 'doble' && <path d="M14 10 L32 30 L50 10" fill="none" stroke="var(--gold)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />}
              </svg>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <ModelBox />
    </>
  );
}

// Probar un modelo .glb y ajustar la calidad del render
function ModelBox() {
  const custom = useStore((s) => s.customModel);
  const quality = useStore((s) => s.quality);
  const status = useStore((s) => s.garmentStatus);
  const set = useStore((s) => s.set);
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (custom) URL.revokeObjectURL(custom.url);
    set({ customModel: { url: URL.createObjectURL(f), name: f.name } });
  };
  return (
    <div className="model-box">
      <span className="label">Modelo 3D</span>
      <p className="help">{custom ? `Usando ${custom.name}${status === 'loading' ? ' (cargando…)' : ''}` : 'Prueba aquí el .glb de tu modelador: el diseño se acomoda solo.'}</p>
      <div className="row2">
        <label className="upload" htmlFor="inGlb">
          <input id="inGlb" type="file" accept=".glb,.gltf,model/gltf-binary" onChange={onFile} />
          <span>{custom ? 'Cambiar .glb' : 'Probar un .glb'}</span>
        </label>
        {custom ? (
          <button
            type="button"
            className="ghost"
            onClick={() => {
              URL.revokeObjectURL(custom.url);
              set({ customModel: null });
              const i = document.getElementById('inGlb');
              if (i) i.value = '';
            }}
          >
            Volver al modelo base
          </button>
        ) : (
          <div />
        )}
      </div>
      <span className="label">Calidad del render</span>
      <Seg label="Calidad del render" value={quality} onChange={(k) => set({ quality: k })} options={[['alta', 'Alta'], ['baja', 'Ligera (celulares)']]} />
    </div>
  );
}

// ---------- 2. Diseño ----------
const SHIRT = 'M36 10 L14 22 L4 48 L22 56 L28 44 L28 94 L72 94 L72 44 L78 56 L96 48 L86 22 L64 10 C60 18 55 21 50 21 C45 21 40 18 36 10 Z';

function Thumb({ p, colors }) {
  const url = useMemo(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(patternSVG(p.id, 300, 293, colors, 'front')), [p.id, colors.a, colors.b, colors.c]);
  const clip = 'clip-' + p.id;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <path d={SHIRT} />
        </clipPath>
      </defs>
      <image href={url} x="0" y="4" width="100" height="98" preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clip})`} />
      <path d={SHIRT} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
    </svg>
  );
}

export function DesignPane() {
  const family = useStore((s) => s.family);
  const template = useStore((s) => s.template);
  const colors = useStore((s) => s.colors);
  const set = useStore((s) => s.set);
  const pick = useStore((s) => s.pickTemplate);
  const families = ['Todas', ...new Set(PATTERNS.map((t) => t.family))];
  const list = PATTERNS.filter((t) => family === 'Todas' || t.family === family);
  return (
    <>
      <h2>
        Diseño de la tela <span className="muted">· {PATTERNS.length} diseños</span>
      </h2>
      <div className="filters" role="group" aria-label="Familia de diseño">
        {families.map((f) => (
          <button key={f} type="button" className={cx('chip', family === f && 'is-on')} onClick={() => set({ family: f })}>
            {f}
          </button>
        ))}
      </div>
      <div className="designs">
        {list.map((t) => {
          const on = template === t.id;
          const c = on ? colors : { a: t.colors[0], b: t.colors[1], c: t.colors[2] };
          return (
            <button key={t.id} type="button" className={cx('design', on && 'is-on')} aria-pressed={on} onClick={() => pick(t.id)}>
              <Thumb p={t} colors={c} />
              <span>
                {t.name}
                <small>{t.family}</small>
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ---------- 3. Colores y tejido ----------
const ZONES = [
  ['a', 'Jersey'],
  ['b', 'Diseño'],
  ['c', 'Acento'],
];

export function ColorPane() {
  const colors = useStore((s) => s.colors);
  const zone = useStore((s) => s.zone);
  const collar = useStore((s) => s.collar);
  const collar2 = useStore((s) => s.collar2);
  const collarType = useStore((s) => s.collarType);
  const cuff = useStore((s) => s.cuff);
  const set = useStore((s) => s.set);
  const setColor = useStore((s) => s.setColor);
  const reset = useStore((s) => s.resetColors);
  const trimColor = { a: colors.a, b: colors.b, c: colors.c, blanco: '#f4f5f8', negro: '#0b0d12' };
  const trimOpts = TRIMS.map(([k, l]) => [k, l, trimColor[k]]);
  return (
    <>
      <h2>Colores</h2>
      <div className="zones" role="group" aria-label="Zona a pintar">
        {ZONES.map(([k, label]) => (
          <button key={k} type="button" className={cx('zone', zone === k && 'is-on')} aria-pressed={zone === k} onClick={() => set({ zone: k })}>
            <i style={{ background: colors[k] }} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="palette">
        {PALETTE.map(([name, hex]) => {
          const on = colors[zone].toLowerCase() === hex.toLowerCase();
          return <button key={hex} type="button" className={cx('sw', on && 'is-on')} style={{ background: hex }} title={name} aria-label={name} aria-pressed={on} onClick={() => setColor(hex)} />;
        })}
      </div>
      <label className="custom-color" htmlFor="inZoneColor">
        <input id="inZoneColor" type="color" value={colors[zone]} onChange={(e) => setColor(e.target.value)} />
        <span>Otro color…</span>
      </label>
      <button type="button" className="link" onClick={reset}>
        Volver a los colores del diseño
      </button>
      <TrimPicker label="Color del cuello" value={collar} onChange={(k) => set({ collar: k })} opts={trimOpts} />
      {collarType === 'doble' && <TrimPicker label="Color de la telita (vértice del doble cuello)" value={collar2} onChange={(k) => set({ collar2: k })} opts={trimOpts} />}
      <TrimPicker label="Color de los puños" value={cuff} onChange={(k) => set({ cuff: k })} opts={trimOpts} same="Igual al cuello" />
      <p className="help">Tela Tecno Dry (malla transpirable).</p>
    </>
  );
}

// Selector de color para cuello, telita y puños: colores del diseño o cualquier color (picker)
function TrimPicker({ label, value, onChange, opts, same }) {
  const custom = value && value[0] === '#';
  const shown = custom ? value : (opts.find((o) => o[0] === value) || opts[0])[2];
  const id = 'in' + label.replace(/\W/g, '');
  return (
    <div className="field">
      <span className="label">{label}</span>
      <div className="trims" role="group" aria-label={label}>
        {same && (
          <button type="button" className={cx('trim', !value && 'is-on')} aria-pressed={!value} onClick={() => onChange(null)}>
            {same}
          </button>
        )}
        {opts.map(([k, l, color]) => (
          <button key={k} type="button" className={cx('trim', value === k && 'is-on')} aria-pressed={value === k} onClick={() => onChange(k)} title={l}>
            <i style={{ background: color }} />
            {l}
          </button>
        ))}
        <label className={cx('trim', 'picker', custom && 'is-on')} htmlFor={id} title="Elegir cualquier color">
          <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(shown || '') ? shown : '#ffffff'} onChange={(e) => onChange(e.target.value)} />
          <i style={{ background: custom ? value : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
          Otro
        </label>
      </div>
    </div>
  );
}

// ---------- 4. Logos ----------
const CHEST = [
  ['der', 'Pecho derecho'],
  ['centro', 'Centro'],
  ['izq', 'Pecho izquierdo'],
];

function SleeveControl({ which }) {
  const key = which === 'izq' ? 'sleeveLeft' : 'sleeveRight';
  const item = useStore((s) => s[key]);
  const set = useStore((s) => s.set);
  const showView = useStore((s) => s.showView);
  const update = (patch) => {
    set({ [key]: { ...item, ...patch } });
    showView(which === 'izq' ? 'ladoIzq' : 'ladoDer');
  };
  return (
    <div className="field">
      <span className="label">Manga {which === 'izq' ? 'izquierda' : 'derecha'}</span>
      <Seg label={`Manga ${which}`} value={item.kind} onChange={(k) => update({ kind: k })} options={[['none', 'Nada'], ['logo', 'Logo'], ['flag', 'Bandera'], ['text', 'Texto']]} />
      {item.kind === 'logo' && <LogoUpload id={`inSleeve${which}`} value={item.logo || null} onChange={(v) => update({ logo: v, ...(!v || !item.logo || v.name !== item.logo.name ? { sx: 1, sy: 1 } : {}) })} />}
      {item.kind !== 'none' && (
        <label className="range">
          <span className="help">Tamaño</span>
          <input type="range" min="0.5" max="1.8" step="0.05" value={item.scale || 1} aria-label={`Tamaño manga ${which}`} onChange={(e) => update({ scale: Number(e.target.value) })} />
        </label>
      )}
      {item.kind === 'flag' && (
        <div className="flags" role="group" aria-label="Bandera">
          {Object.entries(FLAGS).map(([code, fl]) => (
            <button key={code} type="button" className={cx('flag', item.flag === code && 'is-on')} title={fl.name} aria-label={fl.name} aria-pressed={item.flag === code} onClick={() => update({ flag: code })}>
              <svg viewBox="0 0 3 2" dangerouslySetInnerHTML={{ __html: fl.svg }} />
            </button>
          ))}
        </div>
      )}
      {item.kind === 'text' && (
        <input
          type="text"
          maxLength={6}
          autoComplete="off"
          aria-label={`Texto manga ${which}`}
          value={item.text || ''}
          placeholder="Ej. MX, PRO"
          onChange={(e) => update({ text: e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 6) })}
        />
      )}
    </div>
  );
}

export function LogosPane() {
  const logo = useStore((s) => s.logo);
  const logoPos = useStore((s) => s.logoPos);
  const logoSize = useStore((s) => s.logoSize);
  const set = useStore((s) => s.set);
  const showView = useStore((s) => s.showView);
  const demo = useStore(isDemoState);
  const front = () => showView('frente');
  return (
    <>
      <h2>Logos y elementos</h2>
      <div className="move-tip">
        <strong>Mueve los logos libremente</strong>
        <span>Toca cualquier logo, bandera o patrocinador en el jersey: arrástralo para moverlo y jala sus esquinas u orillas para cambiar su tamaño o deformarlo (con Shift conserva la proporción). Abajo puedes agregar los logos de tus patrocinadores.</span>
        <em>Es una vista de referencia de lugar y tamaño; con base en tu diseño te enviamos la representación oficial.</em>
      </div>
      {demo && (
        <div className="demo-tip">
          <span>El jersey trae logos de ejemplo para que veas dónde van tu escudo y tus marcas. Sube los tuyos para reemplazarlos.</span>
          <button type="button" className="link" onClick={() => set((st) => ({ logo: st.logo && st.logo.demo ? null : st.logo, sponsors: st.sponsors.filter((x) => !x.demo) }))}>
            Quitar ejemplos
          </button>
        </div>
      )}
      <div className="field">
        <span className="label">Logo en el pecho</span>
        <LogoUpload
          id="inLogo"
          value={logo}
          onChange={(v) => {
            set((st) => ({ logo: v, ...(!v || !st.logo || v.name !== st.logo.name ? { logoSX: 1, logoSY: 1 } : {}) }));
            front();
          }}
          hint="Subir logo del equipo"
        />
        <Seg
          label="Posición del logo"
          value={logoPos}
          onChange={(k) => {
            set({ logoPos: k, logoXY: null });
            front();
          }}
          options={CHEST}
        />
        <label className="range" htmlFor="inLogoSize">
          <span className="help">Tamaño</span>
          <input id="inLogoSize" type="range" min="0.4" max="2.2" step="0.05" value={logoSize} onChange={(e) => set({ logoSize: Number(e.target.value) })} />
        </label>
        <span className="help">Derecho e izquierdo según quien porta el jersey.</span>
      </div>
      <SleeveControl which="izq" />
      <SleeveControl which="der" />
      <SponsorList />
    </>
  );
}

// Patrocinadores: varios, cada uno en el lugar que se elija
const VIEW_OF = { front: 'frente', back: 'espalda', sleeveR: 'ladoIzq', sleeveL: 'ladoDer' };
function SponsorList() {
  const list = useStore((s) => s.sponsors);
  const set = useStore((s) => s.set);
  const showView = useStore((s) => s.showView);
  const used = new Set(list.map((x) => x.pos));
  const upd = (id, patch) => {
    const content = 'logo' in patch || 'text' in patch || 'kind' in patch;
    const next = list.map((x) => (x.id === id ? { ...x, ...patch, ...(content ? { demo: false } : {}) } : x));
    set({ sponsors: next });
    const it = next.find((x) => x.id === id);
    if (it) showView(VIEW_OF[SPONSOR_POS[it.pos].panel]);
  };
  const add = () => {
    const pos = Object.keys(SPONSOR_POS).find((k) => !used.has(k)) || 'pecho';
    set({ sponsors: [...list, { id: Date.now().toString(36), kind: 'text', text: '', logo: null, pos }] });
    showView(VIEW_OF[SPONSOR_POS[pos].panel]);
  };
  return (
    <div className="field">
      <span className="label">Patrocinadores</span>
      {list.length === 0 && <span className="help">Agrega uno o varios: al frente, en la espalda o en las mangas.</span>}
      {list.map((sp, i) => (
        <div className="sponsor" key={sp.id}>
          <div className="sponsor-head">
            <strong>
              Patrocinador {i + 1} {sp.demo && <span className="tag">Ejemplo</span>}
            </strong>
            <button type="button" className="ghost small" onClick={() => set({ sponsors: list.filter((x) => x.id !== sp.id) })}>
              Quitar
            </button>
          </div>
          <label className="select">
            <span className="help">Lugar</span>
            <select value={sp.pos} onChange={(e) => upd(sp.id, { pos: e.target.value, xy: null })}>
              {Object.entries(SPONSOR_POS).map(([k, p]) => (
                <option key={k} value={k}>
                  {p.label}
                  {used.has(k) && k !== sp.pos ? ' (ocupado)' : ''}
                </option>
              ))}
            </select>
          </label>
          <Seg label="Tipo de patrocinador" value={sp.kind} onChange={(k) => upd(sp.id, { kind: k })} options={[['text', 'Texto'], ['logo', 'Logo']]} />
          <label className="range">
            <span className="help">Tamaño</span>
            <input type="range" min="0.4" max="2.2" step="0.05" value={sp.scale || 1} aria-label="Tamaño del patrocinador" onChange={(e) => upd(sp.id, { scale: Number(e.target.value) })} />
          </label>
          {sp.kind === 'text' ? (
            <input type="text" maxLength={18} autoComplete="off" aria-label="Texto del patrocinador" value={sp.text || ''} placeholder="Nombre del patrocinador" onChange={(e) => upd(sp.id, { text: e.target.value })} />
          ) : (
            <LogoUpload id={'inSp' + sp.id} value={sp.logo || null} onChange={(v) => upd(sp.id, { logo: v, ...(!v || !sp.logo || v.name !== sp.logo.name ? { sx: 1, sy: 1 } : {}) })} hint="Subir logo del patrocinador" />
          )}
        </div>
      ))}
      {list.length < MAX_SPONSORS && (
        <button type="button" className="add" onClick={add}>
          + Agregar patrocinador
        </button>
      )}
    </div>
  );
}

// ---------- 5. Nombre y número ----------
export function NamePane() {
  const s = useStore();
  const back = () => s.view !== 'espalda' && s.showView('espalda');
  const textOpts = [...new Set(['#f4f5f8', '#0b0d12', '#d9a92b', '#ffd60a', '#35e0ff', '#2ee6a6', '#ff3da6', '#e11d2e', '#2f6bff', '#b8bec9', s.colors.b, s.colors.c].map((x) => x.toLowerCase()))].slice(0, 12);
  return (
    <>
      <h2>Gamertag y número</h2>
      <div className="row2">
        <label className="field" htmlFor="inName">
          <span className="label">Gamertag (espalda alta)</span>
          <input id="inName" type="text" maxLength={14} autoComplete="off" spellCheck={false} value={s.name} onFocus={back} onChange={(e) => s.set({ name: e.target.value.toUpperCase().replace(/[^A-Z0-9ÑÁÉÍÓÚÜ _.\-]/g, '') })} />
          <span className="help">{s.name.length}/14 caracteres</span>
        </label>
        <label className="field" htmlFor="inNum">
          <span className="label">Número</span>
          <input id="inNum" type="text" inputMode="numeric" maxLength={2} value={s.number} onFocus={back} onChange={(e) => s.set({ number: e.target.value.replace(/\D/g, '').slice(0, 2) })} />
          <span className="help">Opcional, 0 a 99</span>
        </label>
      </div>
      <div className="field">
        <span className="label">Fuente</span>
        <div className="fonts" role="group" aria-label="Fuente">
          {FONTS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={cx('font', s.font === f.id && 'is-on')}
              style={{ fontFamily: f.css, fontWeight: f.weight, fontSize: Math.round(18 * f.scale) }}
              title={f.label}
              aria-label={f.label}
              aria-pressed={s.font === f.id}
              onClick={() => s.set({ font: f.id })}
            >
              {(s.name || 'SC1').slice(0, 8)}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <span className="label">Color del texto</span>
        <div className="palette small">
          {textOpts.map((hex) => {
            const name = (PALETTE.find((p) => p[1].toLowerCase() === hex) || ['Color'])[0];
            const on = s.textColor.toLowerCase() === hex;
            return <button key={hex} type="button" className={cx('sw', on && 'is-on')} style={{ background: hex }} title={name} aria-label={name} aria-pressed={on} onClick={() => s.set({ textColor: hex })} />;
          })}
        </div>
      </div>
      <label className="toggle" htmlFor="inOutline">
        <input id="inOutline" type="checkbox" checked={s.outline} onChange={(e) => s.set({ outline: e.target.checked })} />
        <span>Contorno en gamertag y número</span>
      </label>
    </>
  );
}

// ---------- 6. Talla ----------
export function SizePane({ onQuote }) {
  const cut = useStore((s) => s.cut);
  const size = useStore((s) => s.size);
  const qty = useStore((s) => s.qty);
  const nudge = useStore((s) => s.sizeNudge);
  const notes = useStore((s) => s.notes);
  const set = useStore((s) => s.set);
  return (
    <>
      <h2>
        Talla y pedido <span className="muted">· {CUTS[cut].label}</span>
      </h2>
      <div key={nudge} className={cx('sizes', nudge > 0 && 'need')} role="group" aria-label="Talla">
        {SIZES[cut].map(([s]) => (
          <button key={s} type="button" className={cx('size', size === s && 'is-on')} aria-pressed={size === s} onClick={() => set({ size: s })}>
            {s}
          </button>
        ))}
      </div>
      <div className="guide-wrap">
        <table className="guide">
          <thead>
            <tr>
              <th>Talla</th>
              <th>Ancho de pecho</th>
              <th>Largo</th>
            </tr>
          </thead>
          <tbody>
            {SIZES[cut].map(([s, chest, len]) => (
              <tr key={s} className={size === s ? 'is-on' : ''}>
                <td>{s}</td>
                <td>{chest} cm</td>
                <td>{len} cm</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="help">Medidas del jersey en cm, prenda extendida. Referencia de ejemplo.</p>
      <label className="field" htmlFor="inNotes">
        <span className="label">Comentarios (opcional)</span>
        <textarea id="inNotes" rows={3} maxLength={500} value={notes} placeholder="Algo que debamos saber de tu diseño…" onChange={(e) => set({ notes: e.target.value })} />
      </label>
      <div className="field qty">
        <span className="label">Piezas</span>
        <div className="stepper">
          <button type="button" aria-label="Menos" onClick={() => set({ qty: Math.max(1, qty - 1) })}>
            −
          </button>
          <output>{qty}</output>
          <button type="button" aria-label="Más" onClick={() => set({ qty: Math.min(50, qty + 1) })}>
            +
          </button>
        </div>
      </div>
      <div className="team-box">
        <strong>¿Es para tu equipo?</strong>
        <span>Para varios jerseys o pedidos especiales, manda tu diseño a cotizar y te contactamos.</span>
        <button type="button" className="ghost" onClick={() => onQuote && onQuote()}>
          Mandar a cotizar
        </button>
      </div>
    </>
  );
}
