// Faixa de opções (no estilo do Word) da tela da avaliação, com as guias:
// Página Inicial (prova, questões, fonte, parágrafo, padrões), Layout, Questões (numeração e alternativas)
// e Gabarito (o que imprimir, versões anti-cola e Leitor). "Gerar com IA" fica na barra das guias.
import { h, toast } from './ui.js';
import { svg, botao, suspenso, dividido, paleta, menu, grupo, col, lin, abrirPop, fecharPop } from './editor-ui.js';
import { ICONES } from './icones.js';

const I = (nome) => ICONES[nome];

// modelos prontos de instruções e de mensagem final
const INSTRUCOES = [
  ['Padrão', ['Leia atentamente cada questão antes de responder.', 'Marque apenas uma alternativa por questão.', 'Transfira suas respostas para a folha de respostas.']],
  ['Com folha de respostas', ['Leia com atenção todas as questões.', 'Use caneta azul ou preta.', 'Preencha completamente a bolinha da alternativa escolhida na folha de respostas.', 'Não rasure a folha de respostas.']],
  ['Prova sem consulta', ['Leia atentamente cada questão antes de responder.', 'A prova é individual e sem consulta.', 'É proibido o uso de celular e de outros aparelhos eletrônicos.', 'Marque apenas uma alternativa por questão.']],
  ['Prova com consulta', ['Leia atentamente cada questão antes de responder.', 'É permitida a consulta ao livro e ao caderno.', 'Marque apenas uma alternativa por questão.']],
  ['Simulado', ['Leia atentamente cada questão antes de responder.', 'Você terá o tempo indicado pelo professor para concluir.', 'Marque as respostas na folha de respostas: apenas ela será corrigida.']],
];
const MENSAGENS = ['Boa prova!', 'Bons estudos!', 'Confie em você. Boa prova!', 'Revise suas respostas antes de entregar.', 'Sucesso!'];
const ICONE_IA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9zM19 14l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9zM5 15l.7 1.8 1.8.7-1.8.7L5 20l-.7-1.8-1.8-.7 1.8-.7z"/></svg>';

/**
 * av: a avaliação; fer: ferramentas do cartão de formatação (montarFormatacao().ferramentas);
 * a: ações da tela { mudou, cabecalho, instrucoes, mensagemFinal, adicionarSalvas, novaQuestao, gerarIA,
 *   imprimir, gerarGabaritos, abrirColecao, temColecao, mudarTipos, alterarVersoes, reembaralhar, verGabarito,
 *   desfazer, refazer, podeDesfazer, podeRefazer }
 */
