# Especificaciones del modelo 3D: SC1 Jersey Lab

Este documento es para el modelador 3D. Describe cómo entregar el jersey para que el configurador de sc1.gg le ponga los diseños, el nombre y el número automáticamente, y para que la tela se mueva al girarlo.

## Entregables

| Archivo | Descripción |
| --- | --- |
| `jersey-hombre.glb` | Corte regular, talla M |
| `jersey-mujer.glb` | Corte entallado, talla M |
| Archivos fuente | `.zprj` (CLO3D) o `.zpac` (Marvelous Designer) de cada corte |
| Patrón | DXF de las piezas, el mismo que usa el taller |

## Formato

- glTF 2.0 binario (`.glb`), **sin compresión Draco**, máximo 15 MB por archivo.
- Metros como unidad, eje **Y hacia arriba** y el **frente mirando a +Z**.
- La prenda sola, sin cuerpo ni gancho: caída natural sobre un maniquí invisible, con los brazos ligeramente separados del torso.
- Entre 30,000 y 80,000 triángulos, con normales suaves.
- La tela con grosor, de unos 2 mm, para que los bordes no se vean como papel.

## Mallas

- **Tela:** frente, espalda y mangas. Puede ser una sola malla.
- **Cuello:** malla aparte, con un nombre que contenga `cuello` o `collar`.
- **Puños:** malla aparte, con un nombre que contenga `puno` o `cuff`.

El configurador pinta el cuello y los puños con el color que elige el cliente.

## Mapa UV (lo más importante)

- Una sola textura para toda la tela.
- **Cada pieza del patrón en su propia isla UV, sin encimarse con otras piezas.**
- Ideal: acomodar las piezas en las zonas de `uv-guia.png`. El frente va al derecho con el cuello arriba, y la espalda igual, vista desde atrás.
- Si no se puede seguir la guía exacta, el visor detecta solo dónde quedó cada pieza, siempre que las piezas no se encimen.
- La forma de cada isla debe ser la de la pieza plana del patrón. Así, lo que ve el cliente coincide con lo que se imprime.

## Texturas

Todas en PNG a 2048 o 4096 px, dentro del `.glb`:

- **Normal map:** arrugas, costuras (overlock en los costados, doble aguja en la bastilla y las mangas) y tejido interlock fino.
- **Ambient occlusion horneada:** pliegues, axilas, cuello.
- **Roughness** (opcional).
- **Base color:** gris claro neutro, **sin diseño**. Si trae las arrugas horneadas en claro y oscuro, el visor las usa como sombra sobre el diseño del cliente.

## Cómo probarlo

En el configurador, en el paso **Corte → Modelo 3D → Probar un .glb**, se carga el archivo y se ve al instante con cualquier diseño, nombre y número.

## Licencia

Se requieren derechos de uso comercial sin atribución obligatoria, o con atribución indicada por escrito.
