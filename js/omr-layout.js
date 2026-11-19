// Layout da folha de respostas (cartão-resposta).
// Todas as coordenadas em milímetros, relativas ao CENTRO do marcador superior-esquerdo.
// O leitor usa exatamente este mesmo layout para saber onde estão as bolhas.

import { LETRAS, esc } from './ui.js';

export const FOLHA = {
  W: 180,          // distância horizontal entre centros dos marcadores
  H: 250,          // distância vertical entre centros dos marcadores
  marcador: 9,     // lado do quadrado marcador
  offsetX: 15,     // posição do marcador TL na página A4
  offsetY: 22,
  raio: 2.3,       // raio da bolha
  barra: { x: 70, y: -2.5, w: 40, h: 5 }, // barra de orientação (topo)
  gradeTopo: 64,
  gradeFundo: 244,
  altLinha: 6.4,
  passoAlt: 6.6,
};

export const MAX_LINHAS = Math.floor((FOLHA.gradeFundo - FOLHA.gradeTopo) / FOLHA.altLinha);

function larguraColuna(nAlt) {
  return 10 + nAlt * FOLHA.passoAlt + 5;
}

export function maxQuestoes(nAlt) {
  const cols = Math.floor((FOLHA.W - 4) / larguraColuna(nAlt));
  return cols * MAX_LINHAS;
}

/**
 * Calcula a posição de todas as bolhas.
 * @returns {{questoes: {x,y}[][], numero: {x,y}[][], tipo: {x,y}[], colunas: {x, letrasY}[]}}
 */
export function calcularLayout(nQuestoes, nAlt, nTipos) {
  const cw = larguraColuna(nAlt);
  const nCols = Math.ceil(nQuestoes / MAX_LINHAS);
  const porCol = Math.ceil(nQuestoes / nCols);
  const larguraTotal = nCols * cw;
  const x0 = (FOLHA.W - larguraTotal) / 2;
  const questoes = [];
  const colunas = [];
  for (let c = 0; c < nCols; c++) {
    const cx = x0 + c * cw;
    colunas.push({ x: cx, numX: cx + 8, primeiraX: cx + 10 + FOLHA.passoAlt / 2 });
  }
  for (let q = 0; q < nQuestoes; q++) {
    const c = Math.floor(q / porCol);
    const l = q % porCol;
    const y = FOLHA.gradeTopo + l * FOLHA.altLinha + FOLHA.altLinha / 2;
    const linha = [];
    for (let a = 0; a < nAlt; a++) linha.push({ x: colunas[c].primeiraX + a * FOLHA.passoAlt, y });
    questoes.push(linha);
  }
  // Número do aluno: 2 linhas (dezena, unidade) × 10 dígitos
  const numero = [0, 1].map((r) => Array.from({ length: 10 }, (_, d) => ({ x: 62 + d * 7, y: 30 + r * 7 })));
  const tipo = nTipos > 1 ? Array.from({ length: nTipos }, (_, i) => ({ x: 62 + i * 7, y: 48 })) : [];
  return { questoes, numero, tipo, colunas, porCol };
}

/**
 * Gera o SVG (em mm) de uma página A4 com a folha de respostas.
 * opts: { titulo, subtitulo, nQuestoes, nAlt, tipos: ['A','B'], tipoMarcado: index|null }
 */