export function montarFaixa(av, fer, a) {
  const atualizadores = [];
  const quando = (fn) => { atualizadores.push(fn); return fn; };

  /** Botão liga/desliga ligado a um campo da avaliação. */
  const alternar = ({ icone, rotulo, titulo, k, padrao = false, tam = 'r', aoMudar }) => {
    const ligado = () => (av[k] === undefined ? padrao : !!av[k]);
    const b = botao({ icone, rotulo, titulo, tam, acao: () => { av[k] = !ligado(); aoMudar ? aoMudar() : a.mudou(); atualizar(); } });
    b.setAttribute('aria-pressed', 'false');
    quando(() => { b.classList.toggle('ativo', ligado()); b.setAttribute('aria-pressed', String(ligado())); });
    return b;
  };
  const itemTexto = (titulo, desc, ativo, acao) => fer.itemGaleria({ desenho: fer.S('0 0 44 30', '<path d="M6 7h32M6 13h32M6 19h24M6 25h28" opacity=".8"/>'), titulo, desc, ativo, acao });
  const painelInstrucoes = () => h('div', { class: 'fmt-galeria' }, h('div', { class: 'ed-paleta-tit' }, 'Instruções'),
    ...INSTRUCOES.map(([nome, linhas]) => itemTexto(nome, linhas.join('\n'), (av.instrucoes || '').trim() === linhas.join('\n'), () => { av.instrucoes = linhas.join('\n'); a.mudou(); })),
    itemTexto('Sem instruções', '', !(av.instrucoes || '').trim(), () => { av.instrucoes = ''; a.mudou(); }),
    h('button', { type: 'button', class: 'fmt-gi-mais', onclick: () => { fecharPop(); a.instrucoes(); } }, 'Editar Instruções…'));
  const painelMensagem = () => h('div', { class: 'fmt-galeria' }, h('div', { class: 'ed-paleta-tit' }, 'Mensagem final'),
    itemTexto('Sem mensagem', '', !(av.mensagemFinal || '').trim(), () => { av.mensagemFinal = ''; a.mudou(); }),
    ...MENSAGENS.map((m) => itemTexto(m, '', (av.mensagemFinal || '').trim() === m, () => { av.mensagemFinal = m; a.mudou(); })),
    h('button', { type: 'button', class: 'fmt-gi-mais', onclick: () => { fecharPop(); a.mensagemFinal(); } }, 'Mensagem Personalizada…'));

  // valor da questão: os formatos + "Definir pesos"
  const painelValor = () => {
    const p = fer.painelValor();
    p.querySelector('.fmt-gi-nota')?.remove();
    p.append(h('button', { type: 'button', class: 'fmt-gi-mais', onclick: () => { fecharPop(); a.pesos(); } }, 'Definir Pesos das Questões…'),
      h('small', { class: 'fmt-gi-nota' }, 'Sem pesos, o valor da prova é dividido igualmente. Os pesos também valem na correção pelo Leitor.'));
    return p;
  };
  // rodapé
  const rodapes = () => [
    av.escola && av.escola.trim(),
    [av.escola, av.disciplina, av.turma].filter((x) => x && x.trim()).join(' · '),
    av.professor && `Prof(ª). ${av.professor.trim()}`,
    'Boa prova!',
  ].filter((x, i, arr) => x && arr.indexOf(x) === i);
  const painelRodape = () => h('div', { class: 'fmt-galeria' }, h('div', { class: 'ed-paleta-tit' }, 'Rodapé'),
    itemTexto('Sem rodapé', '', !(av.rodape || '').trim(), () => { av.rodape = ''; a.mudou(); }),
    ...rodapes().map((t) => itemTexto(t, '', (av.rodape || '').trim() === t, () => { av.rodape = t; a.mudou(); })),
    h('button', { type: 'button', class: 'fmt-gi-mais', onclick: () => { fecharPop(); a.rodape(); } }, 'Rodapé Personalizado…'),
    h('small', { class: 'fmt-gi-nota' }, 'Aparece no pé de todas as páginas (impressão e PDF). Os modelos usam os dados do Cabeçalho.'));
  // marca d'água
  const desenhoMarca = (op, esc) => fer.S('0 0 30 40', `<rect x="2" y="2" width="26" height="36" rx="2" fill="#fff"/><circle cx="15" cy="20" r="${10 * esc}" fill="currentColor" opacity="${op}" stroke="none"/><path d="M6 9h18M6 13h18M6 27h18M6 31h12" opacity=".5"/>`);
  const painelMarca = () => {
    const temImg = !!(av.marcaImg || av.logo);
    const op = (v, nome, desc, opac, esc) => fer.itemGaleria({ desenho: desenhoMarca(opac, esc), titulo: nome, desc, ativo: (av.marcaDagua || '') === v,
      acao: () => { if (v && !temImg) { toast('Adicione o logotipo da escola em Cabeçalho, ou use "Usar Outra Imagem…".'); return; } av.marcaDagua = v; a.mudou(); } });
    return h('div', { class: 'fmt-galeria' }, h('div', { class: 'ed-paleta-tit' }, "Marca d'água"),
      op('', "Sem marca d'água", '', 0, 0),
      op('clara', 'Logotipo claro', 'Grande e bem suave, no centro', 0.15, 1),
      op('visivel', 'Logotipo mais visível', 'Grande, um pouco mais forte', 0.32, 1),
      op('pequena', 'Logotipo pequeno', 'Menor e suave, no centro', 0.2, 0.55),
      h('button', { type: 'button', class: 'fmt-gi-mais', onclick: async () => { fecharPop(); if (await a.escolherMarca()) atualizar(); } }, 'Usar Outra Imagem…'),
      av.marcaImg ? h('button', { type: 'button', class: 'fmt-gi-mais', onclick: () => { fecharPop(); delete av.marcaImg; a.mudou(); } }, 'Voltar ao Logotipo da Escola') : null,
      h('small', { class: 'fmt-gi-nota' }, av.marcaImg ? 'Usando uma imagem escolhida por você.' : av.logo ? 'Usa o logotipo do Cabeçalho.' : 'Ainda não há logotipo: adicione em Cabeçalho.'));
  };

  const galeria = (icone, rotulo, painel) => {
    const b = botao({ icone, rotulo, titulo: rotulo, tam: 'g', classe: 'ed-susp' });
    b.append(h('span', { class: 'ed-caret', html: svg('caret') }));
    b.addEventListener('click', () => abrirPop(b, painel()));
    return b;
  };

  // ================================================================ PÁGINA INICIAL
  const gProva = grupo('Prova', [
    botao({ icone: I('documento'), rotulo: 'Cabeçalho', titulo: 'Cabeçalho: título, escola, logotipo, professor(a), turma, data e valor', tam: 'g', acao: a.cabecalho }),
    galeria(I('estiloCab'), 'Estilo', fer.painelCab),
    galeria(I('instrucoes'), 'Instruções', painelInstrucoes),
  ]);
  const gQuestoes = grupo('Questões', [
    botao({ icone: I('livros'), rotulo: 'Questões salvas', titulo: 'Adicionar questões do banco de questões', tam: 'g', acao: a.adicionarSalvas }),
    botao({ icone: I('mais'), rotulo: 'Nova questão', titulo: 'Criar uma questão nova nesta avaliação', tam: 'g', acao: a.novaQuestao }),
    botao({ icone: ICONE_IA, rotulo: 'Gerar com IA', titulo: 'Gerar a prova inteira com IA (pode anexar material de referência)', tam: 'g', classe: 'faixa-b-ia', acao: a.gerarIA }),
  ]);
  // Fonte: como na faixa das questões, mas vale para a prova inteira
  const corFonte = dividido({
    icone: 'corFonte', titulo: 'Cor do texto da prova', tituloSeta: 'Mais cores',
    acao: () => { av.corTexto = ultimaCor; a.mudou(); },
    painel: () => paleta({ semCor: 'Automático (preto)', valorSemCor: '', aoEscolher: (cor) => { if (cor) ultimaCor = cor; av.corTexto = cor; a.mudou(); atualizar(); } }),
  });
  let ultimaCor = av.corTexto || '#1F3864';
  const barraCor = h('span', { class: 'ed-cor-barra' });
  corFonte.principal.querySelector('.ed-ic').append(barraCor);
  quando(() => { barraCor.style.background = av.corTexto || '#000000'; });
  const limparFonte = () => {
    Object.assign(av, { fonte: 'Arial', tamanho: 12, caixaTexto: 'normal', corTexto: '', enunNegrito: false, enunItalico: false });
    fer.refazerTudo(); a.mudou(); atualizar();
  };
  const gFonte = grupo('Fonte', col(
    lin(fer.cbFonte.el, fer.cbTam.el,
      botao({ icone: 'aumentarFonte', titulo: 'Aumentar Tamanho da Fonte', acao: () => fer.mudarTam(1) }),
      botao({ icone: 'diminuirFonte', titulo: 'Diminuir Tamanho da Fonte', acao: () => fer.mudarTam(-1) }),
      suspenso({ icone: 'maiusculas', titulo: 'Maiúsculas e Minúsculas', painel: () => menu([
        { rotulo: 'Como digitado', ativo: av.caixaTexto !== 'maiusculas', acao: () => { av.caixaTexto = 'normal'; fer.refazerTudo(); a.mudou(); } },
        { rotulo: 'MAIÚSCULAS (letra bastão)', ativo: av.caixaTexto === 'maiusculas', acao: () => { av.caixaTexto = 'maiusculas'; fer.refazerTudo(); a.mudou(); } }]) }),
      botao({ icone: 'limparFmt', titulo: 'Limpar a formatação do texto (Arial 12, preto, sem negrito/itálico)', acao: limparFonte })),
    lin(alternar({ icone: 'negrito', titulo: 'Negrito nos enunciados das questões', k: 'enunNegrito', tam: 'p' }),
      alternar({ icone: 'italico', titulo: 'Itálico nos enunciados das questões', k: 'enunItalico', tam: 'p' }),
      alternar({ icone: 'sublinhado', titulo: 'Sublinhar o título da prova', k: 'tituloSublinhado', tam: 'p' }),
      corFonte.el)));
  const gParagrafo = grupo('Parágrafo', [
    col(h('span', { class: 'faixa-seg' }, fer.alinhamento), lin(fer.btnEspac)),
  ], () => fer.abrirParagrafo());
  const bABNT = botao({ icone: fer.IC.abnt, rotulo: 'Padrão ABNT', titulo: 'Aplicar as normas da ABNT (NBR 14724)', tam: 'g', acao: () => { fer.aplicarPadraoABNT(); atualizar(); } });
  const bCustom = botao({ icone: I('estrela'), rotulo: 'Padrão Customizado', titulo: 'Aplicar a formatação que você definiu como padrão', tam: 'g', acao: () => { fer.aplicarCustom(); atualizar(); } });
  const bDefinir = botao({ icone: I('salvarPadrao'), rotulo: 'Definir como padrão', titulo: 'Usar esta formatação nas próximas avaliações', tam: 'g', acao: async () => { await fer.definirPadrao(); atualizar(); } });
  quando(() => {
    const e = fer.estadoPadroes();
    bABNT.classList.toggle('ativo', e.abnt);
    bCustom.classList.toggle('ativo', e.custom);
    bCustom.classList.toggle('faixa-apagado', !e.temCustom);
  });
  const gPadroes = grupo('Padrões', [bABNT, bCustom, bDefinir]);
  const gConcluir = grupo('Concluir', [
    botao({ icone: I('impressora'), rotulo: 'Imprimir', titulo: 'Visualizar e imprimir a prova (ou salvar em PDF)', tam: 'g', acao: a.imprimir }),
  ]);

  // ================================================================ LAYOUT
  const gPagina = grupo('Configurar Página', [
    galeria(fer.IC.margens, 'Margens', fer.painelMargens),
    galeria(fer.IC.tamanho, 'Tamanho', fer.painelPapel),
    galeria(fer.IC.colunas, 'Colunas', fer.painelColunas),
    galeria(fer.IC.numPagina, 'Nº de Página', fer.painelNumPag),
  ], () => fer.dialogoMargens());
  const gEspaco = grupo('Questões na página', [
    galeria(I('espacoQ'), 'Espaçamento', fer.painelEspacoQ),
    galeria(I('linhaH'), 'Linha', fer.painelLinhaQ),
  ]);
  const gExtras = grupo('Na prova', [
    galeria(I('valor'), 'Valor da questão', painelValor),
    botao({ icone: I('pesos'), rotulo: 'Pesos', titulo: 'Valores diferentes por questão (ex.: uma vale 2,0 e as outras 1,0)', tam: 'g', acao: a.pesos }),
    galeria(I('mensagem'), 'Mensagem final', painelMensagem),
  ]);
  const gFundo = grupo('Fundo e rodapé', [
    galeria(I('marca'), "Marca d'água", painelMarca),
    galeria(I('rodape'), 'Rodapé', painelRodape),
  ]);

  // ================================================================ QUESTÕES (numeração e alternativas)
  const gNumeracao = grupo('Numeração', [
    galeria(fer.IC.numero, 'Numeração', fer.painelNumeracao),
  ]);
  const gAlternativas = grupo('Alternativas', [
    galeria(fer.IC.alternativas, 'Alternativas', fer.painelAlternativas),
    col(alternar({ icone: I('negrito'), rotulo: 'Letra em negrito', titulo: 'Letra da alternativa em negrito', k: 'letraNegrito' })),
  ]);

  // ================================================================ GABARITO
  const posSimples = suspenso({
    icone: I('posicao'), rotulo: 'Posição', titulo: 'Onde fica o gabarito simplificado', tam: 'r',
    painel: () => menu([
      { rotulo: 'No início (abaixo do cabeçalho)', ativo: av.gabSimplesPos !== 'fim', acao: () => { av.gabSimplesPos = 'inicio'; a.mudou(); } },
      { rotulo: 'No final (após a última questão)', ativo: av.gabSimplesPos === 'fim', acao: () => { av.gabSimplesPos = 'fim'; a.mudou(); } },
    ]),
  });
  quando(() => { posSimples.disabled = !av.gabSimples; });
  const gImprimir = grupo('Imprimir junto', [
    alternar({ icone: I('folha'), rotulo: 'Folha de respostas', titulo: 'Folha de respostas para o Leitor', k: 'imprimirFolha', padrao: true, tam: 'g' }),
    col(alternar({ icone: I('gabaritoSimples'), rotulo: 'Gabarito simplificado', titulo: 'Gabarito simplificado na própria prova (para o Leitor)', k: 'gabSimples' }), posSimples,
      alternar({ icone: I('check'), rotulo: 'Gabarito do professor', titulo: 'Gabarito do professor', k: 'imprimirGabProf', padrao: true })),
  ]);
  const bTipos = suspenso({
    icone: I('versoes'), rotulo: 'Tipos', titulo: 'Quantidade de tipos (versões) da prova', tam: 'g',
    painel: () => menu([1, 2, 3, 4, 5, 6].map((n) => ({ rotulo: n === 1 ? '1 (sem versões)' : `${n} tipos`, ativo: +av.tipos === n, acao: () => { a.mudarTipos(n); atualizar(); } }))),
  });
  quando(() => { bTipos.querySelector('.ed-rot').textContent = +av.tipos > 1 ? `${av.tipos} tipos` : 'Tipos'; });
  const gVersoes = grupo('Versões (anti-cola)', [
    bTipos,
    col(alternar({ icone: I('embaralhar'), rotulo: 'Embaralhar questões', titulo: 'Ordem das questões diferente em cada tipo', k: 'embQuestoes', aoMudar: a.alterarVersoes }),
      alternar({ icone: I('embaralhar'), rotulo: 'Embaralhar alternativas', titulo: 'Ordem das alternativas diferente em cada tipo', k: 'embAlternativas', aoMudar: a.alterarVersoes }),
      botao({ icone: I('atualizar'), rotulo: 'Reembaralhar', titulo: 'Sortear de novo a ordem dos tipos', tam: 'r', acao: a.reembaralhar })),
    botao({ icone: I('busca'), rotulo: 'Ver gabarito', titulo: 'Respostas de cada tipo', tam: 'g', acao: a.verGabarito }),
  ]);
  const bLeitor = botao({ icone: I('check'), rotulo: 'Criar gabaritos no Leitor', titulo: 'Monta a coleção de gabaritos para corrigir esta prova', tam: 'g', acao: a.gerarGabaritos });
  const bColecao = botao({ icone: I('pasta'), rotulo: 'Abrir coleção', titulo: 'Abrir a coleção de gabaritos no Leitor', tam: 'g', acao: a.abrirColecao });
  quando(() => { bLeitor.querySelector('.ed-rot').textContent = a.temColecao() ? 'Atualizar gabaritos no Leitor' : 'Criar gabaritos no Leitor'; bColecao.style.display = a.temColecao() ? '' : 'none'; });
  const gLeitor = grupo('Leitor de Gabarito', [bLeitor, bColecao]);

  // ================================================================ guias
  const ABAS = [
    { id: 'inicio', nome: 'Página Inicial', conteudo: [gProva, gQuestoes, gFonte, gParagrafo, gPadroes, gConcluir] },
    { id: 'layout', nome: 'Layout', conteudo: [gPagina, gEspaco, gExtras, gFundo] },
    { id: 'questoes', nome: 'Questões', conteudo: [gNumeracao, gAlternativas] },
    { id: 'gabarito', nome: 'Gabarito', conteudo: [gImprimir, gVersoes, gLeitor] },
  ];
  const bDesfazer = botao({ icone: 'desfazer', titulo: 'Desfazer (Ctrl+Z)', acao: () => { a.desfazer(); atualizar(); } });
  const bRefazer = botao({ icone: 'refazer', titulo: 'Refazer (Ctrl+Y)', acao: () => { a.refazer(); atualizar(); } });
  quando(() => { bDesfazer.disabled = !a.podeDesfazer(); bRefazer.disabled = !a.podeRefazer(); });
  const barra = h('div', { class: 'ed-abas' }, h('span', { class: 'ed-acesso' }, bDesfazer, bRefazer));
  const corpo = h('div', { class: 'ed-paineis' });
  const botoesAba = {}, paineis = {};
  ABAS.forEach((x) => {
    botoesAba[x.id] = h('button', { type: 'button', class: 'ed-aba', onmousedown: (ev) => ev.preventDefault(), onclick: () => mostrarAba(x.id) }, x.nome);
    barra.append(botoesAba[x.id]);
    paineis[x.id] = h('div', { class: 'ed-painel', hidden: x.id !== 'inicio' }, x.conteudo);
    corpo.append(paineis[x.id]);
  });
  barra.append(h('button', { class: 'btn btn-ia btn-sm ed-btn-ia', type: 'button', title: 'Gerar a prova inteira com IA (pode anexar material de referência)', onclick: a.gerarIA, onmousedown: (ev) => ev.preventDefault() },
    h('span', { html: ICONE_IA, style: { display: 'inline-flex' } }), 'Gerar prova com IA'));
  function mostrarAba(id) {
    Object.entries(botoesAba).forEach(([k, b]) => b.classList.toggle('ativa', k === id));
    Object.entries(paineis).forEach(([k, p]) => { p.hidden = k !== id; });
  }
  mostrarAba('inicio');

  function atualizar() { atualizadores.forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } }); }
  const el = h('div', { class: 'ed-ribbon faixa-av no-print' }, barra, corpo);
  el.atualizar = atualizar;
  atualizar();
  return el;
}
