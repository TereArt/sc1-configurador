import { Component, useEffect, useRef, useState } from 'react';
import { useStore, glRef } from './store.js';
import Scene from './components/Scene.jsx';
import { CutPane, DesignPane, ColorPane, LogosPane, NamePane, SizePane } from './components/Panes.jsx';
import { paint } from './lib/texture.js';
import { PATTERNS as TEMPLATES } from './lib/patterns.js';
import { FONTS, printSVG, DEFAULT_ATLAS } from './lib/compose.js';
import { CUTS } from './lib/geometry.js';
import { PRICE_MXN, MODELS, MODEL_CREDITS, QUOTE_EMAIL } from './lib/config.js';
import { proceduralGarment, loadGlbGarment } from './lib/garment.js';
import { exampleItems } from './lib/examples.js';
import { editor, HANDLES } from './lib/editor.js';
import { money, designConfig, designCode, printPreview, snapshot, sendToWix, sendQuote } from './lib/order.js';

const STEPS = ['Corte', 'Diseño', 'Colores', 'Logos', 'Nombre', 'Pedido'];
const PANES = [CutPane, DesignPane, ColorPane, LogosPane, NamePane, SizePane];
const LAST = STEPS.length - 1;
const PAINT_KEYS = ['garment', 'template', 'colors', 'name', 'number', 'font', 'textColor', 'outline', 'logo', 'logoPos', 'logoSize', 'logoXY', 'logoSX', 'logoSY', 'selKey', 'hoverKey', 'sleeveLeft', 'sleeveRight', 'sponsors', 'fontsVersion'];

// Repinta la textura cuando cambia algo del diseño (una vez por cuadro)
// Jersey inicial con logos de ejemplo (escudo y marcas genéricas) para que el cliente vea dónde van las suyas
function useExamples() {
  useEffect(() => {
    exampleItems().then((ex) => {
      const st = useStore.getState();
      if (st.examplesDone) return;
      st.set({ examplesDone: true, ...(st.logo ? {} : { logo: ex.logo }), ...(st.sponsors.length ? {} : { sponsors: ex.sponsors }) });
    });
  }, []);
}

function usePainter() {
  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const st = useStore.getState();
        paint(st, st.garment);
      });
    };
    schedule();
    const unsub = useStore.subscribe((s, prev) => {
      if (PAINT_KEYS.some((k) => s[k] !== prev[k])) schedule();
    });
    // fuentes web: repintar cuando terminen de cargar
    if (document.fonts) {
      const bump = () => useStore.setState((s) => ({ fontsVersion: s.fontsVersion + 1 }));
      const loads = FONTS.map((f) => document.fonts.load(`${f.weight} 80px ${f.css.split(',')[0]}`)).concat(document.fonts.load("700 70px 'Chakra Petch'"));
      Promise.allSettled(loads).then(bump);
      document.fonts.ready.then(bump);
    }
    return () => {
      unsub();
      cancelAnimationFrame(raf);
    };
  }, []);
}

class SceneBoundary extends Component {
  constructor(p) {
    super(p);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error)
      return <p className="note stage-error">No se pudo mostrar la vista 3D en este navegador. Puedes seguir diseñando y revisar el archivo de impresión.</p>;
    return this.props.children;
  }
}

function StageStatus() {
  const status = useStore((s) => s.garmentStatus);
  const err = useStore((s) => s.garmentError);
  const custom = useStore((s) => s.customModel);
  const cut = useStore((s) => s.cut);
  const credit = custom ? null : MODEL_CREDITS[cut];
  return (
    <>
      {status === 'loading' && <div className="stage-status">Cargando modelo 3D…</div>}
      {err && <div className="stage-status is-error">{err}</div>}
      {credit && <div className="stage-credit">{credit}</div>}
    </>
  );
}

function DiagBox() {
  const diag = useStore((s) => s.diag);
  const set = useStore((s) => s.set);
  if (!diag) return null;
  return (
    <div className="diag" role="status">
      <b>La vista 3D reportó un error. Toma una captura de este cuadro y envíala.</b>
      <pre>{JSON.stringify(diag, null, 1)}</pre>
      <button type="button" className="link" onClick={() => set({ diag: null })}>Cerrar</button>
    </div>
  );
}

