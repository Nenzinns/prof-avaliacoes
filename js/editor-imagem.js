// Ferramentas de imagem (Formato da Imagem), no estilo do Word.
// Edições não destrutivas: a imagem original fica em data-orig e as edições em data-ed;
// o src exibido/impresso é gerado a partir delas.

import { h, modal, campo, lerImagem, escolherArquivo, toast } from './ui.js';
import { svg, abrirPop, fecharPop, menu } from './editor-ui.js';

export const LARGURA_REF_CM = 18.6; // largura útil de uma prova A4 em 1 coluna

export const QUEBRAS = [
  { id: 'linha', nome: 'Alinhado com o Texto', icone: '<svg viewBox="0 0 60 44"><path d="M4 30h14M42 30h14M4 38h52" stroke="#888" stroke-width="2.5"/><rect x="21" y="16" width="18" height="16" rx="1.5" fill="#7d93e8"/></svg>' },
  { id: 'esq', nome: 'Quadrado: imagem à esquerda', icone: '<svg viewBox="0 0 60 44"><rect x="4" y="5" width="22" height="22" rx="1.5" fill="#7d93e8"/><path d="M31 8h25M31 15h25M31 22h25M4 33h52M4 40h40" stroke="#888" stroke-width="2.5"/></svg>' },
  { id: 'dir', nome: 'Quadrado: imagem à direita', icone: '<svg viewBox="0 0 60 44"><rect x="34" y="5" width="22" height="22" rx="1.5" fill="#7d93e8"/><path d="M4 8h25M4 15h25M4 22h25M4 33h52M4 40h40" stroke="#888" stroke-width="2.5"/></svg>' },
  { id: 'superior', nome: 'Superior e Inferior', icone: '<svg viewBox="0 0 60 44"><path d="M4 6h52" stroke="#888" stroke-width="2.5"/><rect x="18" y="11" width="24" height="20" rx="1.5" fill="#7d93e8"/><path d="M4 37h52" stroke="#888" stroke-width="2.5"/></svg>' },
];
const CLASSE_QUEBRA = { linha: 'fig-linha', esq: 'fig-meia-esq', dir: 'fig-meia-dir', superior: 'fig-inteira' };

export const ESTILOS_IMG = [
  { id: '', nome: 'Simples' },
  { id: 'borda-fina', nome: 'Borda Fina Preta' },
  { id: 'borda-grossa', nome: 'Borda Grossa' },
  { id: 'moldura', nome: 'Moldura Branca Simples' },
  { id: 'sombra', nome: 'Sombra Suave' },
  { id: 'arredondado', nome: 'Retângulo Arredondado' },
  { id: 'oval', nome: 'Elipse Suave' },
  { id: 'dupla', nome: 'Moldura Dupla' },
];
export const MODOS_COR = [
  { id: 'normal', nome: 'Cor original' },
  { id: 'cinza', nome: 'Escala de Cinza' },
  { id: 'pb', nome: 'Preto e Branco (50%)' },
  { id: 'sepia', nome: 'Sépia' },
  { id: 'desbotado', nome: 'Desbotado (marca d’água)' },
];
export const PROPORCOES = [['Livre', null], ['Quadrado 1:1', 1], ['Retrato 3:4', 3 / 4], ['Retrato 2:3', 2 / 3], ['Paisagem 4:3', 4 / 3], ['Paisagem 3:2', 3 / 2], ['Paisagem 16:9', 16 / 9]];

const EDICAO_PADRAO = { rot: 0, fh: false, fv: false, brilho: 0, contraste: 0, cor: 'normal', crop: null };

