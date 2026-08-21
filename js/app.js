// app.js
// -----------------------------------------------------------------------
// Ponto de entrada do app. Guarda o estado do caso sendo preenchido,
// controla a navegação entre os passos do wizard, e é o único lugar que
// "liga" a interface (HTML) com as regras (regras.js) e o cálculo
// (calculo.js). Se um dia você quiser conferir se o app está calculando
// certo, o lugar pra olhar é calculo.js — aqui é só orquestração e DOM.
// -----------------------------------------------------------------------

import { carregarRegras } from "./regras.js";
import {
  calcularCasoCompleto,
  diaAnterior,
  primeiroDiaDoMes,
  ultimoDiaDoMes,
} from "./calculo.js";
import { criarCartaoPeriodo, criarCartaoRubrica } from "./wizard.js";

const estado = {
  regras: null,
  mesReferencia: { ano: null, mes: null },
  periodos: [],
  valorHoraAula: null,
  rubricas: [],
  resultado: null,
};

const ORDEM_PASSOS = ["intro", "mes", "jornadas", "valor-aula", "rubricas", "resultado"];

function mostrarPasso(nome) {
  document.querySelectorAll("[data-passo]").forEach((secao) => {
    secao.hidden = secao.dataset.passo !== nome;
  });
  // Rolagem instantânea (não suave): uma rolagem animada ainda em andamento
  // quando a pessoa clica de novo rápido pode fazer o clique cair em cima
  // do elemento errado, porque a página ainda está se movendo debaixo do
  // cursor.
  window.scrollTo({ top: 0, behavior: "auto" });
}

function passoAtual() {
  const visivel = document.querySelector("[data-passo]:not([hidden])");
  return visivel?.dataset.passo ?? "intro";
}

function voltarUmPasso() {
  const indiceAtual = ORDEM_PASSOS.indexOf(passoAtual());
  if (indiceAtual > 0) {
    mostrarPasso(ORDEM_PASSOS[indiceAtual - 1]);
  }
}

// ------------------------- Passo: Jornadas -------------------------

function novoPeriodoPadrao() {
  const primeiraJornada = Object.keys(estado.regras.jornadasNomeadas)[0];
  return {
    jornadaNome: primeiraJornada,
    aulasAtribuidas: estado.regras.jornadasNomeadas[primeiraJornada].aulasComAlunosBase,
    dataInicio: "",
  };
}

function renderPeriodos() {
  const lista = document.getElementById("lista-periodos");
  lista.innerHTML = "";
  const dataInicioFixaTexto = primeiroDiaDoMes(estado.mesReferencia.ano, estado.mesReferencia.mes);

  estado.periodos.forEach((periodo, indice) => {
    const cartao = criarCartaoPeriodo({
      periodo,
      indice,
      jornadasNomeadas: estado.regras.jornadasNomeadas,
      dataInicioFixaTexto,
    });
    lista.appendChild(cartao);
    atualizarAjudaSuplementar(cartao, periodo);
  });
}

function atualizarAjudaSuplementar(cartao, periodo) {
  const jornada = estado.regras.jornadasNomeadas[periodo.jornadaNome];
  const paragrafo = cartao.querySelector(".campo-ajuda-suplementar");
  const excedentes = (periodo.aulasAtribuidas || 0) - jornada.aulasComAlunosBase;
  paragrafo.textContent =
    excedentes > 0
      ? `${excedentes} aula(s) acima da jornada "${periodo.jornadaNome}" → entra como carga suplementar.`
      : "";
}

document.getElementById("lista-periodos").addEventListener("change", (evento) => {
  const cartao = evento.target.closest(".cartao-periodo");
  if (!cartao) return;
  const indice = Number(cartao.dataset.indice);
  const periodo = estado.periodos[indice];

  if (evento.target.classList.contains("campo-jornada")) {
    periodo.jornadaNome = evento.target.value;
    periodo.aulasAtribuidas = estado.regras.jornadasNomeadas[periodo.jornadaNome].aulasComAlunosBase;
    renderPeriodos(); // reconstrói pra atualizar o campo de aulas atribuídas
    return;
  }
  if (evento.target.classList.contains("campo-aulas-atribuidas")) {
    periodo.aulasAtribuidas = Number(evento.target.value);
    atualizarAjudaSuplementar(cartao, periodo);
  }
  if (evento.target.classList.contains("campo-data-inicio")) {
    periodo.dataInicio = evento.target.value;
  }
});

