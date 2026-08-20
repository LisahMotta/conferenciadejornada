// calculo.js
// -----------------------------------------------------------------------
// Aqui mora TODO o dinheiro do app: as fórmulas de valor esperado,
// proporcionalidade por dias corridos e carga suplementar.
//
// Regra de ouro deste arquivo: cada função devolve não só o número final,
// mas também os valores intermediários (dias contados, valor mensal cheio
// antes do rateio, etc.) — essa é a "memória de cálculo" que você precisa
// pra defender o número numa conferência com o RH. Ver calcularCasoCompleto
// no fim do arquivo.
// -----------------------------------------------------------------------

import {
  buscarLinhaPorAulasComAlunos,
  escolherTabelaDeComposicao,
  obterJornadaNomeada,
} from "./regras.js";

// Confirmado com a usuária: conversão de aulas/semana para aulas/mês é
// sempre por esse multiplicador fixo, não importa quantas semanas o mês
// realmente tem.
const MULTIPLICADOR_MENSAL = 5;

/**
 * Conta os dias corridos entre duas datas ISO ("AAAA-MM-DD"), incluindo os
 * dois extremos. Ex.: contarDiasCorridos("2026-03-01", "2026-03-14") = 14.
 */
export function contarDiasCorridos(dataInicioISO, dataFimISO) {
  const inicio = new Date(`${dataInicioISO}T00:00:00`);
  const fim = new Date(`${dataFimISO}T00:00:00`);
  const umDiaEmMs = 1000 * 60 * 60 * 24;
  const dias = Math.round((fim - inicio) / umDiaEmMs) + 1;
  if (dias <= 0) {
    throw new Error(
      `A data fim (${dataFimISO}) não pode ser anterior à data início (${dataInicioISO}).`
    );
  }
  return dias;
}

/** Nº de dias do mês de referência (28, 29, 30 ou 31). */
export function diasNoMes(ano, mes) {
  // O "dia 0" do mês seguinte é sempre o último dia do mês atual — um
  // truque padrão do objeto Date do JavaScript.
  return new Date(ano, mes, 0).getDate();
}

/**
 * Valor mensal CHEIO da jornada BASE, sem considerar proporcionalidade
 * nem carga suplementar.
 *
 * Fórmula confirmada com a usuária, batendo com o Decreto 70.483/2026:
 *   valor da hora-aula × designação nominal da jornada × 5
 * (ex.: Jornada Integral/Ampliada = 25,65 × 40 × 5 ≈ 5.130,63)
 */
export function calcularValorMensalJornadaBase(
  valorHoraAula,
  cargaHorariaSemanalNominal
) {
  return valorHoraAula * cargaHorariaSemanalNominal * MULTIPLICADOR_MENSAL;
}

/**
 * Valor mensal CHEIO da carga suplementar (aulas com alunos atribuídas
 * acima da jornada base do docente).
 *
 * Fórmula confirmada com a usuária: valor da hora-aula × aulas excedentes × 5.
 * Não recalcula ATPC/ATPL — só a(s) aula(s) excedente(s) entra(m) na conta.
 */
export function calcularValorMensalCargaSuplementar(
  valorHoraAula,
  aulasExcedentes
) {
  if (aulasExcedentes < 0) {
    throw new Error("Número de aulas excedentes não pode ser negativo.");
  }
  return valorHoraAula * aulasExcedentes * MULTIPLICADOR_MENSAL;
}

/**
 * Rateia um valor mensal cheio pelos dias corridos em que ele de fato
 * vigorou dentro do mês de referência.
 */
export function ratearPorDiasCorridos(
  valorMensalCheio,
  diasNoPeriodo,
  totalDiasDoMes
) {
  return (valorMensalCheio / totalDiasDoMes) * diasNoPeriodo;
}

/**
 * Calcula o valor esperado de UM período de jornada dentro do mês
 * (jornada base + eventual carga suplementar), já rateado pelos dias
 * corridos daquele período. Devolve a memória de cálculo completa desse
 * período — nada fica escondido dentro de uma única conta.
 *
 * `periodo` esperado:
 *   {
 *     jornadaNome: "Inicial",       // uma chave de regras.jornadasNomeadas
 *     aulasAtribuidas: 20,          // aulas com alunos realmente atribuídas
 *     dataInicio: "2026-03-15",     // "AAAA-MM-DD"
 *     dataFim: "2026-03-31",
 *     valorHoraAula: 25.65,
 *   }
 */
