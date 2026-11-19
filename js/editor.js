// Núcleo do editor de texto rico das questões (no estilo do Word).
// A faixa de opções (ribbon.js) é compartilhada entre os editores da página e age
// sempre no editor ativo. Tabelas: editor-tabela.js. Imagens: editor-imagem.js.

import { h, modal, campo } from './ui.js';
import { criarTabela } from './editor-tabela.js';
import { criarImagem } from './editor-imagem.js';
import { createRibbon } from './ribbon.js';
import { abrirMenuContexto } from './editor-ui.js';

export const TAMANHOS = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];
const ZW = '​';

export const ESTILOS_PARAGRAFO = {
  normal: { nome: 'Normal', tag: 'p', cls: '' },
  semesp: { nome: 'Sem Espaçamento', tag: 'p', cls: 'q-semesp' },
  titulo1: { nome: 'Título 1', tag: 'h3', cls: '' },
  titulo2: { nome: 'Título 2', tag: 'h4', cls: '' },
  titulo: { nome: 'Título', tag: 'p', cls: 'q-titulo' },
  subtitulo: { nome: 'Subtítulo', tag: 'p', cls: 'q-subtitulo' },
  citacao: { nome: 'Citação', tag: 'blockquote', cls: '' },
  enfase: { nome: 'Ênfase Intensa', tag: 'p', cls: 'q-enfase' },
};

