import { ChangeDetectionStrategy, Component, afterNextRender, computed, signal } from '@angular/core';
import data from './data/model.json';
import eda from './data/eda.json';
import { VoteModel, Voter, logits, predict } from './model';

const M = data as typeof data & VoteModel;
const E = eda;

export const LINKS = {
  author: 'Gustavo Martins Gripaldi',
  portfolio: 'https://g2portfolio.grovicdata.com/',
  project: 'https://g2portfolio.grovicdata.com/projetos/eleicoes-sp-2024-ia/',
  repo: 'https://github.com/G2Martins/EleicoesSP-2024-IA',
  tse: 'https://www.tse.jus.br/comunicacao/noticias/2024/Outubro/ricardo-nunes-mdb-e-reeleito-prefeito-de-sao-paulo',
};

export const ESC = ['Fundamental', 'Médio', 'Superior', 'Pós-graduação'];
export const REG = ['Norte', 'Sul', 'Leste', 'Oeste', 'Centro'];
export const GEN = ['Masculino', 'Feminino'];
/** Candidate colors follow the class order (alphabetical, like pandas cat.codes): fixed, never cycled. */
const COLOR = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];
const ON_COLOR = ['#fff', '#fff', '#fff', 'var(--c4-ink)'];

type PresetKey = 'medio' | 'jovem' | 'pos' | 'linha0';
const first = E.table.rows[0];
const PRESETS: Record<PresetKey, Voter> = {
  medio: { Idade: Math.round(E.describe.Idade.mean), Renda: Math.round(E.describe.Renda.mean * 10) / 10, Escolaridade: 3, 'Região': 3, 'Gênero': 1 },
  jovem: { Idade: 20, Renda: 1.8, Escolaridade: 2, 'Região': 1, 'Gênero': 0 },
  pos: { Idade: 55, Renda: 9.2, Escolaridade: 4, 'Região': 5, 'Gênero': 1 },
  linha0: { Idade: first[1] as number, Renda: Math.round((first[2] as number) * 10) / 10, Escolaridade: first[3] as number, 'Região': first[4] as number, 'Gênero': first[5] as number },
};

const nf = (o: Intl.NumberFormatOptions) => new Intl.NumberFormat('pt-BR', o);
const PCT = [0, 1].map((d) => nf({ style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }));
const DEC = [0, 1, 2, 3, 4].map((d) => nf({ minimumFractionDigits: d, maximumFractionDigits: d }));
const SGN = [0, 1, 2, 3, 4].map((d) => nf({ minimumFractionDigits: d, maximumFractionDigits: d, signDisplay: 'exceptZero' }));
const INT = nf({ maximumFractionDigits: 1 });
const cmp = (x: string | number, y: string | number) =>
  typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');

// Decision facets: Idade x Renda grid, 260 x 180 per facet.
const FW = 260, FH = 180, NX = 13, NY = 9;
const ages = Array.from({ length: NX }, (_, i) => 18 + ((69 - 18) * (i + 0.5)) / NX);
const incomes = Array.from({ length: NY }, (_, j) => 1 + ((10 - 1) * (j + 0.5)) / NY);
const fx = (age: number) => ((age - 18) / (69 - 18)) * FW;
const fy = (inc: number) => FH - ((inc - 1) / (10 - 1)) * FH;

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
})
export class App {
  protected readonly links = LINKS;
  protected readonly m = M;
  protected readonly e = E;
  protected readonly year = 2026;
  protected readonly Math = Math;
  protected readonly esc = ESC;
  protected readonly reg = REG;
  protected readonly gen = GEN;
  protected readonly color = COLOR;
  protected readonly onColor = ON_COLOR;
  protected readonly classes = M.classes;
  protected readonly credits = ['Caio Silveira Guimarães', 'Gustavo Martins Gripaldi', 'Giovanna Monteiro Bispo', 'Mariana Monteiro Bispo', 'Mayron Malaquias Oliveira'];