document.getElementById("lista-periodos").addEventListener("click", (evento) => {
  if (evento.target.dataset.acao !== "remover-periodo") return;
  const cartao = evento.target.closest(".cartao-periodo");
  const indice = Number(cartao.dataset.indice);
  estado.periodos.splice(indice, 1);
  renderPeriodos();
});

document.querySelector('[data-acao="adicionar-periodo"]').addEventListener("click", () => {
  estado.periodos.push(novoPeriodoPadrao());
  renderPeriodos();
});

// ------------------------- Passo: Rubricas -------------------------

function renderRubricas() {
  const lista = document.getElementById("lista-rubricas");
  lista.innerHTML = "";
  estado.rubricas.forEach((rubrica, indice) => {
    lista.appendChild(criarCartaoRubrica({ rubrica, indice }));
  });
}

document.getElementById("lista-rubricas").addEventListener("input", (evento) => {
  const cartao = evento.target.closest(".cartao-rubrica");
  if (!cartao) return;
  const rubrica = estado.rubricas[Number(cartao.dataset.indice)];
  if (evento.target.classList.contains("campo-nome-rubrica")) {
    rubrica.nome = evento.target.value;
  }
  if (evento.target.classList.contains("campo-valor-rubrica")) {
    rubrica.valor = Number(evento.target.value);
  }
});

document.getElementById("lista-rubricas").addEventListener("click", (evento) => {
  if (evento.target.dataset.acao !== "remover-rubrica") return;
  const cartao = evento.target.closest(".cartao-rubrica");
  estado.rubricas.splice(Number(cartao.dataset.indice), 1);
  renderRubricas();
});

document.querySelector('[data-acao="adicionar-rubrica"]').addEventListener("click", () => {
  estado.rubricas.push({ nome: "", valor: null });
  renderRubricas();
});

// ------------------------- Montagem do caso p/ cálculo -------------------------

/**
 * Transforma estado.periodos (que só guarda a DATA DE INÍCIO de cada
 * mudança) na lista completa que calculo.js espera, calculando a data de
 * fim de cada período: um dia antes do início do período seguinte, ou o
 * último dia do mês para o último período. Isso é o que garante, por
 * construção, que não sobra buraco nem sobreposição entre períodos.
 */
function montarPeriodosParaCalculo() {
  const { ano, mes } = estado.mesReferencia;
  const periodosOrdenados = [...estado.periodos].sort((a, b) => {
    const dataA = a.dataInicio || primeiroDiaDoMes(ano, mes);
    const dataB = b.dataInicio || primeiroDiaDoMes(ano, mes);
    return dataA.localeCompare(dataB);
  });

  return periodosOrdenados.map((periodo, indice) => {
    const dataInicio = indice === 0 ? primeiroDiaDoMes(ano, mes) : periodo.dataInicio;
    const proximo = periodosOrdenados[indice + 1];
    const dataFim = proximo ? diaAnterior(proximo.dataInicio) : ultimoDiaDoMes(ano, mes);
    return {
      jornadaNome: periodo.jornadaNome,
      aulasAtribuidas: periodo.aulasAtribuidas,
      dataInicio,
      dataFim,
      valorHoraAula: estado.valorHoraAula,
    };
  });
}

function calcularEExibirResultado() {
  const erro = document.getElementById("erro-calculo");
  erro.hidden = true;

  const caso = {
    mesReferencia: estado.mesReferencia,
    periodosDeJornada: montarPeriodosParaCalculo(),
  };

  let resultado;
  try {
    resultado = calcularCasoCompleto(caso, estado.regras);
  } catch (erroCalculo) {
    erro.textContent = erroCalculo.message;
    erro.hidden = false;
    return false;
  }

  estado.resultado = resultado;
  renderResultado();
  mostrarPasso("resultado");
  return true;
}

