// teste-calculo.mjs
// -----------------------------------------------------------------------
// Script de conferência manual (não é um "backend" — só um jeito de rodar
// a camada de cálculo pelo terminal, sem precisar abrir o navegador, pra
// eu e você conferirmos os números antes de existir qualquer tela).
//
// Como rodar (com Node.js instalado):
//   node scripts/teste-calculo.mjs
// -----------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { calcularCasoCompleto } from "../js/calculo.js";

const regras = JSON.parse(
  readFileSync(new URL("../regras-jornada.json", import.meta.url))
);

// Caso de exemplo: o mesmo que você descreveu — Jornada Inicial (carreira
// antiga, 19 aulas com alunos) que passa a ter 20 aulas atribuídas (1 aula
// suplementar) a partir do dia 15 de março de 2026.
const casoExemplo = {
  mesReferencia: { ano: 2026, mes: 3 },
  periodosDeJornada: [
    {
      jornadaNome: "Inicial",
      aulasAtribuidas: 19, // só a jornada base, sem suplementar
      dataInicio: "2026-03-01",
      dataFim: "2026-03-14",
      valorHoraAula: 25.65,
    },
    {
      jornadaNome: "Inicial",
      aulasAtribuidas: 20, // 1 aula suplementar a partir daqui
      dataInicio: "2026-03-15",
      dataFim: "2026-03-31",
      valorHoraAula: 25.65,
    },
  ],
};

const resultado = calcularCasoCompleto(casoExemplo, regras);

console.log(`Mês de referência: ${resultado.mes}/${resultado.ano} (${resultado.totalDiasDoMes} dias)`);
console.log("");

for (const periodo of resultado.periodosCalculados) {
  console.log(`Período: ${periodo.dataInicio} a ${periodo.dataFim} (${periodo.dias} dias) — Jornada ${periodo.jornadaNome}`);
  console.log(`  Composição da jornada base: ${periodo.aulasBase} aulas com alunos, ${periodo.atpc} ATPC, ${periodo.atplApd} ATPL/APD (designação nominal: ${periodo.cargaHorariaSemanalNominal}h)`);
  console.log(`  Aulas atribuídas: ${periodo.aulasAtribuidas} (${periodo.aulasExcedentes} excedente(s) = carga suplementar)`);
  console.log(`  Valor mensal cheio — jornada base: R$ ${periodo.valorMensalBase.toFixed(2)}`);
  console.log(`  Valor mensal cheio — carga suplementar: R$ ${periodo.valorMensalSuplementar.toFixed(2)}`);
  console.log(`  Rateio (${periodo.dias}/${periodo.totalDiasDoMes} dias) — jornada base: R$ ${periodo.valorRateadoBase.toFixed(2)}`);
  console.log(`  Rateio (${periodo.dias}/${periodo.totalDiasDoMes} dias) — carga suplementar: R$ ${periodo.valorRateadoSuplementar.toFixed(2)}`);
  console.log(`  Subtotal do período: R$ ${periodo.valorRateadoTotal.toFixed(2)}`);
  console.log("");
}

console.log(`VALOR ESPERADO TOTAL DO MÊS: R$ ${resultado.valorEsperadoTotal.toFixed(2)}`);
