// Cartão "Formatação" da avaliação, com ferramentas no estilo do Word
// (Margens, Tamanho, Colunas, Espaçamento, Fonte, Alinhamento), padrão ABNT,
// "Definir como padrão", estimativa de páginas e mini-página ao vivo.

import { h, esc, modal, campo, toast, confirmar } from './ui.js';
import { svg, abrirPop, fecharPop, menu, combo } from './editor-ui.js';
import {
  PAPEIS, MARGENS_PRESET, margemDe, papelDe, fmtCm, divergenciasABNT, aplicarABNT, definirComoPadrao, restaurarPadraoABNT, padraoUsuario,
} from './formato-pagina.js';

// ------------------------------------------------------------------ desenhos (SVG)
const S = (vb, corpo, extra = '') => `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${corpo}</svg>`;
const linhas = (x, y, w, n, passo = 4) => Array.from({ length: n }, (_, i) => `<path d="M${x} ${y + i * passo}h${i === n - 1 ? w * 0.6 : w}"/>`).join('');

/** Página com as margens desenhadas na proporção real. */
function desenhoMargens(m, papel = PAPEIS.A4) {
  const W = 30, H = (W * papel.h) / papel.w, k = W / (papel.w / 10);
  const x = 1 + m.esq * k, y = 1 + m.sup * k, w = W - (m.esq + m.dir) * k, hh = H - (m.sup + m.inf) * k;
  const n = Math.max(2, Math.floor((hh - 3) / 3.2));
  return S(`0 0 ${W + 2} ${(H + 2).toFixed(2)}`, `<rect x="1" y="1" width="${W}" height="${H.toFixed(2)}" rx="1.5" fill="#fff"/><rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${hh.toFixed(2)}" stroke-dasharray="1.4 1.4" stroke-width="1" opacity=".75"/>${linhas(+(x + 1.5).toFixed(2), +(y + 2.5).toFixed(2), +Math.max(2, w - 3).toFixed(2), Math.min(n, 9), 3.2)}`);
}
function desenhoColunas(n, linha = true) {
  const x0 = 5, x1 = 25, gap = 2.5;
  const cw = (x1 - x0 - gap * (n - 1)) / n;
  let corpo = '<rect x="2" y="2" width="26" height="36" rx="2" fill="#fff"/>';
  for (let c = 0; c < n; c++) corpo += linhas(+(x0 + c * (cw + gap)).toFixed(2), 8, +cw.toFixed(2), 7);
  if (linha) for (let c = 1; c < n; c++) corpo += `<path d="M${(x0 + c * (cw + gap) - gap / 2).toFixed(2)} 7v27" stroke-dasharray="1.2 1.2" opacity=".6"/>`;
  return S('0 0 30 40', corpo);
}
function desenhoPapel(p) {
  const k = 34 / p.h, w = p.w * k;
  return S('0 0 30 38', `<rect x="${((30 - w) / 2).toFixed(2)}" y="2" width="${w.toFixed(2)}" height="34" rx="1.5" fill="#fff"/><text x="15" y="22" font-size="6" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial">${p.nome === 'Ofício' ? 'OF' : p.nome}</text>`);
}
const DESENHO = {
  numAcima: S('0 0 44 28', `<rect x="3" y="3" width="13" height="6" rx="1.5" fill="currentColor" stroke="none"/>${linhas(3, 15, 38, 3, 5)}`),
  numLinha: S('0 0 44 28', `<rect x="3" y="4" width="13" height="6" rx="1.5" fill="currentColor" stroke="none"/><path d="M19 7h22"/>${linhas(3, 15, 38, 2, 5)}`),
  altLista: S('0 0 44 28', [0, 1, 2, 3].map((i) => `<circle cx="5" cy="${4 + i * 6.5}" r="2"/><path d="M10 ${4 + i * 6.5}h16"/>`).join('')),
  altDuas: S('0 0 44 28', [0, 1].map((i) => `<circle cx="5" cy="${7 + i * 12}" r="2"/><path d="M10 ${7 + i * 12}h10"/><circle cx="25" cy="${7 + i * 12}" r="2"/><path d="M30 ${7 + i * 12}h10"/>`).join('')),
  altLinha: S('0 0 44 28', [0, 1, 2, 3].map((i) => `<circle cx="${4 + i * 10.5}" cy="14" r="2"/><path d="M${7.5 + i * 10.5} 14h4"/>`).join('')),
  numPagTopo: S('0 0 30 40', `<rect x="2" y="2" width="26" height="36" rx="2" fill="#fff"/><rect x="21" y="4.5" width="4" height="3" fill="currentColor" stroke="none"/>${linhas(6, 12, 18, 6)}`),
  numPagRodC: S('0 0 30 40', `<rect x="2" y="2" width="26" height="36" rx="2" fill="#fff"/><rect x="13" y="33" width="4" height="3" fill="currentColor" stroke="none"/>${linhas(6, 8, 18, 6)}`),
  numPagRodD: S('0 0 30 40', `<rect x="2" y="2" width="26" height="36" rx="2" fill="#fff"/><rect x="21" y="33" width="4" height="3" fill="currentColor" stroke="none"/>${linhas(6, 8, 18, 6)}`),
  semNum: S('0 0 30 40', `<rect x="2" y="2" width="26" height="36" rx="2" fill="#fff"/>${linhas(6, 8, 18, 6)}`),
};
const IC = {
  texto: S('0 0 24 24', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  paragrafo: S('0 0 24 24', '<path d="M10 4v16M15 4v16M18 4H9.5a4 4 0 0 0 0 8H15"/>'),
  numero: S('0 0 24 24', '<path d="M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"/>'),
  alternativas: S('0 0 24 24', '<circle cx="6" cy="6" r="2.2"/><circle cx="6" cy="12" r="2.2" fill="currentColor"/><circle cx="6" cy="18" r="2.2"/><path d="M11 6h9M11 12h9M11 18h9"/>'),
  layout: S('0 0 24 24', '<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5"/><rect x="9" y="10" width="8" height="8" stroke-dasharray="2 1.5"/>'),
  questoes: S('0 0 24 24', '<rect x="4" y="3" width="16" height="7" rx="1.5"/><rect x="4" y="14" width="16" height="7" rx="1.5"/>'),
  olho: S('0 0 24 24', '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  margens: S('0 0 24 24', '<rect x="3" y="2" width="18" height="20" rx="1.5"/><rect x="7" y="6" width="10" height="12" stroke-dasharray="2 1.5"/>'),
  tamanho: S('0 0 24 24', '<rect x="5" y="2" width="14" height="20" rx="1.5"/><path d="M8 7h8M8 11h8M8 15h5"/>'),
  colunas: S('0 0 24 24', '<rect x="3" y="3" width="18" height="18" rx="1.5"/><path d="M12 3v18M6 7h3M6 10h3M6 13h3M15 7h3M15 10h3M15 13h3"/>'),
  numPagina: S('0 0 24 24', '<rect x="4" y="2" width="16" height="20" rx="1.5"/><path d="M8 7h8M8 11h8"/><text x="12" y="19.5" font-size="6" text-anchor="middle" fill="currentColor" stroke="none" font-family="Arial">1</text>'),
  espacamento: svg('espacamento'),
  abnt: S('0 0 24 24', '<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
};

// ------------------------------------------------------------------ controles básicos
function segmentado(av, k, opcoes, mudou, { numero = false, classe = '' } = {}) {
  const el = h('div', { class: `fmt-seg ${classe}`, role: 'radiogroup' });
  const render = () => el.replaceChildren(...opcoes.map((o) => h('button', {
    type: 'button', class: `fmt-seg-b ${String(av[k] ?? '') === String(o.v) ? 'ativo' : ''}`, title: o.tit || o.rot || '',
    disabled: o.desab || false, onclick: () => { av[k] = numero ? +o.v : o.v; render(); mudou(); },
  }, o.ic ? h('span', { class: 'fmt-ic', html: o.ic }) : null, o.rot ? h('span', { class: 'fmt-seg-rot' }, o.rot) : null)));
  render();
  el.render = render;
  return el;
}
function blocos(av, k, opcoes, mudou, { numero = false, classe = '' } = {}) {
  const el = h('div', { class: `fmt-blocos ${classe}` });
  const render = () => el.replaceChildren(...opcoes.map((o) => h('button', {
    type: 'button', class: `fmt-bloco ${String(av[k] ?? '') === String(o.v) ? 'ativo' : ''}`, title: o.tit || o.rot,
    onclick: () => { av[k] = numero ? +o.v : o.v; render(); mudou(); },
  }, h('span', { class: 'fmt-bloco-img', html: typeof o.html === 'function' ? o.html() : (o.html || o.desenho) }), h('span', { class: 'fmt-bloco-rot' }, o.rot))));
  render();
  el.render = render;
  return el;
}
function chave(av, k, mudou) {
  const inp = h('input', { type: 'checkbox', checked: !!av[k], role: 'switch' });
  inp.addEventListener('change', () => { av[k] = inp.checked ? '1' : ''; mudou(); });
  const el = h('label', { class: 'fmt-chave' }, inp, h('span', { class: 'fmt-chave-trilho' }, h('span', { class: 'fmt-chave-bola' })));
  el.render = () => { inp.checked = !!av[k]; };
  return el;
}
/** Campo numérico com setas, como os do Word (ex.: "Antes: 6 pt"). */
function numero(av, k, { min = 0, max = 99, passo = 1, sufixo = '', casas = 1 }, mudou) {
  const lerV = () => +av[k] || 0;
  const inp = h('input', { type: 'number', class: 'fmt-num-inp', min, max, step: passo });
  const fix = (v) => Math.round(Math.max(min, Math.min(max, v)) * 10 ** casas) / 10 ** casas;
  const render = () => { if (document.activeElement !== inp) inp.value = String(lerV()); };
  const aplicar = (v) => { av[k] = fix(v); render(); mudou(); };
  inp.addEventListener('change', () => aplicar(+String(inp.value).replace(',', '.') || 0));
  const seta = (d, txt) => h('button', { type: 'button', class: 'fmt-num-seta', tabindex: -1, title: d > 0 ? 'Aumentar' : 'Diminuir', onclick: () => aplicar(lerV() + d * passo) }, txt);
  const el = h('div', { class: 'fmt-num' }, inp, h('span', { class: 'fmt-num-suf' }, sufixo), h('div', { class: 'fmt-num-setas' }, seta(1, '▴'), seta(-1, '▾')));
  render();
  el.render = render;
  return el;
}
/** Botão grande com galeria (como "Margens", "Colunas" no Word). */
function botaoGaleria(icone, rotulo, painel) {
  const b = h('button', { type: 'button', class: 'fmt-gal-b', title: rotulo },
    h('span', { class: 'fmt-gal-ic', html: icone }), h('span', { class: 'fmt-gal-rot' }, rotulo), h('span', { class: 'fmt-gal-caret', html: svg('caret') }));
  b.addEventListener('click', () => abrirPop(b, painel()));
  return b;
}
/** Item de galeria: desenho + título + descrição (como no menu de Margens do Word). */
function itemGaleria({ desenho, titulo, desc, ativo, acao }) {
  return h('button', { type: 'button', class: `fmt-gi ${ativo ? 'ativo' : ''}`, onclick: () => { fecharPop(); acao(); } },
    h('span', { class: 'fmt-gi-img', html: desenho }),
    h('span', { class: 'fmt-gi-txt' }, h('b', {}, titulo), desc ? h('small', {}, desc) : null));
}

const linha = (rotulo, ...controles) => h('div', { class: 'fmt-linha' }, h('span', { class: 'fmt-rot' }, rotulo), h('div', { class: 'fmt-ctl' }, ...controles));
const pilha = (rotulo, ...controles) => h('div', { class: 'fmt-pilha' }, h('span', { class: 'fmt-rot' }, rotulo), ...controles);

function secao(id, icone, titulo, resumo, ...conteudo) {
  const res = h('span', { class: 'fmt-resumo' });
  const d = h('details', { class: 'fmt-secao', open: true, 'data-secao': id },
    h('summary', {}, h('span', { class: 'fmt-sec-ic', html: icone }), h('span', { class: 'fmt-sec-tit' }, titulo), res, h('span', { class: 'fmt-sec-seta', html: svg('caret') })),
    h('div', { class: 'fmt-sec-corpo' }, ...conteudo));
  d.atualizarResumo = () => { res.textContent = resumo(); };
  return d;
}

const descMargem = (m) => `Superior: ${fmtCm(m.sup)}  Inferior: ${fmtCm(m.inf)}\nEsquerda: ${fmtCm(m.esq)}  Direita: ${fmtCm(m.dir)}`;

// ------------------------------------------------------------------ cartão completo
/**
 * deps: { mudou, renderPagina, renderCompleta, formatacao, rotuloQuestao, ESTILOS_ALT, FONTES, linkImprimir }
 */
export function montarFormatacao(av, deps) {
  const { formatacao, rotuloQuestao, ESTILOS_ALT, FONTES } = deps;
  const atualizaveis = [];
  const reg = (el) => { atualizaveis.push(el); return el; };
  let pendente = false;
  const mudou = () => {
    deps.mudou();
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => { pendente = false; atualizar(); });
  };
  const F = () => formatacao(av);

  // ================= barra ABNT / padrão
  const selo = h('div', { class: 'fmt-selo' });
  const barraPadrao = h('div', { class: 'fmt-barra-padrao' }, selo,
    h('div', { class: 'linha-botoes' },
      h('button', { class: 'btn btn-sm', title: 'Aplicar as normas da ABNT (NBR 14724)', onclick: () => { aplicarABNT(av); refazerTudo(); mudou(); toast('Padrão ABNT aplicado', 'ok'); } },
        h('span', { class: 'fmt-ic', html: IC.abnt }), 'Padrão ABNT'),
      h('button', { class: 'btn btn-sm', title: 'Usar esta formatação nas próximas avaliações (como o "Definir como Padrão" do Word)', onclick: async () => {
        if (!(await confirmar('Usar a formatação atual como padrão para as novas avaliações?', { ok: 'Definir como padrão' }))) return;
        toast(definirComoPadrao(av) ? 'Formatação definida como padrão para novas avaliações' : 'Não foi possível salvar o padrão neste navegador', 'ok');
        atualizar();
      } }, '★ Definir como padrão'),
      h('button', { class: 'btn btn-sm btn-link', title: 'Novas avaliações voltam a usar o padrão ABNT', onclick: () => { restaurarPadraoABNT(); toast('Novas avaliações voltam ao padrão ABNT'); atualizar(); } }, 'Restaurar padrão ABNT')));

  // ================= pré-visualização (mini-página)
  const folha = h('div', { class: 'fmt-folha' });
  const moldura = h('div', { class: 'fmt-folha-moldura' }, folha);
  const estimativa = h('span', { class: 'fmt-estimativa' });
  const previa = h('div', { class: 'fmt-previa' },
    h('div', { class: 'fmt-previa-head' }, h('span', { class: 'fmt-sec-ic', html: IC.olho }), h('span', {}, 'Pré-visualização'), estimativa,
      deps.linkImprimir ? h('a', { class: 'btn btn-sm', href: deps.linkImprimir }, 'Tamanho real') : null),
    moldura);
  const medidor = h('div', { class: 'fmt-medidor', 'aria-hidden': 'true' });
  document.querySelectorAll('.fmt-medidor').forEach((x) => x.remove());
  document.body.append(medidor);

  // ================= Layout da página (Margens, Tamanho, Colunas, Nº de página)
  const aplicarMargem = (chaveP, m) => { av.margemPreset = chaveP; av.margem = { sup: +m.sup, inf: +m.inf, esq: +m.esq, dir: +m.dir }; mudou(); };
  const painelMargens = () => {
    const m = margemDe(F()), p = papelDe(F());
    return h('div', { class: 'fmt-galeria' },
      h('div', { class: 'ed-paleta-tit' }, 'Margens'),
      ...Object.entries(MARGENS_PRESET).map(([k, mp]) => itemGaleria({
        desenho: desenhoMargens(mp, p), titulo: mp.nome + (mp.desc ? ` · ${mp.desc}` : ''), desc: descMargem(mp),
        ativo: av.margemPreset === k, acao: () => aplicarMargem(k, mp),
      })),
      av.margemPreset === 'personalizada' ? itemGaleria({ desenho: desenhoMargens(m, p), titulo: 'Última personalizada', desc: descMargem(m), ativo: true, acao: () => {} }) : null,
      h('button', { type: 'button', class: 'fmt-gi-mais', onclick: () => { fecharPop(); dialogoMargens(); } }, 'Margens Personalizadas…'));
  };
  const painelPapel = () => h('div', { class: 'fmt-galeria' },
    h('div', { class: 'ed-paleta-tit' }, 'Tamanho do papel'),
    ...Object.entries(PAPEIS).map(([k, p]) => itemGaleria({ desenho: desenhoPapel(p), titulo: p.nome, desc: p.desc, ativo: F().papel === k, acao: () => { av.papel = k; mudou(); } })),
    h('small', { class: 'fmt-gi-nota' }, 'A folha de respostas é sempre impressa em A4.'));
  const painelColunas = () => h('div', { class: 'fmt-galeria' },
    h('div', { class: 'ed-paleta-tit' }, 'Colunas'),
    ...[[1, 'Uma'], [2, 'Duas'], [3, 'Três']].map(([n, nome]) => itemGaleria({ desenho: desenhoColunas(n, !!F().linhaColunas), titulo: nome, ativo: +av.colunas === n, acao: () => { av.colunas = n; mudou(); } })),
    h('button', { type: 'button', class: 'fmt-gi-mais', onclick: () => { fecharPop(); dialogoColunas(); } }, 'Mais Colunas…'));
  const painelNumPag = () => {
    const f = F();
    const atual = f.numPagina ? f.posNumPagina : '';
    const op = (v, titulo, desc, desenho) => itemGaleria({ desenho, titulo, desc, ativo: atual === v, acao: () => { av.numPagina = v ? '1' : ''; if (v) av.posNumPagina = v; mudou(); } });
    return h('div', { class: 'fmt-galeria' },
      h('div', { class: 'ed-paleta-tit' }, 'Número de Página'),
      op('topo-dir', 'Início da página · direita', 'ABNT: canto superior direito', DESENHO.numPagTopo),
      op('rodape-centro', 'Fim da página · centro', '"Página 1 de 2"', DESENHO.numPagRodC),
      op('rodape-dir', 'Fim da página · direita', '"Página 1 de 2"', DESENHO.numPagRodD),
      op('', 'Sem número de página', '', DESENHO.semNum),
      h('small', { class: 'fmt-gi-nota' }, 'Aparece na impressão/PDF (Chrome e Edge).'));
  };
  const resumoLayout = h('div', { class: 'fmt-layout-resumo' });
  const secLayout = secao('layout', IC.layout, 'Layout da página', () => `${papelDe(F()).nome} · ${+av.colunas} col.`,
    h('div', { class: 'fmt-gal-barra' },
      botaoGaleria(IC.margens, 'Margens', painelMargens),
      botaoGaleria(IC.tamanho, 'Tamanho', painelPapel),
      botaoGaleria(IC.colunas, 'Colunas', painelColunas),
      botaoGaleria(IC.numPagina, 'Nº de Página', painelNumPag)),
    resumoLayout);

  // ================= Fonte
  const cbFonte = combo({
    largura: 150, titulo: 'Fonte', opcoes: () => FONTES.map(([f]) => f),
    renderOpcao: (f) => h('span', { style: { fontFamily: `'${f}'`, fontSize: '15px' } }, f),
    aoEscolher: (v) => { if (v) { av.fonte = v; mudou(); } },
  });
  const TAM = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20];
  const cbTam = combo({
    largura: 44, titulo: 'Tamanho da fonte', opcoes: () => TAM.map((t) => String(t).replace('.', ',')),
    aoEscolher: (v) => { const n = +String(v).replace(',', '.'); if (n >= 6 && n <= 28) { av.tamanho = n; mudou(); } },
  });
  const mudarTam = (d) => {
    const t = +av.tamanho;
    const prox = d > 0 ? TAM.find((x) => x > t) : [...TAM].reverse().find((x) => x < t);
    if (prox) { av.tamanho = prox; mudou(); }
  };
  const secFonte = secao('fonte', IC.texto, 'Fonte', () => `${av.fonte}, ${String(av.tamanho).replace('.', ',')} pt`,
    h('div', { class: 'fmt-fonte-barra' }, cbFonte.el, cbTam.el,
      h('button', { type: 'button', class: 'fmt-mini-b', title: 'Aumentar Tamanho da Fonte', html: svg('aumentarFonte'), onclick: () => mudarTam(1) }),
      h('button', { type: 'button', class: 'fmt-mini-b', title: 'Diminuir Tamanho da Fonte', html: svg('diminuirFonte'), onclick: () => mudarTam(-1) })),
    linha('Maiúsculas e minúsculas', reg(segmentado(av, 'caixaTexto', [{ v: 'normal', rot: 'Aa', tit: 'Como digitado' }, { v: 'maiusculas', rot: 'AA', tit: 'TUDO MAIÚSCULO (letra bastão)' }], mudou))));

  // ================= Parágrafo (alinhamento, espaçamento, recuo)
  const painelEspacamento = () => {
    const f = F();
    return menu([
      ...[['1', '1,0'], ['1.15', '1,15'], ['1.5', '1,5'], ['2', '2,0'], ['2.5', '2,5'], ['3', '3,0']].map(([v, n]) => ({ rotulo: n, ativo: String(f.entreLinhas) === v, acao: () => { av.entreLinhas = v; mudou(); } })),
      '-',
      { rotulo: 'Opções de Espaçamento de Linha…', acao: dialogoEspacamento },
      '-',
      { rotulo: +f.espAntes ? 'Remover Espaço Antes de Parágrafo' : 'Adicionar Espaço Antes de Parágrafo', acao: () => { av.espAntes = +f.espAntes ? 0 : 12; refazerTudo(); mudou(); } },
      { rotulo: +f.espDepois ? 'Remover Espaço Depois de Parágrafo' : 'Adicionar Espaço Depois de Parágrafo', acao: () => { av.espDepois = +f.espDepois ? 0 : 8; refazerTudo(); mudou(); } },
    ]);
  };
  const btnEspac = h('button', { type: 'button', class: 'fmt-mini-b fmt-mini-largo', title: 'Espaçamento de Linha e Parágrafo' }, h('span', { class: 'fmt-ic', html: IC.espacamento }), h('span', { class: 'fmt-espac-v' }), h('span', { class: 'fmt-ic', html: svg('caret') }));
  btnEspac.addEventListener('click', () => abrirPop(btnEspac, painelEspacamento()));
  const secPar = secao('paragrafo', IC.paragrafo, 'Parágrafo', () => {
    const f = F();
    return `${{ left: 'Esquerda', center: 'Centralizado', right: 'Direita', justify: 'Justificado' }[f.alinhamento] || ''} · ${String(f.entreLinhas).replace('.', ',')}`;
  },
  linha('Alinhamento', reg(segmentado(av, 'alinhamento', [
    { v: 'left', ic: svg('esq'), tit: 'Alinhar à Esquerda' }, { v: 'center', ic: svg('centro'), tit: 'Centralizar' },
    { v: 'right', ic: svg('dir'), tit: 'Alinhar à Direita' }, { v: 'justify', ic: svg('just'), tit: 'Justificar' }], mudou))),
  linha('Espaçamento entre linhas', btnEspac),
  h('div', { class: 'fmt-grade-num' },
    h('label', {}, h('span', { class: 'fmt-rot' }, 'Recuo 1ª linha'), reg(numero(av, 'recuo', { min: 0, max: 5, passo: 0.25, sufixo: 'cm', casas: 2 }, mudou))),
    h('label', {}, h('span', { class: 'fmt-rot' }, 'Antes'), reg(numero(av, 'espAntes', { min: 0, max: 48, passo: 6, sufixo: 'pt', casas: 0 }, mudou))),
    h('label', {}, h('span', { class: 'fmt-rot' }, 'Depois'), reg(numero(av, 'espDepois', { min: 0, max: 48, passo: 6, sufixo: 'pt', casas: 0 }, mudou)))));

  // ================= Questões (espaço e linha entre questões)
  const secQuest = secao('questoes', IC.questoes, 'Questões', () => `espaço ${{ 2: 'P', 4: 'M', 8: 'G', 14: 'GG' }[av.espacoQuestoes] || 'M'}${av.linhaDivisoria ? ' · com linha' : ''}`,
    linha('Espaço entre questões', reg(segmentado(av, 'espacoQuestoes', [[2, 'P', 'Pequeno'], [4, 'M', 'Médio'], [8, 'G', 'Grande'], [14, 'GG', 'Muito grande']].map(([v, rot, tit]) => ({ v, rot, tit })), mudou, { numero: true }))),
    linha('Linha entre questões', reg(chave(av, 'linhaDivisoria', mudou))));

  // ================= Numeração
  const amostraNum = (estilo) => () => `<div class="fmt-qn qn-${estilo}"><div class="q-num"><span>${esc(rotuloQuestao({ ...F(), rotulo: '' }, 0))}</span></div></div>`;
  const ESTILOS_NUM = [['negrito', 'Negrito'], ['normal', 'Normal'], ['sublinhado', 'Sublinhado'], ['destaque', 'Fundo cinza'], ['caixa', 'Em caixa'], ['escuro', 'Fundo escuro'], ['circulo', 'Círculo']];
  const blocosEstilo = reg(blocos(av, 'estiloNum', ESTILOS_NUM.map(([v, rot]) => ({ v, rot, html: amostraNum(v) })), mudou, { classe: 'fmt-blocos-num' }));
  const segCaixaWrap = h('div');
  const refazerCaixa = () => {
    const r = av.rotulo || 'Questão';
    segCaixaWrap.replaceChildren(segmentado(av, 'caixaRotulo', [
      { v: 'maiusculas', rot: r.toLocaleUpperCase('pt-BR'), desab: !av.rotulo }, { v: 'normal', rot: r, desab: !av.rotulo }, { v: 'minusculas', rot: r.toLocaleLowerCase('pt-BR'), desab: !av.rotulo }], mudou));
  };
  refazerCaixa();
  const secNum = secao('numero', IC.numero, 'Numeração das questões', () => rotuloQuestao(F(), 0),
    pilha('Rótulo', reg(segmentado(av, 'rotulo', [['Questão', 'Questão'], ['Exercício', 'Exercício'], ['Atividade', 'Atividade'], ['Q', 'Q'], ['', 'Só nº']].map(([v, rot]) => ({ v, rot })), () => { mudou(); refazerCaixa(); }, { classe: 'fmt-seg-wrap' }))),
    linha('Maiúsc./minúsc.', segCaixaWrap),
    linha('Número', reg(segmentado(av, 'zeros', [{ v: '', rot: '1, 2, 3' }, { v: '1', rot: '01, 02, 03' }], mudou))),
    linha('Pontuação', reg(segmentado(av, 'sufixo', [['', '1'], ['.', '1.'], [')', '1)'], [':', '1:'], [' –', '1 –']].map(([v, rot]) => ({ v, rot })), mudou, { classe: 'fmt-seg-comp' }))),
    pilha('Estilo do número', blocosEstilo),
    pilha('Posição', reg(blocos(av, 'posNum', [{ v: 'acima', rot: 'Acima do enunciado', desenho: DESENHO.numAcima }, { v: 'linha', rot: 'Na mesma linha', desenho: DESENHO.numLinha }], mudou, { classe: 'fmt-blocos-2' }))));

  // ================= Alternativas
  const secAlt = secao('alternativas', IC.alternativas, 'Alternativas', () => {
    const f = ESTILOS_ALT[av.estiloAlt] || ESTILOS_ALT['a)'];
    return `${f(0)} ${f(1)} ${f(2)} · ${{ lista: 'em lista', duas: '2 colunas', linha: 'em linha' }[av.dispoAlt] || 'em lista'}`;
  },
  pilha('Letras', reg(segmentado(av, 'estiloAlt', Object.keys(ESTILOS_ALT).map((k) => ({ v: k, rot: ESTILOS_ALT[k](0), tit: `${ESTILOS_ALT[k](0)} ${ESTILOS_ALT[k](1)} ${ESTILOS_ALT[k](2)}` })), mudou, { classe: 'fmt-seg-wrap' }))),
  linha('Letra em negrito', reg(chave(av, 'letraNegrito', mudou))),
  pilha('Disposição', reg(blocos(av, 'dispoAlt', [
    { v: 'lista', rot: 'Em lista', desenho: DESENHO.altLista }, { v: 'duas', rot: '2 colunas', desenho: DESENHO.altDuas }, { v: 'linha', rot: 'Em linha', desenho: DESENHO.altLinha }], mudou, { classe: 'fmt-blocos-3' }))));

  const secoes = [secLayout, secFonte, secPar, secQuest, secNum, secAlt];
  const el = h('div', { class: 'fmt-cartao' }, barraPadrao, previa, ...secoes);

  // ================= caixas de diálogo (como no Word)
  async function dialogoMargens() {
    const m = { ...margemDe(F()) };
    let papel = F().papel;
    const prev = h('div', { class: 'fmt-dlg-prev' });
    const inps = {};
    const atualizarPrev = () => { prev.innerHTML = desenhoMargens(m, PAPEIS[papel] || PAPEIS.A4); };
    const campoM = (k, nome) => {
      const i = h('input', { type: 'number', step: 0.1, min: 0, max: 8, value: m[k] });
      i.addEventListener('input', () => { m[k] = Math.max(0, Math.min(8, +i.value || 0)); atualizarPrev(); });
      inps[k] = i;
      return campo(`${nome} (cm)`, i);
    };
    const selPapel = h('select', {}, Object.entries(PAPEIS).map(([k, p]) => h('option', { value: k, selected: k === papel }, `${p.nome} (${p.desc})`)));
    selPapel.addEventListener('change', () => { papel = selPapel.value; atualizarPrev(); });
    atualizarPrev();
    const r = await modal({
      titulo: 'Configurar Página — Margens',
      corpo: h('div', { class: 'fmt-dlg' },
        h('div', {}, h('h3', { class: 'dlg-sec' }, 'Margens'),
          h('div', { class: 'form-grade' }, campoM('sup', 'Superior'), campoM('inf', 'Inferior'), campoM('esq', 'Esquerda'), campoM('dir', 'Direita')),
          h('h3', { class: 'dlg-sec' }, 'Papel'), campo('Tamanho do papel', selPapel),
          h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { Object.assign(m, { sup: 3, inf: 2, esq: 3, dir: 2 }); Object.entries(inps).forEach(([k, i]) => { i.value = m[k]; }); atualizarPrev(); } }, 'Usar margens ABNT (3, 2, 3, 2)')),
        h('div', { class: 'fmt-dlg-lado' }, h('span', { class: 'fmt-rot' }, 'Visualização'), prev)),
      acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }],
    });
    if (r !== 'ok') return;
    const preset = Object.entries(MARGENS_PRESET).find(([, mp]) => ['sup', 'inf', 'esq', 'dir'].every((k) => +mp[k] === +m[k]));
    av.papel = papel;
    aplicarMargem(preset ? preset[0] : 'personalizada', m);
  }

  async function dialogoColunas() {
    const f = F();
    let n = +av.colunas || 1;
    const prev = h('div', { class: 'fmt-dlg-prev' });
    const num = h('input', { type: 'number', min: 1, max: 3, value: n });
    const esp = h('input', { type: 'number', min: 0.2, max: 3, step: 0.1, value: +f.espacoColunas || 0.8 });
    const lin = h('input', { type: 'checkbox', checked: !!f.linhaColunas });
    const pre = h('div', { class: 'fmt-blocos fmt-blocos-3' });
    const render = () => {
      prev.innerHTML = desenhoColunas(n, lin.checked);
      pre.replaceChildren(...[[1, 'Uma'], [2, 'Duas'], [3, 'Três']].map(([k, nome]) => h('button', {
        type: 'button', class: `fmt-bloco ${n === k ? 'ativo' : ''}`, onclick: () => { n = k; num.value = k; render(); },
      }, h('span', { class: 'fmt-bloco-img fmt-bloco-pag', html: desenhoColunas(k, lin.checked) }), h('span', { class: 'fmt-bloco-rot' }, nome))));
    };
    num.addEventListener('input', () => { n = Math.max(1, Math.min(3, +num.value || 1)); render(); });
    lin.addEventListener('change', render);
    render();
    const r = await modal({
      titulo: 'Colunas',
      corpo: h('div', { class: 'fmt-dlg' },
        h('div', {}, h('h3', { class: 'dlg-sec' }, 'Predefinições'), pre,
          h('div', { class: 'form-grade', style: { marginTop: '10px' } }, campo('Número de colunas', num), campo('Espaçamento entre colunas (cm)', esp)),
          h('label', { class: 'campo-check' }, lin, 'Linha entre colunas')),
        h('div', { class: 'fmt-dlg-lado' }, h('span', { class: 'fmt-rot' }, 'Visualização'), prev)),
      acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }],
    });
    if (r !== 'ok') return;
    av.colunas = n;
    av.espacoColunas = Math.max(0.2, Math.min(3, +esp.value || 0.8));
    av.linhaColunas = lin.checked ? '1' : '';
    mudou();
  }

  async function dialogoEspacamento() {
    const f = F();
    const padroes = ['1', '1.15', '1.5', '2'];
    const entre = h('select', {}, [['1', 'Simples'], ['1.15', '1,15'], ['1.5', '1,5 linha'], ['2', 'Duplo'], ['mult', 'Múltiplos']]
      .map(([v, n]) => h('option', { value: v, selected: v === String(f.entreLinhas) || (v === 'mult' && !padroes.includes(String(f.entreLinhas))) }, n)));
    const mult = h('input', { type: 'number', min: 0.8, max: 4, step: 0.1, value: +f.entreLinhas || 1.5 });
    const antes = h('input', { type: 'number', min: 0, max: 48, step: 6, value: +f.espAntes || 0 });
    const depois = h('input', { type: 'number', min: 0, max: 48, step: 6, value: +f.espDepois || 0 });
    const especial = h('select', {}, [['0', '(nenhum)'], ['1', 'Primeira linha']].map(([v, n]) => h('option', { value: v, selected: (v === '1') === (+f.recuo > 0) }, n)));
    const por = h('input', { type: 'number', min: 0, max: 5, step: 0.25, value: +f.recuo || 1.25 });
    const r = await modal({
      titulo: 'Parágrafo — Recuos e espaçamento',
      corpo: h('div', {},
        h('h3', { class: 'dlg-sec' }, 'Recuo'),
        h('div', { class: 'form-grade' }, campo('Especial', especial), campo('Por (cm)', por)),
        h('h3', { class: 'dlg-sec' }, 'Espaçamento'),
        h('div', { class: 'form-grade' }, campo('Antes (pt)', antes), campo('Depois (pt)', depois), campo('Entre linhas', entre), campo('Em (múltiplos)', mult)),
        h('p', { class: 'dica' }, 'ABNT: espaçamento 1,5 entre linhas e recuo de 1,25 cm na primeira linha.')),
      acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }],
    });
    if (r !== 'ok') return;
    av.entreLinhas = entre.value === 'mult' ? String(Math.max(0.8, Math.min(4, +mult.value || 1.5))) : entre.value;
    av.espAntes = Math.max(0, +antes.value || 0);
    av.espDepois = Math.max(0, +depois.value || 0);
    av.recuo = especial.value === '1' ? Math.max(0, +por.value || 0) : 0;
    refazerTudo();
    mudou();
  }

  function refazerTudo() { atualizaveis.forEach((x) => x.render?.()); refazerCaixa(); }

  // ================= atualização
  function atualizar() {
    const f = F();
    const p = papelDe(f), m = margemDe(f);
    // selo ABNT
    const div = divergenciasABNT(av, f);
    selo.className = `fmt-selo ${div.length ? '' : 'ok'}`;
    selo.replaceChildren(h('span', { class: 'fmt-ic', html: IC.abnt }),
      h('span', { class: 'fmt-selo-txt' }, div.length
        ? [h('b', {}, 'Fora do padrão ABNT'), h('small', {}, `Ajuste: ${div.slice(0, 3).join(', ')}${div.length > 3 ? '…' : ''}`)]
        : [h('b', {}, 'Segue a ABNT'), h('small', {}, 'NBR 14724: A4, margens 3/2/3/2 cm, 12 pt, espaço 1,5, justificado')],
      padraoUsuario() ? h('small', { class: 'fmt-padrao-usuario' }, '★ Novas avaliações usam o seu padrão') : null));
    // controles
    if (document.activeElement !== cbFonte.inp) cbFonte.inp.value = av.fonte;
    if (document.activeElement !== cbTam.inp) cbTam.inp.value = String(av.tamanho).replace('.', ',');
    cbFonte.inp.style.fontFamily = `'${av.fonte}'`;
    btnEspac.querySelector('.fmt-espac-v').textContent = String(f.entreLinhas).replace('.', ',');
    atualizaveis.forEach((x) => x.render?.());
    resumoLayout.replaceChildren(
      h('span', { html: desenhoMargens(m, p), class: 'fmt-lr-img' }),
      h('div', {},
        h('div', {}, h('b', {}, 'Margens: '), `${MARGENS_PRESET[av.margemPreset]?.nome || 'Personalizadas'} — sup. ${fmtCm(m.sup)}, inf. ${fmtCm(m.inf)}, esq. ${fmtCm(m.esq)}, dir. ${fmtCm(m.dir)}`),
        h('div', {}, h('b', {}, 'Papel: '), `${p.nome} (${p.desc})`),
        h('div', {}, h('b', {}, 'Colunas: '), `${+av.colunas}${+av.colunas > 1 ? ` · espaço ${fmtCm(+f.espacoColunas || 0.8)}${f.linhaColunas ? ' · com linha' : ''}` : ''}`),
        h('div', {}, h('b', {}, 'Nº de página: '), f.numPagina ? { 'topo-dir': 'canto superior direito', 'rodape-centro': 'rodapé, centro', 'rodape-dir': 'rodapé, direita' }[f.posNumPagina] : 'não')));
    secoes.forEach((s) => s.atualizarResumo());
    // mini-página com guias de margem
    folha.style.width = p.w + 'mm';
    folha.style.height = p.h + 'mm';
    folha.style.setProperty('--margem', `${m.sup}cm ${m.dir}cm ${m.inf}cm ${m.esq}cm`);
    folha.innerHTML = deps.renderPagina() + `<div class="fmt-guia" style="top:${m.sup}cm;bottom:${m.inf}cm;left:${m.esq}cm;right:${m.dir}cm"></div>`
      + (f.numPagina ? `<div class="fmt-num-pag fmt-np-${f.posNumPagina}" style="--msup:${m.sup}cm;--minf:${m.inf}cm;--mdir:${m.dir}cm">${f.posNumPagina === 'topo-dir' ? '1' : 'Página 1 de 1'}</div>` : '');
    const k = moldura.clientWidth / folha.offsetWidth;
    if (k > 0) { folha.style.transform = `scale(${k})`; moldura.style.height = folha.offsetHeight * k + 'px'; }
    // estimativa de páginas (mede a prova inteira na largura útil)
    medidor.style.width = `calc(${p.w}mm - ${m.esq + m.dir}cm)`;
    medidor.innerHTML = deps.renderCompleta();
    const alturaMm = medidor.scrollHeight / (96 / 25.4);
    const util = p.h - (m.sup + m.inf) * 10;
    const n = Math.max(1, Math.ceil((alturaMm - 2) / util));
    estimativa.textContent = `≈ ${n} página${n > 1 ? 's' : ''} por prova`;
    estimativa.title = 'Estimativa sem contar a folha de respostas e o gabarito do professor';
  }
  el.atualizar = atualizar;
  let ultimaLargura = 0;
  new ResizeObserver(() => { if (moldura.clientWidth !== ultimaLargura) { ultimaLargura = moldura.clientWidth; atualizar(); } }).observe(moldura);
  return el;
}
