// Datos editables por SC1: precio, paleta, tallas.
// IMPORTANTE: el precio y las medidas son valores de ejemplo. Reemplázalos con los reales del taller.

export const PRICE_MXN = 847; // precio de "Jersey Personalizable" en sc1.gg

export const PALETTE = [
  ['Negro', '#0b0d12'], ['Grafito', '#2a2f3a'], ['Gris', '#6b7280'], ['Plata', '#b8bec9'],
  ['Blanco', '#f4f5f8'], ['Azul marino', '#0f1b4d'], ['Azul rey', '#1f3fbf'], ['Azul eléctrico', '#2f6bff'],
  ['Cian', '#35e0ff'], ['Turquesa', '#14b8a6'], ['Verde neón', '#2ee6a6'], ['Lima', '#a3e635'],
  ['Verde militar', '#56663f'], ['Amarillo', '#ffd60a'], ['Dorado', '#d9a92b'], ['Naranja', '#ff7a1a'],
  ['Rojo', '#e11d2e'], ['Vino', '#7a1030'], ['Rosa neón', '#ff3da6'], ['Magenta', '#d946ef'],
  ['Morado', '#6d28d9'], ['Morado noche', '#3a1a6b'], ['Café', '#5b3a1e'], ['Arena', '#d6c7a1'],
];

// ancho de pecho y largo en cm (referencia)
export const SIZES = {
  hombre: [
    ['XS', 48, 68], ['S', 51, 70], ['M', 54, 72], ['L', 57, 74], ['XL', 60, 76], ['2XL', 63, 78], ['3XL', 66, 80],
  ],
  mujer: [
    ['XS', 43, 60], ['S', 45.5, 62], ['M', 48, 64], ['L', 50.5, 66], ['XL', 53, 68], ['2XL', 55.5, 70],
  ],
};

export const TRIMS = [
  ['c', 'Acento'],
  ['b', 'Secundario'],
  ['blanco', 'Blanco'],
  ['negro', 'Negro'],
];

// Modelos 3D profesionales (.glb) por corte. Déjalo en null para usar el modelo procedural.
// Ejemplo: hombre: './models/jersey-hombre.glb'
// (en la demo de Claude los modelos van codificados en base64 porque no acepta archivos .glb)
const DEMO = import.meta.env.MODE === 'artifact';
export const MODELS = {
  hombre: DEMO ? './models/jersey-hombre.b64.txt' : './models/jersey-hombre.glb',
  mujer: DEMO ? './models/jersey-mujer.b64.txt' : './models/jersey-mujer.glb',
};

// Crédito requerido si el modelo tiene licencia CC BY (se muestra en la esquina del visor)
export const MODEL_CREDITS = {
  hombre: 'Modelo 3D: "Men Regular Apparel Fit Sporty T-Shirt" de BINARYCLOTH · CC BY 4.0',
  mujer: 'Modelo 3D: "T-Shirt for Female" de DaaGHrii · CC BY 4.0',
};

// Cotizaciones para equipos: a dónde llegan si el visor NO está incrustado en Wix.
// En sc1.gg (incrustado) la página de Wix recibe el mensaje 'sc1:quote' (ver README).
// Si pones un correo aquí, el botón "Enviar" abre el correo del cliente ya lleno.
export const QUOTE_EMAIL = '';
