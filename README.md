# Otimizador de Agenda com Programação Dinâmica

Projeto em Python com front web para resolver o problema de **Weighted Interval Scheduling**.

O usuário cadastra atividades com horário de início, horário de fim e peso. O sistema escolhe a melhor agenda possível sem sobreposição de horários, maximizando o peso total.

## Algoritmo usado

O projeto implementa programação dinâmica em duas versões:

- **Iterativa**, usando tabela `M[i]`;
- **Recursiva com memoização**, para comparar o resultado com a versão iterativa.

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