export function svgFolha(opts) {
  const { titulo = '', subtitulo = '', nQuestoes, nAlt, tipos = [], tipoMarcado = null } = opts;
  const L = calcularLayout(nQuestoes, nAlt, tipos.length);
  const { offsetX: ox, offsetY: oy, raio: r } = FOLHA;
  const P = (x, y) => `x="${(x + ox).toFixed(2)}" y="${(y + oy).toFixed(2)}"`;
  const C = (x, y) => `cx="${(x + ox).toFixed(2)}" cy="${(y + oy).toFixed(2)}"`;
  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" class="folha-svg" viewBox="0 0 210 297" width="210mm" height="297mm" font-family="Arial, Helvetica, sans-serif">`);
  s.push('<rect width="210" height="297" fill="#fff"/>');
  // marcadores
  const m = FOLHA.marcador;
  for (const [x, y] of [[0, 0], [FOLHA.W, 0], [FOLHA.W, FOLHA.H], [0, FOLHA.H]]) {
    s.push(`<rect ${P(x - m / 2, y - m / 2)} width="${m}" height="${m}" fill="#000"/>`);
  }
  // barra de orientação
  const b = FOLHA.barra;
  s.push(`<rect ${P(b.x, b.y)} width="${b.w}" height="${b.h}" fill="#000"/>`);
  // cabeçalho
  s.push(`<text ${P(FOLHA.W / 2, 10)} font-size="5" font-weight="bold" text-anchor="middle">FOLHA DE RESPOSTAS</text>`);
  if (titulo) s.push(`<text ${P(FOLHA.W / 2, 15)} font-size="3.4" text-anchor="middle">${esc(titulo)}</text>`);
  if (subtitulo) s.push(`<text ${P(FOLHA.W / 2, 19)} font-size="3" text-anchor="middle" fill="#444">${esc(subtitulo)}</text>`);
  s.push(`<text ${P(4, 25)} font-size="3.2">Nome:</text>`);
  s.push(`<line x1="${ox + 15}" y1="${oy + 25.5}" x2="${ox + 176}" y2="${oy + 25.5}" stroke="#000" stroke-width="0.3"/>`);
  // número do aluno
  s.push(`<text ${P(4, 31)} font-size="3" font-weight="bold">Nº do aluno</text>`);
  s.push(`<text ${P(4, 35)} font-size="2.4" fill="#555">dezena / unidade</text>`);
  ['Dez.', 'Uni.'].forEach((t, i) => s.push(`<text ${P(50, 31 + i * 7)} font-size="2.6" fill="#333">${t}</text>`));
  L.numero.forEach((linha) => linha.forEach((p, d) => {
    s.push(`<circle ${C(p.x, p.y)} r="${r}" fill="none" stroke="#555" stroke-width="0.3"/>`);
    s.push(`<text ${P(p.x, p.y + 0.9)} font-size="2.5" text-anchor="middle" fill="#888">${d}</text>`);
  }));
  // tipo de prova
  if (L.tipo.length) {
    s.push(`<text ${P(4, 49)} font-size="3" font-weight="bold">Tipo de prova</text>`);
    L.tipo.forEach((p, i) => {
      const marcada = tipoMarcado === i;
      s.push(`<circle ${C(p.x, p.y)} r="${r}" fill="${marcada ? '#000' : 'none'}" stroke="#555" stroke-width="0.3"/>`);
      if (!marcada) s.push(`<text ${P(p.x, p.y + 0.9)} font-size="2.6" text-anchor="middle" fill="#888">${esc(tipos[i])}</text>`);
    });
    if (tipoMarcado !== null && tipoMarcado !== undefined) {
      s.push(`<text ${P(62 + L.tipo.length * 7 + 2, 49)} font-size="3.2" font-weight="bold">TIPO ${esc(tipos[tipoMarcado])}</text>`);
    }
  }
  s.push(`<text ${P(4, 57)} font-size="2.6" fill="#333">Preencha totalmente a bolinha com caneta preta ou azul. Não rasure e não marque fora das bolinhas.</text>`);
  // exemplo
  s.push(`<text ${P(140, 31)} font-size="2.4" fill="#555">Correto:</text>`);
  s.push(`<circle ${C(156, 30.2)} r="${r}" fill="#000"/>`);
  s.push(`<text ${P(140, 38)} font-size="2.4" fill="#555">Errado:</text>`);
  s.push(`<circle ${C(156, 37.2)} r="${r}" fill="none" stroke="#555" stroke-width="0.3"/><path d="M${ox + 154.6} ${oy + 37.2} l1 1 l2 -2.4" stroke="#000" stroke-width="0.5" fill="none"/>`);
  s.push(`<circle ${C(163, 37.2)} r="${r}" fill="none" stroke="#555" stroke-width="0.3"/><path d="M${ox + 161.6} ${oy + 35.8} l2.8 2.8 M${ox + 164.4} ${oy + 35.8} l-2.8 2.8" stroke="#000" stroke-width="0.5"/>`);
  // grade de questões
  L.colunas.forEach((col) => {
    for (let a = 0; a < nAlt; a++) {
      s.push(`<text ${P(col.primeiraX + a * FOLHA.passoAlt, FOLHA.gradeTopo - 1.5)} font-size="2.8" font-weight="bold" text-anchor="middle">${LETRAS[a]}</text>`);
    }
  });
  L.questoes.forEach((linha, q) => {
    const c = Math.floor(q / L.porCol);
    const col = L.colunas[c];
    const y = linha[0].y;
    if ((q % L.porCol) % 2 === 0) {
      s.push(`<rect x="${(col.x + ox).toFixed(2)}" y="${(y - FOLHA.altLinha / 2 + oy).toFixed(2)}" width="${(10 + nAlt * FOLHA.passoAlt).toFixed(2)}" height="${FOLHA.altLinha}" fill="#f1f1f1"/>`);
    }
    s.push(`<text ${P(col.numX, y + 1)} font-size="3" font-weight="bold" text-anchor="end">${q + 1}</text>`);
    linha.forEach((p, a) => {
      s.push(`<circle ${C(p.x, p.y)} r="${r}" fill="#fff" stroke="#555" stroke-width="0.3"/>`);
      s.push(`<text ${P(p.x, p.y + 0.9)} font-size="2.5" text-anchor="middle" fill="#999">${LETRAS[a]}</text>`);
    });
  });
  s.push('</svg>');
  return s.join('');
}