  // ---------- Simulator ----------
  protected readonly x = signal<Voter>({ ...PRESETS.medio });
  protected readonly preset = signal<PresetKey | ''>('medio');
  protected readonly focus = signal<number | null>(null);
  protected readonly probs = computed(() => predict(M, this.x()));
  protected readonly top = computed(() => { const p = this.probs(); return p.indexOf(Math.max(...p)); });
  protected readonly shown = computed(() => this.focus() ?? this.top());
  protected readonly z = computed(() => logits(M, this.x()));
  protected readonly terms = computed(() => {
    const k = this.shown(), x = this.x();
    const rows = M.features.map((f, j) => ({ label: f, value: M.coef[k][j] * x[f], coef: M.coef[k][j], x: x[f] }));
    const max = Math.max(0.3, ...rows.map((r) => Math.abs(r.value)), Math.abs(M.intercept[k]));
    return { k, intercept: M.intercept[k], max, rows: rows.map((r) => ({ ...r, scale: Math.abs(r.value) / max })) };
  });
  protected readonly facets = computed(() => {
    const x = this.x();
    const cells = incomes.flatMap((inc) => ages.map((age) => ({ age, inc, p: predict(M, { ...x, Idade: age, Renda: inc }) })));
    const cw = FW / NX + 0.4, ch = FH / NY + 0.4;
    return M.classes.map((name, k) => ({
      k,
      name,
      share: cells.filter((c) => c.p.indexOf(Math.max(...c.p)) === k).length / cells.length,
      cells: cells.map((c) => ({ x: Math.round(fx(c.age - 51 / NX / 2) * 10) / 10, y: Math.round(fy(c.inc + 9 / NY / 2) * 10) / 10, o: Math.round(c.p[k] * 90) / 100, w: cw, h: ch, top: c.p.indexOf(Math.max(...c.p)) === k })),
      voters: E.table.rows.filter((r) => r[6] === name).map((r) => ({ x: Math.round(fx(r[1] as number) * 10) / 10, y: Math.round(fy(r[2] as number) * 10) / 10 })),
    }));
  });
  protected readonly here = computed(() => ({ x: fx(this.x()['Idade']), y: fy(this.x()['Renda']) }));
  protected readonly fw = FW;
  protected readonly fh = FH;

  // ---------- Dashboard ----------
  protected readonly votes = (() => {
    const max = Math.max(...E.votes);
    return E.votes.map((n, k) => ({ name: M.classes[k], n, k, scale: n / max }));
  })();
  protected readonly hists = (['Idade', 'Renda'] as const).map((f) => {
    const bins = E.hist[f];
    const max = Math.max(...bins.map((b) => b.n));
    return { f, bins: bins.map((b) => ({ ...b, scale: b.n / max })) };
  });
  protected readonly counts = (['Escolaridade', 'Região', 'Gênero'] as const).map((f) => {
    const max = Math.max(...E.counts[f].map((c) => c.n));
    return { f, items: E.counts[f].map((c) => ({ ...c, scale: c.n / max })) };
  });
  protected readonly segments = E.segments.map((s) => ({
    key: s.key,
    groups: s.groups.map((g) => ({ ...g, parts: g.counts.map((c, k) => ({ k, c, share: c / g.n })) })),
  }));
  protected readonly perm = (() => {
    const max = Math.max(...E.permutation.items.map((i) => Math.abs(i.mean) + i.std));
    return E.permutation.items.map((i) => ({ ...i, scale: Math.abs(i.mean) / max, err: i.std / max }));
  })();
  protected readonly stdCoef = (() => {
    const max = Math.max(...E.stdCoef.map((i) => i.value));
    return [...E.stdCoef].sort((a, b) => b.value - a.value).map((i) => ({ ...i, scale: i.value / max }));
  })();

