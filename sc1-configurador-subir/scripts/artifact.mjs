// Genera dist-artifact/artifact.html (sin <html>/<head>/<body>) para publicar la demo en Claude.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const html = readFileSync('dist-artifact/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1].replace(/<meta[^>]*>/g, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
writeFileSync('dist-artifact/artifact.html', head.trim() + '\n' + body.trim() + '\n');
console.log(readFileSync('dist-artifact/artifact.html', 'utf8'));

// la demo no acepta .glb: se publican en base64 como texto
for (const f of readdirSync('dist-artifact/models')) {
  if (f.endsWith('.glb')) writeFileSync('dist-artifact/models/' + f.replace('.glb', '.b64.txt'), readFileSync('dist-artifact/models/' + f).toString('base64'));
}
