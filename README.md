# Conferência de Jornada

App de apoio para conferir se um(a) professor(a) da rede estadual de SP
(SEDUC-SP) recebeu corretamente na folha de pagamento quando há mudança de
jornada de trabalho no meio do mês.

⚠️ **Ferramenta de apoio, não substitui a conferência oficial do RH/Diretoria
de Ensino.** Não cobre afastamentos, licenças, faltas, substituições ou
pagamentos retroativos — ver `regras-jornada.json > escopoForaDoMVP`.

Todo o cálculo roda no navegador (client-side). Nenhum dado de pagamento é
enviado para servidor nenhum.

## Estrutura do projeto

```
regras-jornada.json   ← todas as regras de negócio (fonte oficial, datas,
                         fórmulas). Editar aqui quando a SEDUC mudar algo —
                         não é preciso mexer no código.
js/regras.js           ← leitura das regras (não faz cálculo)
js/calculo.js           ← toda a matemática: proporcionalidade, carga
                         suplementar, memória de cálculo
scripts/teste-calculo.mjs ← script de conferência manual, roda no terminal
index.html, css/, js/wizard.js, js/app.js, js/exportar.js ← ainda não
                         criados (próxima etapa: a tela)
```

## Como conferir os cálculos pelo terminal (antes de ter tela)

Com o [Node.js](https://nodejs.org) instalado:

```
node scripts/teste-calculo.mjs
```

Isso roda um caso de exemplo (Jornada Inicial, com 1 aula suplementar
atribuída a partir do meio do mês) e imprime a memória de cálculo completa.
Edite o `casoExemplo` dentro do script pra testar outros cenários.

## Regras de cálculo já confirmadas

Resumo das decisões registradas em `regras-jornada.json` (a fonte de
verdade é sempre o JSON, isto aqui é só um resumo):

- **Proporcionalidade:** dias corridos reais do mês (28/29/30/31).
- **Dia da mudança de jornada:** já conta como a jornada nova.
- **Valor mensal da jornada base:** valor da hora-aula × designação nominal
  da jornada × 5.
- **Carga suplementar:** valor da hora-aula × aulas excedentes × 5, sem
  alterar ATPC/ATPL da jornada base.
- **Tabela de composição de jornada (aulas/ATPC/ATPL):** Resolução SEDUC
  105/2024 a partir de 29/01/2025; Anexo II da Resolução SE 72/2019 antes
  disso.
- **Valor da hora-aula:** digitado manualmente em cada caso (não há tabela
  fixa por categoria/nível no app).
