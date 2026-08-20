// regras.js
// -----------------------------------------------------------------------
// Este módulo só sabe "ler" o arquivo regras-jornada.json — ele não faz
// nenhuma conta de dinheiro. A ideia é manter a leitura das regras
// separada do cálculo (calculo.js), pra facilitar a leitura do código:
// se algo der errado na conta, você sabe que o problema está em
// calculo.js; se der errado o valor lido de uma tabela, o problema está
// aqui.
// -----------------------------------------------------------------------

/**
 * Carrega o regras-jornada.json. No navegador isso usa fetch (o arquivo
 * precisa estar publicado junto com o resto do site). Se um dia o app
 * rodar fora do navegador (ex.: um script de teste no Node), dá pra
 * trocar essa função por uma leitura de arquivo local.
 */
export async function carregarRegras(caminho = "./regras-jornada.json") {
  const resposta = await fetch(caminho);
  if (!resposta.ok) {
    throw new Error(
      `Não consegui carregar ${caminho} (status ${resposta.status}). ` +
        `Confira se o arquivo está no lugar certo.`
    );
  }
  return resposta.json();
}

/**
 * Busca, dentro de uma tabela de composição de jornada (um array de
 * linhas — tabelaJornadasAnexoI ou tabelaAnexoII_SE72_2019), a linha cujo
 * campo 'aulasComAlunos' bate com o número informado.
 *
 * Por que pela quantidade de aulas com alunos, e não pela "carga horária
 * semanal"? Porque foi essa a regra confirmada com a usuária: o ATPC e o
 * ATPL/APD de cada jornada dependem de quantas aulas com alunos o
 * professor tem de fato atribuídas — a "carga horária semanal" é só uma
 * designação legal (nominal), que nas fontes oficiais não bate com a
 * soma real de aulas + ATPC + ATPL.
 */
export function buscarLinhaPorAulasComAlunos(tabela, aulasComAlunos) {
  const linha = tabela.find((l) => l.aulasComAlunos === aulasComAlunos);
  if (!linha) {
    throw new Error(
      `Não encontrei nenhuma linha da tabela de composição para ${aulasComAlunos} aulas ` +
        `com alunos. Confira se esse número existe no Anexo I/II da resolução usada como fonte.`
    );
  }
  return linha;
}

/**
 * Decide qual tabela de composição de jornada usar, de acordo com a data
 * de referência do caso (formato "AAAA-MM-DD").
 *
 * Regra confirmada com a usuária: a partir de 29/01/2025 usa-se a tabela
 * nova (Resolução SEDUC 105/2024, Anexo I — vale pra TODAS as jornadas,
 * inclusive as da carreira antiga); antes disso, usa-se a tabela antiga
 * (Anexo II da Resolução SE 72/2019).
 */
export function escolherTabelaDeComposicao(regras, dataReferenciaISO) {
  const dataCorte = regras.vigenciaComposicaoJornada.apartirDe; // "2025-01-29"
  // Datas no formato "AAAA-MM-DD" podem ser comparadas como texto: a ordem
  // alfabética delas é a mesma ordem cronológica.
  const usarTabelaNova = dataReferenciaISO >= dataCorte;
  return usarTabelaNova
    ? regras.tabelaJornadasAnexoI
    : regras.tabelaAnexoII_SE72_2019;
}

/** Devolve os dados de uma jornada nomeada (ex.: "Inicial", "Ampliada"). */
export function obterJornadaNomeada(regras, nomeJornada) {
  const jornada = regras.jornadasNomeadas[nomeJornada];
  if (!jornada) {
    const nomesValidos = Object.keys(regras.jornadasNomeadas).join(", ");
    throw new Error(
      `Jornada "${nomeJornada}" não existe em regras-jornada.json > jornadasNomeadas. ` +
        `Jornadas conhecidas: ${nomesValidos}.`
    );
  }
  return jornada;
}