// Carga la prenda 3D: .glb del usuario > .glb configurado por corte > modelo procedural
function useGarment() {
  const cut = useStore((s) => s.cut);
  const custom = useStore((s) => s.customModel);
  const set = useStore((s) => s.set);
  useEffect(() => {
    let alive = true;
    const url = custom ? custom.url : MODELS[cut];
    if (!url) {
      set({ garment: proceduralGarment(cut), garmentStatus: 'ready', garmentError: null });
      return;
    }
    set({ garmentStatus: 'loading', garmentError: null });
    loadGlbGarment(url)
      .then((g) => {
        if (!alive) return;
        window.__sc1atlas = g.atlas; window.__sc1g = { mapping: g.mapping, halfW: g.halfW, detected: g.detected };
        set({ garment: g, garmentStatus: 'ready' });
      })
      .catch((e) => {
        if (!alive) return;
        console.warn('modelo .glb', e);
        set({ garment: proceduralGarment(cut), garmentStatus: 'error', garmentError: 'No se pudo abrir el modelo. Se muestra el modelo base.' });
      });
    return () => {
      alive = false;
    };
  }, [cut, custom, set]);
}

// Recuadro de selección: se deforma el logo desde cualquier esquina u orilla (Shift = sin deformar)
function SelectionOverlay() {
  const selKey = useStore((s) => s.selKey);
  const set = useStore((s) => s.set);
  const moveItem = useStore((s) => s.moveItem);
  return (
    <>
      <svg className="sel-overlay" ref={(el) => (editor.svg = el)} style={{ display: 'none' }} aria-hidden="true">
        <polygon className="sel-line" points="" />
        {HANDLES.map((h) => (
          <circle key={h} data-h={h} className={'sel-h h-' + h} r={h.length === 2 ? 8 : 6.5} onPointerDown={(e) => editor.startResize && editor.startResize(h, e)} />
        ))}
      </svg>
      <div className="sel-bar" ref={(el) => (editor.bar = el)} style={{ display: 'none' }}>
        <span className="sel-tag">Vista de referencia</span>
        <button type="button" onClick={() => selKey && moveItem(selKey, { sx: 1, sy: 1 })}>
          Proporción original
        </button>
        <button type="button" onClick={() => set({ selKey: null })}>
          Listo
        </button>
      </div>
    </>
  );
}

function Stage() {
  const view = useStore((s) => s.view);
  const spin = useStore((s) => s.spin);
  const showView = useStore((s) => s.showView);
  const set = useStore((s) => s.set);
  const template = useStore((s) => s.template);
  const t = TEMPLATES.find((x) => x.id === template);
  const cut = useStore((s) => s.cut);
  const step = useStore((s) => s.step);
  const moveHint = useStore((s) => s.moveHint);
  const logosStep = step === 3;
  return (
    <section className="stage" aria-label="Vista 3D del jersey">
      {logosStep && moveHint && (
        <div className="move-toast" role="status">
          <span className="move-ico" aria-hidden="true">
            ✥
          </span>
          <div>
            <strong>Puedes mover los logos libremente</strong>
            <span>Toca un logo para seleccionarlo y arrástralo a donde quieras. Jala sus esquinas u orillas para agrandarlo, achicarlo o deformarlo (Shift = sin deformar). Agrega logos de patrocinadores en el panel.</span>
            <em>Vista de referencia: con base en tu diseño te enviamos la representación oficial.</em>
          </div>
          <button type="button" className="chip" onClick={() => set({ moveHint: false })}>
            Entendido
          </button>
        </div>
      )}
      <SceneBoundary>
        <Scene />
      </SceneBoundary>
      <DiagBox />
      <StageStatus />
      <SelectionOverlay />
      <div className="stage-tag">
        {t.name} · {CUTS[cut].label}
      </div>
      <div className="stage-hud">
        <div className="view-btns" role="group" aria-label="Vista">
          <button type="button" className={'chip' + (!spin && view === 'frente' ? ' is-on' : '')} onClick={() => showView('frente')}>
            Frente
          </button>
          <button type="button" className={'chip' + (!spin && view === 'espalda' ? ' is-on' : '')} onClick={() => showView('espalda')}>
            Espalda
          </button>
          <button type="button" className={'chip' + (spin ? ' is-on' : '')} aria-pressed={spin} onClick={() => set({ spin: !spin, view: null })}>
            Girar
          </button>
        </div>
        <p className="hint">{logosStep ? 'Arrastra un logo para moverlo · arrastra la tela para girar' : 'Arrastra para girar · rueda o pellizca para acercar'}</p>
      </div>
    </section>
  );
}

