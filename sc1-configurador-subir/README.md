# SC1 Jersey Lab: prototipo del configurador 3D

Configurador de jerseys esports para sc1.gg. El cliente elige corte (hombre/mujer), diseño, colores, nombre, número, fuente, etiqueta de manga, logo y talla, y ve el jersey en 3D antes de comprar.

## Tecnología

React 18 + React Three Fiber + drei + Zustand, empaquetado con Vite en **un solo HTML** (`dist/index.html`) listo para cualquier hosting.

| Archivo | Qué hace |
| --- | --- |
| `src/lib/geometry.js` | Modelo 3D procedural del jersey (hombre y mujer) con mapa UV controlado |
| `src/lib/templates.js` | Las 12 plantillas originales (Neón, Glitch, Retro pixel, Pro) |
| `src/lib/compose.js` | Arma la textura: plantilla + nombre + número + logo. Es también el archivo de impresión |
| `src/lib/texture.js` | Textura del jersey, relieve del tejido y brillo del piso |
| `src/lib/config.js` | **Precio, paleta y tabla de tallas.** Edita aquí |
| `src/lib/order.js` | Código de diseño, foto del jersey y mensaje a Wix |
| `src/store.js` | Estado del configurador (Zustand) |
| `src/components/Scene.jsx` | Escena 3D: luces, jersey, piso, sombras y cámara |
| `src/components/Panes.jsx` | Los 5 pasos: corte, diseño, colores, nombre y talla |
| `src/App.jsx` | Estructura, barra de compra y ventanas |
| `legacy/` | Primera versión en WebGL puro, solo como referencia |

## Probar en tu computadora

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # genera dist/index.html (un solo archivo, para hosting / Wix)
npm run build:demo  # genera dist-artifact/ (HTML + JS aparte, para la demo en Claude)
```

## Valores de ejemplo que hay que reemplazar

- `PRICE_MXN = 1199` en `src/lib/config.js`: precio de ejemplo.
- `SIZES` en `src/lib/config.js`: medidas de referencia. Usa la tabla real del taller.
- Los modelos 3D son procedurales. En la fase de assets se sustituyen por los `.glb` hechos sobre el patrón de corte real, respetando la distribución de la textura descrita en `geometry.js`.

## Qué puede personalizar el cliente

1. **Corte y cuello:** hombre o mujer; cuello redondo, V o doble cuello. El modelo .glb conserva su escote original y el cuello se pinta sobre la tela siguiendo esa orilla (`src/lib/collar.js`); en cuello V se abre la tela en triángulo al frente.
2. **Diseño de la tela:** 40 diseños originales en **vectores** (SVG) en 6 familias (`src/lib/patterns.js`).
3. **Colores y tejido:** color del jersey, del diseño y del acento; color del cuello y puños; tejido Tecno Dry (malla transpirable, predeterminado), interlock liso, panal, malla o piqué (relieve en 3D, acabado mate).
4. **Logos:** logo en pecho derecho, centro o izquierdo con tamaño ajustable; en cada manga un logo, bandera o texto; patrocinador al frente (texto o logo).
5. **Gamertag** en la espalda alta, número opcional, 4 fuentes, color y contorno.
6. **Talla** y cantidad. Precio: $847 MXN (`src/lib/config.js`).

El botón **Archivo de impresión** descarga las 4 piezas planas en SVG (vectores) para el taller.

## Modelo 3D y movimiento

- `src/lib/cloth.js`: movimiento de la tela al girar. Resorte con poco amortiguamiento (estilo dramático): la tela se retrasa, se abre con la velocidad, ondea y rebota. Ajusta `K`, `C` y `DRIVE` para cambiar el estilo.
- `src/lib/garment.js`: carga modelos `.glb`. Si el mapa UV separa las piezas, pone el diseño ahí; si no, lo proyecta.
- Modelos por corte en `MODELS` (`src/lib/config.js`); en el configurador también se puede probar cualquier `.glb` desde **Corte → Modelo 3D**.
- Especificaciones para el modelador: `docs/MODELO-3D.md` y `docs/uv-guia.png`.

## Integración con Wix (sc1.gg)

sc1.gg está hecho en Wix, así que el configurador se integra así:

1. **Publica** `dist/index.html` en un hosting estático (Netlify, Vercel, Cloudflare Pages o GitHub Pages). Por ejemplo: `https://configurador.sc1.gg`.
2. **Crea en Wix Stores** un producto "Jersey personalizado" con:
   - Opciones: `Corte` (Hombre, Mujer) y `Talla` (XS a 3XL).
   - Dos campos de texto personalizados: `Diseño` y `Nombre y número`.
3. **Inserta** en una página de Wix un elemento *Embed HTML (iframe)* en modo "Sitio web" con la URL `https://configurador.sc1.gg/?embed=1`. Ponle el ID `#configurador`.
4. **Activa Velo** (Dev Mode) y pega este código en la página:

