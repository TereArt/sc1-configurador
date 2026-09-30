// Logos de ejemplo del jersey inicial: muestran al cliente dónde irán SU escudo y SUS marcas.
// Son diseños genéricos de SC1 (no marcas reales); el cliente los reemplaza con los suyos.
const CREST = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="440" viewBox="0 0 200 220">
<path d="M100 8 L184 34 L178 120 Q168 176 100 212 Q32 176 22 120 L16 34 Z" fill="#0f1830" stroke="#e3b23c" stroke-width="9" stroke-linejoin="round"/>
<path d="M108 36 L64 112 L94 112 L80 170 L138 88 L106 88 L124 36 Z" fill="#e3b23c"/>
<rect x="10" y="118" width="180" height="40" rx="4" fill="#d7263d"/>
<text x="100" y="146" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="26" fill="#ffffff" letter-spacing="1">TU LOGO</text>
</svg>`;

const BRAND = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="200" viewBox="0 0 360 100">
<polygon points="40,10 72,28 72,64 40,82 8,64 8,28" fill="none" stroke="#2f6bff" stroke-width="9"/>
<polygon points="40,30 56,39 56,57 40,66 24,57 24,39" fill="#ffffff"/>
<text x="90" y="63" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="40" fill="#ffffff" letter-spacing="1">TU MARCA</text>
<rect x="92" y="74" width="250" height="6" fill="#2f6bff"/>
</svg>`;

const BADGE = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 200 100">
<rect x="5" y="5" width="190" height="90" rx="14" fill="#ffffff"/>
<circle cx="45" cy="50" r="24" fill="#0b0d12"/><path d="M34 50 L45 36 L56 50 L45 64 Z" fill="#e3b23c"/>
<text x="80" y="46" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="20" fill="#0b0d12">TU</text>
<text x="80" y="70" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="20" fill="#0b0d12">MARCA</text>
</svg>`;

function load(svg, name) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ img, name, svg, demo: true });
    img.onerror = () => res(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

export async function exampleItems() {
  const [crest, brand, badge] = await Promise.all([load(CREST, 'ejemplo-escudo.svg'), load(BRAND, 'ejemplo-marca.svg'), load(BADGE, 'ejemplo-marca-2.svg')]);
  return {
    logo: crest,
    sponsors: [
      { id: 'ej1', kind: 'logo', text: '', logo: brand, pos: 'pecho', demo: true },
      { id: 'ej2', kind: 'text', text: 'TU PATROCINADOR', logo: null, pos: 'espalda', demo: true },
      { id: 'ej3', kind: 'logo', text: '', logo: badge, pos: 'mangaDer', demo: true },
    ],
  };
}

export const isDemoState = (st) => (st.logo && st.logo.demo) || (st.sponsors || []).some((x) => x.demo);
