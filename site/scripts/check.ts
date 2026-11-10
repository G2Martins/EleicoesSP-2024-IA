// Post-build smoke check (npm run check, also part of build:pages). Exits 1 on any failure.
// SEO essentials, honesty banners, prerendered sections, downloads, no em dash, and TS-vs-sklearn parity.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { predict, type VoteModel, type Voter } from '../src/app/model.ts';

const SITE = 'https://g2martins.github.io/EleicoesSP-2024-IA/';
const root = new URL('../dist/eleicoes/browser/', import.meta.url);
const read = (u: URL) => readFileSync(u, 'utf8');
const fails: string[] = [];
const must = (ok: unknown, msg: string) => ok || fails.push(msg);

// 1. Model parity: TypeScript softmax vs sklearn predict_proba saved by export_model.py.
const model = JSON.parse(read(new URL('../src/app/data/model.json', import.meta.url))) as VoteModel;
const fixtures = JSON.parse(read(new URL('../src/app/data/fixtures.json', import.meta.url))) as { x: Voter; proba: number[] }[];
let worst = 0;
for (const f of fixtures) predict(model, f.x).forEach((p, k) => (worst = Math.max(worst, Math.abs(p - f.proba[k]))));
must(fixtures.length >= 20, `only ${fixtures.length} fixtures`);
must(worst <= 1e-6, `parity: max |TS - sklearn| = ${worst}`);

// 2. The one prerendered page.
const h = read(new URL('index.html', root));
must((h.match(/<h1[\s>]/g) ?? []).length === 1, 'expected exactly one <h1>');
must(h.includes(`<link rel="canonical" href="${SITE}">`), 'canonical mismatch');
must(/<meta name="description" content="[^"]{70,}/.test(h), 'description missing/short');
must(h.includes('Projeto de portfólio de Gustavo Martins Gripaldi'), 'disclaimer missing');
must(h.includes('Modelo educacional treinado com dados fictícios; não é previsão eleitoral.'), 'fictitious-data banner missing');
must(h.includes('Desenvolvido por Gustavo Martins Gripaldi'), 'footer credit missing');
must(h.includes('https://github.com/G2Martins/EleicoesSP-2024-IA'), 'repo link missing');
for (const id of ['visao-geral', 'dashboard', 'modelo', 'simulador', 'dados', 'limitacoes']) must(h.includes(`id="${id}"`), `section #${id} missing`);
must(/data-testid="p1"[^>]*>\s*\d+,\d%/.test(h), 'predictor output not prerendered');
try {
  const ld = h.match(/<script id="ld-json" type="application\/ld\+json">(.*?)<\/script>/s)?.[1];
  const types = (JSON.parse(ld ?? '')['@graph'] as { '@type': string }[]).map((n) => n['@type']);
  for (const t of ['WebSite', 'SoftwareSourceCode']) must(types.includes(t), `${t} JSON-LD missing`);
  must(!types.includes('Dataset'), 'fictitious data must not be published as a schema.org Dataset');
} catch { fails.push('invalid JSON-LD'); }

// 3. Downloads listed on the page exist, with the advertised size and "ficticio" in the name.
const eda = JSON.parse(read(new URL('../src/app/data/eda.json', import.meta.url))) as { downloads: { file: string; bytes: number }[] };
for (const d of eda.downloads) {
  const f = new URL(`data/${d.file}`, root);
  must(d.file.includes('ficticio'), `download ${d.file} must say "ficticio" in the name`);
  must(existsSync(f) && statSync(f).size === d.bytes, `download ${d.file} missing or size changed (run npm run model)`);
  must(h.includes(`href="data/${d.file}"`), `download link ${d.file} not on page`);
}

// 4. No em dash in anything a visitor can read or download.
const walk = (dir: URL): URL[] => readdirSync(dir).flatMap((n) => {
  const p = new URL(n, dir);
  return statSync(p).isDirectory() ? walk(new URL(`${n}/`, dir)) : [p];
});
for (const f of walk(root).filter((f) => /\.(html|js|json|txt|xml|csv|webmanifest)$/.test(f.pathname) && !f.pathname.endsWith('3rdpartylicenses.txt'))) {
  must(!read(f).includes(String.fromCharCode(0x2014)), `em dash in ${f.pathname.split('/browser/')[1]}`);
}
for (const f of ['robots.txt', 'sitemap.xml', 'site.webmanifest', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'og/eleicoes.png'])
  must(existsSync(new URL(f, root)), `missing /${f}`);

if (fails.length) { console.error(`check: ${fails.length} problem(s)\n- ` + [...new Set(fails)].join('\n- ')); process.exit(1); }
console.log(`check: page OK, ${eda.downloads.length} downloads OK, no em dash, parity OK (max diff ${worst.toExponential(2)} over ${fixtures.length} fixtures)`);