export function calcularPeriodo(periodo, regras, totalDiasDoMes) {
  const { jornadaNome, aulasAtribuidas, dataInicio, dataFim, valorHoraAula } =
    periodo;

  const jornada = obterJornadaNomeada(regras, jornadaNome);
  const tabela = escolherTabelaDeComposicao(regras, dataInicio);
  const linhaBase = buscarLinhaPorAulasComAlunos(
    tabela,
    jornada.aulasComAlunosBase
  );

  if (aulasAtribuidas < jornada.aulasComAlunosBase) {
    throw new Error(
      `Aulas atribuídas (${aulasAtribuidas}) é menor que a base da jornada "${jornadaNome}" ` +
        `(${jornada.aulasComAlunosBase} aulas com alunos). Isso não é carga suplementar — ` +
        `confira o valor digitado, ou escolha uma jornada nomeada menor.`
    );
  }
  const aulasExcedentes = aulasAtribuidas - jornada.aulasComAlunosBase;

  const dias = contarDiasCorridos(dataInicio, dataFim);

  const valorMensalBase = calcularValorMensalJornadaBase(
    valorHoraAula,
    linhaBase.cargaHorariaSemanal
  );
  const valorMensalSuplementar = calcularValorMensalCargaSuplementar(
    valorHoraAula,
    aulasExcedentes
  );
  const valorMensalTotal = valorMensalBase + valorMensalSuplementar;

  const valorRateadoBase = ratearPorDiasCorridos(
    valorMensalBase,
    dias,
    totalDiasDoMes
  );
  const valorRateadoSuplementar = ratearPorDiasCorridos(
    valorMensalSuplementar,
    dias,
    totalDiasDoMes
  );
  const valorRateadoTotal = valorRateadoBase + valorRateadoSuplementar;

  return {
    jornadaNome,
    dataInicio,
    dataFim,
    dias,
    totalDiasDoMes,
    aulasAtribuidas,
    aulasBase: jornada.aulasComAlunosBase,
    aulasExcedentes,
    atpc: linhaBase.atpc,
    atplApd: linhaBase.atplApd,
    cargaHorariaSemanalNominal: linhaBase.cargaHorariaSemanal,
    valorHoraAula,
    valorMensalBase,
    valorMensalSuplementar,
    valorMensalTotal,
    valorRateadoBase,
    valorRateadoSuplementar,
    valorRateadoTotal,
  };
}

/**
 * Confere se os períodos informados:
 *  - não saem do mês de referência;
 *  - não se sobrepõem entre si;
 *  - cobrem o mês inteiro, do dia 1 ao último dia (sem "buraco" sem
 *    jornada registrada).
 * Lança um erro com uma mensagem explicando o problema, se achar algum.
 */
function validarPeriodos(periodos, ano, mes, totalDiasDoMes) {
  if (periodos.length === 0) {
    throw new Error("Informe ao menos um período de jornada para o mês.");
  }

  const mesTexto = String(mes).padStart(2, "0");
  const primeiroDiaDoMes = `${ano}-${mesTexto}-01`;
  const ultimoDiaDoMes = `${ano}-${mesTexto}-${String(totalDiasDoMes).padStart(2, "0")}`;

  const ordenados = [...periodos].sort((a, b) =>
    a.dataInicio.localeCompare(b.dataInicio)
  );

  ordenados.forEach((periodo, indice) => {
    if (periodo.dataInicio < primeiroDiaDoMes || periodo.dataFim > ultimoDiaDoMes) {
      throw new Error(
        `O período de "${periodo.jornadaNome}" (${periodo.dataInicio} a ${periodo.dataFim}) ` +
          `está fora do mês de referência (${primeiroDiaDoMes} a ${ultimoDiaDoMes}).`
      );
    }
    const proximo = ordenados[indice + 1];
    if (proximo && periodo.dataFim >= proximo.dataInicio) {
      throw new Error(
        `Os períodos "${periodo.jornadaNome}" (até ${periodo.dataFim}) e ` +
          `"${proximo.jornadaNome}" (a partir de ${proximo.dataInicio}) se sobrepõem. ` +
          `Lembrete: o dia da mudança já conta como a jornada nova.`
      );
    }
  });

  const primeiroPeriodo = ordenados[0];
  const ultimoPeriodo = ordenados[ordenados.length - 1];
  const cobreOMesTodo =
    primeiroPeriodo.dataInicio === primeiroDiaDoMes &&
    ultimoPeriodo.dataFim === ultimoDiaDoMes;
  if (!cobreOMesTodo) {
    throw new Error(
      `Os períodos informados não cobrem o mês inteiro (${primeiroDiaDoMes} a ${ultimoDiaDoMes}). ` +
        `Confira se falta algum período no início, no fim, ou entre dois períodos já informados.`
    );
  }
}

/**
 * Ponto de entrada principal: calcula o valor esperado do mês inteiro,
 * somando todos os períodos de jornada informados pela usuária, e devolve
 * a memória de cálculo completa (um item por período) mais o total.
 *
 * `caso` esperado:
 *   {
 *     mesReferencia: { ano: 2026, mes: 3 },
 *     periodosDeJornada: [ {...igual ao formato de calcularPeriodo...}, ... ],
 *   }
 */
export function calcularCasoCompleto(caso, regras) {
  const { ano, mes } = caso.mesReferencia;
  const totalDiasDoMes = diasNoMes(ano, mes);

  validarPeriodos(caso.periodosDeJornada, ano, mes, totalDiasDoMes);

  const periodosCalculados = caso.periodosDeJornada.map((periodo) =>
    calcularPeriodo(periodo, regras, totalDiasDoMes)
  );

  const valorEsperadoTotal = periodosCalculados.reduce(
    (soma, periodo) => soma + periodo.valorRateadoTotal,
    0
  );

  return {
    ano,
    mes,
    totalDiasDoMes,
    periodosCalculados,
    valorEsperadoTotal,
  };
}