export function createEditor({ html = '', modo = 'completo', placeholder = 'Digite aqui…', minAltura = null, ribbon = null, rotulo = '' } = {}) {
  const area = h('div', { class: 'ed-area q-conteudo ed-grade', contenteditable: 'true', 'data-placeholder': placeholder, spellcheck: 'true' });
  if (minAltura) area.style.minHeight = minAltura;
  const overlay = h('div', { class: 'ed-overlay' });
  const areaWrap = h('div', { class: 'ed-area-wrap' }, area, overlay);
  const proprio = !ribbon;
  if (proprio) ribbon = createRibbon();
  const wrap = h('div', { class: `ed-wrap ed-${modo}` }, proprio ? ribbon.el : null, areaWrap);

  const ed = { area, wrap, overlay, areaWrap, modo, ribbon, rotulo, range: null, figSel: null, celulasSel: [], tabelaAtual: null };

  // ------------------------------------------------ histórico (desfazer/refazer)
  const hist = [];
  let histPos = -1, histTimer = null;
  ed.snapshot = () => {
    clearTimeout(histTimer);
    const s = area.innerHTML;
    if (hist[histPos] === s) return;
    hist.splice(histPos + 1);
    hist.push(s);
    if (hist.length > 80) hist.shift();
    histPos = hist.length - 1;
  };
  const agendarSnapshot = () => { clearTimeout(histTimer); histTimer = setTimeout(ed.snapshot, 400); };
  ed.desfazer = (d = -1) => {
    ed.snapshot();
    const n = histPos + d;
    if (n < 0 || n >= hist.length) return;
    histPos = n;
    area.innerHTML = hist[n];
    prepararConteudo();
    ed.imagem.desselecionar();
    ed.tabela.limparSelecao();
    notificar();
  };

  // ------------------------------------------------ seleção
  ed.dentro = (n) => !!n && (n === area || area.contains(n));
  const notificar = () => { area.dispatchEvent(new Event('ed-change')); };
  ed.mudou = () => { agendarSnapshot(); notificar(); ed.imagem?.reposicionar(); ribbon.atualizar(ed); };

  const onSel = () => {
    if (!area.isConnected) { document.removeEventListener('selectionchange', onSel); return; }
    const s = getSelection();
    if (s.rangeCount && ed.dentro(s.anchorNode)) {
      ed.range = s.getRangeAt(0).cloneRange();
      ed.tabela.aoMudarSelecao();
      ribbon.ativar(ed); // o cursor entrou neste campo: a faixa de opções passa a agir nele
    }
  };
  document.addEventListener('selectionchange', onSel);

  ed.restaurar = () => {
    if (document.activeElement !== area && !area.contains(document.activeElement)) area.focus({ preventScroll: true });
    if (ed.range && ed.dentro(ed.range.startContainer)) {
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(ed.range);
    }
  };
  ed.selecionarRange = (r) => {
    const s = getSelection(); s.removeAllRanges(); s.addRange(r);
    ed.range = r.cloneRange();
  };
  ed.exec = (cmd, val = null) => {
    ed.restaurar();
    document.execCommand('styleWithCSS', false, true);
    document.execCommand(cmd, false, val);
    ed.mudou();
  };
  ed.estado = (cmd) => { try { return document.queryCommandState(cmd); } catch { return false; } };
  ed.elementoAtual = () => {
    let n = ed.range?.startContainer;
    if (n?.nodeType === 1 && ed.range) {
      // seleção começa "entre" nós: usa o nó logo após o início (ex.: o <span> recém-formatado)
      const filho = n.childNodes[ed.range.startOffset] || (n === area ? area.lastChild : null);
      if (filho) n = filho.nodeType === 1 ? filho : filho.parentNode;
    }
    if (n?.nodeType === 3) n = n.parentNode;
    return ed.dentro(n) ? n : area;
  };
  ed.blocoTopo = (no) => {
    while (no && no.parentNode !== area) no = no.parentNode;
    return no && no.parentNode === area ? no : null;
  };

  /** Blocos de parágrafo tocados pela seleção. */
  ed.blocosSelecionados = () => {
    ed.restaurar();
    const r = ed.range;
    if (!r) return [];
    const sel = 'p,li,h1,h2,h3,h4,h5,h6,blockquote';
    let blocos = [...area.querySelectorAll(sel)].filter((b) => r.intersectsNode(b) && !b.querySelector(sel));
    if (!blocos.length) {
      const b = ed.elementoAtual().closest(sel);
      if (b && ed.dentro(b)) blocos = [b];
    }
    if (!blocos.length) {
      document.execCommand('formatBlock', false, 'p');
      const b = getSelection().anchorNode;
      const p = (b?.nodeType === 3 ? b.parentNode : b)?.closest?.('p');
      if (p) blocos = [p];
    }
    return blocos;
  };

  /** Envolve a seleção num <span> com o estilo dado (fonte, tamanho, sublinhado…). */
  ed.envolver = (estilo, limparDescendentes = []) => {
    ed.restaurar();
    const s = getSelection();
    if (!s.rangeCount) return false;
    if (s.isCollapsed) {
      // sem seleção: o próximo texto digitado recebe o estilo (como no Word)
      const sp = h('span', {}, ZW);
      Object.assign(sp.style, estilo);
      const r = s.getRangeAt(0);
      r.insertNode(sp);
      const nr = document.createRange(); nr.setStart(sp.firstChild, 1); nr.collapse(true);
      ed.selecionarRange(nr);
      return true;
    }
    ed.snapshot();
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('fontSize', false, '7');
    document.execCommand('styleWithCSS', false, true);
    const novos = [];
    area.querySelectorAll('font[size="7"]').forEach((f) => {
      const sp = h('span');
      Object.assign(sp.style, estilo);
      sp.append(...f.childNodes);
      f.replaceWith(sp);
      novos.push(sp);
    });
    area.querySelectorAll('span[style*="xxx-large"]').forEach((sp) => { sp.style.fontSize = ''; Object.assign(sp.style, estilo); novos.push(sp); });
    novos.forEach((sp) => limparDescendentes.forEach((p) => sp.querySelectorAll('[style]').forEach((d) => { d.style[p] = ''; })));
    if (novos.length) {
      const r = document.createRange();
      r.setStartBefore(novos[0]);
      r.setEndAfter(novos[novos.length - 1]);
      ed.selecionarRange(r);
    }
    ed.mudou();
    return true;
  };

  ed.aplicarTamanho = (pt) => {
    const n = parseFloat(String(pt).replace(',', '.'));
    if (!(n >= 1 && n <= 400)) return;
    ed.envolver({ fontSize: n + 'pt' }, ['fontSize']);
  };
  ed.aplicarFonte = (nome) => { if (nome) ed.envolver({ fontFamily: nome }, ['fontFamily']); };
  ed.fonteAtual = () => {
    const cs = getComputedStyle(ed.elementoAtual());
    return {
      familia: cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      tamanho: Math.round(parseFloat(cs.fontSize) * 0.75 * 2) / 2,
    };
  };
  ed.mudarTamanho = (dir) => {
    const atual = ed.fonteAtual().tamanho;
    const prox = dir > 0 ? TAMANHOS.find((t) => t > atual) : [...TAMANHOS].reverse().find((t) => t < atual);
    if (prox) ed.aplicarTamanho(prox);
  };
  ed.sublinhar = (estilo) => {
    if (!estilo) { ed.exec('underline'); return; }
    ed.envolver({ textDecorationLine: 'underline', textDecorationStyle: estilo }, ['textDecorationLine', 'textDecorationStyle']);
  };

  // ------------------------------------------------ Maiúsculas e minúsculas (Aa)
  ed.mudarCaixa = (modoCaixa) => {
    ed.restaurar();
    const r = ed.range;
    if (!r || r.collapsed) return;
    ed.snapshot();
    const { startContainer: sc, startOffset: so, endContainer: ec, endOffset: eo } = r;
    const raiz = r.commonAncestorContainer;
    const nos = [];
    if (raiz.nodeType === 3) nos.push(raiz);
    else {
      const tw = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
      while (tw.nextNode()) if (r.intersectsNode(tw.currentNode)) nos.push(tw.currentNode);
    }
    let inicioFrase = true;
    nos.forEach((no) => {
      const ini = no === sc ? so : 0, fim = no === ec ? eo : no.length;
      const t = no.data.slice(ini, fim);
      let n;
      if (modoCaixa === 'maiusculas') n = t.toLocaleUpperCase('pt-BR');
      else if (modoCaixa === 'minusculas') n = t.toLocaleLowerCase('pt-BR');
      else if (modoCaixa === 'alternar') n = [...t].map((c) => (c === c.toLocaleUpperCase('pt-BR') ? c.toLocaleLowerCase('pt-BR') : c.toLocaleUpperCase('pt-BR'))).join('');
      else if (modoCaixa === 'titulo') n = t.toLocaleLowerCase('pt-BR').replace(/(^|[\s(\-"“])(\p{L})/gu, (m, a, b) => a + b.toLocaleUpperCase('pt-BR'));
      else {
        n = [...t.toLocaleLowerCase('pt-BR')].map((c) => {
          if (inicioFrase && /\p{L}/u.test(c)) { inicioFrase = false; return c.toLocaleUpperCase('pt-BR'); }
          if (/[.!?]/.test(c)) inicioFrase = true;
          return c;
        }).join('');
      }
      if (n.length === t.length) no.data = no.data.slice(0, ini) + n + no.data.slice(fim);
    });
    const nr = document.createRange();
    nr.setStart(sc, Math.min(so, sc.length ?? so)); nr.setEnd(ec, Math.min(eo, ec.length ?? eo));
    ed.selecionarRange(nr);
    ed.mudou();
  };

  // ------------------------------------------------ Pincel de formatação
  ed.copiarFormato = () => {
    const el = ed.elementoAtual();
    const cs = getComputedStyle(el);
    const fundo = el.closest('span[style*="background"]');
    ed.formatoCopiado = {
      fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle,
      textDecorationLine: cs.textDecorationLine, color: cs.color, backgroundColor: fundo ? getComputedStyle(fundo).backgroundColor : '',
    };
    area.classList.add('ed-pincel');
    ribbon.atualizar(ed);
  };
  const aplicarPincel = () => {
    const f = ed.formatoCopiado;
    ed.formatoCopiado = null;
    area.classList.remove('ed-pincel');
    const s = getSelection();
    if (!s.rangeCount || s.isCollapsed) { ribbon.atualizar(ed); return; }
    ed.range = s.getRangeAt(0).cloneRange();
    const props = Object.keys(f);
    ed.envolver(f, props);
    ribbon.atualizar(ed);
  };

  // ------------------------------------------------ parágrafo
  ed.recuo = (delta) => {
    ed.restaurar();
    if (ed.elementoAtual().closest('li')) { ed.exec(delta > 0 ? 'indent' : 'outdent'); return; }
    ed.snapshot();
    ed.blocosSelecionados().forEach((b) => {
      const atual = parseFloat(b.style.marginLeft) || 0;
      const novo = Math.max(0, Math.round((atual + delta) * 100) / 100);
      b.style.marginLeft = novo ? novo + 'cm' : '';
    });
    ed.mudou();
  };
  ed.estiloParagrafo = (chave) => {
    const e = ESTILOS_PARAGRAFO[chave];
    if (!e) return;
    ed.snapshot();
    ed.restaurar();
    document.execCommand('formatBlock', false, e.tag);
    ed.range = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : ed.range;
    ed.blocosSelecionados().forEach((b) => {
      [...b.classList].filter((c) => c.startsWith('q-')).forEach((c) => b.classList.remove(c));
      if (e.cls) b.classList.add(e.cls);
      if (!b.className) b.removeAttribute('class');
    });
    ed.mudou();
  };
  ed.estiloAtual = () => {
    const b = ed.elementoAtual().closest('p,h3,h4,blockquote,li');
    if (!b) return 'normal';
    for (const [k, e] of Object.entries(ESTILOS_PARAGRAFO)) {
      if (b.tagName.toLowerCase() === e.tag && (e.cls ? b.classList.contains(e.cls) : ![...b.classList].some((c) => c.startsWith('q-')))) return k;
    }
    return '';
  };
  ed.espacamento = (valor) => { ed.snapshot(); ed.blocosSelecionados().forEach((b) => { b.style.lineHeight = valor; }); ed.mudou(); };
  ed.espacoParagrafo = (lado, pt) => { ed.snapshot(); ed.blocosSelecionados().forEach((b) => { b.style[lado === 'antes' ? 'marginTop' : 'marginBottom'] = pt === null ? '' : pt + 'pt'; }); ed.mudou(); };
  ed.sombreamentoParagrafo = (cor) => { ed.snapshot(); ed.blocosSelecionados().forEach((b) => { b.style.backgroundColor = cor === 'transparent' ? '' : cor; }); ed.mudou(); };
  ed.bordaParagrafo = (tipo) => {
    ed.snapshot();
    const v = '1px solid #000';
    ed.blocosSelecionados().forEach((b) => {
      if (tipo === 'nenhuma') { b.style.border = ''; b.style.padding = ''; return; }
      if (tipo === 'externas') { b.style.border = v; b.style.padding = '2px 4px'; return; }
      b.style[tipo === 'inferior' ? 'borderBottom' : 'borderTop'] = v;
    });
    ed.mudou();
  };
  ed.lista = (tipo, classe = '', estiloMarcador = '') => {
    ed.restaurar();
    ed.snapshot();
    let lista = ed.elementoAtual().closest('ul,ol');
    const tag = tipo === 'ol' ? 'OL' : 'UL';
    if (classe === 'nenhum') { if (lista) document.execCommand(lista.tagName === 'OL' ? 'insertOrderedList' : 'insertUnorderedList'); ed.mudou(); return; }
    if (!lista || !ed.dentro(lista) || lista.tagName !== tag) {
      document.execCommand(tipo === 'ol' ? 'insertOrderedList' : 'insertUnorderedList');
      const n = getSelection().anchorNode;
      lista = (n?.nodeType === 3 ? n.parentNode : n)?.closest?.('ul,ol');
    }
    if (lista) {
      [...lista.classList].filter((c) => c.startsWith('q-lst-')).forEach((c) => lista.classList.remove(c));
      if (classe) lista.classList.add(classe);
      lista.style.listStyleType = estiloMarcador || '';
      if (!lista.getAttribute('style')) lista.removeAttribute('style');
      if (!lista.className) lista.removeAttribute('class');
    }
    ed.mudou();
  };
  ed.limparFormatacao = () => {
    ed.exec('removeFormat');
    ed.blocosSelecionados().forEach((b) => { b.removeAttribute('style'); [...b.classList].filter((c) => c.startsWith('q-')).forEach((c) => b.classList.remove(c)); if (!b.className) b.removeAttribute('class'); });
    ed.mudou();
  };
  ed.alternarMarcas = () => { area.classList.toggle('ed-marcas'); ribbon.atualizar(ed); };

  ed.substituir = (de, para, { maiusc = false, inteira = false } = {}) => {
    if (!de) return 0;
    ed.snapshot();
    const escapar = de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(inteira ? `(?<![\\p{L}\\d])${escapar}(?![\\p{L}\\d])` : escapar, (maiusc ? 'g' : 'gi') + 'u');
    let n = 0;
    const tw = document.createTreeWalker(area, NodeFilter.SHOW_TEXT);
    const nos = [];
    while (tw.nextNode()) nos.push(tw.currentNode);
    nos.forEach((no) => { const novo = no.data.replace(re, () => { n++; return para; }); if (novo !== no.data) no.data = novo; });
    if (n) ed.mudou();
    return n;
  };

  // ------------------------------------------------ inserção
  /** Insere um nó de bloco (tabela, figura, caixa) na posição do cursor. */
  ed.inserirBloco = (no, { antes = false } = {}) => {
    ed.restaurar();
    ed.snapshot();
    const r = ed.range;
    let ref = r ? ed.blocoTopo(r.startContainer) : null;
    if (r && r.startContainer === area) ref = area.childNodes[r.startOffset] || null;
    if (ref && ref.nodeType === 1 && ref.tagName === 'P' && !ref.textContent.replace(ZW, '').trim() && !ref.querySelector('img,.q-fig,table')) {
      ref.replaceWith(no);
    } else if (ref) {
      antes ? area.insertBefore(no, ref) : ref.after(no);
    } else {
      area.append(no);
    }
    if (!no.nextSibling || (no.nextSibling.nodeType === 1 && /FIGURE|TABLE/.test(no.nextSibling.tagName))) no.after(h('p', {}, h('br')));
    const nr = document.createRange();
    nr.setStart(no.nextSibling, 0); nr.collapse(true);
    ed.selecionarRange(nr);
    ed.mudou();
  };
  ed.inserirInline = (no, focar = null) => {
    ed.restaurar();
    ed.snapshot();
    const r = getSelection().rangeCount ? getSelection().getRangeAt(0) : null;
    if (!r || !ed.dentro(r.startContainer)) { area.append(h('p', {}, no)); }
    else { r.deleteContents(); r.insertNode(no); }
    const depois = document.createTextNode(ZW);
    no.after(depois);
    const nr = document.createRange();
    if (focar) { nr.selectNodeContents(focar); } else { nr.setStart(depois, 1); nr.collapse(true); }
    ed.selecionarRange(nr);
    ed.mudou();
  };
  ed.inserirFracao = () => {
    const n = h('span', { class: 'q-frac-n', contenteditable: 'true' }, 'a');
    ed.inserirInline(h('span', { class: 'q-frac', contenteditable: 'false' }, n, h('span', { class: 'q-frac-d', contenteditable: 'true' }, 'b')), n);
  };
  ed.inserirRaiz = (indice = '') => {
    const r = h('span', { class: 'q-raiz-r', contenteditable: 'true' }, 'x');
    ed.inserirInline(h('span', { class: 'q-raiz', contenteditable: 'false' },
      indice ? h('sup', { class: 'q-raiz-i' }, indice) : null, h('span', { class: 'q-raiz-s' }, '√'), r), r);
  };
  ed.inserirCaixa = () => {
    const cx = h('div', { class: 'q-caixa' }, h('p', {}, 'Texto-base…'));
    ed.inserirBloco(cx);
    const r = document.createRange(); r.selectNodeContents(cx.firstChild);
    ed.selecionarRange(r);
  };
  ed.inserirLinhas = async () => {
    const n = h('input', { type: 'number', min: 1, max: 30, value: 4 });
    if ((await modal({ titulo: 'Linhas para resposta', corpo: campo('Quantidade de linhas', n), acoes: [{ label: 'Cancelar', value: null }, { label: 'Inserir', primary: true, value: 'ok' }] })) !== 'ok') return;
    ed.inserirBloco(h('div', { class: 'q-linhas', contenteditable: 'false', 'data-n': n.value, style: { height: `${(+n.value || 4) * 8}mm` } }));
  };

  ed.tabela = criarTabela(ed);
  ed.imagem = criarImagem(ed);

  // ------------------------------------------------ eventos
  area.addEventListener('focusin', () => ribbon.ativar(ed));
  area.addEventListener('input', () => { ed.mudou(); garantirParagrafo(); });
  area.addEventListener('pointerdown', (e) => {
    ribbon.ativar(ed);
    if (ed.imagem.pointerdown(e)) return;
    ed.tabela.pointerdown(e);
  });
  area.addEventListener('pointermove', (e) => ed.tabela.hover(e));
  area.addEventListener('pointerup', () => { if (ed.formatoCopiado) setTimeout(aplicarPincel, 0); });
  area.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const atalho = (fn) => { e.preventDefault(); fn(); };
    if (mod && k === 'z' && !e.shiftKey) return atalho(() => ed.desfazer(-1));
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) return atalho(() => ed.desfazer(1));
    if (mod && k === 'e') return atalho(() => ed.exec('justifyCenter'));
    if (mod && k === 'j') return atalho(() => ed.exec('justifyFull'));
    if (mod && e.shiftKey && (e.key === '>' || e.key === '.')) return atalho(() => ed.mudarTamanho(1));
    if (mod && e.shiftKey && (e.key === '<' || e.key === ',')) return atalho(() => ed.mudarTamanho(-1));
    if (mod && e.key === ']') return atalho(() => ed.aplicarTamanho(ed.fonteAtual().tamanho + 1));
    if (mod && e.key === '[') return atalho(() => ed.aplicarTamanho(Math.max(1, ed.fonteAtual().tamanho - 1)));
    if (mod && e.shiftKey && (e.key === '+' || e.key === '=')) return atalho(() => ed.exec('superscript'));
    if (mod && !e.shiftKey && e.key === '=') return atalho(() => ed.exec('subscript'));
    if (mod && e.shiftKey && k === 'c') return atalho(() => ed.copiarFormato());
    if (mod && e.shiftKey && k === 'v' && ed.formatoCopiado) return atalho(aplicarPincel);
    if (mod && k === ' ') return atalho(() => ed.exec('removeFormat'));
    if (e.key === 'Escape' && ed.formatoCopiado) { ed.formatoCopiado = null; area.classList.remove('ed-pincel'); ribbon.atualizar(ed); return; }
    if (ed.imagem.teclado(e)) return;
    if (e.key === 'Tab') {
      if (ed.tabela.tab(e)) { e.preventDefault(); return; }
      e.preventDefault();
      if (ed.elementoAtual().closest('li')) ed.exec(e.shiftKey ? 'outdent' : 'indent');
      else ed.exec('insertText', '    ');
    }
  });
  area.addEventListener('paste', (e) => {
    const itens = [...(e.clipboardData?.items || [])];
    const imgItem = itens.find((i) => i.type.startsWith('image/'));
    const html = e.clipboardData?.getData('text/html');
    if (imgItem && !html) { e.preventDefault(); ed.imagem.inserir(imgItem.getAsFile()); return; }
    if (html) { e.preventDefault(); ed.exec('insertHTML', limparHtml(html)); prepararConteudo(); }
  });
  area.addEventListener('drop', (e) => {
    const f = [...(e.dataTransfer?.files || [])].find((x) => x.type.startsWith('image/'));
    if (f) { e.preventDefault(); ed.imagem.inserir(f); }
  });
  area.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ribbon.ativar(ed);
    const fig = e.target.closest?.('.q-fig');
    if (fig && ed.dentro(fig)) ed.imagem.selecionar(fig);
    const temSel = ed.range && !ed.range.collapsed;
    const itens = [
      { rotulo: 'Recortar', icone: 'recortar', atalho: 'Ctrl+X', desabilitado: !temSel, acao: () => { ed.restaurar(); document.execCommand('cut'); ed.mudou(); } },
      { rotulo: 'Copiar', icone: 'copiar', atalho: 'Ctrl+C', desabilitado: !temSel, acao: () => { ed.restaurar(); document.execCommand('copy'); } },
      { rotulo: 'Colar', icone: 'colar', atalho: 'Ctrl+V', acao: () => ribbon.colar(ed) },
      '-',
    ];
    if (fig && ed.dentro(fig)) itens.push(...ed.imagem.itensMenu());
    else {
      if (ed.tabelaAtual) itens.push(...ed.tabela.itensMenu(), '-');
      itens.push(
        { rotulo: 'Fonte…', icone: 'maiusculas', acao: () => ribbon.dialogoFonte(ed) },
        { rotulo: 'Parágrafo…', icone: 'espacamento', acao: () => ribbon.dialogoParagrafo(ed) },
        { rotulo: 'Marcadores', icone: 'marcadores', acao: () => ed.lista('ul') },
        { rotulo: 'Numeração', icone: 'numeracao', acao: () => ed.lista('ol') });
    }
    abrirMenuContexto(e.clientX, e.clientY, itens);
  });
  window.addEventListener('resize', () => ed.imagem.reposicionar());

  function garantirParagrafo() {
    if (!area.firstChild || (area.childNodes.length === 1 && area.firstChild.nodeName === 'BR')) {
      area.innerHTML = '<p><br></p>';
      const r = document.createRange(); r.setStart(area.firstChild, 0); r.collapse(true);
      ed.selecionarRange(r);
    }
    area.classList.toggle('vazio', !area.textContent.replace(ZW, '').trim() && !area.querySelector('img,table,.q-linhas,.q-frac,.q-raiz'));
  }

  function prepararConteudo() {
    area.querySelectorAll('.q-fig, .q-linhas, .q-frac, .q-raiz').forEach((f) => f.setAttribute('contenteditable', 'false'));
    area.querySelectorAll('.q-frac-n, .q-frac-d, .q-raiz-r, .q-legenda').forEach((f) => f.setAttribute('contenteditable', 'true'));
    garantirParagrafo();
  }
  ed.prepararConteudo = prepararConteudo;

  function setHTML(html) {
    area.innerHTML = html || '<p><br></p>';
    prepararConteudo();
    hist.length = 0; histPos = -1; ed.snapshot();
  }

  function getHTML() {
    const c = area.cloneNode(true);
    c.querySelectorAll('.ed-fig-sel').forEach((x) => x.classList.remove('ed-fig-sel'));
    c.querySelectorAll('.cel-sel').forEach((x) => x.classList.remove('cel-sel'));
    c.querySelectorAll('[contenteditable]').forEach((x) => x.removeAttribute('contenteditable'));
    c.querySelectorAll('[class=""]').forEach((x) => x.removeAttribute('class'));
    const out = c.innerHTML.replace(/​/g, '').trim();
    return out === '<p><br></p>' || out === '<p></p>' ? '' : out;
  }

  document.execCommand('defaultParagraphSeparator', false, 'p');
  setHTML(html);
  ribbon.registrar(ed);
  return {
    el: wrap, area, ed, getHTML, setHTML,
    vazio: () => !textoDe(getHTML()) && !/<img|<table/.test(getHTML()),
    focus: () => { area.focus(); ribbon.ativar(ed); },
  };
}

function textoDe(html) { const d = document.createElement('div'); d.innerHTML = html; return d.textContent.trim(); }

/** Limpa HTML colado (Word, sites) mantendo formatação básica. */
export function limparHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,meta,link,title,xml,o\\:p,iframe,object,embed,form,input,button').forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((a) => {
      const n = a.name.toLowerCase();
      if (n.startsWith('on') || n === 'id' || n === 'lang') el.removeAttribute(a.name);
      if (n === 'class' && !/^q-/.test(a.value)) el.removeAttribute('class');
      if ((n === 'href' || n === 'src') && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
    if (el.style) {
      ['position', 'top', 'left', 'margin-left', 'margin-right'].forEach((p) => el.style.removeProperty(p));
      if (el.style.fontFamily && !/Calibri|Arial|Times|Georgia|Verdana|Cambria|Tahoma|Segoe|Century|Comic/.test(el.style.fontFamily)) el.style.removeProperty('font-family');
      if (parseFloat(el.style.fontSize) > 72) el.style.removeProperty('font-size');
    }
    if (el.tagName === 'TABLE') { el.classList.add('q-tabela'); el.removeAttribute('width'); el.style.width = el.style.width || '100%'; }
  });
  return doc.body.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
}
