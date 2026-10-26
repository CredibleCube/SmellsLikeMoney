import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'dist');
const output = resolve(root, 'release');
let html = await readFile(resolve(dist, 'index.html'), 'utf8');

// Copy the tested production build into one local-file-compatible document.
// It must remain self-contained: future split chunks or assets need handling here.
async function asset(url) {
  const path = resolve(dist, url.replace(/^\//, ''));
  if (relative(dist, path).startsWith(`..${sep}`)) throw new Error('Asset escapes dist/');
  return readFile(path, 'utf8');
}
const scriptTags = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)];
const styles = [...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi)];
if (scriptTags.length !== 1 || styles.length !== 1) throw new Error('Expected one bundled script and stylesheet; inspect the new build before packaging.');
const js = await asset(scriptTags[0][1]);
const css = await asset(styles[0][1]);
if (/\bimport\s*(?:\(|["'{*])/.test(js) || /@import\b|url\s*\(/i.test(css)) {
  throw new Error('External imports/assets found; standalone packaging must inline them first.');
}
html = html.replace(scriptTags[0][0], '').replace(styles[0][0], '');
html = html.replace(/<link\b[^>]*\brel="(?:icon|modulepreload)"[^>]*>/gi, '');
html = html.replace(/[\t ]+(?=\r?\n)/g, '');
html = html.replace('</head>', `<link rel="icon" href="data:,"><style>${css.replace(/<\/style/gi, '<\\/style')}</style></head>`);
html = html.replace('</body>', `<noscript>This game needs JavaScript enabled in your browser.</noscript><script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script></body>`);
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'Smells-Like-Money.html'), html);
await writeFile(resolve(output, 'OPEN-ME.txt'), [
  'SMELLS LIKE MONEY — PLAYABLE PROTOTYPE',
  '',
  'Extract this ZIP, then double-click Smells-Like-Money.html.',
  'Open it in a current desktop Chrome, Edge, Firefox, or Safari browser.',
  'If the chat preview reports a visualization or SVG error, download/extract',
  'the file and open it in your browser instead of using that preview.',
  '',
  'No installation, server, internet connection, account, or API key is needed.',
  'Choose Clock in to start. How to play reopens the instructions.',
  'All tools are click-to-start/click-to-stop; sound is optional.',
  'No mid-job saves: reloading returns to the title screen.',
  '',
  'This is a fictional outside-only game, not equipment or safety training.',
  '',
].join('\n'));
console.log(`Created release/Smells-Like-Money.html (${Buffer.byteLength(html)} bytes), with no external assets.`);