// ------------------------- Passo: Resultado -------------------------

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function renderResultado() {
  const { resultado } = estado;
  const valorInformadoTotal = estado.rubricas.reduce((soma, r) => soma + (Number(r.valor) || 0), 0);
  const diferenca = valorInformadoTotal - resultado.valorEsperadoTotal;
  const TOLERANCIA = 0.01; // margem de centavo por arredondamento

  const diagnosticoEl = document.getElementById("resumo-diagnostico");
  let classe;
  let titulo;
  if (Math.abs(diferenca) < TOLERANCIA) {
    classe = "ok";
    titulo = "✅ Valor pago bate com o valor esperado";
  } else if (diferenca < 0) {
    classe = "a-menor";
    titulo = `🔴 Recebeu ${formatarMoeda(Math.abs(diferenca))} A MENOS do que o esperado`;
  } else {
    classe = "a-maior";
    titulo = `🟡 Recebeu ${formatarMoeda(diferenca)} A MAIS do que o esperado`;
  }

  diagnosticoEl.className = `diagnostico ${classe}`;
  diagnosticoEl.innerHTML = `
    ${titulo}
    <div class="valores">
      Valor esperado (calculado): <strong>${formatarMoeda(resultado.valorEsperadoTotal)}</strong><br />
      Valor informado (contracheque): <strong>${formatarMoeda(valorInformadoTotal)}</strong>
    </div>
  `;

  const memoriaEl = document.getElementById("memoria-calculo");
  memoriaEl.innerHTML = resultado.periodosCalculados
    .map(
      (p) => `
    <table class="tabela-memoria">
      <caption>Período: ${p.dataInicio} a ${p.dataFim} (${p.dias} de ${p.totalDiasDoMes} dias do mês) — Jornada ${p.jornadaNome}</caption>
      <tr><th>Composição da jornada base</th><td>${p.aulasBase} aulas com alunos + ${p.atpc} ATPC + ${p.atplApd} ATPL/APD (designação nominal: ${p.cargaHorariaSemanalNominal}h)</td></tr>
      <tr><th>Aulas atribuídas no período</th><td>${p.aulasAtribuidas} (${p.aulasExcedentes} excedente(s) = carga suplementar)</td></tr>
      <tr><th>Valor da hora-aula usado</th><td>${formatarMoeda(p.valorHoraAula)}</td></tr>
      <tr><th>Valor mensal cheio — jornada base</th><td>${formatarMoeda(p.valorMensalBase)} (= ${formatarMoeda(p.valorHoraAula)} × ${p.cargaHorariaSemanalNominal} × 5)</td></tr>
      <tr><th>Valor mensal cheio — carga suplementar</th><td>${formatarMoeda(p.valorMensalSuplementar)} (= ${formatarMoeda(p.valorHoraAula)} × ${p.aulasExcedentes} × 5)</td></tr>
      <tr><th>Rateio por dias corridos</th><td>${p.dias}/${p.totalDiasDoMes} dias do mês</td></tr>
      <tr><th>Subtotal do período</th><td><strong>${formatarMoeda(p.valorRateadoTotal)}</strong></td></tr>
    </table>
  `
    )
    .join("");

  const rubricasEl = document.getElementById("resumo-rubricas");
  rubricasEl.innerHTML = `
    <table class="tabela-memoria">
      <tr><th>Rubrica</th><th>Valor pago</th></tr>
      ${estado.rubricas
        .map((r) => `<tr><td>${r.nome || "(sem nome)"}</td><td>${formatarMoeda(Number(r.valor) || 0)}</td></tr>`)
        .join("")}
      <tr><th>Total informado</th><td><strong>${formatarMoeda(valorInformadoTotal)}</strong></td></tr>
    </table>
  `;
}

// ------------------------- Salvar / carregar caso -------------------------