function carregar(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

export function criarImagem(ed) {
  const { area, overlay } = ed;
  const alcas = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((d) => h('div', { class: `ed-alca ed-alca-${d}`, 'data-d': d }));
  const btnLayout = h('button', { type: 'button', class: 'ed-btn-layout', title: 'Opções de Layout', html: svg('layoutOpcoes'), onmousedown: (e) => e.preventDefault() });
  const moldura = h('div', { class: 'ed-img-moldura', hidden: true }, alcas, btnLayout);
  const indicador = h('div', { class: 'ed-indicador', hidden: true });
  overlay.append(moldura, indicador);

  const fig = () => (ed.figSel && ed.figSel.isConnected ? ed.figSel : null);
  const img = (f = fig()) => f?.querySelector('img');
  const lerEd = (f) => ({ ...EDICAO_PADRAO, ...(f.dataset.ed ? JSON.parse(f.dataset.ed) : {}) });
  const op = (fn) => async (...a) => { const f = fig(); if (!f) return; ed.snapshot(); await fn(f, ...a); ed.mudou(); reposicionar(); };

  // ---------------------------------------------------------------- inserir
  async function inserir(arquivo) {
    const [f] = arquivo ? [arquivo] : await escolherArquivo('image/*');
    if (!f) return;
    const src = await lerImagem(f, 1600);
    const el = h('figure', { class: 'q-fig fig-inteira', contenteditable: 'false', 'data-alinh': 'centro', style: { width: '60%' } }, h('img', { src, alt: '' }));
    // cursor no início de um parágrafo com texto: a imagem entra antes dele
    let antes = false;
    const r = ed.range;
    const bloco = r ? ed.blocoTopo(r.startContainer) : null;
    if (r && r.collapsed && bloco && bloco.textContent.trim()) {
      const ini = document.createRange(); ini.setStart(bloco, 0); ini.setEnd(r.startContainer, r.startOffset);
      antes = !ini.toString().replace(/​/g, '').trim();
    }
    ed.inserirBloco(el, { antes });
    await carregar(src).catch(() => {});
    selecionar(el);
  }

  // ---------------------------------------------------------------- seleção e alças
  function selecionar(f) {
    if (ed.figSel && ed.figSel !== f) ed.figSel.classList.remove('ed-fig-sel');
    ed.figSel = f;
    f.classList.add('ed-fig-sel');
    if (document.activeElement !== area) area.focus({ preventScroll: true });
    getSelection().removeAllRanges();
    reposicionar();
    ed.ribbon.mostrarAba?.('imgFormato');
    ed.ribbon.atualizar(ed);
  }
  function desselecionar() {
    if (ed.figSel) ed.figSel.classList.remove('ed-fig-sel');
    ed.figSel = null;
    moldura.hidden = true;
    ed.ribbon.atualizar(ed);
  }
  function reposicionar() {
    const f = fig();
    if (!f) { moldura.hidden = true; if (ed.figSel) desselecionar(); return; }
    const i = img(f);
    const wr = ed.areaWrap.getBoundingClientRect();
    const r = i.getBoundingClientRect();
    moldura.hidden = false;
    Object.assign(moldura.style, { left: r.left - wr.left + 'px', top: r.top - wr.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }

  // redimensionar pelas alças
  alcas.forEach((a) => a.addEventListener('pointerdown', (e) => {
    const f = fig(); if (!f) return;
    e.preventDefault(); e.stopPropagation();
    ed.snapshot();
    const d = a.dataset.d;
    const i = img(f);
    const r0 = i.getBoundingClientRect();
    const asp0 = r0.width / r0.height;
    const W = conteinerLargura(f);
    const x0 = e.clientX, y0 = e.clientY;
    const dica = h('div', { class: 'ed-dica-tam' });
    overlay.append(dica);
    a.setPointerCapture(e.pointerId);
    const mover = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      let w = r0.width, hh = r0.height;
      if (d.includes('e')) w = r0.width + dx;
      if (d.includes('w')) w = r0.width - dx;
      if (d.includes('s')) hh = r0.height + dy;
      if (d.includes('n')) hh = r0.height - dy;
      const canto = d.length === 2;
      if (canto) {
        // cantos mantêm a proporção
        const pelaAltura = hh * asp0;
        w = Math.abs(dx) >= Math.abs(dy * asp0) ? w : pelaAltura;
        hh = w / asp0;
      }
      w = Math.max(20, Math.min(W, w)); hh = Math.max(16, hh);
      f.style.width = ((w / W) * 100).toFixed(1) + '%';
      if (!canto) i.style.aspectRatio = `${Math.round(w)} / ${Math.round(hh)}`;
      reposicionar();
      const cm = cmDe(f);
      dica.textContent = `${cm.l.toFixed(2)} × ${cm.a.toFixed(2)} cm`;
      const wr = ed.areaWrap.getBoundingClientRect();
      dica.style.left = ev.clientX - wr.left + 12 + 'px'; dica.style.top = ev.clientY - wr.top + 12 + 'px';
    };
    const soltar = () => { a.removeEventListener('pointermove', mover); a.removeEventListener('pointerup', soltar); dica.remove(); ed.mudou(); };
    a.addEventListener('pointermove', mover);
    a.addEventListener('pointerup', soltar);
  }));

  btnLayout.addEventListener('click', () => abrirPop(btnLayout, painelQuebra()));

  function painelQuebra() {
    const f = fig(); const q = quebraAtual(f);
    return h('div', { class: 'ed-layout-pop' },
      h('div', { class: 'ed-paleta-tit' }, 'Opções de Layout'),
      h('div', { class: 'ed-layout-opcoes' }, QUEBRAS.map((o) => h('button', {
        type: 'button', class: `ed-layout ${q === o.id ? 'ativo' : ''}`, title: o.nome, onmousedown: (e) => e.preventDefault(),
        onclick: () => { fecharPop(); quebra(o.id); },
      }, h('span', { html: o.icone }), o.nome))));
  }

  function conteinerLargura(f) {
    const p = f.parentElement?.closest('td,th,.q-caixa') || area;
    const cs = getComputedStyle(p);
    return p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }
  function proporcao(f) {
    const i = img(f);
    const ar = i.style.aspectRatio;
    if (ar) { const [a, b] = ar.split('/').map(parseFloat); if (a && b) return a / b; }
    return (i.naturalWidth || 4) / (i.naturalHeight || 3);
  }
  function cmDe(f) {
    const l = ((parseFloat(f.style.width) || 100) / 100) * LARGURA_REF_CM;
    return { l, a: l / proporcao(f) };
  }

  // ---------------------------------------------------------------- mover arrastando
  function pointerdown(e) {
    const f = e.target.closest?.('.q-fig');
    if (!f || !ed.dentro(f)) { if (ed.figSel) desselecionar(); return false; }
    if (e.target.closest('.q-legenda')) { selecionar(f); return true; }
    e.preventDefault();
    selecionar(f);
    const x0 = e.clientX, y0 = e.clientY;
    let arrastando = false, destino = null;
    const mover = (ev) => {
      if (!arrastando && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      arrastando = true;
      f.classList.add('ed-arrastando');
      const pos = document.caretRangeFromPoint ? document.caretRangeFromPoint(ev.clientX, ev.clientY) : null;
      const bloco = pos && ed.dentro(pos.startContainer) ? ed.blocoTopo(pos.startContainer) : null;
      destino = bloco && bloco !== f ? bloco : null;
      if (destino) {
        const wr = ed.areaWrap.getBoundingClientRect(), br = destino.getBoundingClientRect();
        Object.assign(indicador.style, { left: br.left - wr.left + 'px', top: br.top - wr.top - 2 + 'px', width: br.width + 'px' });
        indicador.hidden = false;
      } else indicador.hidden = true;
    };
    const soltar = () => {
      document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', soltar);
      indicador.hidden = true;
      f.classList.remove('ed-arrastando');
      if (arrastando && destino) {
        ed.snapshot();
        if (quebraAtual(f) === 'linha') destino.prepend(f); else destino.before(f);
        ed.mudou();
        reposicionar();
      }
    };
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    return true;
  }

  function teclado(e) {
    const f = fig();
    if (!f) return false;
    if (e.target.closest?.('.q-legenda')) return false;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); ed.snapshot(); f.remove(); desselecionar(); ed.mudou(); return true; }
    if (e.key === 'Escape') { desselecionar(); return true; }
    return false;
  }

  // ---------------------------------------------------------------- quebra de texto e posição
  function quebraAtual(f) {
    if (!f) return null;
    if (f.classList.contains('fig-linha')) return 'linha';
    if (f.classList.contains('fig-meia-esq')) return 'esq';
    if (f.classList.contains('fig-meia-dir')) return 'dir';
    return 'superior';
  }
  function trocarTag(f, tag) {
    if (f.tagName.toLowerCase() === tag) return f;
    const n = document.createElement(tag);
    [...f.attributes].forEach((a) => n.setAttribute(a.name, a.value));
    n.append(...f.childNodes);
    f.replaceWith(n);
    return n;
  }
  const quebra = op((f, tipo) => {
    const antes = quebraAtual(f);
    if (antes === tipo) return;
    Object.values(CLASSE_QUEBRA).forEach((c) => f.classList.remove(c));
    if (tipo === 'linha') {
      // imagem dentro do parágrafo, como um caractere
      const p = (f.nextElementSibling?.tagName === 'P' && f.nextElementSibling) || (f.previousElementSibling?.tagName === 'P' && f.previousElementSibling);
      const nf = trocarTag(f, 'span');
      nf.classList.add('fig-linha');
      if (parseFloat(nf.style.width) > 60) nf.style.width = '30%';
      if (p) { p === nf.nextElementSibling ? p.prepend(nf) : p.append(nf); } else { const np = h('p'); nf.replaceWith(np); np.append(nf); }
      ed.figSel = nf;
      nf.classList.add('ed-fig-sel');
      return;
    }
    let alvo = f;
    if (antes === 'linha') {
      const bloco = ed.blocoTopo(f) || f;
      alvo = trocarTag(f, 'figure');
      if (bloco !== alvo) bloco.before(alvo);
    }
    alvo.classList.add(CLASSE_QUEBRA[tipo]);
    if (tipo !== 'superior' && parseFloat(alvo.style.width) > 50) alvo.style.width = '45%';
    if (tipo === 'esq' || tipo === 'dir') {
      // ancora a imagem no parágrafo de texto, para o texto contorná-la (como no Word)
      const temTexto = (n) => n?.tagName === 'P' && n.textContent.replace(/​/g, '').trim();
      const ant = alvo.previousElementSibling;
      if (!temTexto(alvo.nextElementSibling) && temTexto(ant)) ant.before(alvo);
    }
    if (!alvo.nextSibling) alvo.after(h('p', {}, h('br')));
    ed.figSel = alvo;
    alvo.classList.add('ed-fig-sel');
  });
  const posicao = op((f, p) => {
    if (quebraAtual(f) === 'linha') { const b = f.closest('p'); if (b) b.style.textAlign = { esq: 'left', centro: 'center', dir: 'right' }[p]; return; }
    if (quebraAtual(f) !== 'superior') { Object.values(CLASSE_QUEBRA).forEach((c) => f.classList.remove(c)); f.classList.add(p === 'dir' ? 'fig-meia-dir' : p === 'esq' ? 'fig-meia-esq' : 'fig-inteira'); }
    f.dataset.alinh = p;
  });

  // ---------------------------------------------------------------- tamanho
  const definirTamanho = op((f, { larguraCm, alturaCm, bloquear }) => {
    const i = img(f);
    const asp = proporcao(f);
    let l = larguraCm, a = alturaCm;
    if (bloquear) { if (l) a = l / asp; else if (a) l = a * asp; }
    if (!l) l = cmDe(f).l;
    if (!a) a = l / asp;
    f.style.width = Math.max(3, Math.min(100, (l / LARGURA_REF_CM) * 100)).toFixed(2) + '%';
    if (!bloquear) i.style.aspectRatio = `${l.toFixed(3)} / ${a.toFixed(3)}`;
  });
  const largura = op((f, pct) => { f.style.width = pct + '%'; });

  // ---------------------------------------------------------------- edições de imagem
  async function renderizar(f) {
    const i = img(f);
    if (!f.dataset.orig) f.dataset.orig = i.src;
    const e = lerEd(f);
    const o = await carregar(f.dataset.orig);
    const rot = ((e.rot % 360) + 360) % 360;
    const W = rot % 180 ? o.naturalHeight : o.naturalWidth;
    const H = rot % 180 ? o.naturalWidth : o.naturalHeight;
    let c = h('canvas', { width: W, height: H });
    let ctx = c.getContext('2d');
    const png = f.dataset.orig.startsWith('data:image/png');
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
    ctx.translate(W / 2, H / 2);
    ctx.scale(e.fh ? -1 : 1, e.fv ? -1 : 1);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(o, -o.naturalWidth / 2, -o.naturalHeight / 2);
    if (e.crop) {
      const { x, y, w, h: hh } = e.crop;
      const cw = Math.max(1, Math.round(W * w)), ch = Math.max(1, Math.round(H * hh));
      const c2 = h('canvas', { width: cw, height: ch });
      c2.getContext('2d').drawImage(c, W * x, H * y, W * w, H * hh, 0, 0, cw, ch);
      c = c2; ctx = c.getContext('2d');
    }
    if (e.brilho || e.contraste || e.cor !== 'normal') {
      const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
      const B = e.brilho * 2.55, C = e.contraste * 2.55;
      const F = (259 * (C + 255)) / (255 * (259 - C));
      for (let k = 0; k < d.length; k += 4) {
        let r = F * (d[k] - 128) + 128 + B, g = F * (d[k + 1] - 128) + 128 + B, b = F * (d[k + 2] - 128) + 128 + B;
        if (e.cor === 'cinza' || e.cor === 'pb') {
          let l = 0.299 * r + 0.587 * g + 0.114 * b;
          if (e.cor === 'pb') l = l > 128 ? 255 : 0;
          r = g = b = l;
        } else if (e.cor === 'sepia') {
          const [r0, g0, b0] = [r, g, b];
          r = 0.393 * r0 + 0.769 * g0 + 0.189 * b0; g = 0.349 * r0 + 0.686 * g0 + 0.168 * b0; b = 0.272 * r0 + 0.534 * g0 + 0.131 * b0;
        } else if (e.cor === 'desbotado') {
          r = r * 0.35 + 166; g = g * 0.35 + 166; b = b * 0.35 + 166;
        }
        d[k] = r; d[k + 1] = g; d[k + 2] = b;
      }
      ctx.putImageData(id, 0, 0);
    }
    const semEdicao = JSON.stringify(e) === JSON.stringify(EDICAO_PADRAO);
    i.src = semEdicao ? f.dataset.orig : c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9);
    await i.decode().catch(() => {});
  }
  const editar = (alteracao) => op(async (f, ...a) => {
    const e = lerEd(f);
    alteracao(e, ...a, f);
    f.dataset.ed = JSON.stringify(e);
    await renderizar(f);
  });

  const girar = editar((e, graus, f) => {
    e.rot = (e.rot + (e.fh !== e.fv ? -graus : graus) + 360) % 360;
    if (e.crop) { const { x, y, w, h: hh } = e.crop; e.crop = graus > 0 ? { x: 1 - y - hh, y: x, w: hh, h: w } : { x: y, y: 1 - x - w, w: hh, h: w }; }
    const i = img(f);
    if (i.style.aspectRatio) { const [a, b] = i.style.aspectRatio.split('/'); i.style.aspectRatio = `${b} / ${a}`; }
  });
  const inverter = editar((e, eixo) => {
    if (eixo === 'h') { e.fh = !e.fh; if (e.crop) e.crop.x = 1 - e.crop.x - e.crop.w; }
    else { e.fv = !e.fv; if (e.crop) e.crop.y = 1 - e.crop.y - e.crop.h; }
  });
  const ajustar = editar((e, { brilho, contraste }) => { if (brilho !== undefined) e.brilho = brilho; if (contraste !== undefined) e.contraste = contraste; });
  const cor = editar((e, modo) => { e.cor = modo; });
  const redefinir = op(async (f, tamanho) => {
    delete f.dataset.ed;
    if (f.dataset.orig) img(f).src = f.dataset.orig;
    img(f).style.aspectRatio = '';
    if (tamanho) f.style.width = quebraAtual(f) === 'superior' ? '60%' : '45%';
    await img(f).decode().catch(() => {});
  });

  // ---------------------------------------------------------------- cortar
  async function cortar(proporcaoFixa = undefined) {
    const f = fig(); if (!f) return;
    const e = lerEd(f);
    // imagem sem corte (com rotação/inversão) para escolher a área
    const semCorte = { ...e, crop: null, brilho: 0, contraste: 0, cor: 'normal' };
    const tmp = h('figure', { 'data-orig': f.dataset.orig || img(f).src, 'data-ed': JSON.stringify(semCorte) }, h('img'));
    await renderizar(tmp);
    const base = await carregar(img(tmp).src);
    const novo = await escolherCorte(base, e.crop, proporcaoFixa);
    if (novo === undefined) return;
    ed.snapshot();
    const atual = lerEd(f);
    atual.crop = novo;
    f.dataset.ed = JSON.stringify(atual);
    img(f).style.aspectRatio = '';
    await renderizar(f);
    ed.mudou(); reposicionar();
  }

  // ---------------------------------------------------------------- estilo, borda, legenda, alt
  const estilo = op((f, id) => { if (id) f.dataset.estiloImg = id; else delete f.dataset.estiloImg; img(f).style.border = ''; });
  const borda = op((f, { cor: c, esp, tipo }) => {
    const i = img(f);
    if (c === 'none') { i.style.border = 'none'; return; }
    const atual = i.style.border && i.style.border !== 'none' ? i.style : { borderColor: '#000000', borderWidth: '1px', borderStyle: 'solid' };
    i.style.border = `${esp || atual.borderWidth || '1px'} ${tipo || atual.borderStyle || 'solid'} ${c || atual.borderColor || '#000'}`;
  });
  const legenda = op((f) => {
    const l = f.querySelector('.q-legenda');
    if (l) { l.remove(); return; }
    const n = area.querySelectorAll('.q-legenda').length + 1;
    const leg = h('span', { class: 'q-legenda', contenteditable: 'true' }, `Figura ${n} – `);
    f.append(leg);
    setTimeout(() => { const r = document.createRange(); r.selectNodeContents(leg); r.collapse(false); ed.selecionarRange(r); leg.focus(); });
  });
  async function textoAlt() {
    const f = fig(); if (!f) return;
    const t = h('textarea', { rows: 3, placeholder: 'Descreva a imagem para quem usa leitor de tela' });
    t.value = img(f).alt || '';
    if ((await modal({ titulo: 'Texto Alt', corpo: campo('Como você descreveria esta imagem?', t), acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }] })) !== 'ok') return;
    img(f).alt = t.value.trim();
    ed.mudou();
  }
  async function alterar() {
    const f = fig(); if (!f) return;
    const [arq] = await escolherArquivo('image/*');
    if (!arq) return;
    ed.snapshot();
    const src = await lerImagem(arq, 1600);
    f.dataset.orig = src;
    delete f.dataset.ed;
    img(f).style.aspectRatio = '';
    img(f).src = src;
    await img(f).decode().catch(() => {});
    ed.mudou(); reposicionar();
  }
  function excluir() { const f = fig(); if (!f) return; ed.snapshot(); f.remove(); desselecionar(); ed.mudou(); }

  async function dialogoTamanho() {
    const f = fig(); if (!f) return;
    const e = lerEd(f);
    const cm = cmDe(f);
    const l = h('input', { type: 'number', step: 0.1, min: 0.5, value: cm.l.toFixed(2) });
    const a = h('input', { type: 'number', step: 0.1, min: 0.5, value: cm.a.toFixed(2) });
    const trava = h('input', { type: 'checkbox', checked: !img(f).style.aspectRatio });
    const br = h('input', { type: 'range', min: -60, max: 60, value: e.brilho });
    const ct = h('input', { type: 'range', min: -60, max: 60, value: e.contraste });
    l.addEventListener('input', () => { if (trava.checked) a.value = (+l.value / proporcao(f)).toFixed(2); });
    a.addEventListener('input', () => { if (trava.checked) l.value = (+a.value * proporcao(f)).toFixed(2); });
    const r = await modal({
      titulo: 'Formatar Imagem',
      corpo: h('div', {},
        h('h3', { class: 'dlg-sec' }, 'Tamanho'),
        h('div', { class: 'form-grade' }, campo('Altura (cm)', a), campo('Largura (cm)', l)),
        h('label', { class: 'campo-check' }, trava, 'Bloquear taxa de proporção'),
        h('p', { class: 'dica' }, `Medidas para uma prova A4 em 1 coluna (${LARGURA_REF_CM} cm úteis).`),
        h('h3', { class: 'dlg-sec' }, 'Correções'),
        campo('Brilho', br), campo('Contraste', ct)),
      acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }],
    });
    if (r !== 'ok') return;
    await definirTamanho({ larguraCm: +l.value, alturaCm: +a.value, bloquear: trava.checked });
    if (+br.value !== e.brilho || +ct.value !== e.contraste) await ajustar({ brilho: +br.value, contraste: +ct.value });
  }

  function itensMenu() {
    const f = fig();
    return [
      { rotulo: 'Alterar Imagem…', icone: 'alterar', acao: alterar },
      { rotulo: 'Quebra Automática de Texto', icone: 'quebra', sub: QUEBRAS.map((o) => ({ rotulo: o.nome, ativo: quebraAtual(f) === o.id, acao: () => quebra(o.id) })) },
      { rotulo: 'Girar', icone: 'girar', sub: [
        { rotulo: 'Girar 90° para a Direita', acao: () => girar(90) }, { rotulo: 'Girar 90° para a Esquerda', acao: () => girar(-90) },
        { rotulo: 'Inverter Verticalmente', acao: () => inverter('v') }, { rotulo: 'Inverter Horizontalmente', acao: () => inverter('h') }] },
      { rotulo: 'Cortar', icone: 'cortar', acao: () => cortar() },
      { rotulo: f?.querySelector('.q-legenda') ? 'Remover Legenda' : 'Inserir Legenda', icone: 'legenda', acao: legenda },
      { rotulo: 'Editar Texto Alt…', icone: 'textoAlt', acao: textoAlt },
      { rotulo: 'Tamanho e Posição…', icone: 'propriedades', acao: dialogoTamanho },
      { rotulo: 'Redefinir Imagem', icone: 'redefinir', acao: () => redefinir(false) },
      '-',
      { rotulo: 'Excluir Imagem', icone: 'lixo', acao: excluir },
    ];
  }

  return {
    inserir, selecionar, desselecionar, reposicionar, pointerdown, teclado, quebra, posicao, definirTamanho, largura,
    girar, inverter, ajustar, cor, redefinir, cortar, estilo, borda, legenda, textoAlt, alterar, excluir, dialogoTamanho, itensMenu, painelQuebra,
    atual: fig,
    estado() {
      const f = fig(); if (!f) return null;
      const e = lerEd(f);
      const cm = cmDe(f);
      return { quebra: quebraAtual(f), alinh: f.dataset.alinh || 'centro', larguraCm: cm.l, alturaCm: cm.a, bloqueada: !img(f).style.aspectRatio,
        estilo: f.dataset.estiloImg || '', cor: e.cor, brilho: e.brilho, contraste: e.contraste, legenda: !!f.querySelector('.q-legenda') };
    },
  };
}