// =====================================================================================
// Geometrias que o leitor reconhece. Cada uma descreve o retângulo dos 4 marcadores
// (W × H, em mm, entre centros), a barra de orientação, pontos de referência de branco
// e a posição de todas as bolhas.
// =====================================================================================

/** Folha de respostas de página inteira (A4). */
export function geometriaFolha(nQuestoes, nAlt, nTipos) {
  return {
    formato: 'folha', W: FOLHA.W, H: FOLHA.H, marcador: FOLHA.marcador, raio: FOLHA.raio, barra: FOLHA.barra,
    brancos: [[30, 0], [45, 0], [140, 0]],
    ...calcularLayout(nQuestoes, nAlt, nTipos),
  };
}

/** Gabarito compacto: o mesmo padrão da folha, em um bloco que cabe dentro do caderno da prova.
 *  Só tipo de prova e alternativas (sem número do aluno), para ocupar pouco espaço. */
export const COMPACTO = {
  W: 176, marcador: 7, raio: 2.1, barra: { x: 68, y: -2, w: 40, h: 4 },
  linhaTopo: 8.6, gradeTopo: 14.6, altLinha: 5.6, passoAlt: 5.6, linhasPadrao: 5,
};

function larguraColunaCompacta(nAlt) { return 8 + nAlt * COMPACTO.passoAlt + 4; }

export function geometriaCompacta(nQuestoes, nAlt, nTipos) {
  const C = COMPACTO;
  const cw = larguraColunaCompacta(nAlt);
  const maxCols = Math.max(1, Math.floor((C.W - 8) / cw));
  // colunas de 5 questões; se não couberem, as colunas ficam mais altas
  const nCols = Math.max(1, Math.min(maxCols, Math.ceil(nQuestoes / C.linhasPadrao)));
  const porCol = Math.max(1, Math.ceil(nQuestoes / nCols));
  const x0 = (C.W - nCols * cw) / 2;
  const colunas = Array.from({ length: nCols }, (_, c) => {
    const cx = x0 + c * cw;
    return { x: cx, numX: cx + 6.6, primeiraX: cx + 8 + C.passoAlt / 2 };
  });
  const questoes = [];
  for (let q = 0; q < nQuestoes; q++) {
    const c = Math.floor(q / porCol), l = q % porCol;
    const y = C.gradeTopo + l * C.altLinha + C.altLinha / 2;
    questoes.push(Array.from({ length: nAlt }, (_, a) => ({ x: colunas[c].primeiraX + a * C.passoAlt, y })));
  }
  const tipo = nTipos > 1 ? Array.from({ length: nTipos }, (_, i) => ({ x: 18.5 + i * 5.6, y: C.linhaTopo })) : [];
  const H = C.gradeTopo + porCol * C.altLinha + 3.5;
  return {
    formato: 'compacto', W: C.W, H, marcador: C.marcador, raio: C.raio, barra: C.barra,
    brancos: [[40, 0], [125, 0], [150, 0]],
    questoes, numero: [], tipo, colunas, porCol, passoAlt: C.passoAlt, altLinha: C.altLinha, gradeTopo: C.gradeTopo,
  };
}