function BuyBar() {
  const s = useStore();
  const t = TEMPLATES.find((x) => x.id === s.template);
  const line = `${t.name} · ${CUTS[s.cut].label} · ${s.size ? 'Talla ' + s.size : 'Sin talla'}${s.qty > 1 ? ' · ' + s.qty + ' piezas' : ''}`;

  const addToCart = async () => {
    if (!s.size) {
      s.goStep(LAST);
      s.set({ sizeNudge: s.sizeNudge + 1 });
      return;
    }
    await paint(useStore.getState(), useStore.getState().garment);
    const cfg = designConfig(s);
    const code = designCode(cfg);
    const preview = snapshot(glRef.current);
    const sent = sendToWix({ code, ...cfg, preview });
    s.set({ modal: { kind: 'cart', data: { cfg, code, preview, sent } } });
  };

  return (
    <footer className="buy">
      <div className="sum">
        <div className="sum-line">{!s.size && s.sizeNudge ? 'Elige tu talla para continuar' : line}</div>
        <div className="price">
          {money(PRICE_MXN * s.qty)} <small>MXN</small>
        </div>
      </div>
      <div className="buy-actions">
        {s.step === LAST ? (
          <button type="button" className="ghost" onClick={openQuote}>
            Mandar a cotizar
          </button>
        ) : (
        <button
          type="button"
          className="ghost"
          onClick={async () => {
            const st = useStore.getState();
            await paint(st, st.garment);
            const svg = printSVG(st, (st.garment && st.garment.atlas) || DEFAULT_ATLAS);
            s.set({ modal: { kind: 'print', data: { img: printPreview(), svg, code: designCode(designConfig(st)) } } });
          }}
        >
          Archivo de impresión
        </button>
        )}
        <button type="button" className="cta" onClick={() => (s.step < LAST ? s.goStep(s.step + 1) : addToCart())}>
          {s.step < LAST ? 'Siguiente' : 'Agregar al carrito'}
        </button>
      </div>
    </footer>
  );
}

// Abre el formulario de cotización (equipos)
export async function openQuote() {
  const st = useStore.getState();
  await paint(st, st.garment);
  const cfg = designConfig(st);
  st.set({ modal: { kind: 'quote', data: { cfg, code: designCode(cfg), preview: snapshot(glRef.current) } } });
}

const FIELDS = [
  ['equipo', 'Nombre del equipo', 'text', 'Ej. Orochi Esports', true],
  ['nombre', 'Tu nombre', 'text', 'Nombre y apellido', true],
  ['telefono', 'Número de contacto', 'tel', '10 dígitos', true],
  ['correo', 'Correo', 'email', 'tucorreo@ejemplo.com', true],
  ['piezas', 'Piezas aproximadas', 'number', 'Ej. 12', false],
];