```js
import { cart } from 'wix-stores-frontend';

const PRODUCT_ID = 'PEGA_AQUI_EL_ID_DEL_PRODUCTO';

$w.onReady(() => {
  $w('#configurador').onMessage(async (event) => {
    const d = event.data;
    if (!d || d.type !== 'sc1:add-to-cart') return;
    await cart.addProducts([
      {
        productId: PRODUCT_ID,
        quantity: d.piezas,
        options: {
          choices: { Corte: d.corte === 'mujer' ? 'Mujer' : 'Hombre', Talla: d.talla },
          customTextFields: [
            { title: 'Diseño', value: `${d.code} · ${d.plantilla}` },
            { title: 'Nombre y número', value: `${d.nombre} #${d.numero}` },
            { title: 'Notas', value: (d.notas || '').slice(0, 490) },
          ],
        },
      },
    ]);
    cart.showMiniCart();
  });
});
```

### Cotizaciones de equipos (`sc1:quote`)

El botón **Mandar a cotizar** (paso 6) envía `sc1:quote` con `contacto` (equipo, nombre, teléfono, correo, piezas, descripción), `codigo`, `diseno` (configuración completa), `preview` (PNG) y `archivoSVG`. Ejemplo para guardarlo en una colección de Wix CMS llamada `Cotizaciones` (créala con esos campos):

```js
import wixData from 'wix-data';

$w('#configurador').onMessage(async (event) => {
  const d = event.data;
  if (!d || d.type !== 'sc1:quote') return;
  await wixData.insert('Cotizaciones', {
    title: `${d.contacto.equipo} · ${d.codigo}`,
    equipo: d.contacto.equipo,
    nombre: d.contacto.nombre,
    telefono: d.contacto.telefono,
    correo: d.contacto.correo,
    piezas: Number(d.contacto.piezas) || null,
    descripcion: d.contacto.descripcion,
    codigo: d.codigo,
    diseno: JSON.stringify(d.diseno),
  });
});
```

Si el visor se usa fuera de Wix, pon un correo en `QUOTE_EMAIL` (`src/lib/config.js`) y el formulario abrirá el correo del cliente ya lleno.

El configurador envía el mensaje `sc1:add-to-cart` con toda la configuración (colores, fuente, logo, vista previa en PNG) solo cuando la URL lleva `?embed=1`.

**Por verificar en tu cuenta de Wix:** que el iframe en modo URL entregue los mensajes a `onMessage` y los nombres exactos de las opciones del producto.

## Logos: mover libremente y convertir fotos a vector

- **Paso 4 (Logos):** al entrar aparece un aviso. Al tocar un logo aparece un recuadro con 8 agarraderas que sigue la tela en 3D (también en mangas): las esquinas y orillas agrandan, achican o deforman el logo (Shift conserva la proporción); "Proporción original" lo regresa. El estiramiento viaja en el pedido (`estiramientoLogo`, `patrocinadores[].estiramiento`). La vista se presenta como referencia: SC1 envía después la representación oficial. El logo del pecho, lo de las mangas y cada patrocinador se pueden **arrastrar sobre el jersey 3D**; la rueda del mouse encima cambia el tamaño (también hay control de tamaño en el panel). Las posiciones libres viajan en el pedido (`logoLibre`, `patrocinadores[].posicion`, `tamano`).
- **Conversión inteligente** (`src/lib/vectorize.js`): cuando el cliente sube una foto o PNG, se quita el fondo, se recorta, se reduce a pocos colores (k-means perceptual + filtro de moda) y se traza a SVG con `imagetracerjs`. Puede elegir 2–8 colores, "Una tinta" o "Blanco", o usar la foto sin convertir. En el archivo de impresión el logo va como trazos vectoriales.
- Si el pedido o la cotización trae fotos convertidas, se marca `vectorizacionProfesional: true` para que el equipo de diseño lo redibuje a mano antes de imprimir.
- **Jersey inicial:** diseño SC1 Vortex con logos de ejemplo genéricos ("TU LOGO", "TU MARCA", "TU PATROCINADOR") que se editan en `src/lib/examples.js`. Van marcados como ejemplo en el pedido.

## Siguiente paso técnico

- Guardar el diseño completo (JSON + archivo de impresión en PNG y el logo) en una colección de Wix CMS o en almacenamiento propio, usando el código `SC1-XXXXXXX` como llave, para que el taller lo descargue con el pedido.
- Cuando lleguen los modelos `.glb`, cargarlos con `useGLTF` de drei en `Scene.jsx` en lugar de `buildJersey`, respetando la distribución UV de `geometry.js`.

## Diagnóstico

Si el jersey no se dibuja, a los 3 segundos aparece un recuadro con el error del renderer (tarjeta gráfica, errores de shader y consola). Sirve para depurar en cualquier equipo.
