// Enlace entre el visor 3D (Scene) y el recuadro de selección dibujado encima (Stage):
// el visor mueve el recuadro cada cuadro; el recuadro avisa cuando el cliente toma una esquina.
export const editor = {
  svg: null, // <svg> del recuadro
  bar: null, // barra de acciones sobre el recuadro
  startResize: null, // (handle, pointerEvent) => void   (lo pone el visor)
};
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