function QuoteForm({ data }) {
  const set = useStore((s) => s.set);
  const notes = useStore((s) => s.notes);
  const [form, setForm] = useState({ equipo: '', nombre: '', telefono: '', correo: '', piezas: '', descripcion: notes || '' });
  const [err, setErr] = useState({});
  const [done, setDone] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    const bad = {};
    for (const [k, , , , req] of FIELDS) if (req && !String(form[k]).trim()) bad[k] = 'Obligatorio';
    if (form.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.correo)) bad.correo = 'Correo no válido';
    if (form.telefono && form.telefono.replace(/\D/g, '').length < 10) bad.telefono = 'Mínimo 10 dígitos';
    setErr(bad);
    if (Object.keys(bad).length) return;
    const st = useStore.getState();
    const svg = printSVG(st, (st.garment && st.garment.atlas) || DEFAULT_ATLAS);
    const payload = { contacto: form, codigo: data.code, diseno: data.cfg, preview: data.preview, archivoSVG: svg };
    const sent = sendQuote(payload);
    let mail = null;
    if (!sent && QUOTE_EMAIL) {
      const body = `Equipo: ${form.equipo}\nNombre: ${form.nombre}\nTeléfono: ${form.telefono}\nCorreo: ${form.correo}\nPiezas: ${form.piezas || '—'}\nCódigo de diseño: ${data.code}\n\n${form.descripcion}\n\nConfiguración:\n${JSON.stringify(data.cfg, null, 2)}`;
      mail = `mailto:${QUOTE_EMAIL}?subject=${encodeURIComponent('Cotización jersey · ' + form.equipo + ' · ' + data.code)}&body=${encodeURIComponent(body)}`;
      window.location.href = mail;
    }
    set({ notes: form.descripcion });
    setDone({ sent, mail, payload });
  };
  if (done)
    return (
      <>
        <p className="note">
          {done.sent
            ? '¡Listo! Recibimos tu diseño. El equipo de SC1 te contactará para cotizar.'
            : done.mail
              ? 'Se abrió tu correo con la cotización lista para enviar.'
              : 'Demo: en sc1.gg estos datos le llegan a SC1 junto con el diseño y el archivo de impresión.'}
        </p>
        {!done.sent && <pre className="code">{JSON.stringify({ ...done.payload, preview: '(imagen)', archivoSVG: '(archivo SVG)' }, null, 2)}</pre>}
      </>
    );
  const f = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  return (
    <form className="quote" onSubmit={submit} noValidate>
      <p className="help">Para equipos y pedidos grandes: déjanos tus datos y te mandamos precio. Tu diseño ({data.code}) va incluido{data.cfg.vectorizacionProfesional ? ', y nuestro equipo vectoriza tus logos a mano sin costo' : ''}.</p>
      <div className="quote-grid">
        {FIELDS.map(([k, label, type, ph]) => (
          <label key={k} className="field" htmlFor={'q' + k}>
            <span className="label">{label}</span>
            <input id={'q' + k} type={type} value={form[k]} placeholder={ph} autoComplete={k === 'correo' ? 'email' : k === 'telefono' ? 'tel' : k === 'nombre' ? 'name' : 'off'} min={type === 'number' ? 1 : undefined} onChange={(e) => f(k, e.target.value)} aria-invalid={!!err[k]} />
            {err[k] && <span className="err">{err[k]}</span>}
          </label>
        ))}
      </div>
      <p className="note official-note">Tu diseño es una representación de referencia (lugar y tamaño de logos). Con base en él te enviamos la representación oficial para aprobarla.</p>
      <label className="field" htmlFor="qdesc">
        <span className="label">Describe tu diseño</span>
        <textarea id="qdesc" rows={4} value={form.descripcion} placeholder="Colores, logos, patrocinadores, tallas por jugador, fecha en que los necesitas…" onChange={(e) => f('descripcion', e.target.value)} />
      </label>
      <button type="submit" className="cta">
        Enviar a cotizar
      </button>
    </form>
  );
}

