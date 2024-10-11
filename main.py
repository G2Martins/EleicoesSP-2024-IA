import pandas as pd
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score


# Criar uma base de dados fictícia
dados = {
    'Idade': np.random.randint(18, 70, 100),
    'Renda': np.random.uniform(1, 10, 100),  # renda em milhares
    'Escolaridade': np.random.choice([1, 2, 3, 4], 100),  # 1: Fundamental, 2: Médio, 3: Superior, 4: Pós-graduação
    'Região': np.random.choice([1, 2, 3, 4, 5], 100),  # 1: Norte, 2: Sul, 3: Leste, 4: Oeste, 5: Centro
    'Gênero': np.random.choice([0, 1], 100),  # 0: Masculino, 1: Feminino
    'Voto': np.random.choice(['Monarki', 'Bolos', 'Dantena', 'Marcos'], 100)  # Candidatos
}

# Converter para DataFrame
df = pd.DataFrame(dados)

# Exibir as primeiras linhas da base de dados
df.head(10)

# Codificar as variáveis categóricas
df['Voto'] = df['Voto'].astype('category').cat.codes  # Codifica Monarki=0, Bolos=1, Dantena=2, Marcos=3

# Separar as variáveis independentes (X) e a dependente (y)
X = df[['Idade', 'Renda', 'Escolaridade', 'Região', 'Gênero']]
y = df['Voto']

# Dividir os dados em conjuntos de treino e teste (70% treino, 30% teste)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# Exibir as primeiras linhas dos dados de treino
X_train.head()

# Criar e treinar o modelo de regressão logística multinomial
modelo = LogisticRegression(multi_class='multinomial', solver='lbfgs', max_iter=1000)

# Ajustar o modelo aos dados de treino
modelo.fit(X_train, y_train)

# Fazer previsões no conjunto de teste
y_pred = modelo.predict(X_test)

# Avaliar o modelo
print("Acurácia do modelo:", accuracy_score(y_test, y_pred))
print("\nRelatório de Classificação:\n", classification_report(y_test, y_pred))

# Exibir os coeficientes do modelo para cada classe de voto
print("Coeficientes do modelo:")
print(pd.DataFrame(modelo.coef_, columns=X.columns, index=['Monarki', 'Bolos', 'Dantena', 'Marcos']))

# Comparar os votos reais e previstos
comparacao = pd.DataFrame({'Voto Real': y_test, 'Voto Previsto': y_pred})
comparacao.head()

# Contagem de acertos e erros
sns.countplot(x='Voto Real', data=comparacao, hue='Voto Previsto')
plt.title("Comparação entre Votos Reais e Previstos")
plt.show()