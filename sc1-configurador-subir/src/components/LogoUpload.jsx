import { useState } from 'react';
import { useStore } from '../store.js';
import { vectorizeImage, readLogoFile, sampleLogoPhoto, VEC_STYLES } from '../lib/vectorize.js';

const cx = (...c) => c.filter(Boolean).join(' ');
const DEFAULT_VEC = { colors: 4, removeBg: true, style: 'color' };
const COLOR_OPTS = [2, 3, 4, 6, 8];

// Convierte la foto y arma el objeto logo que usa el configurador
async function toVector(original, vec, ink) {
  const v = await vectorizeImage(original.img, { ...vec, ink });
  return { img: v.img, name: original.name, svg: v.svg, original, vec, bgRemoved: v.bgRemoved };
}

// Subir logo (PNG, JPG, foto de celular o SVG). Las fotos se convierten solas a logo vectorial.
export default function LogoUpload({ id, value, onChange, hint = 'Subir logo (foto, PNG o SVG)' }) {
  const ink = useStore((s) => s.textColor);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async (original, vec) => {
    setBusy(true);
    setErr(null);
    try {
      onChange(await toVector(original, vec, ink));
    } catch (e) {
      setErr(e.message || 'No se pudo convertir');
      onChange({ img: original.img, name: original.name, svg: null, original, vec, raw: true });
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (file) => {
    if (!file) return;
    setErr(null);
    try {
      const r = await readLogoFile(file);
      if (r.isSvg) onChange({ img: r.img, name: r.name, svg: r.svg });
      else await run({ img: r.img, name: r.name }, DEFAULT_VEC);
    } catch (e) {
      setErr(e.message);
    }
  };

  const clear = () => {
    onChange(null);
    const i = document.getElementById(id);
    if (i) i.value = '';
  };

  const vec = (value && value.vec) || DEFAULT_VEC;
  const change = (patch) => value && value.original && run(value.original, { ...vec, ...patch });

  return (
    <div className="logo-up">
      <div className="row2">
        <label className="upload" htmlFor={id}>
          <input id={id} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => onFile(e.target.files && e.target.files[0])} />
          <span>{busy ? 'Convirtiendo a vector…' : err ? err : value && !value.demo ? value.name : hint}</span>
        </label>
        {value && !value.demo ? (
          <button type="button" className="ghost" onClick={clear}>
            Quitar
          </button>
        ) : (
          <button type="button" className="ghost" disabled={busy} onClick={async () => run(await sampleLogoPhoto(), DEFAULT_VEC)}>
            Probar con foto de ejemplo
          </button>
        )}
      </div>
      {value && value.demo && <p className="help">Logo de ejemplo: sube el tuyo para reemplazarlo.</p>}
      {value && value.original && (
        <div className={cx('vec-card', busy && 'is-busy')}>
          <div className="vec-compare">
            <figure>
              <img src={value.original.img.src} alt="Foto original" />
              <figcaption>Tu foto</figcaption>
            </figure>
            <span className="vec-arrow" aria-hidden="true">
              →
            </span>
            <figure className="checker">
              <img src={value.raw ? value.original.img.src : value.img.src} alt="Logo convertido a vector" />
              <figcaption>{value.raw ? 'Foto sin convertir' : 'Vector SC1'}</figcaption>
            </figure>
          </div>
          {!value.raw && (
            <>
              <div className="vec-row">
                <span className="help">Colores</span>
                <div className="seg" role="group" aria-label="Número de colores">
                  {COLOR_OPTS.map((n) => (
                    <button key={n} type="button" className={vec.colors === n ? 'is-on' : ''} aria-pressed={vec.colors === n} onClick={() => change({ colors: n })}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="vec-row">
                <span className="help">Estilo</span>
                <div className="seg" role="group" aria-label="Estilo del logo">
                  {VEC_STYLES.map(([k, l]) => (
                    <button key={k} type="button" className={vec.style === k ? 'is-on' : ''} aria-pressed={vec.style === k} onClick={() => change({ style: k })}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <label className="toggle">
                <input type="checkbox" checked={vec.removeBg} onChange={(e) => change({ removeBg: e.target.checked })} />
                <span>Quitar fondo automáticamente</span>
              </label>
            </>
          )}
          <p className="help">
            {value.raw ? 'Se usa tu foto tal cual. ' : 'Conversión automática para verlo al instante. '}
            <b>Al comprar o cotizar, nuestro equipo de diseño lo vectoriza a mano sin costo</b> para la impresión final.
          </p>
          <button type="button" className="link" onClick={() => (value.raw ? run(value.original, vec) : onChange({ img: value.original.img, name: value.name, svg: null, original: value.original, vec, raw: true }))}>
            {value.raw ? 'Convertir a vector' : 'Usar mi foto sin convertir'}
          </button>
        </div>
      )}
    </div>
  );
}