/** SVG do gabarito compacto (lido pelo Leitor). opts: {nQuestoes, nAlt, tipos, tipoMarcado} */
export function svgCompacto({ nQuestoes, nAlt, tipos = [], tipoMarcado = null }) {
  const L = geometriaCompacta(nQuestoes, nAlt, tipos.length);
  const m = L.marcador / 2 + 0.6;
  const r = L.raio;
  const yl = COMPACTO.linhaTopo;
  const P = (x, y) => `x="${(x + m).toFixed(2)}" y="${(y + m).toFixed(2)}"`;
  const C = (x, y) => `cx="${(x + m).toFixed(2)}" cy="${(y + m).toFixed(2)}"`;
  const Wt = L.W + 2 * m, Ht = L.H + 2 * m;
  const s = [`<svg xmlns="http://www.w3.org/2000/svg" class="gab-compacto" viewBox="0 0 ${Wt.toFixed(2)} ${Ht.toFixed(2)}" width="${Wt.toFixed(2)}mm" height="${Ht.toFixed(2)}mm" font-family="Arial, Helvetica, sans-serif">`];
  s.push(`<rect width="${Wt.toFixed(2)}" height="${Ht.toFixed(2)}" fill="#fff"/>`);
  for (const [x, y] of [[0, 0], [L.W, 0], [L.W, L.H], [0, L.H]]) s.push(`<rect ${P(x - L.marcador / 2, y - L.marcador / 2)} width="${L.marcador}" height="${L.marcador}" fill="#000"/>`);
  const b = L.barra;
  s.push(`<rect ${P(b.x, b.y)} width="${b.w}" height="${b.h}" fill="#000"/>`);
  s.push(`<text ${P(6, 1.4)} font-size="3.3" font-weight="bold">GABARITO</text>`);
  // linha única: TIPO · Correto · Errado
  if (L.tipo.length) {
    s.push(`<text ${P(6, yl + 0.95)} font-size="2.7" font-weight="bold">TIPO</text>`);
    L.tipo.forEach((p, i) => {
      const marcada = tipoMarcado === i;
      s.push(`<circle ${C(p.x, p.y)} r="${r}" fill="${marcada ? '#000' : 'none'}" stroke="#555" stroke-width="0.28"/>`);
      if (!marcada) s.push(`<text ${P(p.x, p.y + 0.85)} font-size="2.4" text-anchor="middle" fill="#888">${esc(tipos[i])}</text>`);
    });
  }
  const xc = L.W - 6 - 37.6; // "Correto/Errado" alinhados à direita, junto ao marcador
  s.push(`<text ${P(xc, yl + 0.9)} font-size="2.5" fill="#333">Correto:</text>`);
  s.push(`<circle ${C(xc + 12.5, yl)} r="${r}" fill="#000"/>`);
  s.push(`<text ${P(xc + 18, yl + 0.9)} font-size="2.5" fill="#333">Errado:</text>`);
  s.push(`<circle ${C(xc + 29.5, yl)} r="${r}" fill="none" stroke="#555" stroke-width="0.28"/><path d="M${(xc + 28.2 + m).toFixed(2)} ${(yl + m).toFixed(2)} l1 1 l2 -2.3" stroke="#000" stroke-width="0.5" fill="none"/>`);
  s.push(`<circle ${C(xc + 35.5, yl)} r="${r}" fill="none" stroke="#555" stroke-width="0.28"/><path d="M${(xc + 34.2 + m).toFixed(2)} ${(yl - 1.3 + m).toFixed(2)} l2.6 2.6 M${(xc + 36.8 + m).toFixed(2)} ${(yl - 1.3 + m).toFixed(2)} l-2.6 2.6" stroke="#000" stroke-width="0.5"/>`);
  // grade (letras sempre maiúsculas)
  L.colunas.forEach((col) => {
    for (let a = 0; a < nAlt; a++) s.push(`<text ${P(col.primeiraX + a * L.passoAlt, L.gradeTopo - 0.9)} font-size="2.5" font-weight="bold" text-anchor="middle">${LETRAS[a]}</text>`);
  });
  L.questoes.forEach((linha, q) => {
    const col = L.colunas[Math.floor(q / L.porCol)];
    const y = linha[0].y;
    if ((q % L.porCol) % 2 === 0) s.push(`<rect x="${(col.x + m).toFixed(2)}" y="${(y - L.altLinha / 2 + m).toFixed(2)}" width="${(8 + nAlt * L.passoAlt).toFixed(2)}" height="${L.altLinha}" fill="#ececec"/>`);
    s.push(`<text ${P(col.numX, y + 0.95)} font-size="2.8" font-weight="bold" text-anchor="end">${q + 1}</text>`);
    linha.forEach((p, a) => {
      s.push(`<circle ${C(p.x, p.y)} r="${r}" fill="#fff" stroke="#555" stroke-width="0.28"/>`);
      s.push(`<text ${P(p.x, p.y + 0.85)} font-size="2.3" text-anchor="middle" fill="#999">${LETRAS[a]}</text>`);
    });
  });
  s.push('</svg>');
  return s.join('');
}
