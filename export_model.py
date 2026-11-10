# Gera os dados FICTÍCIOS e treina o modelo exatamente como main.py, depois exporta tudo que o site mostra.
# Diferença única: semente fixa (SEED) para o resultado ser reproduzível; main.py não fixa semente.
# Rodar da raiz do repositório:  python -I export_model.py
# Saídas: site/src/app/data/{model,eda,fixtures}.json e os downloads em site/public/data/
import csv
import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, roc_auc_score, roc_curve
from sklearn.model_selection import train_test_split

SEED = 42
FEATURES = ['Idade', 'Renda', 'Escolaridade', 'Região', 'Gênero']

root = Path(__file__).resolve().parent
out = root / "site" / "src" / "app" / "data"
pub = root / "site" / "public" / "data"
out.mkdir(parents=True, exist_ok=True)
pub.mkdir(parents=True, exist_ok=True)


# ---------- Dados e treino: idênticos a main.py (com semente) ----------
def gerar(seed):
    np.random.seed(seed)
    return {
        'Idade': np.random.randint(18, 70, 100),
        'Renda': np.random.uniform(1, 10, 100),  # renda em milhares
        'Escolaridade': np.random.choice([1, 2, 3, 4], 100),  # 1: Fundamental, 2: Médio, 3: Superior, 4: Pós-graduação
        'Região': np.random.choice([1, 2, 3, 4, 5], 100),  # 1: Norte, 2: Sul, 3: Leste, 4: Oeste, 5: Centro
        'Gênero': np.random.choice([0, 1], 100),  # 0: Masculino, 1: Feminino
        'Voto': np.random.choice(['Monarki', 'Bolos', 'Dantena', 'Marcos'], 100),  # Candidatos fictícios
    }


def treinar(df):
    X_train, X_test, y_train, y_test = train_test_split(df[FEATURES], df['Voto'], test_size=0.3, random_state=42)
    modelo = LogisticRegression(multi_class='multinomial', solver='lbfgs', max_iter=1000)
    modelo.fit(X_train, y_train)
    return modelo, X_train, X_test, y_train, y_test


warnings.filterwarnings('ignore', category=FutureWarning)  # multi_class='multinomial' (mantido como no original)
raw = pd.DataFrame(gerar(SEED))
df = raw.copy()
votos = df['Voto'].astype('category')
classes = list(votos.cat.categories)  # ordem alfabética: é a ordem real dos códigos e das linhas de coef_
df['Voto'] = votos.cat.codes

modelo, X_train, X_test, y_train, y_test = treinar(df)
print("Acurácia do modelo:", accuracy_score(y_test, modelo.predict(X_test)))


# ---------- Exportação ----------
def r4(v):
    return round(float(v), 4)  # só para gráficos; coeficientes vão com precisão total


def metrics(Xs, ys):
    pred = modelo.predict(Xs)
    rep = classification_report(ys, pred, labels=range(4), output_dict=True, zero_division=0)
    counts = np.bincount(ys, minlength=4)
    return {
        'n': int(len(ys)),
        'accuracy': accuracy_score(ys, pred),
        'majorityBaseline': float(counts.max() / counts.sum()),
        'perClass': {classes[c]: {k: rep[str(c)][k] for k in ('precision', 'recall', 'f1-score', 'support')} for c in range(4)},
        'macroF1': rep['macro avg']['f1-score'],
        'confusion': confusion_matrix(ys, pred, labels=range(4)).tolist(),
    }


def row(r):
    return {f: (float(r[f]) if f == 'Renda' else int(r[f])) for f in FEATURES}


# Sem semente, cada execução de main.py sorteia outros dados: distribuição da acurácia de teste em 500 sementes.
def acc(seed):
    d = pd.DataFrame(gerar(seed))
    d['Voto'] = d['Voto'].astype('category').cat.codes
    m, _, Xt, _, yt = treinar(d)
    return accuracy_score(yt, m.predict(Xt))


accs = np.array([acc(s) for s in range(500)])

# ROC um-contra-todos e confiabilidade da classe prevista, no teste (30 eleitores: curvas serrilhadas por natureza).
P_test = modelo.predict_proba(X_test)
roc = []
for k, c in enumerate(classes):
    yk = (y_test.values == k).astype(int)
    fpr, tpr, _ = roc_curve(yk, P_test[:, k])
    roc.append({'class': c, 'auc': r4(roc_auc_score(yk, P_test[:, k])), 'points': [[r4(a), r4(b)] for a, b in zip(fpr, tpr)]})
