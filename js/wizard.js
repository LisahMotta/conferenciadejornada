// wizard.js
// -----------------------------------------------------------------------
// Este módulo só monta pedaços de HTML (os "cartões" de período de
// jornada e de rubrica do contracheque). Não guarda estado, não valida
// nada de regra de negócio — isso fica no app.js e no calculo.js.
// -----------------------------------------------------------------------

/**
 * Monta o cartão de UM período de jornada dentro do wizard.
 *
 * - O primeiro período (indice 0) sempre começa no dia 1 do mês, então não
 *   mostramos campo de data — só informamos o valor fixo.
 * - Os demais períodos pedem a data de início da mudança; a data de fim é
 *   sempre calculada automaticamente (um dia antes do próximo período, ou
 *   o último dia do mês se for o último período) — por isso não existe
 *   campo de "data fim" em lugar nenhum do formulário.
 */
export function criarCartaoPeriodo({
  periodo,
  indice,
  jornadasNomeadas,
  dataInicioFixaTexto,
}) {
  const cartao = document.createElement("div");
  cartao.className = "cartao-periodo";
  cartao.dataset.indice = String(indice);

  const opcoesJornada = Object.keys(jornadasNomeadas)
    .map((nome) => {
      const selecionado = nome === periodo.jornadaNome ? "selected" : "";
      return `<option value="${nome}" ${selecionado}>${nome} (${jornadasNomeadas[nome].aulasComAlunosBase} aulas com alunos)</option>`;
    })
    .join("");

  const campoData =
    indice === 0
      ? `<p class="ajuda">Início: dia 1 do mês (${dataInicioFixaTexto})</p>`
      : `
        <label>
          A partir de qual data vale essa jornada nova?
          <input type="date" class="campo-data-inicio" value="${periodo.dataInicio ?? ""}" required />
        </label>
      `;

  const botaoRemover =
    indice === 0
      ? ""
      : `<button type="button" class="remover" data-acao="remover-periodo">Remover</button>`;

  cartao.innerHTML = `
    ${botaoRemover}
    <label>
      Jornada
      <select class="campo-jornada">${opcoesJornada}</select>
    </label>
    ${campoData}
    <label>
      Aulas com alunos atribuídas
      <input type="number" class="campo-aulas-atribuidas" min="1" step="1" value="${periodo.aulasAtribuidas ?? ""}" required />
    </label>
    <p class="ajuda campo-ajuda-suplementar"></p>
  `;

  return cartao;
}

/**
 * Monta o cartão de UMA rubrica candidata, extraída de um PDF de
 * holerite — com uma caixinha de marcar, porque a decisão de incluir ou
 * não continua sendo da usuária (ver leitor-holerite.js e app.js).
 */
export function criarCartaoCandidata({ candidata, indice }) {
  const cartao = document.createElement("label");
  cartao.className = "cartao-candidata";
  cartao.dataset.indice = String(indice);

  const ehProvento = candidata.valor >= 0;
  const classeValor = ehProvento ? "valor-provento" : "valor-desconto";
  const valorFormatado = candidata.valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  cartao.innerHTML = `
    <input type="checkbox" class="campo-candidata-marcada" />
    <span>
      <strong>${candidata.codigo}</strong> — ${candidata.nome}
      <span class="${classeValor}"> ${valorFormatado}</span><br />
      <span class="detalhe">${candidata.periodo}${candidata.quantidade ? ` · ${candidata.quantidade} ${candidata.unidade}` : ""}</span>
    </span>
  `;

  return cartao;
}

/** Monta o cartão de UMA rubrica do contracheque (nome livre + valor). */
export function criarCartaoRubrica({ rubrica, indice }) {
  const cartao = document.createElement("div");
  cartao.className = "cartao-rubrica";
  cartao.dataset.indice = String(indice);

  cartao.innerHTML = `
    <button type="button" class="remover" data-acao="remover-rubrica">Remover</button>
    <label>
      Nome da rubrica (como está no holerite)
      <input type="text" class="campo-nome-rubrica" value="${rubrica.nome ?? ""}" placeholder="ex.: Vencimento" required />
    </label>
    <label>
      Valor pago (R$)
      <input type="number" class="campo-valor-rubrica" step="0.01" min="0" value="${rubrica.valor ?? ""}" required />
    </label>
  `;

  return cartao;
}