function Modal() {
  const modal = useStore((s) => s.modal);
  const set = useStore((s) => s.set);
  const closeRef = useRef();
  useEffect(() => {
    if (!modal) return;
    closeRef.current && closeRef.current.focus();
    const onKey = (e) => e.key === 'Escape' && set({ modal: null });
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modal, set]);
  if (!modal) return null;
  const close = () => set({ modal: null });

  let title = '';
  let body = null;
  if (modal.kind === 'print') {
    title = 'Archivo de impresión';
    body = (
      <>
        <img className="print-img" src={modal.data.img} alt="Archivo de impresión: frente, espalda y mangas del jersey" />
        <p className="print-legend">
          <span>Arriba izq.: frente</span>
          <span>Arriba der.: espalda</span>
          <span>Abajo: mangas</span>
        </p>
        <p className="note">
          Esto es lo que recibe el taller al pagar: cada pieza plana con el diseño en vectores, el gamertag, los logos y el patrocinador. Código de diseño: <b>{modal.data.code}</b>
        </p>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            const blob = new Blob([modal.data.svg], { type: 'image/svg+xml' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `${modal.data.code}.svg`;
            document.body.append(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
          }}
        >
          Descargar archivo en vectores (SVG)
        </button>
      </>
    );
  } else if (modal.kind === 'quote') {
    title = 'Mandar a cotizar';
    body = <QuoteForm data={modal.data} />;
  } else {
    const { cfg, code, preview, sent } = modal.data;
    const t = TEMPLATES.find((x) => x.id === cfg.plantilla);
    title = sent ? 'Agregado al carrito' : 'Listo para el carrito';
    body = (
      <>
        <div className="order">
          {preview && <img src={preview} alt="Vista de tu jersey" />}
          <dl>
            <dt>Diseño</dt>
            <dd>{t.name}</dd>
            <dt>Corte</dt>
            <dd>{CUTS[cfg.corte].label}</dd>
            <dt>Talla</dt>
            <dd>{cfg.talla}</dd>
            <dt>Nombre</dt>
            <dd>{cfg.nombre || '—'}</dd>
            <dt>Número</dt>
            <dd>{cfg.numero || '—'}</dd>
            <dt>Piezas</dt>
            <dd>{cfg.piezas}</dd>
            <dt>Total</dt>
            <dd>{money(PRICE_MXN * cfg.piezas)} MXN</dd>
            <dt>Código</dt>
            <dd>{code}</dd>
            {cfg.notas && (
              <>
                <dt>Notas</dt>
                <dd>{cfg.notas}</dd>
              </>
            )}
          </dl>
        </div>
        <p className="note official-note">Lo que ves es una representación de dónde y de qué tamaño quieres tus logos. Con base en tu diseño, nuestro equipo te envía la representación oficial para que la apruebes antes de producir.</p>
        {cfg.vectorizacionProfesional && <p className="note vec-note">Incluye vectorización profesional de tus logos: nuestro equipo de diseño los redibuja a mano antes de imprimir.</p>}
        <p className="note">
          {sent
            ? 'Tu jersey ya está en el carrito de sc1.gg.'
            : 'En sc1.gg este botón agrega el jersey al carrito de Wix con estos datos, y el taller recibe el archivo de impresión al confirmarse el pago.'}
        </p>
        <pre className="code">{JSON.stringify({ ...cfg, code }, null, 2)}</pre>
      </>
    );
  }
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="modal-card">
        <button type="button" className="modal-x" aria-label="Cerrar" ref={closeRef} onClick={close}>
          ×
        </button>
        <h2 id="modalTitle">{title}</h2>
        {body}
      </div>
    </div>
  );
}

export default function App() {
  useGarment();
  usePainter();
  useExamples();
  const step = useStore((s) => s.step);
  const goStep = useStore((s) => s.goStep);
  const paneRef = useRef();
  const Pane = PANES[step];
  useEffect(() => {
    if (paneRef.current) paneRef.current.scrollTop = 0;
  }, [step]);
  return (
    <>
      <div className="app">
        <header className="top">
          <div className="brand">
            <span className="brand-mark">SC1</span>
            <span className="brand-sub">Score One · Jersey Lab</span>
          </div>
          <div className="top-meta">Diseña tu jersey y míralo en 3D antes de comprar</div>
        </header>
        <Stage />
        <aside className="panel" aria-label="Opciones de personalización">
          <nav className="steps" role="tablist" aria-label="Pasos">
            {STEPS.map((label, i) => (
              <button key={label} type="button" role="tab" aria-selected={step === i} className={'step' + (step === i ? ' is-on' : '') + (i < step ? ' done' : '')} onClick={() => goStep(i)}>
                <b>{i + 1}</b>
                {label}
              </button>
            ))}
          </nav>
          <div className="pane-wrap" ref={paneRef}>
            <section className="pane is-on">
              <Pane onQuote={openQuote} />
            </section>
          </div>
          <BuyBar />
        </aside>
      </div>
      <Modal />
    </>
  );
}