  // Sortable / filterable table (all 100 fictitious rows).
  protected readonly cols = E.table.columns;
  protected readonly fVote = signal('');
  protected readonly fReg = signal('');
  protected readonly sortCol = signal(0);
  protected readonly sortDir = signal<1 | -1>(1);
  protected readonly page = signal(0);
  protected readonly pageSize = 15;
  private readonly filtered = computed(() => {
    const v = this.fVote(), r = this.fReg(), c = this.sortCol(), d = this.sortDir();
    return E.table.rows.filter((row) => (!v || row[6] === v) && (!r || String(row[4]) === r)).sort((a, b) => d * cmp(a[c], b[c]));
  });
  protected readonly total = computed(() => this.filtered().length);
  protected readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  protected readonly rows = computed(() => {
    const p = Math.min(this.page(), this.pages() - 1);
    return this.filtered().slice(p * this.pageSize, (p + 1) * this.pageSize);
  });

  // ---------- Model ----------
  protected readonly confusion = M.metrics.test.confusion.map((row, r) => {
    const total = row.reduce((a, b) => a + b, 0);
    return { label: M.classes[r], total, cells: row.map((v, c) => ({ v, share: total ? v / total : 0, pred: M.classes[c] })) };
  });
  protected readonly perClass = M.classes.map((c) => ({ label: c, ...M.metrics.test.perClass[c as keyof typeof M.metrics.test.perClass] }));
  protected readonly seeds = (() => {
    const max = Math.max(...M.seedStudy.hist.map((h) => h.n));
    return M.seedStudy.hist.map((h) => ({ ...h, scale: h.n / max, mine: Math.abs(h.acc - M.metrics.test.accuracy) < 1e-9, readme: Math.abs(h.acc - 0.3) < 1e-9 }));
  })();
  protected readonly sq = (v: number) => v * 300;
  protected readonly rocPath = (pts: number[][]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x * 300).toFixed(1)} ${(300 - y * 300).toFixed(1)}`).join(' ');
  protected readonly coefMax = Math.max(...M.coef.flat().map(Math.abs));

  protected pct = (v: number, d = 1) => PCT[d].format(v);
  protected dec = (v: number, d = 2) => DEC[d].format(v);
  protected sgn = (v: number, d = 2) => SGN[d].format(v);
  protected int = (v: number) => INT.format(v);
  protected kb = (b: number) => (b > 1e6 ? `${DEC[1].format(b / 1e6)} MB` : `${DEC[1].format(Math.max(0.1, b / 1e3))} KB`);
  protected codeLabel = (f: string, v: number) => (f === 'Escolaridade' ? ESC[v - 1] : f === 'Região' ? REG[v - 1] : f === 'Gênero' ? GEN[v] : f === 'Renda' ? `R$ ${DEC[1].format(v)} mil` : `${v} anos`);
  /** Diverging fill for heatmaps: green (+) / magenta (-) around a neutral midpoint. */
  protected div = (v: number, max: number) => `color-mix(in oklab, ${v >= 0 ? 'var(--pos)' : 'var(--neg)'} ${Math.round(Math.min(1, Math.abs(v) / max) * 75)}%, var(--mid))`;

  constructor() {
    afterNextRender(() => {
      document.documentElement.classList.add('reveal-ready');
      const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { rootMargin: '0px 0px -8% 0px' });
      document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));
    });
  }

  protected set(f: string, v: string | number) {
    this.x.update((x) => ({ ...x, [f]: Number(v) }));
    this.preset.set('');
  }

  protected load(k: PresetKey) {
    this.x.set({ ...PRESETS[k] });
    this.preset.set(k);
  }

  protected sort(c: number) {
    if (this.sortCol() === c) this.sortDir.update((d) => (d === 1 ? -1 : 1));
    else { this.sortCol.set(c); this.sortDir.set(1); }
    this.page.set(0);
  }

  protected filter(sig: { set(v: string): void }, v: string) {
    sig.set(v);
    this.page.set(0);
  }
}
