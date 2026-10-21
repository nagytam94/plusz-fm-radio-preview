import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Csak a weboldal erőforrásai kerülnek a GitHub Pages által kiszolgált docs-ba.
// A projektkártya, tesztek és a helyi dokumentáció nem részei az oldalnak.
const root = new URL('../', import.meta.url);
const files = [
  'index.html', 'styles.css', 'app.js', 'player.js', 'schedule.js',
  'assets/logo.svg', 'assets/favicon.svg', 'assets/on-air.jpg',
  'assets/studio.jpg', 'assets/concert.jpg', 'assets/headphones.jpg',
  'assets/inter-latin.woff2', 'assets/inter-latin-ext.woff2', 'assets/Inter-OFL.txt',
];
for (const file of files) {
  const target = new URL(`docs/${file}`, root);
  await mkdir(new URL('./', target), { recursive: true });
  await copyFile(new URL(file, root), target);
}
await writeFile(new URL('docs/.nojekyll', root), '');
console.log(`GitHub Pages csomag: ${files.length + 1} fájl, ${fileURLToPath(new URL('docs/', root))}`);