conf = P_test.max(axis=1)
hit = P_test.argmax(axis=1) == y_test.values
edges = [0.25, 0.3, 0.35, 0.4, 0.45, 1.0]
reliab = [{'from': a, 'to': b, 'n': int(m.sum()), 'conf': r4(conf[m].mean()), 'acc': r4(hit[m].mean())}
          for a, b in zip(edges[:-1], edges[1:]) if (m := (conf >= a) & (conf < b)).sum()]

model_json = {
    'seed': SEED,
    'params': {'algorithm': 'LogisticRegression', 'multiClass': 'multinomial', 'solver': 'lbfgs', 'maxIter': 1000,
               'C': 1.0, 'testSize': 0.3, 'randomState': 42, 'nIter': int(modelo.n_iter_[0]),
               'sklearn': __import__('sklearn').__version__},
    'features': FEATURES,
    'classes': classes,
    'coef': modelo.coef_.tolist(),
    'intercept': modelo.intercept_.tolist(),
    'metrics': {'train': metrics(X_train, y_train), 'test': metrics(X_test, y_test)},
    'viz': {'roc': roc, 'macroAuc': r4(np.mean([r['auc'] for r in roc])), 'reliability': reliab},
    'seedStudy': {'runs': int(len(accs)), 'mean': float(accs.mean()), 'p5': float(np.percentile(accs, 5)),
                  'p95': float(np.percentile(accs, 95)), 'min': float(accs.min()), 'max': float(accs.max()),
                  'hist': [{'acc': float(a), 'n': int((np.isclose(accs, a)).sum())} for a in np.unique(accs)]},
}

fixtures = [{'x': row(r), 'proba': P_test[i].tolist()} for i, (_, r) in enumerate(X_test.iterrows())][:20]

# ---------- Dashboard (EDA) ----------
ESC = ['Fundamental', 'Médio', 'Superior', 'Pós-graduação']
REG = ['Norte', 'Sul', 'Leste', 'Oeste', 'Centro']
GEN = ['Masculino', 'Feminino']


def shares(seg_values, labels):
    out_ = []
    for v, lab in zip(sorted(seg_values.unique()), labels):
        m = seg_values == v
        cnt = np.bincount(df.loc[m, 'Voto'], minlength=4)
        out_.append({'label': lab, 'n': int(m.sum()), 'counts': cnt.tolist()})
    return out_


faixa_idade = pd.cut(df['Idade'], [17, 29, 44, 59, 69], labels=False)
faixa_renda = pd.cut(df['Renda'], [1, 4, 7, 10], labels=False, include_lowest=True)
segments = [
    {'key': 'Região', 'groups': shares(df['Região'], REG)},
    {'key': 'Escolaridade', 'groups': shares(df['Escolaridade'], ESC)},
    {'key': 'Gênero', 'groups': shares(df['Gênero'], GEN)},
    {'key': 'Faixa etária', 'groups': shares(faixa_idade, ['18 a 29', '30 a 44', '45 a 59', '60 a 69'])},
    {'key': 'Renda (mil R$)', 'groups': shares(faixa_renda, ['1 a 4', '4 a 7', '7 a 10'])},
]


def hist(col, edges_):
    c, _ = np.histogram(df[col], bins=edges_)
    return [{'from': r4(a), 'to': r4(b), 'n': int(n)} for a, b, n in zip(edges_[:-1], edges_[1:], c)]


# Importância: permutação (queda de acurácia no teste, 50 rodadas) e |coef| x desvio padrão (média nas 4 classes).
base_acc = accuracy_score(y_test, modelo.predict(X_test))
perm = []
for f in FEATURES:
    drops = []
    for k in range(50):
        Xs = X_test.copy()
        Xs[f] = np.random.default_rng(k).permutation(Xs[f].values)
        drops.append(base_acc - accuracy_score(y_test, modelo.predict(Xs)))
    perm.append({'label': f, 'mean': r4(np.mean(drops)), 'std': r4(np.std(drops))})
std_coef = [{'label': f, 'value': r4(np.abs(modelo.coef_[:, j]).mean() * X_train[f].std())} for j, f in enumerate(FEATURES)]

table = [[int(i), int(r['Idade']), r4(r['Renda']), int(r['Escolaridade']), int(r['Região']), int(r['Gênero']), raw['Voto'].iloc[i]]
         for i, r in df.iterrows()]