function salvarCaso() {
  const dados = {
    mesReferencia: estado.mesReferencia,
    periodos: estado.periodos,
    valorHoraAula: estado.valorHoraAula,
    rubricas: estado.rubricas,
  };
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `conferencia-jornada-${estado.mesReferencia.ano}-${String(estado.mesReferencia.mes).padStart(2, "0")}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function carregarCasoDeArquivo(arquivo) {
  const leitor = new FileReader();
  leitor.onload = () => {
    try {
      const dados = JSON.parse(leitor.result);
      estado.mesReferencia = dados.mesReferencia;
      estado.periodos = dados.periodos;
      estado.valorHoraAula = dados.valorHoraAula;
      estado.rubricas = dados.rubricas;
      const sucesso = calcularEExibirResultado();
      if (!sucesso) mostrarPasso("rubricas"); // se der erro, deixa a usuária corrigir
    } catch (erro) {
      alert(`Não consegui ler esse arquivo de caso: ${erro.message}`);
    }
  };
  leitor.readAsText(arquivo);
}

// ------------------------- Ligações gerais de navegação -------------------------

document.addEventListener("click", (evento) => {
  const acao = evento.target.dataset.acao;
  if (!acao) return;

  switch (acao) {
    case "iniciar-novo":
      if (!estado.regras) {
        alert("Ainda carregando as regras (regras-jornada.json). Aguarde um instante e tente de novo.");
        return;
      }
      estado.mesReferencia = { ano: null, mes: null };
      estado.periodos = [];
      estado.valorHoraAula = null;
      estado.rubricas = [];
      estado.resultado = null;
      document.getElementById("campo-mes-referencia").value = "";
      mostrarPasso("mes");
      break;

    case "voltar":
      voltarUmPasso();
      break;

    case "avancar-mes": {
      const valor = document.getElementById("campo-mes-referencia").value; // "AAAA-MM"
      if (!valor) {
        alert("Escolha o mês de referência.");
        return;
      }
      estado.mesReferencia = { ano: Number(valor.slice(0, 4)), mes: Number(valor.slice(5, 7)) };
      if (estado.periodos.length === 0) {
        estado.periodos.push(novoPeriodoPadrao());
      }
      renderPeriodos();
      mostrarPasso("jornadas");
      break;
    }

    case "avancar-jornadas": {
      const erroEl = document.getElementById("erro-jornadas");
      const problema = estado.periodos.find((p, i) => {
        if (!p.aulasAtribuidas || p.aulasAtribuidas < 1) return true;
        if (i > 0 && !p.dataInicio) return true;
        return false;
      });
      if (problema) {
        erroEl.textContent = "Preencha jornada, aulas atribuídas e data de início de cada mudança antes de continuar.";
        erroEl.hidden = false;
        return;
      }
      erroEl.hidden = true;

      const sugestao = estado.regras.valorDaHoraAula.valorMinimoLegal.valorCalculado;
      const campoValor = document.getElementById("campo-valor-hora-aula");
      if (!campoValor.value) campoValor.value = sugestao;
      document.getElementById("ajuda-valor-minimo").textContent =
        `Mínimo legal de referência: ${formatarMoeda(sugestao)} (Decreto 70.483/2026). O valor real do professor pode ser maior.`;
      mostrarPasso("valor-aula");
      break;
    }

    case "avancar-valor-aula": {
      const valor = Number(document.getElementById("campo-valor-hora-aula").value);
      if (!valor || valor <= 0) {
        alert("Informe um valor de hora-aula válido.");
        return;
      }
      estado.valorHoraAula = valor;
      if (estado.rubricas.length === 0) estado.rubricas.push({ nome: "", valor: null });
      renderRubricas();
      mostrarPasso("rubricas");
      break;
    }

    case "calcular":
      calcularEExibirResultado();
      break;

    case "voltar-inicio":
      mostrarPasso("intro");
      break;

    case "salvar-caso":
      salvarCaso();
      break;

    case "imprimir":
      window.print();
      break;
  }
});

document.getElementById("input-carregar-caso").addEventListener("change", (evento) => {
  const arquivo = evento.target.files[0];
  if (arquivo) carregarCasoDeArquivo(arquivo);
});

// ------------------------- Inicialização -------------------------

carregarRegras()
  .then((regras) => {
    estado.regras = regras;
  })
  .catch((erro) => {
    alert(`Não consegui carregar regras-jornada.json: ${erro.message}`);
  });
