# Laboratório de Programação Dinâmica

Projeto em Python com front web para resolver dois problemas clássicos de programação dinâmica:

- **Weighted Interval Scheduling**, na aba de agenda;
- **Knapsack 0/1**, na aba de mochila.

O usuário cadastra atividades com horário de início, horário de fim e peso. O sistema escolhe a melhor agenda possível sem sobreposição de horários, maximizando o peso total.

Na aba de knapsack, o usuário cadastra itens com peso e valor, além da capacidade máxima da mochila. O sistema escolhe a combinação que maximiza o valor total sem ultrapassar a capacidade.

## Algoritmo usado

O projeto implementa programação dinâmica em duas versões para a agenda:

- **Iterativa**, usando tabela `M[i]`;
- **Recursiva com memoização**, para comparar o resultado com a versão iterativa.

Para o knapsack, a solução é implementada com a tabela iterativa clássica `V[i][c]`, onde `i` representa os itens considerados e `c` a capacidade disponível.

Para cada atividade `i`, o algoritmo calcula:

```text
M[i] = max(peso[i] + M[p(i)], M[i - 1])
```

Onde `p(i)` é a última atividade compatível que termina antes do início da atividade `i`.

## Como executar

```bash
python app.py
```

Depois abra:

```text
http://127.0.0.1:8000
```

## Como testar

```bash
python -m unittest
```

## Estrutura

```text
app.py              Backend Python e algoritmo de programação dinâmica
static/index.html   Interface web
static/style.css    Estilos da interface
static/app.js       Lógica do front e chamadas para a API
tests/              Testes unitários
```
