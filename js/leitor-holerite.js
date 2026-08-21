// leitor-holerite.js
// -----------------------------------------------------------------------
// Lê um PDF de holerite (Demonstrativo de Pagamento da folha do Estado de
// SP) e extrai as linhas da tabela de rubricas (Código, Denominação, Nat.,
// Qtde., Unid., Período, Valor) como CANDIDATAS — este módulo nunca decide
// sozinho quais rubricas "valem" pra conferência de jornada, ele só lê o
// que está escrito no PDF. A escolha de quais linhas usar é sempre da
// pessoa usando o app (ver app.js).
//
// Tudo roda no navegador via pdf.js (js/vendor/pdfjs/). O arquivo do
// holerite NUNCA sai do navegador — não tem upload pra servidor nenhum.
//
// Como funciona a extração, resumidamente: o pdf.js devolve cada pedacinho
// de texto do PDF com sua posição (x, y) na página — não devolve "linhas"
// prontas. Então a gente:
//   1) agrupa os pedaços de texto que estão na mesma altura (y) em linhas;
//   2) acha a linha de cabeçalho da tabela ("Código | Denominação | ...")
//      pra saber em que posição (x) cada coluna começa;
//   3) pra cada outra linha da página, usa essas posições pra decidir qual
//      pedaço de texto pertence a qual coluna;
//   4) só considera "candidata a rubrica" a linha cujo primeiro pedaço
//      (coluna Código) tem o formato "99.999" (dois dígitos, ponto, três
//      dígitos) — é assim que o sistema da folha do Estado numera as
//      rubricas, então isso filtra sozinho cabeçalho/rodapé/resto da
//      página sem precisar adivinhar onde a tabela termina.
// -----------------------------------------------------------------------

import * as pdfjsLib from "./vendor/pdfjs/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "./vendor/pdfjs/pdf.worker.min.mjs",
  import.meta.url
).href;

const PADRAO_CODIGO_RUBRICA = /^\d{2}\.\d{3}$/;

// Nomes das colunas, na ordem em que aparecem no cabeçalho da tabela do
// demonstrativo de pagamento do Estado de SP.
const COLUNAS_ESPERADAS = [
  "codigo",
  "nome",
  "natureza",
  "quantidade",
  "unidade",
  "periodo",
  "valor",
];

/**
 * Lê um arquivo PDF (File, vindo de um <input type="file">) e devolve, pra
 * cada página, a lista de linhas reconstruídas — cada linha é uma lista de
 * { texto, x }, ordenada da esquerda pra direita.
 */
export async function lerLinhasDoPdf(arquivo) {
  const dados = await arquivo.arrayBuffer();
  const documento = await pdfjsLib.getDocument({ data: dados }).promise;

  const paginas = [];
  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    const conteudo = await pagina.getTextContent();
    paginas.push(agruparEmLinhas(conteudo.items));
  }
  return paginas;
}

/**
 * Agrupa os pedaços de texto do pdf.js em linhas, pela posição vertical
 * (y). Pedaços cuja posição y difere em menos de 2 pontos são tratados
 * como a mesma linha (pequenas variações de fonte podem gerar y's quase
 * iguais, mas não idênticos).
 */
function agruparEmLinhas(items) {
  const comTexto = items.filter((item) => item.str.trim() !== "");
  const porY = [];

  for (const item of comTexto) {
    const y = item.transform[5];
    const x = item.transform[4];
    let linha = porY.find((l) => Math.abs(l.y - y) < 2);
    if (!linha) {
      linha = { y, itens: [] };
      porY.push(linha);
    }
    linha.itens.push({ texto: item.str, x });
  }

  // De cima pra baixo (y maior = mais alto na página).
  porY.sort((a, b) => b.y - a.y);
  porY.forEach((linha) => linha.itens.sort((a, b) => a.x - b.x));

  return porY.map((linha) => linha.itens);
}