export { menu };

/**
 * Caixa de diálogo de corte (alças em "L" como no Word, proporções fixas).
 * Retorna: undefined (cancelado), null (sem corte) ou {x,y,w,h} em frações da imagem.
 */
export async function escolherCorte(base, cropAtual = null, proporcaoFixa = undefined) {
  const W = base.naturalWidth, H = base.naturalHeight;
  const maxW = Math.min(760, innerWidth - 80), maxH = Math.min(500, innerHeight - 280);
  const esc = Math.min(maxW / W, maxH / H, 1);
  const cv = h('canvas', { class: 'ed-crop', width: Math.round(W * esc), height: Math.round(H * esc) });
  const ctx = cv.getContext('2d');
  let c = cropAtual ? { x: cropAtual.x * W, y: cropAtual.y * H, w: cropAtual.w * W, h: cropAtual.h * H } : { x: 0, y: 0, w: W, h: H };
  let razao = proporcaoFixa ?? null;
  const encaixar = () => {
    if (!razao) return;
    // maior retângulo com a proporção, centrado no corte atual
    const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    let w = Math.min(W, c.w), hh = w / razao;
    if (hh > H) { hh = H; w = hh * razao; }
    c = { w, h: hh, x: Math.max(0, Math.min(W - w, cx - w / 2)), y: Math.max(0, Math.min(H - hh, cy - hh / 2)) };
  };
  encaixar();
  const desenhar = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(base, 0, 0, cv.width, cv.height);
    const X = c.x * esc, Y = c.y * esc, CW = c.w * esc, CH = c.h * esc;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(0, 0, cv.width, Y); ctx.fillRect(0, Y + CH, cv.width, cv.height - Y - CH);
    ctx.fillRect(0, Y, X, CH); ctx.fillRect(X + CW, Y, cv.width - X - CW, CH);
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1;
    for (let k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(X + (CW * k) / 3, Y); ctx.lineTo(X + (CW * k) / 3, Y + CH); ctx.moveTo(X, Y + (CH * k) / 3); ctx.lineTo(X + CW, Y + (CH * k) / 3); ctx.stroke(); }
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(X, Y, CW, CH);
    // alças de corte em "L" pretas, como no Word
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5;
    const L = 14;
    [[X, Y, 1, 1], [X + CW, Y, -1, 1], [X, Y + CH, 1, -1], [X + CW, Y + CH, -1, -1]].forEach(([px, py, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(px + sx * L, py); ctx.lineTo(px, py); ctx.lineTo(px, py + sy * L); ctx.stroke();
    });
    ctx.lineWidth = 5;
    [[X + CW / 2 - L / 2, Y, X + CW / 2 + L / 2, Y], [X + CW / 2 - L / 2, Y + CH, X + CW / 2 + L / 2, Y + CH], [X, Y + CH / 2 - L / 2, X, Y + CH / 2 + L / 2], [X + CW, Y + CH / 2 - L / 2, X + CW, Y + CH / 2 + L / 2]]
      .forEach(([a, b, cc, d]) => { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(cc, d); ctx.stroke(); });
  };
  desenhar();
  let arr = null;
  const pos = (ev) => { const r = cv.getBoundingClientRect(); return { x: ((ev.clientX - r.left) * (cv.width / r.width)) / esc, y: ((ev.clientY - r.top) * (cv.height / r.height)) / esc }; };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  cv.addEventListener('pointerdown', (ev) => {
    const p = pos(ev), tol = 16 / esc;
    const perto = (a, b) => Math.abs(a - b) < tol;
    const dY = p.y > c.y - tol && p.y < c.y + c.h + tol, dX = p.x > c.x - tol && p.x < c.x + c.w + tol;
    const m = { l: perto(p.x, c.x) && dY, r: perto(p.x, c.x + c.w) && dY, t: perto(p.y, c.y) && dX, b: perto(p.y, c.y + c.h) && dX };
    if (m.l || m.r || m.t || m.b) arr = { tipo: 'borda', m, c0: { ...c }, p0: p };
    else if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) arr = { tipo: 'mover', c0: { ...c }, p0: p };
    else arr = null;
    cv.setPointerCapture(ev.pointerId);
  });
  cv.addEventListener('pointermove', (ev) => {
    const p = pos(ev);
    if (!arr) return;
    const dx = p.x - arr.p0.x, dy = p.y - arr.p0.y;
    if (arr.tipo === 'mover') { c.x = cl(arr.c0.x + dx, 0, W - c.w); c.y = cl(arr.c0.y + dy, 0, H - c.h); }
    else {
      const { m, c0 } = arr;
      let x0 = c0.x, y0 = c0.y, x1 = c0.x + c0.w, y1 = c0.y + c0.h;
      if (m.l) x0 = cl(c0.x + dx, 0, x1 - 10);
      if (m.r) x1 = cl(c0.x + c0.w + dx, x0 + 10, W);
      if (m.t) y0 = cl(c0.y + dy, 0, y1 - 10);
      if (m.b) y1 = cl(c0.y + c0.h + dy, y0 + 10, H);
      if (razao) {
        // mantém a proporção escolhida
        const w = x1 - x0;
        let hh = w / razao;
        if (m.t && !m.l && !m.r) { hh = y1 - y0; x1 = Math.min(W, x0 + hh * razao); }
        else if (m.b && !m.l && !m.r) { hh = y1 - y0; x1 = Math.min(W, x0 + hh * razao); }
        else if (m.t) y0 = y1 - hh; else y1 = y0 + hh;
        if (y0 < 0 || y1 > H) { y0 = cl(y0, 0, H); y1 = cl(y1, 0, H); x1 = x0 + (y1 - y0) * razao; }
      }
      c = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    desenhar();
  });
  cv.addEventListener('pointerup', () => { arr = null; });
  const selRazao = h('select', {}, PROPORCOES.map(([n, v]) => h('option', { value: v ?? '', selected: (v ?? null) === razao }, n)),
    h('option', { value: 'orig' }, 'Original'));
  selRazao.addEventListener('change', () => { razao = selRazao.value === 'orig' ? W / H : selRazao.value ? +selRazao.value : null; encaixar(); desenhar(); });
  const r = await modal({
    titulo: 'Cortar', largo: true,
    corpo: h('div', { style: { textAlign: 'center' } }, cv,
      h('div', { class: 'linha-botoes', style: { justifyContent: 'center', marginTop: '10px' } }, h('label', {}, 'Proporção: ', selRazao)),
      h('p', { class: 'dica' }, 'Arraste as alças pretas para cortar ou arraste a área para posicionar.')),
    acoes: [{ label: 'Cancelar', value: null }, { label: 'Sem corte', value: 'sem' }, { label: 'Cortar', primary: true, value: 'ok' }],
  });
  if (!r) return undefined;
  if (r === 'sem' || (c.x < 1 && c.y < 1 && c.w > W - 1 && c.h > H - 1)) return null;
  return { x: c.x / W, y: c.y / H, w: c.w / W, h: c.h / H };
}