# ---------- Downloads (servidos pelo site em data/) ----------
model_text = json.dumps(model_json, ensure_ascii=False)
raw.to_csv(pub / 'eleicoes-sp-2024-ficticio.csv', index_label='id', encoding='utf-8-sig')
(pub / 'eleicoes-modelo-ficticio.json').write_text(model_text, encoding='utf-8')
with open(pub / 'eleicoes-dicionario-ficticio.csv', 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['coluna', 'tipo', 'descricao', 'valores'])
    w.writerow(['id', 'inteiro', 'Número da linha gerada.', '0 a 99'])
    w.writerow(['Idade', 'inteiro', 'Idade sorteada (np.random.randint). FICTÍCIO.', '18 a 69'])
    w.writerow(['Renda', 'decimal', 'Renda mensal em milhares de reais, sorteio uniforme. FICTÍCIO.', '1 a 10'])
    w.writerow(['Escolaridade', 'código', 'Sorteado. 1 Fundamental, 2 Médio, 3 Superior, 4 Pós-graduação. FICTÍCIO.', '1 a 4'])
    w.writerow(['Região', 'código', 'Sorteado. 1 Norte, 2 Sul, 3 Leste, 4 Oeste, 5 Centro. FICTÍCIO.', '1 a 5'])
    w.writerow(['Gênero', 'código', 'Sorteado. 0 Masculino, 1 Feminino. FICTÍCIO.', '0 ou 1'])
    w.writerow(['Voto', 'texto', 'Candidato fictício sorteado, independente de todas as outras colunas.', 'Bolos, Dantena, Marcos, Monarki'])


def size(n):
    return (pub / n).stat().st_size


downloads = [
    {'file': 'eleicoes-sp-2024-ficticio.csv', 'label': 'Dataset fictício (CSV)', 'bytes': size('eleicoes-sp-2024-ficticio.csv'),
     'description': f'Os {len(df)} eleitores inventados com semente {SEED}: todas as colunas são sorteios aleatórios. Não são dados reais de eleitores.'},
    {'file': 'eleicoes-modelo-ficticio.json', 'label': 'Modelo exportado (JSON)', 'bytes': size('eleicoes-modelo-ficticio.json'),
     'description': 'Coeficientes, interceptos, métricas e curvas do modelo treinado nos dados fictícios. O mesmo arquivo que o simulador usa.'},
    {'file': 'eleicoes-dicionario-ficticio.csv', 'label': 'Dicionário de dados (CSV)', 'bytes': size('eleicoes-dicionario-ficticio.csv'),
     'description': 'Cada coluna com tipo, significado dos códigos e faixa de valores.'},
]

corr = df[FEATURES].corr()
eda = {
    'kpis': {'rows': int(len(df)), 'columns': int(raw.shape[1]), 'missing': int(raw.isna().sum().sum()),
             'duplicates': int(raw.duplicated().sum()), 'seed': SEED},
    'votes': np.bincount(df['Voto'], minlength=4).tolist(),
    'describe': {f: {k: r4(v) for k, v in df[f].describe()[['min', 'mean', '50%', 'max', 'std']].items()} for f in FEATURES},
    'hist': {'Idade': hist('Idade', np.arange(15, 75, 5)), 'Renda': hist('Renda', np.arange(1, 11, 1))},
    'counts': {'Escolaridade': [{'label': l, 'n': int((df['Escolaridade'] == i + 1).sum())} for i, l in enumerate(ESC)],
               'Região': [{'label': l, 'n': int((df['Região'] == i + 1).sum())} for i, l in enumerate(REG)],
               'Gênero': [{'label': l, 'n': int((df['Gênero'] == i).sum())} for i, l in enumerate(GEN)]},
    'segments': segments,
    'corr': {'labels': FEATURES, 'matrix': [[r4(v) for v in r] for r in corr.values]},
    'permutation': {'metric': 'acurácia (teste)', 'base': r4(base_acc), 'repeats': 50, 'items': perm},
    'stdCoef': std_coef,
    'table': {'columns': ['#', 'Idade', 'Renda', 'Escolaridade', 'Região', 'Gênero', 'Voto'], 'rows': table},
    'downloads': downloads,
}

(out / 'model.json').write_text(model_text, encoding='utf-8')
(out / 'eda.json').write_text(json.dumps(eda, ensure_ascii=False), encoding='utf-8')
(out / 'fixtures.json').write_text(json.dumps(fixtures, ensure_ascii=False, indent=1), encoding='utf-8')
print(f"export: model.json (classes {classes}), eda.json, fixtures.json ({len(fixtures)}), public/data ({len(downloads)} arquivos)")
