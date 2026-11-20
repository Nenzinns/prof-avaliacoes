import { h, uid, toast, modal, confirmar, campo, vazio, LETRAS, esc, textoDeHtml, dataBR, lerImagem, escolherArquivo, embaralhar } from './ui.js';
import { db } from './db.js';
import { listaFiltravel, previewQuestao, botaoFavorito, destaques } from './questoes.js';
import { svgFolha, svgCompacto, maxQuestoes } from './omr-layout.js';
import { imprimirPaginas } from './gabaritos.js';
import { editarCabecalho, htmlCabecalho } from './cabecalho.js';
import { montarFormatacao } from './fmt-controles.js';
import { margemDe, margemCss, papelDe, formatacaoInicial } from './formato-pagina.js';

const ESTILOS_ALT = { 'a)': (i) => `${LETRAS[i].toLowerCase()})`, '(a)': (i) => `(${LETRAS[i].toLowerCase()})`, 'A)': (i) => `${LETRAS[i]})`, '(A)': (i) => `(${LETRAS[i]})`, 'A.': (i) => `${LETRAS[i]}.`, 'a.': (i) => `${LETRAS[i].toLowerCase()}.`, 'A': (i) => LETRAS[i] };

// ---------------------------------------------------------------- Formatação da prova
const FONTES_PROVA = ['Arial', 'Times New Roman', 'Calibri', 'Cambria', 'Georgia', 'Garamond', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Century Gothic', 'Comic Sans MS', 'Courier New'].map((f) => [f, f]);

/** Opções de formatação com valores padrão (compatível com avaliações antigas). */
export function formatacao(av) {
  const antiga = av.numeracao || 'QUESTÃO';
  const derivado = antiga === 'num' ? { rotulo: '', sufixo: '.' } : antiga === 'num)' ? { rotulo: '', sufixo: ')' }
    : { rotulo: 'Questão', caixaRotulo: antiga === 'QUESTÃO' ? 'maiusculas' : 'normal', sufixo: '' };
  const F = {
    alinhamento: 'left', entreLinhas: '1.35', caixaTexto: 'normal',
    rotulo: 'Questão', caixaRotulo: 'maiusculas', zeros: '', sufixo: '', estiloNum: 'negrito', posNum: 'acima',
    dispoAlt: 'lista', letraNegrito: '', margens: 'normal', numPagina: '',
    // página e parágrafo (valores antigos preservados; novas provas usam o padrão ABNT)
    papel: 'A4', espAntes: 0, espDepois: 4, recuo: 0, espacoColunas: 0.8, linhaColunas: '1', posNumPagina: 'rodape-centro',
    margemPreset: { estreita: 'personalizada', larga: 'personalizada' }[av.margens] || 'economica',
    ...derivado,
    ...Object.fromEntries(['alinhamento', 'entreLinhas', 'caixaTexto', 'rotulo', 'caixaRotulo', 'zeros', 'sufixo', 'estiloNum', 'posNum', 'dispoAlt', 'letraNegrito', 'margens', 'numPagina',
      'papel', 'margem', 'margemPreset', 'espAntes', 'espDepois', 'recuo', 'espacoColunas', 'linhaColunas', 'posNumPagina']
      .filter((k) => av[k] !== undefined).map((k) => [k, av[k]])),
  };
  F.margem = structuredClone(margemDe(F));
  return F;
}

function rotuloQuestao(F, i) {
  let n = String(i + 1);
  if (F.zeros && i + 1 < 10) n = '0' + n;
  let r = F.rotulo || '';
  if (r) r = F.caixaRotulo === 'maiusculas' ? r.toLocaleUpperCase('pt-BR') : F.caixaRotulo === 'minusculas' ? r.toLocaleLowerCase('pt-BR') : r;
  return (r ? r + ' ' : '') + n + (F.sufixo || '');
}

function classesProva(av, F) {
  return [`prova-c${av.colunas}`, av.linhaDivisoria ? 'prova-divisoria' : '', `txt-${F.alinhamento}`, F.caixaTexto === 'maiusculas' ? 'txt-maiusculas' : '',
    `qn-${F.estiloNum}`, F.posNum === 'linha' ? 'qn-linha' : '', `alts-${F.dispoAlt}`, F.letraNegrito ? 'alt-negrito' : ''].filter(Boolean).join(' ');
}

function estiloProva(av, F) {
  return `font-family:'${esc(av.fonte)}', Arial, sans-serif; font-size:${av.tamanho}pt; line-height:${F.entreLinhas}; --esp-q:${av.espacoQuestoes}mm;`
    + ` --p-antes:${+F.espAntes || 0}pt; --p-depois:${+F.espDepois || 0}pt; --recuo:${+F.recuo || 0}cm;`
    + ` --col-gap:${+F.espacoColunas || 0.8}cm; --col-rule:${F.linhaColunas ? '.5px solid #888' : '0 none transparent'}`;
}

function questaoHtml(av, F, i, comando, alternativas) {
  const fmtAlt = ESTILOS_ALT[av.estiloAlt] || ESTILOS_ALT['a)'];
  return `<div class="questao">
    <div class="q-num"><span>${esc(rotuloQuestao(F, i))}</span></div>
    <div class="q-conteudo">${comando}</div>
    <ol class="prova-alts">${alternativas.map((a, k) => `<li><span class="alt-letra">${fmtAlt(k)}</span><div class="q-conteudo">${a || ''}</div></li>`).join('')}</ol>
  </div>`;
}

/** Regras de página (margens e numeração) para a impressão. */
export function estiloPagina(av) {
  const F = formatacao(av);
  const p = papelDe(F);
  const caixa = { 'topo-dir': 'top-right', 'rodape-centro': 'bottom-center', 'rodape-dir': 'bottom-right' }[F.posNumPagina] || 'bottom-center';
  // ABNT: só o número, no canto superior direito; nos demais, "Página X de Y"
  const conteudo = F.posNumPagina === 'topo-dir' ? 'counter(page)' : '"Página " counter(page) " de " counter(pages)';
  const num = F.numPagina ? ` @${caixa} { content: ${conteudo}; font: 10pt Arial, sans-serif; color: #333; }` : '';
  return `<style>@page { size: ${p.w}mm ${p.h}mm; margin: ${margemCss(F)};${num} } @page folha { size: A4; margin: 0; @top-right { content: none; } @bottom-center { content: none; } @bottom-right { content: none; } }</style>`;
}

function novaAvaliacao() {
  return {
    id: uid(), titulo: 'Avaliação', escola: '', disciplina: '', professor: '', turma: '', data: '', valor: '',
    instrucoes: 'Leia atentamente cada questão antes de responder.\nMarque apenas uma alternativa por questão.\nTransfira suas respostas para a folha de respostas.',
    logo: '', mostrarCampos: true, colunas: 1, fonte: 'Arial', tamanho: 12, estiloAlt: 'a)', numeracao: 'QUESTÃO', espacoQuestoes: 4,
    questoes: [], tipos: 1, embQuestoes: true, embAlternativas: true, versoes: [], colecaoId: null,
    // formatação: padrão ABNT, ou o padrão definido pelo professor ("Definir como padrão")
    ...formatacaoInicial(),
  };
}

// ---------------------------------------------------------------- Versões (anti-cola)
function versoesValidas(av, qmap) {
  if (!av.versoes || av.versoes.length !== av.tipos) return false;
  const base = [...av.questoes].sort().join();
  return av.versoes.every((v) => [...v.ordem].sort().join() === base &&
    v.ordem.every((id) => v.alts[id] && v.alts[id].length === 1 + (qmap[id]?.distratores?.length || 0)));
}

export function gerarVersoes(av, qmap) {
  const versoes = [];
  const baseAlts = {};
  av.questoes.forEach((id) => { baseAlts[id] = embaralhar([...Array(1 + (qmap[id]?.distratores?.length || 0)).keys()]); });
  for (let t = 0; t < av.tipos; t++) {
    const ordem = t === 0 || !av.embQuestoes ? [...av.questoes] : embaralhar(av.questoes);
    const alts = {};
    av.questoes.forEach((id) => { alts[id] = t === 0 || !av.embAlternativas ? baseAlts[id] : embaralhar(baseAlts[id]); });
    versoes.push({ tipo: LETRAS[t], ordem, alts });
  }
  av.versoes = versoes;
}

function garantirVersoes(av, qmap) {
  if (!versoesValidas(av, qmap)) { gerarVersoes(av, qmap); return true; }
  return false;
}

/** Índice da alternativa correta em cada posição da versão. */
function respostasVersao(v) { return v.ordem.map((id) => v.alts[id].indexOf(0)); }

async function carregarQuestoes() {
  const qs = await db.getAll('questoes');
  return Object.fromEntries(qs.map((q) => [q.id, q]));
}

// ---------------------------------------------------------------- Tela inicial do formatador
function itemAvaliacao(a, tela, aoMudar) {
  return h('div', { class: 'item' },
    botaoFavorito('avaliacoes', a, aoMudar),
    h('a', { class: 'item-corpo', href: `#/formatador/avaliacao/${a.id}`, style: { textDecoration: 'none', color: 'inherit' } },
      h('div', { class: 'item-titulo' }, a.titulo || 'Sem título'),
      h('div', { class: 'item-sub' }, [a.disciplina, a.turma, `${a.questoes.length} questões`, a.tipos > 1 ? `${a.tipos} tipos` : null, 'editada em ' + dataBR(a.atualizadoEm)].filter(Boolean).join(' · '))),
    h('div', { class: 'linha-botoes' },
      h('a', { class: 'btn btn-sm', href: `#/formatador/imprimir/${a.id}` }, '🖨️ Imprimir'),
      h('a', { class: 'btn btn-sm btn-primary', href: `#/formatador/avaliacao/${a.id}` }, 'Abrir'),
      h('button', {
        class: 'btn btn-sm', title: 'Duplicar', onclick: async () => {
          const c = { ...structuredClone(a), id: uid(), titulo: a.titulo + ' (cópia)', colecaoId: null, criadoEm: 0, favorito: false };
          await db.put('avaliacoes', c); tela.ir(`/formatador/avaliacao/${c.id}`);
        },
      }, 'Duplicar'),
      h('button', {
        class: 'btn btn-sm', title: 'Excluir', onclick: async (e) => {
          if (!(await confirmar(`Excluir a avaliação "${a.titulo}"? As questões continuam salvas.`, { ok: 'Excluir', perigo: true }))) return;
          await db.del('avaliacoes', a.id); e.target.closest('.item').remove(); toast('Avaliação excluída');
        },
      }, '🗑')));
}

function itemQuestaoResumo(q, aoMudar) {
  return h('div', { class: 'item' },
    botaoFavorito('questoes', q, aoMudar),
    h('a', { class: 'item-corpo', href: `#/formatador/questao/${q.id}`, style: { textDecoration: 'none', color: 'inherit' } },
      h('div', { class: 'item-texto' }, textoDeHtml(q.comando) || '(imagem/tabela)'),
      h('div', { class: 'item-sub' }, [q.disciplina, q.assunto].filter(Boolean).join(' · '))));
}

/** Favoritos e recentes, com subtítulos só quando os dois grupos existem. */
function grupos({ favoritos, recentes }, render) {
  const out = [];
  if (favoritos.length) out.push(h('div', { class: 'grupo-tit' }, '★ Favoritos'), h('div', { class: 'lista' }, favoritos.map(render)));
  if (recentes.length) out.push(favoritos.length ? h('div', { class: 'grupo-tit' }, 'Editados recentemente') : null, h('div', { class: 'lista' }, recentes.map(render)));
  return out;
}

export async function telaFormatador(app, tela) {
  tela.titulo('Formatador de Avaliações');
  const avs = await db.getAll('avaliacoes');
  const qs = await db.getAll('questoes');
  const recarregar = () => { app.replaceChildren(); telaFormatador(app, tela); };
  const novaAv = () => h('a', { class: 'btn btn-primary', href: '#/formatador/avaliacao/nova' }, '+ Nova avaliação');

  const dAv = destaques(avs);
  const mostradasAv = dAv.favoritos.length + dAv.recentes.length;
  app.append(h('div', { class: 'secao' },
    h('div', { class: 'secao-head' }, h('h2', {}, 'Avaliações'), novaAv()),
    avs.length ? [
      grupos(dAv, (a) => itemAvaliacao(a, tela, recarregar)),
      avs.length > mostradasAv ? h('a', { class: 'btn btn-link ver-todas', href: '#/formatador/avaliacoes' }, `Ver todas as avaliações (${avs.length})`) : null,
    ] : vazio('📄', 'Nenhuma avaliação criada ainda.')));

  const dQ = destaques(qs);
  const disc = [...new Set(qs.map((q) => q.disciplina).filter(Boolean))];
  app.append(h('div', { class: 'secao' },
    h('div', { class: 'secao-head' }, h('h2', {}, 'Questões'),
      h('a', { class: 'btn btn-primary', href: '#/formatador/questao/nova' }, '+ Nova questão')),
    qs.length ? [
      disc.length ? h('div', { class: 'item-sub', style: { marginBottom: '10px' } }, disc.slice(0, 8).map((d) => h('span', { class: 'chip' }, d))) : null,
      grupos(dQ, (q) => itemQuestaoResumo(q, recarregar)),
      h('a', { class: 'btn btn-link ver-todas', href: '#/formatador/questoes' }, `Ver todas as questões (${qs.length})`),
    ] : vazio('📝', 'Cadastre questões para montar suas avaliações.')));
}

/** Lista completa das avaliações. */
export async function telaAvaliacoes(app, tela) {
  tela.titulo('Todas as avaliações');
  const avs = (await db.getAll('avaliacoes')).sort((a, b) => (b.favorito ? 1 : 0) - (a.favorito ? 1 : 0) || b.atualizadoEm - a.atualizadoEm);
  app.append(h('div', { class: 'secao-head' }, h('h2', {}, `${avs.length} avaliação(ões)`), h('a', { class: 'btn btn-primary', href: '#/formatador/avaliacao/nova' }, '+ Nova avaliação')));
  app.append(avs.length ? h('div', { class: 'lista' }, avs.map((a) => itemAvaliacao(a, tela))) : vazio('📄', 'Nenhuma avaliação criada ainda.'));
}

// ---------------------------------------------------------------- Editor da avaliação
export async function telaAvaliacao(app, tela, id) {
  if (id === 'nova') {
    const n = novaAvaliacao();
    const ultima = (await db.getAll('avaliacoes')).sort((a, b) => b.atualizadoEm - a.atualizadoEm)[0];
    if (ultima) Object.assign(n, { escola: ultima.escola, professor: ultima.professor, logo: ultima.logo });
    await db.put('avaliacoes', n);
    history.replaceState(null, '', `#/formatador/avaliacao/${n.id}`);
    id = n.id;
  }
  const av = await db.get('avaliacoes', id);
  if (!av) { app.append(vazio('❓', 'Avaliação não encontrada.')); return; }
  const qmap = await carregarQuestoes();
  av.questoes = av.questoes.filter((qid) => qmap[qid]);
  tela.titulo(av.titulo || 'Avaliação');

  let timer = null;
  const salvar = () => { clearTimeout(timer); return db.put('avaliacoes', av); };
  let atualizarPrevia = () => {};
  let timerPrevia = null;
  const agendar = () => { clearTimeout(timer); timer = setTimeout(salvar, 500); clearTimeout(timerPrevia); timerPrevia = setTimeout(() => atualizarPrevia(), 250); };
  tela.aoSair(() => { if (timer) salvar(); });

  const inp = (k, ph, tipo = 'text') => {
    const el = h(tipo === 'textarea' ? 'textarea' : 'input', { type: tipo, placeholder: ph, rows: 3 });
    el.value = av[k] ?? '';
    el.addEventListener('input', () => { av[k] = el.value; if (k === 'titulo') tela.titulo(el.value); agendar(); });
    return el;
  };
  const sel = (k, opcoes, numero = false, aoMudar) => {
    const el = h('select', {}, opcoes.map(([v, t]) => h('option', { value: v, selected: String(av[k]) === String(v) }, t)));
    el.addEventListener('change', () => { av[k] = numero ? +el.value : el.value; agendar(); aoMudar?.(); });
    return el;
  };

  // logo
  const logoPrev = h('div', { class: 'linha-botoes' });
  const renderLogo = () => logoPrev.replaceChildren(
    av.logo ? h('img', { src: av.logo, style: { maxHeight: '48px', maxWidth: '120px', border: '1px solid var(--borda)', borderRadius: '6px' } }) : h('span', { class: 'dica' }, 'Sem logotipo'),
    h('button', { class: 'btn btn-sm', onclick: async () => { const [f] = await escolherArquivo('image/*'); if (!f) return; av.logo = await lerImagem(f, 500); agendar(); renderLogo(); } }, av.logo ? 'Trocar' : 'Adicionar logo'),
    av.logo ? h('button', { class: 'btn btn-sm', onclick: () => { av.logo = ''; agendar(); renderLogo(); } }, 'Remover') : '');
  renderLogo();

  // lista de questões
  const listaQ = h('div', { class: 'lista lista-ordenavel' });
  const resumo = h('span', { class: 'chip' });
  const invalidar = () => { av.versoes = []; agendar(); renderVersoes(); };
  const renderQuestoes = () => {
    resumo.textContent = `${av.questoes.length} questão(ões)`;
    if (!av.questoes.length) { listaQ.replaceChildren(vazio('📝', 'Nenhuma questão na avaliação ainda.')); return; }
    listaQ.replaceChildren(...av.questoes.map((qid, i) => {
      const q = qmap[qid];
      const mover = (d) => { const j = i + d; if (j < 0 || j >= av.questoes.length) return; [av.questoes[i], av.questoes[j]] = [av.questoes[j], av.questoes[i]]; invalidar(); renderQuestoes(); };
      return h('div', { class: 'item' },
        h('div', { class: 'ordem-btns' }, h('button', { title: 'Subir', onclick: () => mover(-1) }, '▲'), h('button', { title: 'Descer', onclick: () => mover(1) }, '▼')),
        h('span', { class: 'num-q' }, i + 1),
        h('div', { class: 'item-corpo' }, h('div', { class: 'item-texto' }, textoDeHtml(q.comando) || '(imagem/tabela)'),
          h('div', { class: 'item-sub' }, [q.disciplina, q.assunto, `${1 + q.distratores.length} alt.`].filter(Boolean).join(' · '))),
        h('div', { class: 'linha-botoes' },
          h('button', { class: 'btn btn-sm', onclick: () => modal({ titulo: `Questão ${i + 1}`, largo: true, corpo: previewQuestao(q) }) }, 'Ver'),
          h('a', { class: 'btn btn-sm', href: `#/formatador/questao/${qid}` }, 'Editar'),
          h('button', { class: 'btn btn-sm', title: 'Remover da avaliação', onclick: () => { av.questoes.splice(i, 1); invalidar(); renderQuestoes(); } }, '✕')));
    }));
  };

  const adicionarDoBanco = async () => {
    const todas = Object.values(qmap).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
    if (!todas.length) { toast('Nenhuma questão cadastrada. Crie uma questão primeiro.'); return; }
    const escolhidas = new Set();
    const contador = h('b', {}, '0');
    const { el } = listaFiltravel(todas, (q) => {
      const ja = av.questoes.includes(q.id);
      const chk = h('input', { type: 'checkbox', checked: ja || escolhidas.has(q.id), disabled: ja, style: { width: '20px', height: '20px' } });
      chk.addEventListener('change', () => { chk.checked ? escolhidas.add(q.id) : escolhidas.delete(q.id); contador.textContent = escolhidas.size; });
      return h('label', { class: `item clicavel ${ja ? '' : ''}`, style: { opacity: ja ? 0.55 : 1 } }, chk,
        h('div', { class: 'item-corpo' }, h('div', { class: 'item-texto' }, textoDeHtml(q.comando) || '(imagem/tabela)'),
          h('div', { class: 'item-sub' }, [q.disciplina, q.assunto, q.serie, q.dificuldade, ja ? 'já está na avaliação' : null].filter(Boolean).join(' · '))),
        h('button', { class: 'btn btn-sm', onclick: (e) => { e.preventDefault(); modal({ titulo: 'Questão', largo: true, corpo: previewQuestao(q) }); } }, 'Ver'));
    });
    const r = await modal({ titulo: 'Adicionar questões salvas', largo: true, corpo: el, acoes: [{ label: 'Cancelar', value: null }, { label: h('span', {}, 'Adicionar (', contador, ')'), primary: true, value: 'ok' }] });
    if (r !== 'ok' || !escolhidas.size) return;
    av.questoes.push(...escolhidas);
    invalidar(); renderQuestoes();
  };

  // versões
  const versoesEl = h('div');
  const renderVersoes = () => {
    if (!av.questoes.length) { versoesEl.replaceChildren(h('p', { class: 'dica' }, 'Adicione questões para gerar o gabarito.')); return; }
    const novo = garantirVersoes(av, qmap);
    if (novo) agendar();
    versoesEl.replaceChildren(...av.versoes.map((v) => h('div', { class: 'item-sub', style: { fontFamily: 'monospace', margin: '4px 0', wordBreak: 'break-all' } },
      h('b', {}, `Tipo ${v.tipo}: `), respostasVersao(v).map((r) => LETRAS[r]).join(''))));
  };

  const gerarGabaritos = async () => {
    if (!av.questoes.length) { toast('Adicione questões primeiro.', 'erro'); return; }
    garantirVersoes(av, qmap);
    await salvar();
    const col = await sincronizarColecao(av, qmap);
    if (col) { toast('Gabaritos criados no Leitor!', 'ok'); tela.ir(`/leitor/colecao/${col.id}`); }
  };

  // ---- cartão Formatação (controles gráficos + mini-página ao vivo)
  Object.assign(av, formatacao(av));
  const QUESTOES_EXEMPLO = {
    ex1: { comando: '<p>Leia o texto e responda: qual alternativa completa corretamente a frase sobre o ciclo da água?</p>', solucao: '<p>Evaporação</p>', distratores: ['<p>Condensação</p>', '<p>Precipitação</p>', '<p>Infiltração</p>'] },
    ex2: { comando: '<p>Qual é o resultado de 3/4 + 1/4?</p>', solucao: '<p>1</p>', distratores: ['<p>4/8</p>', '<p>1/2</p>', '<p>3/16</p>'] },
    ex3: { comando: '<p>Assinale a alternativa que apresenta apenas substantivos próprios.</p>', solucao: '<p>Brasil, Ana, Amazonas</p>', distratores: ['<p>casa, Pedro, rio</p>', '<p>cidade, país, mar</p>', '<p>livro, Maria, mesa</p>'] },
  };
  const renderPagina = (limite = 8) => {
    const usarReais = av.questoes.length > 0;
    const mapa = usarReais ? qmap : QUESTOES_EXEMPLO;
    const ordem = (usarReais ? (av.versoes?.[0]?.ordem?.length ? av.versoes[0].ordem : av.questoes) : Object.keys(QUESTOES_EXEMPLO)).filter((id) => mapa[id]).slice(0, limite);
    const alts = Object.fromEntries(ordem.map((id) => [id, av.versoes?.[0]?.alts?.[id] || [...Array(1 + mapa[id].distratores.length).keys()]]));
    const nAltPrev = Math.max(2, ...ordem.map((id) => alts[id].length));
    const html = renderProva({ ...av, tipos: av.tipos }, mapa, { tipo: 'A', ordem, alts }, {
      comTipo: av.tipos > 1, gabSimples: av.gabSimples ? (av.gabSimplesPos === 'fim' ? 'fim' : 'inicio') : null, indice: 0, nAlt: Math.min(6, nAltPrev),
    });
    return `<div class="pagina-prova">${html}</div>`;
  };
  const renderCompleta = () => renderPagina(Infinity);
  const cartaoFormatacao = montarFormatacao(av, {
    mudou: agendar, renderPagina, formatacao, rotuloQuestao, ESTILOS_ALT, FONTES: FONTES_PROVA, renderCompleta, linkImprimir: `#/formatador/imprimir/${av.id}`,
  });
  setTimeout(() => cartaoFormatacao.atualizar(), 0);
  atualizarPrevia = () => cartaoFormatacao.atualizar();

  // cabeçalho personalizado (imagem), ao lado do título
  const cabCtrl = h('div', { class: 'campo cab-ctrl' });
  const renderCab = () => {
    const c = av.cabecalho;
    const ativo = !!(c?.ativo && c.src);
    cabCtrl.replaceChildren(
      h('span', { class: 'campo-label' }, 'Cabeçalho'),
      ativo
        ? h('div', { class: 'linha-botoes' },
          h('img', { src: c.src, class: 'cab-mini', alt: 'Cabeçalho personalizado', title: 'Cabeçalho personalizado' }),
          h('button', { class: 'btn btn-sm', onclick: async () => { const n = await editarCabecalho(av.cabecalho); if (n) { av.cabecalho = n; agendar(); renderCab(); } } }, 'Editar'),
          h('button', { class: 'btn btn-sm', title: 'Voltar ao cabeçalho padrão (a imagem fica guardada)', onclick: () => { av.cabecalho.ativo = false; agendar(); renderCab(); } }, 'Usar padrão'))
        : h('div', { class: 'linha-botoes' },
          h('button', { class: 'btn', onclick: async () => {
            const n = await editarCabecalho(c?.src ? { ...c } : null);
            if (n) { av.cabecalho = n; agendar(); renderCab(); }
          } }, c?.src ? '🖼 Reativar cabeçalho personalizado' : '🖼 Cabeçalho personalizado')));
  };
  renderCab();

  tela.acoes(h('a', { class: 'btn btn-primary', href: `#/formatador/imprimir/${av.id}`, onclick: () => salvar() }, '🖨️ Visualizar / Imprimir'));

  app.append(h('div', { class: 'duas-col' },
    h('div', {},
      h('div', { class: 'cartao secao' },
        h('div', { class: 'titulo-cab' }, campo('Título da avaliação', inp('titulo', 'Ex.: Avaliação Bimestral')), cabCtrl),
        h('div', { class: 'form-grade' },
          campo('Escola', inp('escola', 'Nome da escola')), campo('Disciplina', inp('disciplina', 'Ex.: Matemática')),
          campo('Professor(a)', inp('professor', 'Seu nome')), campo('Turma / série', inp('turma', 'Ex.: 8º ano A')),
          campo('Data', inp('data', '', 'date')), campo('Valor', inp('valor', 'Ex.: 10,0 pontos'))),
        campo('Instruções', inp('instrucoes', 'Uma instrução por linha', 'textarea')),
        h('div', { class: 'campo' }, h('span', { class: 'campo-label' }, 'Logotipo da escola'), logoPrev),
        h('label', { class: 'campo-check' }, (() => { const c = h('input', { type: 'checkbox', checked: av.mostrarCampos }); c.addEventListener('change', () => { av.mostrarCampos = c.checked; agendar(); }); return c; })(), 'Campos para o aluno preencher (nome, nº, data, nota)')),
      h('div', { class: 'secao' },
        h('div', { class: 'secao-head' }, h('h2', {}, 'Questões '), resumo,
          h('button', { class: 'btn', onclick: adicionarDoBanco }, '📚 Adicionar questões salvas'),
          h('a', { class: 'btn btn-primary', href: `#/formatador/questao/nova?avaliacao=${av.id}`, onclick: () => salvar() }, '+ Nova questão')),
        listaQ)),
    h('div', {},
      h('div', { class: 'cartao secao' },
        h('h2', { style: { fontSize: '17px', marginTop: 0 } }, 'Formatação'),
        cartaoFormatacao),
      h('div', { class: 'cartao secao' },
        h('h2', { style: { fontSize: '17px', marginTop: 0 } }, 'Versões (anti-cola)'),
        h('p', { class: 'dica' }, 'Gere tipos diferentes da mesma prova (mesmo conteúdo em ordens diferentes). Cada tipo tem seu gabarito.'),
        campo('Quantidade de tipos', sel('tipos', [1, 2, 3, 4, 5, 6].map((n) => [n, n === 1 ? '1 (sem versões)' : `${n} tipos (${LETRAS.slice(0, n).split('').join(', ')})`]), true, invalidar)),
        h('label', { class: 'campo-check' }, (() => { const c = h('input', { type: 'checkbox', checked: av.embQuestoes }); c.addEventListener('change', () => { av.embQuestoes = c.checked; invalidar(); }); return c; })(), 'Embaralhar ordem das questões'),
        h('label', { class: 'campo-check' }, (() => { const c = h('input', { type: 'checkbox', checked: av.embAlternativas }); c.addEventListener('change', () => { av.embAlternativas = c.checked; invalidar(); }); return c; })(), 'Embaralhar ordem das alternativas'),
        h('div', { class: 'campo-label' }, 'Gabarito'), versoesEl,
        h('div', { class: 'linha-botoes', style: { marginTop: '10px' } },
          h('button', { class: 'btn btn-sm', onclick: async () => { if (av.colecaoId && !(await confirmar('Reembaralhar muda o gabarito. Provas já impressas deixarão de corresponder. Continuar?'))) return; gerarVersoes(av, qmap); agendar(); renderVersoes(); } }, '🔀 Reembaralhar'))),
      h('div', { class: 'cartao secao' },
        h('h2', { style: { fontSize: '17px', marginTop: 0 } }, 'Concluir'),
        h('div', { class: 'lista' },
          h('a', { class: 'btn btn-primary', href: `#/formatador/imprimir/${av.id}`, onclick: () => salvar() }, '🖨️ Visualizar / Imprimir prova'),
          h('button', { class: 'btn btn-ok', onclick: gerarGabaritos }, av.colecaoId ? '🔄 Atualizar gabaritos no Leitor' : '✅ Criar gabaritos no Leitor'),
          av.colecaoId ? h('a', { class: 'btn', href: `#/leitor/colecao/${av.colecaoId}` }, '📁 Abrir coleção de gabaritos') : null)))));
  renderQuestoes();
  renderVersoes();
}

/** Cria/atualiza a coleção de gabaritos do Leitor a partir da avaliação. */
export async function sincronizarColecao(av, qmap) {
  const nAlt = Math.max(2, ...av.questoes.map((id) => 1 + (qmap[id]?.distratores?.length || 0)));
  if (nAlt > 6) { toast('A folha de respostas aceita até 6 alternativas.', 'erro'); return null; }
  if (av.questoes.length > maxQuestoes(nAlt)) { toast(`A folha de respostas comporta até ${maxQuestoes(nAlt)} questões com ${nAlt} alternativas.`, 'erro'); return null; }
  let col = av.colecaoId ? await db.get('colecoes', av.colecaoId) : null;
  const nome = [av.titulo, av.disciplina, av.turma].filter(Boolean).join(' · ');
  if (col) {
    const res = await db.byIndex('resultados', 'colecaoId', col.id);
    if (res.length && (col.nQuestoes !== av.questoes.length || col.nAlternativas !== nAlt)) {
      if (!(await confirmar(`A coleção já tem ${res.length} prova(s) corrigida(s) e o número de questões/alternativas mudou. Os resultados antigos podem ficar inconsistentes. Continuar?`))) return null;
    }
  } else {
    col = { id: uid(), notaMaxima: parseFloat(String(av.valor).replace(',', '.')) || 10, gabaritos: [] };
  }
  col.nome = nome || 'Avaliação';
  col.nQuestoes = av.questoes.length;
  col.nAlternativas = nAlt;
  col.avaliacaoId = av.id;
  col.gabaritos = av.versoes.map((v, i) => ({
    id: col.gabaritos[i]?.id || uid(),
    nome: `Tipo ${v.tipo}`,
    respostas: respostasVersao(v),
    anuladas: col.gabaritos[i]?.anuladas?.length === av.questoes.length ? col.gabaritos[i].anuladas : Array(av.questoes.length).fill(false),
  }));
  await db.put('colecoes', col);
  if (av.colecaoId !== col.id) { av.colecaoId = col.id; await db.put('avaliacoes', av); }
  return col;
}

// ---------------------------------------------------------------- Renderização da prova
function renderProva(av, qmap, v, { comTipo, gabSimples = null, indice = 0, nAlt = 5 }) {
  // gabarito simplificado: bloco com marcadores, lido pelo Leitor (câmera ou scanner)
  const gabHtml = gabSimples ? `<div class="gab-simples-wrap gab-${gabSimples}">${svgCompacto({ nQuestoes: v.ordem.length, nAlt, tipos: av.tipos > 1 ? av.versoes.map((x) => x.tipo) : [], tipoMarcado: av.tipos > 1 ? indice : null })}</div>` : '';
  const F = formatacao(av);
  const data = av.data ? new Date(av.data + 'T12:00').toLocaleDateString('pt-BR') : '';
  const linhaCampo = (rotulo, valor, flex = 1) => `<div class="pc-campo" style="flex:${flex}"><span>${rotulo}:</span><b>${esc(valor || '')}</b></div>`;
  const instr = (av.instrucoes || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const cabPers = !!(av.cabecalho?.ativo && av.cabecalho.src);
  // o gabarito simplificado já mostra o tipo marcado: sem caixa TIPO no cabeçalho
  const tipoNoCabecalho = comTipo && !gabSimples;
  const cabCampos = cabPers && av.cabecalho.manterCampos !== false && (av.mostrarCampos || instr.length);
  return `
  <div class="prova ${classesProva(av, F)}" style="${estiloProva(av, F)}">
    ${cabPers ? htmlCabecalho(av.cabecalho, { tipo: tipoNoCabecalho ? v.tipo : null }) : ''}
    ${cabPers && !cabCampos ? '' : `<div class="prova-cab ${cabPers ? 'prova-cab-campos' : ''}">
      ${cabPers ? '' : `<div class="pc-topo">
        ${av.logo ? `<img class="pc-logo" src="${av.logo}" alt="">` : ''}
        <div class="pc-titulos">
          ${av.escola ? `<div class="pc-escola">${esc(av.escola)}</div>` : ''}
          <div class="pc-titulo">${esc(av.titulo || 'Avaliação')}</div>
          <div class="pc-sub">${[av.disciplina, av.professor ? 'Prof(ª). ' + av.professor : ''].filter(Boolean).map(esc).join(' — ')}</div>
        </div>
        ${tipoNoCabecalho ? `<div class="pc-tipo"><small>TIPO</small>${v.tipo}</div>` : ''}
      </div>`}
      ${av.mostrarCampos ? `
      <div class="pc-linha">${linhaCampo('Aluno(a)', '', 4)}${linhaCampo('Nº', '', 0.8)}</div>
      <div class="pc-linha">${linhaCampo('Turma', av.turma, 1.4)}${linhaCampo('Data', data, 1.2)}${linhaCampo('Valor', av.valor, 1)}${linhaCampo('Nota', '', 1)}</div>` : ''}
      ${instr.length ? `<div class="pc-instr"><b>Instruções:</b><ul>${instr.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : ''}
    </div>`}
    ${gabSimples === 'inicio' ? gabHtml : ''}
    <div class="prova-questoes">
      ${v.ordem.map((id, i) => {
        const q = qmap[id];
        const alts = [q.solucao, ...q.distratores];
        return questaoHtml(av, F, i, q.comando, v.alts[id].map((ai) => alts[ai]));
      }).join('')}
    </div>
    ${gabSimples === 'fim' ? gabHtml : ''}
  </div>`;
}

function renderGabaritoProfessor(av) {
  return `<div class="prova gabarito-prof" style="font-family:Arial, sans-serif">
    <div class="pc-titulo" style="text-align:center;margin-bottom:6mm">Gabarito do professor — ${esc(av.titulo)}</div>
    <div class="gp-grade">${av.versoes.map((v) => `<table class="gp-tabela"><thead><tr><th colspan="2">Tipo ${v.tipo}</th></tr></thead><tbody>
      ${respostasVersao(v).map((r, i) => `<tr><td>${i + 1}</td><td><b>${LETRAS[r]}</b></td></tr>`).join('')}</tbody></table>`).join('')}</div>
    ${av.tipos > 1 ? `<p style="font-size:9pt;color:#555;margin-top:6mm">Correspondência das questões com o Tipo A:</p><div class="gp-grade">${av.versoes.slice(1).map((v) => `<table class="gp-tabela"><thead><tr><th colspan="2">Tipo ${v.tipo} → A</th></tr></thead><tbody>${v.ordem.map((id, i) => `<tr><td>${i + 1}</td><td>${av.versoes[0].ordem.indexOf(id) + 1}</td></tr>`).join('')}</tbody></table>`).join('')}</div>` : ''}
  </div>`;
}

export async function telaImprimir(app, tela, id) {
  const av = await db.get('avaliacoes', id);
  if (!av) { app.append(vazio('❓', 'Avaliação não encontrada.')); return; }
  const qmap = await carregarQuestoes();
  av.questoes = av.questoes.filter((qid) => qmap[qid]);
  tela.titulo(`Imprimir · ${av.titulo}`);
  if (!av.questoes.length) { app.append(vazio('📝', 'Esta avaliação ainda não tem questões.', h('a', { class: 'btn btn-primary', href: `#/formatador/avaliacao/${av.id}` }, 'Voltar e adicionar questões'))); return; }
  if (garantirVersoes(av, qmap)) await db.put('avaliacoes', av);

  const selV = h('select', { class: 'inp', style: { maxWidth: '200px' } },
    av.tipos > 1 ? h('option', { value: 'todas' }, 'Todos os tipos') : null,
    av.versoes.map((v, i) => h('option', { value: i }, av.tipos > 1 ? `Somente tipo ${v.tipo}` : 'Prova')));
  const chkFolha = h('input', { type: 'checkbox', checked: true });
  const chkGab = h('input', { type: 'checkbox', checked: true });
  const chkSimples = h('input', { type: 'checkbox', checked: !!av.gabSimples });
  const posSimples = h('select', { class: 'inp', style: { width: 'auto' }, disabled: !av.gabSimples },
    h('option', { value: 'inicio', selected: av.gabSimplesPos !== 'fim' }, 'No início (abaixo do cabeçalho)'),
    h('option', { value: 'fim', selected: av.gabSimplesPos === 'fim' }, 'No final (após a última questão)'));
  const selCols = h('select', { class: 'inp', style: { width: 'auto' }, title: 'Prova em colunas' }, [1, 2, 3].map((n) => h('option', { value: n, selected: +av.colunas === n }, n === 1 ? '1 coluna' : `${n} colunas`)));
  const chkLinha = h('input', { type: 'checkbox', checked: !!av.linhaDivisoria });
  const salvarOpcao = () => {
    av.gabSimples = chkSimples.checked; av.gabSimplesPos = posSimples.value; posSimples.disabled = !chkSimples.checked;
    av.colunas = +selCols.value; av.linhaDivisoria = chkLinha.checked ? '1' : '';
    db.put('avaliacoes', av);
  };
  const prev = h('div', { class: 'preview-provas' });
  const nAlt = Math.max(2, ...av.questoes.map((qid) => 1 + qmap[qid].distratores.length));
  const folhaOk = nAlt <= 6 && av.questoes.length <= maxQuestoes(nAlt);

  const montar = () => {
    const idx = selV.value === 'todas' ? av.versoes.map((_, i) => i) : [+selV.value];
    const partes = [];
    idx.forEach((i) => {
      const v = av.versoes[i];
      partes.push(`<div class="pagina-prova">${renderProva(av, qmap, v, { comTipo: av.tipos > 1, gabSimples: chkSimples.checked && nAlt <= 6 ? posSimples.value : null, indice: i, nAlt })}</div>`);
      if (chkFolha.checked && folhaOk) {
        partes.push(`<div class="pagina-folha">${svgFolha({ titulo: av.titulo, subtitulo: [av.disciplina, av.turma].filter(Boolean).join(' · '), nQuestoes: av.questoes.length, nAlt, tipos: av.tipos > 1 ? av.versoes.map((x) => x.tipo) : [], tipoMarcado: av.tipos > 1 ? i : null })}</div>`);
      }
    });
    if (chkGab.checked) partes.push(`<div class="pagina-prova">${renderGabaritoProfessor(av)}</div>`);
    return estiloPagina(av) + partes.join('');
  };
  const atualizar = () => { const F = formatacao(av), pp = papelDe(F); prev.style.setProperty('--margem', margemCss(F)); prev.style.setProperty('--pag-w', pp.w + 'mm'); prev.style.setProperty('--pag-h', pp.h + 'mm'); prev.innerHTML = montar(); prev.querySelectorAll('.pagina-folha').forEach((p) => p.classList.add('tela')); };
  [chkSimples, posSimples, selCols, chkLinha].forEach((e) => e.addEventListener('change', salvarOpcao));
  [selV, chkFolha, chkGab, chkSimples, posSimples, selCols, chkLinha].forEach((e) => e.addEventListener('change', atualizar));
  const imprimir = async () => {
    // folha de respostas ou gabarito simplificado: os gabaritos precisam existir no Leitor
    if ((chkFolha.checked && folhaOk) || (chkSimples.checked && nAlt <= 6)) {
      const col = av.colecaoId ? await db.get('colecoes', av.colecaoId) : null;
      const desatualizada = !col || col.gabaritos.length !== av.versoes.length || col.gabaritos.some((g, i) => g.respostas.join() !== respostasVersao(av.versoes[i]).join());
      if (desatualizada) { await sincronizarColecao(av, qmap); toast('Gabaritos criados/atualizados no Leitor.', 'ok'); }
    }
    imprimirPaginas(montar());
  };
  tela.acoes(h('button', { class: 'btn btn-primary', onclick: imprimir }, '🖨️ Imprimir'));
  app.append(
    h('div', { class: 'cartao secao no-print' },
      h('div', { class: 'linha-botoes' },
        selV,
        h('label', { class: 'campo-check', style: { margin: 0 } }, chkFolha, 'Folha de respostas (para o Leitor)'),
        h('span', { class: 'linha-botoes', style: { gap: '6px' } }, h('label', { class: 'campo-check', style: { margin: 0 } }, chkSimples, 'Gabarito simplificado (para o Leitor)'), posSimples),
        h('label', { class: 'campo-check', style: { margin: 0 } }, chkGab, 'Gabarito do professor'),
        h('span', { class: 'espaco' }),
        h('a', { class: 'btn', href: `#/formatador/avaliacao/${av.id}` }, 'Editar'),
        h('button', { class: 'btn btn-primary', onclick: imprimir }, '🖨️ Imprimir / Salvar PDF')),
      h('div', { class: 'linha-botoes', style: { marginTop: '10px' } }, h('span', { class: 'campo-label' }, 'Layout da prova:'), selCols,
        h('label', { class: 'campo-check', style: { margin: 0 } }, chkLinha, 'Linha divisória entre as questões')),
      chkSimples.checked && nAlt > 6 ? h('p', { class: 'dica', style: { color: 'var(--verm)' } }, 'O gabarito simplificado aceita até 6 alternativas.') : null,
      !folhaOk ? h('p', { class: 'dica', style: { color: 'var(--verm)' } }, 'A folha de respostas não comporta esta quantidade de questões/alternativas.') : null,
      h('p', { class: 'dica' }, 'Na janela de impressão, escolha "Salvar como PDF" para gerar um arquivo. Use papel A4 e escala 100%.')),
    prev);
  atualizar();
}
