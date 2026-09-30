// Empaqueta el prototipo en un solo HTML (sin dependencias externas salvo Google Fonts).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const order = ['geometry', 'templates', 'compose', 'config', 'renderer', 'app'];
const js = order
  .map((f) => `// ---- ${f}.js ----\n` + readFileSync(`src/${f}.js`, 'utf8')
    .replace(/^import[\s\S]*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^export\s+(?=(const|function|class|let)\b)/gm, ''))
  .join('\n');
const css = readFileSync('src/styles.css', 'utf8');
const body = readFileSync('src/body.html', 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Audiowide&family=Barlow:wght@400;500;600&family=Chakra+Petch:wght@500;600;700&family=Orbitron:wght@900&family=Press+Start+2P&family=Teko:wght@600&display=swap">';
const title = '<title>SC1 Jersey Lab</title>';
const script = `<script>\n(() => {\n${js}\n})();\n</script>`;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', `${title}\n${fonts}\n<style>\n${css}\n</style>\n${body}\n${script}\n`);
writeFileSync('dist/configurador.html', `<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${title}\n${fonts}\n<style>\nbody{margin:0}\n${css}\n</style>\n</head>\n<body>\n${body}\n${script}\n</body>\n</html>\n`);
console.log('ok', (readFileSync('dist/configurador.html').length / 1024).toFixed(0) + ' KB');
