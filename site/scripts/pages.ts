// Publishes the static build to the repo-root /docs (GitHub Pages: main branch, /docs folder, base /EleicoesSP-2024-IA/).
import { cp, rm, writeFile } from 'node:fs/promises';

const dist = new URL('../dist/eleicoes/browser/', import.meta.url);
const docs = new URL('../../docs/', import.meta.url);

// ponytail: async cp on purpose: Node 22's native cpSync exits 127 silently on non-ASCII paths ("Programação").
await rm(docs, { recursive: true, force: true });
await cp(dist, docs, { recursive: true });
await writeFile(new URL('.nojekyll', docs), '');
// One-page app: any unknown URL shows the same page (canonical still points to the root).
await cp(new URL('index.html', dist), new URL('404.html', docs));
console.log('pages: site/dist/eleicoes/browser -> docs/ (+ .nojekyll, 404.html)');
