// Diagnóstico: guarda errores de consola y del renderer para mostrarlos si el jersey no aparece.
export const diagLog = [];
const push = (level, args) => {
  try {
    const msg = args.map((a) => (a instanceof Error ? a.message : typeof a === 'object' ? JSON.stringify(a)?.slice(0, 300) : String(a))).join(' ');
    diagLog.push(`[${level}] ${msg}`.slice(0, 600));
    if (diagLog.length > 40) diagLog.shift();
  } catch (e) {}
};
for (const level of ['error', 'warn']) {
  const orig = console[level].bind(console);
  console[level] = (...a) => {
    push(level, a);
    orig(...a);
  };
}
window.addEventListener('error', (e) => push('onerror', [e.message]));
window.addEventListener('unhandledrejection', (e) => push('promise', [e.reason]));
