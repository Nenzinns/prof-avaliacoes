// Faixa de opções (Ribbon) no estilo do Word, compartilhada pelos editores da página.
// Guias: Página Inicial, Inserir e as guias contextuais Design da Tabela, Layout (tabela)
// e Formato da Imagem, que aparecem quando uma tabela/imagem está selecionada.

import { h, modal, campo, toast } from './ui.js';
import { svg, iconeBorda, botao, suspenso, dividido, menu, paleta, paletaDestaque, grupo, col, lin, combo, galeria, abrirPop, fecharPop } from './editor-ui.js';
import { ESTILOS_TABELA } from './editor-tabela.js';
import { QUEBRAS, ESTILOS_IMG, MODOS_COR, PROPORCOES } from './editor-imagem.js';
import { TAMANHOS, ESTILOS_PARAGRAFO, limparHtml } from './editor.js';

const FONTES = ['Arial', 'Arial Black', 'Calibri', 'Cambria', 'Candara', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Courier New', 'Garamond', 'Georgia', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];

const MARCADORES = [
  { rot: '•', tipo: 'disc' }, { rot: '○', tipo: 'circle' }, { rot: '■', tipo: 'square' }, { rot: '◆', tipo: '"◆  "' },
  { rot: '➤', tipo: '"➤  "' }, { rot: '✓', tipo: '"✓  "' }, { rot: '–', tipo: '"–  "' }, { rot: '★', tipo: '"★  "' },
];
const NUMERACOES = [
  { rot: ['1.', '2.', '3.'], tipo: 'decimal' }, { rot: ['1)', '2)', '3)'], cls: 'q-lst-paren' }, { rot: ['(1)', '(2)', '(3)'], cls: 'q-lst-dparen' },
  { rot: ['a)', 'b)', 'c)'], cls: 'q-lst-alfa-paren' }, { rot: ['a.', 'b.', 'c.'], tipo: 'lower-alpha' }, { rot: ['A.', 'B.', 'C.'], tipo: 'upper-alpha' },
  { rot: ['i.', 'ii.', 'iii.'], tipo: 'lower-roman' }, { rot: ['I.', 'II.', 'III.'], tipo: 'upper-roman' },
];
const SIMBOLOS = {
  'Matemática': '± × ÷ · = ≠ ≈ ≡ < > ≤ ≥ √ ∛ ∞ π ° ′ ″ % ‰ ² ³ ⁿ ½ ⅓ ¼ ¾ ∑ ∏ ∫ ∂ ∆ ∇ ∠ ⊥ ∥ △ □ ∝',
  'Gregas': 'α β γ δ ε ζ η θ λ μ ν ξ π ρ σ τ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω',
  'Conjuntos': '∈ ∉ ⊂ ⊃ ⊆ ⊇ ∪ ∩ ∅ ℕ ℤ ℚ ℝ ℂ ∀ ∃ ¬ ∧ ∨ ⇒ ⇔ ∴ ∵',
  'Setas': '→ ← ↑ ↓ ↔ ↕ ⇒ ⇐ ⇑ ⇓ ⇔ ↗ ↘ ↙ ↖ ➤ ⟶ ⇌',
  'Ciências': '⇌ Å µ Ω ℃ ℉ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉ ⁰ ¹ ² ³ ⁴ ⁵ ⁺ ⁻ ∆ λ',
  'Diversos': '• … § ¶ © ® ™ € £ ¥ ★ ☆ ✓ ✗ ☐ ☑ ♀ ♂ ♪ ☺ ❤ ☼',
};
const SUBLINHADOS = [['solid', 'Sublinhado simples'], ['double', 'Sublinhado duplo'], ['dotted', 'Sublinhado pontilhado'], ['dashed', 'Sublinhado tracejado'], ['wavy', 'Sublinhado ondulado']];

export function createRibbon() {
  let ed = null;
  const editores = new Set();
  const atualizadores = [];
  const quando = (fn) => atualizadores.push(fn);
  const c = (fn) => (...a) => { if (!ed) { toast('Clique primeiro no campo de texto que deseja formatar.'); return; } return fn(ed, ...a); };
  const exec = (cmdNome, val) => c((e) => e.exec(cmdNome, val));
  const estado = (b, cmd) => { b.dataset.estado = cmd; return b; };

  // ================================================================ PÁGINA INICIAL
  const pincel = botao({ icone: 'pincel', rotulo: 'Pincel', titulo: 'Pincel de Formatação (Ctrl+Shift+C): copie a formatação e selecione o texto onde aplicá-la', tam: 'r', acao: c((e) => { if (e.formatoCopiado) { e.formatoCopiado = null; e.area.classList.remove('ed-pincel'); atualizar(e); } else e.copiarFormato(); }) });
  quando((e) => pincel.classList.toggle('ativo', !!e.formatoCopiado));
  const gArea = grupo('Área de Transferência', [
    botao({ icone: 'colar', rotulo: 'Colar', titulo: 'Colar (Ctrl+V)', tam: 'g', acao: c((e) => colar(e)) }),
    col(botao({ icone: 'recortar', rotulo: 'Recortar', titulo: 'Recortar (Ctrl+X)', tam: 'r', acao: c((e) => { e.restaurar(); document.execCommand('cut'); e.mudou(); }) }),
      botao({ icone: 'copiar', rotulo: 'Copiar', titulo: 'Copiar (Ctrl+C)', tam: 'r', acao: c((e) => { e.restaurar(); document.execCommand('copy'); }) }),
      pincel),
  ]);

  const cbFonte = combo({
    largura: 128, titulo: 'Fonte', opcoes: () => FONTES,
    renderOpcao: (f) => h('span', { style: { fontFamily: `'${f}'`, fontSize: '15px' } }, f),
    aoEscolher: c((e, v) => e.aplicarFonte(v)),
  });
  const cbTam = combo({ largura: 40, titulo: 'Tamanho da Fonte', opcoes: () => TAMANHOS.map((t) => String(t).replace('.', ',')), aoEscolher: c((e, v) => e.aplicarTamanho(v)) });
  quando((e) => {
    const f = e.fonteAtual();
    if (document.activeElement !== cbFonte.inp) cbFonte.inp.value = f.familia;
    if (document.activeElement !== cbTam.inp) cbTam.inp.value = String(f.tamanho).replace('.', ',');
  });

  let ultimaCorFonte = '#C00000', ultimoRealce = '#FFFF00';
  const corFonte = dividido({
    icone: 'corFonte', titulo: 'Cor da Fonte', tituloSeta: 'Mais cores da fonte',
    acao: c((e) => e.exec('foreColor', ultimaCorFonte)),
    painel: () => paleta({ semCor: 'Automático', valorSemCor: '#000000', aoEscolher: c((e, cor) => { ultimaCorFonte = cor; barraCorFonte.style.background = cor; e.exec('foreColor', cor); }) }),
  });
  const barraCorFonte = h('span', { class: 'ed-cor-barra', style: { background: ultimaCorFonte } });
  corFonte.principal.querySelector('.ed-ic').append(barraCorFonte);
  const realce = dividido({
    icone: 'realce', titulo: 'Cor do Realce do Texto', tituloSeta: 'Cores de realce',
    acao: c((e) => e.exec('hiliteColor', ultimoRealce)),
    painel: () => paletaDestaque({ aoEscolher: c((e, cor) => { if (cor !== 'transparent') { ultimoRealce = cor; barraRealce.style.background = cor; } e.exec('hiliteColor', cor); }) }),
  });
  const barraRealce = h('span', { class: 'ed-cor-barra', style: { background: ultimoRealce } });
  realce.principal.querySelector('.ed-ic').append(barraRealce);
  const sublinhado = dividido({
    icone: 'sublinhado', titulo: 'Sublinhado (Ctrl+U)', acao: exec('underline'),
    painel: () => menu(SUBLINHADOS.map(([v, n]) => ({ rotulo: n, estilo: { textDecoration: `underline ${v}`, textUnderlineOffset: '3px' }, acao: c((e) => e.sublinhar(v === 'solid' ? null : v)) }))),
  });
  estado(sublinhado.principal, 'underline');

  const gFonte = grupo('Fonte', col(
    lin(cbFonte.el, cbTam.el,
      botao({ icone: 'aumentarFonte', titulo: 'Aumentar Tamanho da Fonte (Ctrl+Shift+>)', acao: c((e) => e.mudarTamanho(1)) }),
      botao({ icone: 'diminuirFonte', titulo: 'Diminuir Tamanho da Fonte (Ctrl+Shift+<)', acao: c((e) => e.mudarTamanho(-1)) }),
      suspenso({ icone: 'maiusculas', titulo: 'Maiúsculas e Minúsculas', painel: () => menu([
        { rotulo: 'Primeira letra da frase em maiúscula.', acao: c((e) => e.mudarCaixa('frase')) },
        { rotulo: 'minúsculas', acao: c((e) => e.mudarCaixa('minusculas')) },
        { rotulo: 'MAIÚSCULAS', acao: c((e) => e.mudarCaixa('maiusculas')) },
        { rotulo: 'Colocar Cada Palavra em Maiúscula', acao: c((e) => e.mudarCaixa('titulo')) },
        { rotulo: 'aLTERNAR mAIÚSC./mINÚSC.', acao: c((e) => e.mudarCaixa('alternar')) }]) }),
      botao({ icone: 'limparFmt', titulo: 'Limpar Toda a Formatação', acao: c((e) => e.limparFormatacao()) })),
    lin(estado(botao({ icone: 'negrito', titulo: 'Negrito (Ctrl+B)', acao: exec('bold') }), 'bold'),
      estado(botao({ icone: 'italico', titulo: 'Itálico (Ctrl+I)', acao: exec('italic') }), 'italic'),
      sublinhado.el,
      estado(botao({ icone: 'tachado', titulo: 'Tachado', acao: exec('strikeThrough') }), 'strikeThrough'),
      estado(botao({ icone: 'subscrito', titulo: 'Subscrito (Ctrl+=)', acao: exec('subscript') }), 'subscript'),
      estado(botao({ icone: 'sobrescrito', titulo: 'Sobrescrito (Ctrl+Shift++)', acao: exec('superscript') }), 'superscript'),
      h('span', { class: 'ed-sep' }), realce.el, corFonte.el)), c((e) => dialogoFonte(e)));

  const bibMarcadores = () => h('div', {}, h('div', { class: 'ed-paleta-tit' }, 'Biblioteca de Marcadores'),
    h('div', { class: 'ed-biblioteca' },
      h('button', { type: 'button', class: 'ed-bib-item', onmousedown: (ev) => ev.preventDefault(), onclick: () => { fecharPop(); c((e) => e.lista('ul', 'nenhum'))(); } }, 'Nenhum'),
      MARCADORES.map((m) => h('button', { type: 'button', class: 'ed-bib-item', onmousedown: (ev) => ev.preventDefault(), onclick: () => { fecharPop(); c((e) => e.lista('ul', '', m.tipo))(); } },
        h('span', { class: 'ed-bib-marc' }, m.rot), h('span', { class: 'ed-bib-linhas' })))));
  const bibNumeros = () => h('div', {}, h('div', { class: 'ed-paleta-tit' }, 'Biblioteca de Numeração'),
    h('div', { class: 'ed-biblioteca' },
      h('button', { type: 'button', class: 'ed-bib-item', onmousedown: (ev) => ev.preventDefault(), onclick: () => { fecharPop(); c((e) => e.lista('ol', 'nenhum'))(); } }, 'Nenhum'),
      NUMERACOES.map((n) => h('button', { type: 'button', class: 'ed-bib-item ed-bib-num', onmousedown: (ev) => ev.preventDefault(), onclick: () => { fecharPop(); c((e) => e.lista('ol', n.cls || '', n.tipo || ''))(); } },
        n.rot.map((r) => h('span', {}, h('b', {}, r), h('i')))))));
  const marcadores = dividido({ icone: 'marcadores', titulo: 'Marcadores', acao: c((e) => e.lista('ul')), painel: bibMarcadores });
  const numeracao = dividido({ icone: 'numeracao', titulo: 'Numeração', acao: c((e) => e.lista('ol')), painel: bibNumeros });
  estado(marcadores.principal, 'insertUnorderedList');
  estado(numeracao.principal, 'insertOrderedList');
  const marcas = botao({ icone: 'marcas', titulo: 'Mostrar Tudo (marcas de parágrafo)', acao: c((e) => e.alternarMarcas()) });
  quando((e) => marcas.classList.toggle('ativo', e.area.classList.contains('ed-marcas')));
  const espac = suspenso({ icone: 'espacamento', titulo: 'Espaçamento de Linha e Parágrafo', painel: () => {
    const atual = ed?.elementoAtual().closest('p,li,h3,h4,blockquote')?.style.lineHeight || '';
    return menu([
      ...[['1', '1,0'], ['1.15', '1,15'], ['1.5', '1,5'], ['2', '2,0'], ['2.5', '2,5'], ['3', '3,0']].map(([v, n]) => ({ rotulo: n, ativo: atual === v, acao: c((e) => e.espacamento(v)) })),
      '-',
      { rotulo: 'Opções de Espaçamento de Linha…', acao: c((e) => dialogoParagrafo(e)) },
      '-',
      { rotulo: 'Adicionar Espaço Antes do Parágrafo', acao: c((e) => e.espacoParagrafo('antes', 12)) },
      { rotulo: 'Remover Espaço Antes do Parágrafo', acao: c((e) => e.espacoParagrafo('antes', 0)) },
      { rotulo: 'Adicionar Espaço Depois do Parágrafo', acao: c((e) => e.espacoParagrafo('depois', 10)) },
      { rotulo: 'Remover Espaço Depois do Parágrafo', acao: c((e) => e.espacoParagrafo('depois', 0)) }]);
  } });
  let ultimoSomb = '#FFF2CC';
  const sombPar = dividido({
    icone: 'sombreamento', titulo: 'Sombreamento do parágrafo', acao: c((e) => e.sombreamentoParagrafo(ultimoSomb)),
    painel: () => paleta({ semCor: 'Sem Cor', valorSemCor: 'transparent', aoEscolher: c((e, cor) => { if (cor !== 'transparent') { ultimoSomb = cor; barraSomb.style.background = cor; } e.sombreamentoParagrafo(cor); }) }),
  });
  const barraSomb = h('span', { class: 'ed-cor-barra', style: { background: ultimoSomb } });
  sombPar.principal.querySelector('.ed-ic').append(barraSomb);
  const bordaPar = suspenso({ icone: iconeBorda('inferior'), titulo: 'Bordas do parágrafo', painel: () => menu([
    { rotulo: 'Borda Inferior', icone: iconeBorda('inferior'), acao: c((e) => e.bordaParagrafo('inferior')) },
    { rotulo: 'Borda Superior', icone: iconeBorda('superior'), acao: c((e) => e.bordaParagrafo('superior')) },
    { rotulo: 'Bordas Externas', icone: iconeBorda('externas'), acao: c((e) => e.bordaParagrafo('externas')) },
    { rotulo: 'Sem Borda', icone: iconeBorda('nenhuma'), acao: c((e) => e.bordaParagrafo('nenhuma')) }]) });

  const gParagrafo = grupo('Parágrafo', col(
    lin(marcadores.el, numeracao.el,
      botao({ icone: 'recuoMenos', titulo: 'Diminuir Recuo', acao: c((e) => e.recuo(-1.25)) }),
      botao({ icone: 'recuoMais', titulo: 'Aumentar Recuo', acao: c((e) => e.recuo(1.25)) }), marcas),
    lin(estado(botao({ icone: 'esq', titulo: 'Alinhar à Esquerda', acao: exec('justifyLeft') }), 'justifyLeft'),
      estado(botao({ icone: 'centro', titulo: 'Centralizar (Ctrl+E)', acao: exec('justifyCenter') }), 'justifyCenter'),
      estado(botao({ icone: 'dir', titulo: 'Alinhar à Direita', acao: exec('justifyRight') }), 'justifyRight'),
      estado(botao({ icone: 'just', titulo: 'Justificar (Ctrl+J)', acao: exec('justifyFull') }), 'justifyFull'),
      espac, sombPar.el, bordaPar)), c((e) => dialogoParagrafo(e)));

  const galEstilos = h('div', { class: 'ed-galeria ed-gal-estilos' });
  const renderEstilos = (atual) => galEstilos.replaceChildren(...Object.entries(ESTILOS_PARAGRAFO).map(([k, s]) => h('button', {
    type: 'button', class: `ed-gal-item ed-estilo-card ${atual === k ? 'ativo' : ''}`, title: s.nome, onmousedown: (ev) => ev.preventDefault(),
    onclick: c((e) => e.estiloParagrafo(k)),
  }, h('span', { class: `ed-estilo-prev ed-ep-${k}` }, 'AaBbCc'), h('small', {}, s.nome))));
  renderEstilos('normal');
  quando((e) => { const a = e.estiloAtual(); if (galEstilos.dataset.atual !== a) { galEstilos.dataset.atual = a; renderEstilos(a); } });
  const gEstilos = grupo('Estilos', galEstilos);
  const gEdicao = grupo('Edição', col(
    botao({ icone: 'substituir', rotulo: 'Substituir', titulo: 'Localizar e Substituir', tam: 'r', acao: c((e) => dialogoSubstituir(e)) }),
    botao({ icone: 'selecionar', rotulo: 'Selecionar Tudo', titulo: 'Selecionar Tudo (Ctrl+A)', tam: 'r', acao: c((e) => { const r = document.createRange(); r.selectNodeContents(e.area); e.area.focus(); e.selecionarRange(r); }) })));

  // ================================================================ INSERIR
  const painelTabela = (fechar) => {
    const rot = h('div', { class: 'ed-paleta-tit' }, 'Inserir Tabela');
    const grade = h('div', { class: 'ed-grade-sel' });
    for (let r = 0; r < 8; r++) for (let cc = 0; cc < 10; cc++) {
      grade.append(h('span', {
        'data-r': r, 'data-c': cc,
        onmouseenter: () => { grade.querySelectorAll('span').forEach((s) => s.classList.toggle('on', +s.dataset.r <= r && +s.dataset.c <= cc)); rot.textContent = `Tabela ${cc + 1}x${r + 1}`; },
        onclick: () => { fechar(); c((e) => e.tabela.inserir(r + 1, cc + 1))(); },
      }));
    }
    grade.addEventListener('mouseleave', () => { grade.querySelectorAll('span').forEach((s) => s.classList.remove('on')); rot.textContent = 'Inserir Tabela'; });
    return h('div', {}, rot, grade, menu([
      '-',
      { rotulo: 'Inserir Tabela…', icone: 'tabela', acao: c((e) => dialogoInserirTabela(e)) },
      { rotulo: 'Tabelas Rápidas', icone: 'propriedades', sub: [
        { rotulo: 'Tabela com cabeçalho (3×4)', acao: c((e) => e.tabela.inserir(4, 3, { estilo: 'grade-cinza' })) },
        { rotulo: 'Dupla entrada azul (4×4)', acao: c((e) => { e.tabela.inserir(4, 4, { estilo: 'grade-azul' }); e.tabela.opcao('pricol', true); }) },
        { rotulo: 'Tabela simples com linhas (2×5)', acao: c((e) => e.tabela.inserir(5, 2, { estilo: 'lista' })) },
        { rotulo: 'Grade invisível para layout (2×2)', acao: c((e) => e.tabela.inserir(2, 2, { estilo: 'sem' })) }] },
    ]));
  };
  const painelSimbolos = () => {
    const grade = h('div', { class: 'ed-simb-grade' });
    const abasS = h('div', { class: 'ed-simb-abas' });
    const mostrar = (cat) => {
      abasS.querySelectorAll('button').forEach((b) => b.classList.toggle('ativo', b.textContent === cat));
      grade.replaceChildren(...SIMBOLOS[cat].split(' ').map((s) => h('button', { type: 'button', class: 'ed-simb', onmousedown: (ev) => ev.preventDefault(), onclick: c((e) => e.exec('insertText', s)) }, s)));
    };
    Object.keys(SIMBOLOS).forEach((cat) => abasS.append(h('button', { type: 'button', onmousedown: (ev) => ev.preventDefault(), onclick: () => mostrar(cat) }, cat)));
    mostrar('Matemática');
    return h('div', { class: 'ed-simb-pop' }, abasS, grade);
  };
  const painelInserir = [
    grupo('Tabelas', suspenso({ icone: 'tabela', rotulo: 'Tabela', titulo: 'Tabela', tam: 'g', painel: painelTabela })),
    grupo('Ilustrações', botao({ icone: 'imagem', rotulo: 'Imagens', titulo: 'Inserir imagem do computador', tam: 'g', acao: c((e) => e.imagem.inserir()) })),
    grupo('Texto', [
      botao({ icone: 'caixaTexto', rotulo: 'Caixa de Texto', titulo: 'Caixa de texto (texto-base)', tam: 'g', acao: c((e) => e.inserirCaixa()) }),
      botao({ icone: 'linhas', rotulo: 'Linhas', titulo: 'Linhas para resposta', tam: 'g', acao: c((e) => e.inserirLinhas()) }),
      col(botao({ icone: 'linhaH', rotulo: 'Linha Horizontal', tam: 'r', acao: exec('insertHorizontalRule') }))]),
    grupo('Símbolos', [
      suspenso({ icone: 'equacao', rotulo: 'Equação', titulo: 'Equação', tam: 'g', painel: () => menu([
        { rotulo: 'Fração', icone: 'fracao', acao: c((e) => e.inserirFracao()) },
        { rotulo: 'Raiz Quadrada', icone: 'raiz', acao: c((e) => e.inserirRaiz()) },
        { rotulo: 'Raiz Cúbica', icone: 'raiz', acao: c((e) => e.inserirRaiz('3')) },
        { rotulo: 'Potência (sobrescrito)', icone: 'sobrescrito', acao: exec('superscript') },
        { rotulo: 'Índice (subscrito)', icone: 'subscrito', acao: exec('subscript') }]) }),
      suspenso({ icone: 'simbolo', rotulo: 'Símbolo', titulo: 'Símbolo', tam: 'g', painel: painelSimbolos })]),
  ];

  // ================================================================ DESIGN DA TABELA
  const chk = (flag, rotulo) => {
    const i = h('input', { type: 'checkbox' });
    i.addEventListener('change', c((e) => e.tabela.opcao(flag, i.checked)));
    quando((e) => { const s = e.tabela.estado(); if (s) i.checked = s[flag]; });
    return h('label', { class: 'ed-chk' }, i, rotulo);
  };
  const thumbTabela = (est) => h('span', { class: 'ed-tb-thumb' }, h('table', { class: 'q-tabela', 'data-estilo': est.id, 'data-cab': est.cab ? '1' : null, 'data-tiras': est.tiras ? '1' : null },
    h('tbody', {}, Array.from({ length: 5 }, () => h('tr', {}, Array.from({ length: 4 }, () => h('td')))))));
  const galTabelas = h('div', { class: 'ed-galeria ed-gal-tabelas' }, ESTILOS_TABELA.map((est) => h('button', {
    type: 'button', class: 'ed-gal-item', 'data-id': est.id, title: est.nome, onmousedown: (ev) => ev.preventDefault(), onclick: c((e) => e.tabela.aplicarEstilo(est.id)),
  }, thumbTabela(est))));
  quando((e) => { const s = e.tabela.estado(); if (s) galTabelas.querySelectorAll('.ed-gal-item').forEach((b) => b.classList.toggle('ativo', b.dataset.id === s.estilo)); });
  let ultimoSombCel = '#D9E2F3';
  const sombCel = dividido({
    icone: 'sombreamento', rotulo: 'Sombreamento', titulo: 'Sombreamento da(s) célula(s)', tam: 'g', acao: c((e) => e.tabela.sombreamento(ultimoSombCel)),
    painel: () => paleta({ semCor: 'Sem Cor', valorSemCor: 'transparent', aoEscolher: c((e, cor) => { if (cor !== 'transparent') { ultimoSombCel = cor; barraSombCel.style.background = cor; } e.tabela.sombreamento(cor); }) }),
  });
  const barraSombCel = h('span', { class: 'ed-cor-barra', style: { background: ultimoSombCel } });
  sombCel.principal.querySelector('.ed-ic').append(barraSombCel);

  const selEstiloCaneta = h('select', { class: 'ed-sel', title: 'Estilo da Borda' }, [['solid', '──────'], ['dashed', '─ ─ ─ ─'], ['dotted', '· · · · · ·'], ['double', '══════']].map(([v, n]) => h('option', { value: v }, n)));
  const selEspCaneta = h('select', { class: 'ed-sel', title: 'Espessura da Caneta' }, ['0.5px', '1px', '1.5px', '2px', '3px', '4.5px'].map((v) => h('option', { value: v, selected: v === '1px' }, v.replace('px', ' pt').replace('.', ','))));
  const barraCaneta = h('span', { class: 'ed-cor-barra', style: { background: '#000000' } });
  const corCaneta = suspenso({ icone: 'corFonte', rotulo: 'Cor da Caneta', titulo: 'Cor da Caneta', tam: 'r', painel: () => paleta({ semCor: 'Automático', valorSemCor: '#000000', aoEscolher: c((e, cor) => { e.tabela.caneta.cor = cor; barraCaneta.style.background = cor; }) }) });
  corCaneta.querySelector('.ed-ic').append(barraCaneta);
  selEstiloCaneta.addEventListener('change', c((e) => { e.tabela.caneta.estilo = selEstiloCaneta.value; if (selEstiloCaneta.value === 'double' && parseFloat(e.tabela.caneta.esp) < 3) { e.tabela.caneta.esp = '3px'; selEspCaneta.value = '3px'; } }));
  selEspCaneta.addEventListener('change', c((e) => { e.tabela.caneta.esp = selEspCaneta.value; }));
  const OPC_BORDAS = [['inferior', 'Borda Inferior'], ['superior', 'Borda Superior'], ['esquerda', 'Borda Esquerda'], ['direita', 'Borda Direita'], '-', ['nenhuma', 'Sem Borda'], ['todas', 'Todas as Bordas'], ['externas', 'Bordas Externas'], ['internas', 'Bordas Internas'], '-', ['internasH', 'Borda Horizontal Interna'], ['internasV', 'Borda Vertical Interna']];
  let ultimaBorda = 'todas';
  const btnBordas = dividido({
    icone: iconeBorda('todas'), rotulo: 'Bordas', titulo: 'Bordas: aplica a caneta (estilo, espessura e cor) às células selecionadas', tam: 'g',
    acao: c((e) => e.tabela.bordas(ultimaBorda)),
    painel: () => menu(OPC_BORDAS.map((o) => (o === '-' ? '-' : { rotulo: o[1], icone: iconeBorda(o[0]), acao: c((e) => { ultimaBorda = o[0]; btnBordas.principal.querySelector('.ed-ic').innerHTML = iconeBorda(o[0]); e.tabela.bordas(o[0]); }) }))),
  });

  const painelDesign = [
    grupo('Opções de Estilo de Tabela', h('div', { class: 'ed-chk-grade' }, chk('cab', 'Linha de Cabeçalho'), chk('pricol', 'Primeira Coluna'), chk('total', 'Linha de Total'), chk('tiras', 'Linhas em Tiras'))),
    grupo('Estilos de Tabela', [galTabelas, sombCel.el]),
    grupo('Bordas', [col(selEstiloCaneta, selEspCaneta, corCaneta), btnBordas.el]),
  ];

  // ================================================================ LAYOUT (TABELA)
  const btnGrade = botao({ icone: 'grade', rotulo: 'Exibir Linhas de Grade', titulo: 'Mostra linhas pontilhadas onde a tabela não tem bordas (não são impressas)', tam: 'r', acao: c((e) => { e.area.classList.toggle('ed-grade'); atualizar(e); }) });
  quando((e) => btnGrade.classList.toggle('ativo', e.area.classList.contains('ed-grade')));
  const inpAltura = h('input', { class: 'ed-num', type: 'number', step: 0.1, min: 0, title: 'Altura da linha (cm)' });
  const inpLargura = h('input', { class: 'ed-num', type: 'number', step: 0.1, min: 0.3, title: 'Largura da coluna (cm)' });
  inpAltura.addEventListener('change', c((e) => e.tabela.alturaLinha(+inpAltura.value)));
  inpLargura.addEventListener('change', c((e) => e.tabela.larguraColuna(+inpLargura.value)));
  quando((e) => { const s = e.tabela.estado(); if (!s) return; if (document.activeElement !== inpAltura) inpAltura.value = s.altura; if (document.activeElement !== inpLargura) inpLargura.value = s.largura; });
  const ALINH = [['top', 'left'], ['top', 'center'], ['top', 'right'], ['middle', 'left'], ['middle', 'center'], ['middle', 'right'], ['bottom', 'left'], ['bottom', 'center'], ['bottom', 'right']];
  const iconeAlinh = (v, hz) => {
    const y = { top: 4, middle: 9, bottom: 14 }[v];
    const x = { left: 4, center: 7, right: 10 }[hz];
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="1" opacity=".35"/><path d="M${x} ${y + 1}h10M${x} ${y + 4}h10M${x + (hz === 'right' ? 4 : hz === 'center' ? 2 : 0)} ${y + 7}h6"/></svg>`;
  };
  const gradeAlinh = h('div', { class: 'ed-alinh-grade' }, ALINH.map(([v, hz]) => botao({ icone: iconeAlinh(v, hz), titulo: `Alinhar ${{ top: 'em Cima', middle: 'no Centro', bottom: 'Embaixo' }[v]} e ${{ left: 'à Esquerda', center: 'ao Centro', right: 'à Direita' }[hz]}`, acao: c((e) => e.tabela.alinhar(v, hz)) })));

  const painelLayout = [
    grupo('Tabela', col(
      suspenso({ icone: 'selecionar', rotulo: 'Selecionar', tam: 'r', painel: () => menu([
        { rotulo: 'Selecionar Célula', acao: c((e) => e.tabela.selecionar('celula')) }, { rotulo: 'Selecionar Coluna', acao: c((e) => e.tabela.selecionar('coluna')) },
        { rotulo: 'Selecionar Linha', acao: c((e) => e.tabela.selecionar('linha')) }, { rotulo: 'Selecionar Tabela', acao: c((e) => e.tabela.selecionar('tabela')) }]) }),
      btnGrade,
      botao({ icone: 'propriedades', rotulo: 'Propriedades', tam: 'r', acao: c((e) => e.tabela.propriedades()) }))),
    grupo('Linhas e Colunas', [
      suspenso({ icone: 'excluir', rotulo: 'Excluir', tam: 'g', painel: () => menu([
        { rotulo: 'Excluir Colunas', acao: c((e) => e.tabela.excluirColunas()) }, { rotulo: 'Excluir Linhas', acao: c((e) => e.tabela.excluirLinhas()) },
        { rotulo: 'Excluir Tabela', acao: c((e) => e.tabela.excluirTabela()) }]) }),
      botao({ icone: 'insAcima', rotulo: 'Inserir Acima', tam: 'g', acao: c((e) => e.tabela.inserirLinha(false)) }),
      col(botao({ icone: 'insAbaixo', rotulo: 'Inserir Abaixo', tam: 'r', acao: c((e) => e.tabela.inserirLinha(true)) }),
        botao({ icone: 'insEsq', rotulo: 'Inserir à Esquerda', tam: 'r', acao: c((e) => e.tabela.inserirColuna(false)) }),
        botao({ icone: 'insDir', rotulo: 'Inserir à Direita', tam: 'r', acao: c((e) => e.tabela.inserirColuna(true)) }))]),
    grupo('Mesclar', col(
      botao({ icone: 'mesclar', rotulo: 'Mesclar Células', tam: 'r', acao: c((e) => e.tabela.mesclar()) }),
      botao({ icone: 'dividir', rotulo: 'Dividir Células', tam: 'r', acao: c((e) => e.tabela.dialogoDividir()) }),
      botao({ icone: 'dividirTabela', rotulo: 'Dividir Tabela', tam: 'r', acao: c((e) => e.tabela.dividirTabela()) }))),
    grupo('Tamanho da Célula', [
      suspenso({ icone: 'autoAjuste', rotulo: 'AutoAjuste', tam: 'g', painel: () => menu([
        { rotulo: 'AutoAjuste do Conteúdo', acao: c((e) => e.tabela.autoAjuste('conteudo')) },
        { rotulo: 'AutoAjuste da Janela', acao: c((e) => e.tabela.autoAjuste('janela')) },
        { rotulo: 'Largura Fixa da Coluna', acao: c((e) => e.tabela.autoAjuste('fixa')) }]) }),
      col(h('label', { class: 'ed-campo-num', title: 'Altura da linha' }, h('span', { html: svg('distLinhas') }), 'Altura', inpAltura, 'cm'),
        h('label', { class: 'ed-campo-num', title: 'Largura da coluna' }, h('span', { html: svg('distColunas') }), 'Largura', inpLargura, 'cm')),
      col(botao({ icone: 'distLinhas', rotulo: 'Distribuir Linhas', tam: 'r', acao: c((e) => e.tabela.distribuirLinhas()) }),
        botao({ icone: 'distColunas', rotulo: 'Distribuir Colunas', tam: 'r', acao: c((e) => e.tabela.distribuirColunas()) }))]),
    grupo('Alinhamento', [gradeAlinh,
      botao({ icone: 'direcaoTexto', rotulo: 'Direção do Texto', tam: 'g', acao: c((e) => e.tabela.direcaoTexto()) }),
      suspenso({ icone: 'margens', rotulo: 'Margens da Célula', tam: 'g', painel: () => menu([
        { rotulo: 'Estreitas', acao: c((e) => e.tabela.margens('estreita')) }, { rotulo: 'Normais', acao: c((e) => e.tabela.margens('normal')) },
        { rotulo: 'Largas', acao: c((e) => e.tabela.margens('larga')) }]) }),
      suspenso({ icone: 'posicao', rotulo: 'Posição', tam: 'g', painel: () => menu([
        { rotulo: 'À Esquerda', acao: c((e) => e.tabela.posicao('')) }, { rotulo: 'Centralizada', acao: c((e) => e.tabela.posicao('centro')) },
        { rotulo: 'À Direita', acao: c((e) => e.tabela.posicao('dir')) }]) })]),
  ];

  // ================================================================ FORMATO DA IMAGEM
  const srcAtual = () => ed?.imagem.atual()?.querySelector('img')?.src || '';
  const painelCorrecoes = () => {
    const vals = [-40, -20, 0, 20, 40];
    const s = ed.imagem.estado();
    const grade = h('div', { class: 'ed-thumbs ed-thumbs-5' });
    vals.forEach((ct) => vals.forEach((br) => grade.append(h('button', {
      type: 'button', class: `ed-thumb ${s.brilho === br && s.contraste === ct ? 'ativo' : ''}`, title: `Brilho: ${br > 0 ? '+' : ''}${br}%  Contraste: ${ct > 0 ? '+' : ''}${ct}%`,
      onmousedown: (ev) => ev.preventDefault(), onclick: () => { fecharPop(); c((e) => e.imagem.ajustar({ brilho: br, contraste: ct }))(); },
    }, h('img', { src: srcAtual(), style: { filter: `brightness(${1 + br / 100}) contrast(${1 + ct / 100})` } })))));
    return h('div', {}, h('div', { class: 'ed-paleta-tit' }, 'Brilho/Contraste'), grade, menu(['-', { rotulo: 'Opções de Correções de Imagem…', acao: c((e) => e.imagem.dialogoTamanho()) }]));
  };
  const FILTRO_COR = { normal: 'none', cinza: 'grayscale(1)', pb: 'grayscale(1) contrast(6)', sepia: 'sepia(1)', desbotado: 'opacity(.35)' };
  const painelCor = () => {
    const s = ed.imagem.estado();
    return h('div', {}, h('div', { class: 'ed-paleta-tit' }, 'Recolorir'),
      h('div', { class: 'ed-thumbs' }, MODOS_COR.map((m) => h('button', {
        type: 'button', class: `ed-thumb ed-thumb-rot ${s.cor === m.id ? 'ativo' : ''}`, title: m.nome, onmousedown: (ev) => ev.preventDefault(),
        onclick: () => { fecharPop(); c((e) => e.imagem.cor(m.id))(); },
      }, h('img', { src: srcAtual(), style: { filter: FILTRO_COR[m.id] } }), h('small', {}, m.nome)))));
  };
  const galImg = h('div', { class: 'ed-galeria ed-gal-img' });
  const renderGalImg = (s) => galImg.replaceChildren(...ESTILOS_IMG.map((est) => h('button', {
    type: 'button', class: `ed-gal-item ${s?.estilo === est.id ? 'ativo' : ''}`, title: est.nome, onmousedown: (ev) => ev.preventDefault(), onclick: c((e) => e.imagem.estilo(est.id)),
  }, h('span', { class: 'q-fig ed-img-thumb', 'data-estilo-img': est.id || null }, h('img', { src: srcAtual() })))));
  quando((e) => {
    const s = e.imagem.estado(); if (!s) return;
    const chave = srcAtual().slice(-40) + s.estilo;
    if (galImg.dataset.chave !== chave) { galImg.dataset.chave = chave; renderGalImg(s); }
  });
  const bordaImg = suspenso({ icone: 'bordaImg', rotulo: 'Borda da Imagem', tam: 'r', painel: () => h('div', {},
    paleta({ aoEscolher: c((e, cor) => e.imagem.borda({ cor })) }),
    menu([
      { rotulo: 'Sem Contorno', acao: c((e) => e.imagem.borda({ cor: 'none' })) },
      { rotulo: 'Espessura', sub: ['0.5px', '1px', '1.5px', '2px', '3px', '4.5px', '6px'].map((v) => ({ rotulo: v.replace('px', ' pt').replace('.', ','), acao: c((e) => e.imagem.borda({ esp: v })) })) },
      { rotulo: 'Traços', sub: [['solid', 'Sólido'], ['dashed', 'Tracejado'], ['dotted', 'Pontilhado'], ['double', 'Duplo']].map(([v, n]) => ({ rotulo: n, acao: c((e) => e.imagem.borda({ tipo: v })) })) }])) });
  const inpImgAlt = h('input', { class: 'ed-num', type: 'number', step: 0.1, min: 0.3, title: 'Altura da forma (cm)' });
  const inpImgLarg = h('input', { class: 'ed-num', type: 'number', step: 0.1, min: 0.3, title: 'Largura da forma (cm)' });
  let travada = true;
  const btnTrava = botao({ icone: 'cadeado', titulo: 'Bloquear taxa de proporção', acao: () => { travada = !travada; btnTrava.querySelector('.ed-ic').innerHTML = svg(travada ? 'cadeado' : 'cadeadoAberto'); btnTrava.classList.toggle('ativo', travada); } });
  btnTrava.classList.add('ativo');
  inpImgAlt.addEventListener('change', c((e) => e.imagem.definirTamanho({ alturaCm: +inpImgAlt.value, larguraCm: travada ? 0 : +inpImgLarg.value, bloquear: travada })));
  inpImgLarg.addEventListener('change', c((e) => e.imagem.definirTamanho({ larguraCm: +inpImgLarg.value, alturaCm: travada ? 0 : +inpImgAlt.value, bloquear: travada })));
  quando((e) => {
    const s = e.imagem.estado(); if (!s) return;
    if (document.activeElement !== inpImgAlt) inpImgAlt.value = s.alturaCm.toFixed(2);
    if (document.activeElement !== inpImgLarg) inpImgLarg.value = s.larguraCm.toFixed(2);
    btnLegenda.classList.toggle('ativo', s.legenda);
  });
  const btnLegenda = botao({ icone: 'legenda', rotulo: 'Legenda', titulo: 'Inserir/remover legenda (Figura N – …)', tam: 'g', acao: c((e) => e.imagem.legenda()) });
  const cortarBtn = dividido({
    icone: 'cortar', rotulo: 'Cortar', titulo: 'Cortar', tam: 'g', acao: c((e) => e.imagem.cortar()),
    painel: () => menu([
      { rotulo: 'Cortar', icone: 'cortar', acao: c((e) => e.imagem.cortar()) },
      { rotulo: 'Cortar para Proporção', sub: PROPORCOES.filter((p) => p[1]).map(([n, v]) => ({ rotulo: n, acao: c((e) => e.imagem.cortar(v)) })) }]),
  });

  const painelImagem = [
    grupo('Ajustar', [
      suspenso({ icone: 'correcoes', rotulo: 'Correções', tam: 'g', painel: painelCorrecoes }),
      suspenso({ icone: 'cor', rotulo: 'Cor', tam: 'g', painel: painelCor }),
      col(botao({ icone: 'alterar', rotulo: 'Alterar Imagem', tam: 'r', acao: c((e) => e.imagem.alterar()) }),
        dividido({ icone: 'redefinir', rotulo: 'Redefinir Imagem', tam: 'r', acao: c((e) => e.imagem.redefinir(false)), painel: () => menu([
          { rotulo: 'Redefinir Imagem', acao: c((e) => e.imagem.redefinir(false)) }, { rotulo: 'Redefinir Imagem e Tamanho', acao: c((e) => e.imagem.redefinir(true)) }]) }).el)]),
    grupo('Estilos de Imagem', [galImg, col(bordaImg)]),
    grupo('Acessibilidade', botao({ icone: 'textoAlt', rotulo: 'Texto Alt', tam: 'g', acao: c((e) => e.imagem.textoAlt()) })),
    grupo('Organizar', [
      suspenso({ icone: 'quebra', rotulo: 'Quebra de Texto', tam: 'g', painel: () => { const q = ed.imagem.estado()?.quebra; return menu(QUEBRAS.map((o) => ({ rotulo: o.nome, icone: o.icone.replace('viewBox="0 0 60 44"', 'viewBox="0 0 60 44" width="22"'), ativo: q === o.id, acao: c((e) => e.imagem.quebra(o.id)) }))); } }),
      suspenso({ icone: 'posicao', rotulo: 'Posição', tam: 'g', painel: () => menu([
        { rotulo: 'À Esquerda', icone: 'esq', acao: c((e) => e.imagem.posicao('esq')) }, { rotulo: 'Centralizada', icone: 'centro', acao: c((e) => e.imagem.posicao('centro')) },
        { rotulo: 'À Direita', icone: 'dir', acao: c((e) => e.imagem.posicao('dir')) }]) }),
      suspenso({ icone: 'girar', rotulo: 'Girar', tam: 'g', painel: () => menu([
        { rotulo: 'Girar 90° para a Direita', acao: c((e) => e.imagem.girar(90)) }, { rotulo: 'Girar 90° para a Esquerda', acao: c((e) => e.imagem.girar(-90)) },
        { rotulo: 'Inverter Verticalmente', acao: c((e) => e.imagem.inverter('v')) }, { rotulo: 'Inverter Horizontalmente', acao: c((e) => e.imagem.inverter('h')) }]) }),
      btnLegenda]),
    grupo('Tamanho', [cortarBtn.el,
      col(h('label', { class: 'ed-campo-num', title: 'Altura' }, h('span', { html: svg('distLinhas') }), 'Altura', inpImgAlt, 'cm'),
        h('label', { class: 'ed-campo-num', title: 'Largura' }, h('span', { html: svg('distColunas') }), 'Largura', inpImgLarg, 'cm'),
        btnTrava)], c((e) => e.imagem.dialogoTamanho())),
  ];

  // ================================================================ estrutura das guias
  const ABAS = [
    { id: 'inicio', nome: 'Página Inicial', conteudo: [gArea, gFonte, gParagrafo, gEstilos, gEdicao] },
    { id: 'inserir', nome: 'Inserir', conteudo: painelInserir },
    { id: 'tabDesign', nome: 'Design da Tabela', ctx: 'tab', conteudo: painelDesign },
    { id: 'tabLayout', nome: 'Layout', ctx: 'tab', conteudo: painelLayout },
    { id: 'imgFormato', nome: 'Formato da Imagem', ctx: 'img', conteudo: painelImagem },
  ];
  let abaAtiva = 'inicio';
  const botoesAba = {}, paineis = {};
  const barra = h('div', { class: 'ed-abas' },
    h('span', { class: 'ed-acesso' },
      botao({ icone: 'desfazer', titulo: 'Desfazer (Ctrl+Z)', acao: c((e) => e.desfazer(-1)) }),
      botao({ icone: 'refazer', titulo: 'Refazer (Ctrl+Y)', acao: c((e) => e.desfazer(1)) })));
  const corpo = h('div', { class: 'ed-paineis' });
  ABAS.forEach((a) => {
    botoesAba[a.id] = h('button', { type: 'button', class: `ed-aba ${a.ctx ? 'ed-aba-ctx ed-ctx-' + a.ctx : ''}`, hidden: !!a.ctx, onmousedown: (ev) => ev.preventDefault(), onclick: () => mostrarAba(a.id) }, a.nome);
    barra.append(botoesAba[a.id]);
    paineis[a.id] = h('div', { class: 'ed-painel', hidden: a.id !== 'inicio' }, a.conteudo);
    corpo.append(paineis[a.id]);
  });
  const alvo = h('span', { class: 'ed-alvo' });
  barra.append(alvo);
  const el = h('div', { class: 'ed-ribbon no-print' }, barra, corpo);

  let abaPendente = null;
  function mostrarAba(id) {
    // guia contextual ainda oculta: abre assim que ela aparecer
    if (botoesAba[id].hidden) { abaPendente = id; atualizar(ed); return; }
    abaAtiva = id;
    Object.entries(botoesAba).forEach(([k, b]) => b.classList.toggle('ativa', k === id));
    Object.entries(paineis).forEach(([k, p]) => { p.hidden = k !== id; });
  }
  mostrarAba('inicio');

  let pendente = false;
  function atualizar(e) {
    if (e && e !== ed) return;
    if (pendente) return;
    pendente = true;
    requestAnimationFrame(() => {
      pendente = false;
      if (!ed) return;
      el.querySelectorAll('[data-estado]').forEach((b) => b.classList.toggle('ativo', ed.estado(b.dataset.estado)));
      const temTab = !!ed.tabelaAtual, temImg = !!ed.imagem.atual();
      botoesAba.tabDesign.hidden = botoesAba.tabLayout.hidden = !temTab;
      botoesAba.imgFormato.hidden = !temImg;
      if (abaPendente && !botoesAba[abaPendente].hidden) mostrarAba(abaPendente);
      abaPendente = null;
      if (botoesAba[abaAtiva].hidden) mostrarAba('inicio');
      alvo.textContent = ed.rotulo ? `Editando: ${ed.rotulo}` : '';
      atualizadores.forEach((fn) => { try { fn(ed); } catch (err) { console.warn(err); } });
    });
  }

  return {
    el,
    registrar(e) { editores.add(e); if (!ed) ativar(e); },
    ativar,
    atualizar,
    mostrarAba,
    /** Coloca um botão extra na barra das guias, logo depois de "Inserir". */
    adicionarNaBarra(botaoExtra) { botoesAba.inserir.after(botaoExtra); },
    colar: (e) => colar(e),
    dialogoFonte, dialogoParagrafo,
  };

  function ativar(e) {
    if (ed !== e) {
      if (ed && ed !== e) { ed.imagem.desselecionar(); ed.tabela.limparSelecao(); ed.tabelaAtual = null; }
      ed = e;
      editores.forEach((x) => x.wrap.classList.toggle('ed-ativo', x === e));
    }
    atualizar(e);
  }
}

// ================================================================ caixas de diálogo
async function colar(e) {
  try {
    if (navigator.clipboard?.read) {
      const itens = await navigator.clipboard.read();
      for (const it of itens) {
        if (it.types.includes('text/html')) { const html = await (await it.getType('text/html')).text(); e.exec('insertHTML', limparHtml(html)); e.prepararConteudo(); return; }
        const tipoImg = it.types.find((t) => t.startsWith('image/'));
        if (tipoImg) { const b = await it.getType(tipoImg); e.imagem.inserir(new File([b], 'colada.png', { type: tipoImg })); return; }
        if (it.types.includes('text/plain')) { e.exec('insertText', await (await it.getType('text/plain')).text()); return; }
      }
    } else {
      e.exec('insertText', await navigator.clipboard.readText());
    }
  } catch {
    toast('Use Ctrl+V para colar (o navegador não liberou a área de transferência).');
  }
}

async function dialogoFonte(e) {
  e.restaurar();
  const cs = getComputedStyle(e.elementoAtual());
  const deco = cs.textDecorationLine;
  const fonte = h('select', {}, FONTES.map((f) => h('option', { selected: cs.fontFamily.includes(f), style: { fontFamily: f } }, f)));
  const estiloAtual = ((+cs.fontWeight >= 600 ? 'b' : '') + (cs.fontStyle === 'italic' ? 'i' : '')) || 'n';
  const estiloF = h('select', {}, [['n', 'Normal'], ['i', 'Itálico'], ['b', 'Negrito'], ['bi', 'Negrito Itálico']].map(([v, n]) => h('option', { value: v, selected: v === estiloAtual }, n)));
  const tam = h('input', { type: 'number', min: 1, max: 400, step: 0.5, value: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2 });
  const cor = h('input', { type: 'color', value: rgbParaHex(cs.color) });
  const sub = h('select', {}, h('option', { value: '' }, '(nenhum)'), SUBLINHADOS.map(([v, n]) => h('option', { value: v, selected: deco.includes('underline') && cs.textDecorationStyle === v }, n.replace('Sublinhado ', ''))));
  const ck = (rot, on) => { const i = h('input', { type: 'checkbox', checked: on }); return [i, h('label', { class: 'campo-check' }, i, rot)]; };
  const [tach, lTach] = ck('Tachado', deco.includes('line-through'));
  const [sobre, lSobre] = ck('Sobrescrito', cs.verticalAlign === 'super');
  const [subs, lSubs] = ck('Subscrito', cs.verticalAlign === 'sub');
  const [vers, lVers] = ck('Versalete', cs.fontVariantCaps === 'small-caps');
  const [maius, lMaius] = ck('Todas em maiúsculas', cs.textTransform === 'uppercase');
  const espac = h('input', { type: 'number', step: 0.5, min: -5, max: 20, value: cs.letterSpacing === 'normal' ? 0 : Math.round(parseFloat(cs.letterSpacing) * 0.75 * 2) / 2 });
  const prev = h('div', { class: 'dlg-prev' }, (e.range && !e.range.collapsed ? e.range.toString().slice(0, 40) : '') || 'AaBbCcDd');
  sobre.addEventListener('change', () => { if (sobre.checked) subs.checked = false; montar(); });
  subs.addEventListener('change', () => { if (subs.checked) sobre.checked = false; montar(); });
  const montar = () => {
    const s = {
      fontFamily: fonte.value, fontSize: tam.value + 'pt', fontWeight: estiloF.value.includes('b') ? 'bold' : 'normal', fontStyle: estiloF.value.includes('i') ? 'italic' : 'normal',
      color: cor.value, textDecorationLine: [sub.value ? 'underline' : '', tach.checked ? 'line-through' : ''].filter(Boolean).join(' ') || 'none',
      textDecorationStyle: sub.value && sub.value !== 'solid' ? sub.value : '', fontVariantCaps: vers.checked ? 'small-caps' : '', textTransform: maius.checked ? 'uppercase' : '',
      letterSpacing: +espac.value ? espac.value + 'pt' : '', verticalAlign: sobre.checked ? 'super' : subs.checked ? 'sub' : '',
    };
    if (sobre.checked || subs.checked) s.fontSize = (+tam.value * 0.65).toFixed(1) + 'pt';
    Object.assign(prev.style, s);
    return s;
  };
  // como no Word, só aplica o que o usuário alterou na caixa de diálogo
  const sujo = new Set();
  const CHAVES = new Map([[fonte, ['fontFamily']], [estiloF, ['fontWeight', 'fontStyle']], [tam, ['fontSize']], [cor, ['color']],
    [sub, ['textDecorationLine', 'textDecorationStyle']], [tach, ['textDecorationLine', 'textDecorationStyle']], [vers, ['fontVariantCaps']],
    [maius, ['textTransform']], [espac, ['letterSpacing']], [sobre, ['verticalAlign', 'fontSize']], [subs, ['verticalAlign', 'fontSize']]]);
  CHAVES.forEach((ks, x) => { x.addEventListener('input', () => { ks.forEach((k) => sujo.add(k)); montar(); }); x.addEventListener('change', () => ks.forEach((k) => sujo.add(k))); });
  montar();
  const r = await modal({
    titulo: 'Fonte',
    corpo: h('div', {},
      h('div', { class: 'form-grade' }, campo('Fonte', fonte), campo('Estilo da fonte', estiloF), campo('Tamanho', tam)),
      h('div', { class: 'form-grade' }, campo('Cor da fonte', cor), campo('Estilo de sublinhado', sub), campo('Espaçamento entre caracteres (pt)', espac)),
      h('h3', { class: 'dlg-sec' }, 'Efeitos'),
      h('div', { class: 'dlg-efeitos' }, lTach, lSobre, lSubs, lVers, lMaius),
      h('h3', { class: 'dlg-sec' }, 'Visualização'), prev),
    acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }],
  });
  if (r !== 'ok') return;
  const tudo = montar();
  const s = Object.fromEntries(Object.entries(tudo).filter(([k]) => sujo.has(k)));
  if (Object.keys(s).length) e.envolver(s, Object.keys(s));
}

async function dialogoParagrafo(e) {
  const blocos = e.blocosSelecionados();
  if (!blocos.length) return;
  const b = blocos[0];
  const cs = getComputedStyle(b);
  const pxCm = (px) => Math.round((parseFloat(px) || 0) / 37.795 * 100) / 100;
  const pxPt = (px) => Math.round((parseFloat(px) || 0) * 0.75 * 10) / 10;
  const alin = h('select', {}, [['left', 'Esquerda'], ['center', 'Centralizada'], ['right', 'Direita'], ['justify', 'Justificada']].map(([v, n]) => h('option', { value: v, selected: cs.textAlign === v || (v === 'left' && cs.textAlign === 'start') }, n)));
  const ind = parseFloat(cs.textIndent) || 0;
  const especial = h('select', {}, [['', '(nenhum)'], ['primeira', 'Primeira linha'], ['desloc', 'Deslocamento']].map(([v, n]) => h('option', { value: v, selected: v === (ind > 0 ? 'primeira' : ind < 0 ? 'desloc' : '') }, n)));
  const por = h('input', { type: 'number', step: 0.25, min: 0, value: Math.abs(pxCm(ind)) || 1.25 });
  const recE = h('input', { type: 'number', step: 0.25, min: 0, value: pxCm(cs.marginLeft) - (ind < 0 ? Math.abs(pxCm(ind)) : 0) });
  const recD = h('input', { type: 'number', step: 0.25, min: 0, value: pxCm(cs.marginRight) });
  const antes = h('input', { type: 'number', step: 1, min: 0, value: pxPt(cs.marginTop) });
  const depois = h('input', { type: 'number', step: 1, min: 0, value: pxPt(cs.marginBottom) });
  const lhAtual = b.style.lineHeight || '';
  const entre = h('select', {}, [['', 'Padrão'], ['1', 'Simples'], ['1.15', '1,15'], ['1.5', '1,5 linha'], ['2', 'Duplo'], ['mult', 'Múltiplos']].map(([v, n]) => h('option', { value: v, selected: v === lhAtual || (v === 'mult' && lhAtual && !['1', '1.15', '1.5', '2'].includes(lhAtual)) }, n)));
  const mult = h('input', { type: 'number', step: 0.1, min: 0.5, value: parseFloat(lhAtual) || 3 });
  const r = await modal({
    titulo: 'Parágrafo',
    corpo: h('div', {},
      h('h3', { class: 'dlg-sec' }, 'Geral'), campo('Alinhamento', alin),
      h('h3', { class: 'dlg-sec' }, 'Recuo'),
      h('div', { class: 'form-grade' }, campo('Esquerdo (cm)', recE), campo('Direito (cm)', recD), campo('Especial', especial), campo('Por (cm)', por)),
      h('h3', { class: 'dlg-sec' }, 'Espaçamento'),
      h('div', { class: 'form-grade' }, campo('Antes (pt)', antes), campo('Depois (pt)', depois), campo('Entre linhas', entre), campo('Em (múltiplos)', mult))),
    acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }],
  });
  if (r !== 'ok') return;
  e.snapshot();
  blocos.forEach((x) => {
    x.style.textAlign = alin.value === 'left' ? '' : alin.value;
    const p = +por.value || 0;
    const esq = +recE.value || 0;
    if (especial.value === 'primeira') { x.style.textIndent = p + 'cm'; x.style.marginLeft = esq ? esq + 'cm' : ''; }
    else if (especial.value === 'desloc') { x.style.textIndent = -p + 'cm'; x.style.marginLeft = esq + p + 'cm'; }
    else { x.style.textIndent = ''; x.style.marginLeft = esq ? esq + 'cm' : ''; }
    x.style.marginRight = +recD.value ? recD.value + 'cm' : '';
    x.style.marginTop = antes.value + 'pt';
    x.style.marginBottom = depois.value + 'pt';
    x.style.lineHeight = entre.value === 'mult' ? mult.value : entre.value;
  });
  e.mudou();
}

async function dialogoSubstituir(e) {
  const de = h('input', { type: 'text', value: e.range && !e.range.collapsed ? e.range.toString().slice(0, 80) : '' });
  const para = h('input', { type: 'text' });
  const mai = h('input', { type: 'checkbox' });
  const inteira = h('input', { type: 'checkbox' });
  await modal({
    titulo: 'Localizar e Substituir',
    corpo: h('div', {}, campo('Localizar', de), campo('Substituir por', para),
      h('label', { class: 'campo-check' }, mai, 'Diferenciar maiúsculas e minúsculas'),
      h('label', { class: 'campo-check' }, inteira, 'Localizar apenas palavras inteiras')),
    acoes: [{ label: 'Fechar', value: null }, {
      label: 'Substituir Tudo', primary: true, onClick: () => {
        const n = e.substituir(de.value, para.value, { maiusc: mai.checked, inteira: inteira.checked });
        toast(n ? `${n} substituição(ões) feita(s).` : 'Nenhuma ocorrência encontrada.', n ? 'ok' : 'info');
        return false;
      },
    }],
  });
}

async function dialogoInserirTabela(e) {
  const cols = h('input', { type: 'number', min: 1, max: 20, value: 5 });
  const lins = h('input', { type: 'number', min: 1, max: 60, value: 2 });
  const ajuste = h('select', {}, [['fixa', 'Largura fixa da coluna'], ['conteudo', 'AutoAjuste do conteúdo'], ['janela', 'AutoAjuste da janela']].map(([v, n]) => h('option', { value: v }, n)));
  const estilo = h('select', {}, ESTILOS_TABELA.map((s) => h('option', { value: s.id }, s.nome)));
  const r = await modal({
    titulo: 'Inserir Tabela',
    corpo: h('div', {}, h('h3', { class: 'dlg-sec' }, 'Tamanho da tabela'),
      h('div', { class: 'form-grade' }, campo('Número de colunas', cols), campo('Número de linhas', lins)),
      h('h3', { class: 'dlg-sec' }, 'Comportamento de AutoAjuste'), ajuste, campo('Estilo', estilo)),
    acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }],
  });
  if (r !== 'ok') return;
  e.tabela.inserir(+lins.value || 2, +cols.value || 5, { estilo: estilo.value });
  if (ajuste.value !== 'fixa') e.tabela.autoAjuste(ajuste.value);
}

function rgbParaHex(v) {
  const m = String(v).match(/\d+/g);
  if (!m) return '#000000';
  return '#' + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('');
}

export { abrirPop };