/** Acha a linha de cabeçalho da tabela de rubricas dentro das linhas de uma página. */
function acharCabecalhoDaTabela(linhas) {
  return linhas.find((linha) => {
    const textoDaLinha = linha.map((i) => i.texto).join(" ");
    return textoDaLinha.includes("Código") && textoDaLinha.includes("Denominação") && textoDaLinha.includes("Valor");
  });
}

/**
 * A partir da linha de cabeçalho, calcula os limites (em x) de cada
 * coluna: cada coluna vai do meio-do-caminho até o cabeçalho anterior até
 * o meio-do-caminho até o cabeçalho seguinte.
 */
function calcularLimitesDasColunas(linhaCabecalho) {
  const xsDosCabecalhos = linhaCabecalho.map((i) => i.x);
  const limites = xsDosCabecalhos.map((x, indice) => {
    const anterior = xsDosCabecalhos[indice - 1];
    const inicio = anterior === undefined ? -Infinity : (anterior + x) / 2;
    return inicio;
  });
  return limites; // limites[i] = a partir de que x começa a coluna i
}

/** Descobre em qual coluna (índice) um x cai, dado os limites calculados acima. */
function acharColuna(x, limites) {
  let coluna = 0;
  for (let i = 0; i < limites.length; i++) {
    if (x >= limites[i]) coluna = i;
  }
  return coluna;
}

/**
 * Converte um texto de valor no formato brasileiro do demonstrativo (ex.:
 * "2.659,00 +" ou "19,79 -") num número, junto com o sinal (positivo =
 * provento, negativo = desconto).
 */
function interpretarValor(texto) {
  const negativo = /-\s*$/.test(texto);
  const somenteNumero = texto.replace(/[^\d,]/g, ""); // tira tudo que não é dígito ou vírgula
  const comPontoDecimal = somenteNumero.replace(",", ".");
  const numero = Number(comPontoDecimal);
  if (Number.isNaN(numero)) return null;
  return negativo ? -numero : numero;
}

/**
 * Varre as linhas de uma página e devolve as linhas candidatas a rubrica:
 * qualquer linha cuja coluna "Código" bate com o padrão "99.999".
 *
 * Cada candidata devolvida tem: codigo, nome, natureza, quantidade,
 * unidade, periodo, valor (número, já com sinal), valorTexto (como
 * apareceu no PDF, pra conferência visual).
 */
export function extrairRubricasCandidatas(linhasDaPagina) {
  const cabecalho = acharCabecalhoDaTabela(linhasDaPagina);
  if (!cabecalho) return [];

  const limites = calcularLimitesDasColunas(cabecalho);
  const candidatas = [];

  for (const linha of linhasDaPagina) {
    if (linha === cabecalho) continue;

    const colunas = COLUNAS_ESPERADAS.map(() => []);
    for (const item of linha) {
      const indiceColuna = Math.min(acharColuna(item.x, limites), COLUNAS_ESPERADAS.length - 1);
      colunas[indiceColuna].push(item.texto);
    }
    const [codigo, nome, natureza, quantidade, unidade, periodo, valorTexto] = colunas.map((c) =>
      c.join(" ").trim()
    );

    if (!PADRAO_CODIGO_RUBRICA.test(codigo)) continue; // não é uma linha de rubrica de verdade

    const valor = interpretarValor(valorTexto);
    if (valor === null) continue; // sem valor legível, melhor não oferecer como candidata

    candidatas.push({ codigo, nome, natureza, quantidade, unidade, periodo, valor, valorTexto });
  }

  return candidatas;
}

/** Lê o PDF inteiro e já devolve todas as rubricas candidatas de todas as páginas. */
export async function lerRubricasCandidatasDoPdf(arquivo) {
  const paginas = await lerLinhasDoPdf(arquivo);
  return paginas.flatMap((linhas) => extrairRubricasCandidatas(linhas));
}
