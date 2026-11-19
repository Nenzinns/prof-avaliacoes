// Ferramentas de tabela (Design da Tabela / Layout), no estilo do Word.

import { h, modal, campo, toast } from './ui.js';

export const ESTILOS_TABELA = [
  { id: 'grade', nome: 'Grade da Tabela', cab: false, tiras: false },
  { id: 'grade-cinza', nome: 'Grade com Cabeçalho Cinza', cab: true, tiras: true },
  { id: 'grade-azul', nome: 'Grade Azul (Ênfase 1)', cab: true, tiras: true },
  { id: 'grade-laranja', nome: 'Grade Laranja (Ênfase 2)', cab: true, tiras: true },
  { id: 'grade-verde', nome: 'Grade Verde (Ênfase 6)', cab: true, tiras: true },
  { id: 'lista', nome: 'Tabela Simples (linhas)', cab: true, tiras: false },
  { id: 'listrada', nome: 'Lista Listrada', cab: true, tiras: true },
  { id: 'moldura', nome: 'Somente Moldura', cab: false, tiras: false },
  { id: 'sem', nome: 'Sem Bordas', cab: false, tiras: false },
];

const OPOSTO = { Top: 'Bottom', Bottom: 'Top', Left: 'Right', Right: 'Left' };

export function mapear(t) {
  const grid = [];
  const pos = new Map();
  [...t.rows].forEach((tr, r) => {
    grid[r] = grid[r] || [];
    let c = 0;
    [...tr.cells].forEach((cel) => {
      while (grid[r][c]) c++;
      pos.set(cel, { r, c });
      for (let i = 0; i < cel.rowSpan; i++) for (let j = 0; j < cel.colSpan; j++) {
        grid[r + i] = grid[r + i] || [];
        grid[r + i][c + j] = cel;
      }
      c += cel.colSpan;
    });
  });
  const nCols = Math.max(0, ...grid.map((l) => l.length));
  return { grid, pos, nCols };
}

export function criarTabela(ed) {
  const { area } = ed;
  const novaCel = () => h('td', {}, h('br'));
  const caneta = { estilo: 'solid', esp: '1px', cor: '#000000' };
  let zona = null; // zona de redimensionamento sob o mouse
  let celInicio = null;

  const atual = () => ed.tabelaAtual;
  function celulaAtual() {
    if (ed.celulasSel.length) return ed.celulasSel[0];
    const c = ed.elementoAtual()?.closest?.('td,th');
    return c && ed.tabelaAtual?.contains(c) ? c : null;
  }
  const alvos = () => (ed.celulasSel.length ? ed.celulasSel : [celulaAtual()].filter(Boolean));
  function retangulo(cels, pos) {
    let r0 = Infinity, c0 = Infinity, r1 = -1, c1 = -1;
    cels.forEach((x) => { const p = pos.get(x); r0 = Math.min(r0, p.r); c0 = Math.min(c0, p.c); r1 = Math.max(r1, p.r + x.rowSpan - 1); c1 = Math.max(c1, p.c + x.colSpan - 1); });
    return { r0, c0, r1, c1 };
  }
  function inserirNaLinha(tr, pos, colAlvo, nova) {
    const r = [...tr.parentNode.rows].indexOf(tr);
    const ref = [...tr.cells].find((cel) => pos.get(cel) && pos.get(cel).r === r && pos.get(cel).c > colAlvo);
    tr.insertBefore(nova, ref || null);
  }
  const op = (fn) => (...a) => { if (!atual()) return; ed.snapshot(); fn(...a); ed.mudou(); };

  // ---------------------------------------------------------------- colunas (colgroup em %)
  function colgroup(t) { return t.querySelector(':scope > colgroup'); }
  function garantirColgroup(t) {
    const { grid, nCols } = mapear(t);
    let cg = colgroup(t);
    if (cg && cg.children.length === nCols) return cg;
    const larg = Array(nCols).fill(0);
    for (let c = 0; c < nCols; c++) {
      const simples = grid.map((l) => l[c]).find((x) => x && x.colSpan === 1);
      if (simples) larg[c] = simples.getBoundingClientRect().width;
    }
    const conhecidas = larg.filter(Boolean);
    const media = conhecidas.length ? conhecidas.reduce((a, b) => a + b, 0) / conhecidas.length : 1;
    const ws = larg.map((w) => w || media);
    const total = ws.reduce((a, b) => a + b, 0) || 1;
    cg?.remove();
    cg = h('colgroup', {}, ws.map((w) => h('col', { style: { width: ((w / total) * 100).toFixed(2) + '%' } })));
    t.prepend(cg);
    if (!t.style.width || t.style.width === 'auto') {
      t.style.width = Math.min(100, (t.getBoundingClientRect().width / larguraUtil()) * 100).toFixed(1) + '%';
    }
    t.style.tableLayout = 'fixed';
    delete t.dataset.ajuste;
    return cg;
  }
  function larguraUtil() {
    const cs = getComputedStyle(area);
    return area.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  }
  function normalizarCols(t) {
    const cg = colgroup(t); if (!cg) return;
    const cols = [...cg.children];
    const tot = cols.reduce((s, c) => s + (parseFloat(c.style.width) || 0), 0) || 1;
    cols.forEach((c) => { c.style.width = (((parseFloat(c.style.width) || 0) / tot) * 100).toFixed(2) + '%'; });
  }

  // ---------------------------------------------------------------- inserir tabela
  function inserir(linhas, colunas, { estilo = 'grade', larguraPct = 100 } = {}) {
    const nl = Math.max(1, Math.min(60, linhas)), nc = Math.max(1, Math.min(20, colunas));
    const def = ESTILOS_TABELA.find((e) => e.id === estilo) || ESTILOS_TABELA[0];
    const t = h('table', { class: 'q-tabela', 'data-estilo': def.id, style: { width: larguraPct + '%', tableLayout: 'fixed' } },
      h('colgroup', {}, Array.from({ length: nc }, () => h('col', { style: { width: (100 / nc).toFixed(2) + '%' } }))),
      h('tbody', {}, Array.from({ length: nl }, () => h('tr', {}, Array.from({ length: nc }, novaCel)))));
    if (def.cab) t.dataset.cab = '1';
    if (def.tiras) t.dataset.tiras = '1';
    ed.inserirBloco(t);
    const r = document.createRange(); r.setStart(t.rows[0].cells[0], 0); r.collapse(true);
    ed.selecionarRange(r);
    aoMudarSelecao();
    ed.mudou();
    return t;
  }

  // ---------------------------------------------------------------- linhas e colunas
  const inserirLinha = op((abaixo) => {
    const cel = celulaAtual(); if (!cel) return;
    const t = atual();
    const { grid, pos, nCols } = mapear(t);
    const sel = ed.celulasSel.length ? retangulo(ed.celulasSel, pos) : null;
    const p = pos.get(cel);
    const r = sel ? (abaixo ? sel.r1 : sel.r0) : (abaixo ? p.r + cel.rowSpan - 1 : p.r);
    const quantas = sel ? sel.r1 - sel.r0 + 1 : 1; // como no Word: insere tantas linhas quanto selecionadas
    for (let k = 0; k < quantas; k++) {
      const tr = h('tr');
      const visto = new Set();
      for (let c = 0; c < nCols; c++) {
        const x = grid[r]?.[c];
        if (!x) { tr.append(novaCel()); continue; }
        const px = pos.get(x);
        const atravessa = abaixo ? px.r + x.rowSpan - 1 > r : px.r < r;
        if (atravessa) { if (!visto.has(x)) { x.rowSpan++; visto.add(x); } } else {
          const n = novaCel();
          if (x.style.background) n.style.background = x.style.background;
          tr.append(n);
        }
      }
      const ref = t.rows[r];
      abaixo ? ref.after(tr) : ref.before(tr);
    }
  });

  const inserirColuna = op((direita) => {
    const cel = celulaAtual(); if (!cel) return;
    const t = atual();
    const cg = garantirColgroup(t);
    const quantas = ed.celulasSel.length ? (() => { const m = mapear(t); const s = retangulo(ed.celulasSel, m.pos); return s.c1 - s.c0 + 1; })() : 1;
    for (let k = 0; k < quantas; k++) {
      const { grid, pos } = mapear(t);
      const sel = ed.celulasSel.length ? retangulo(ed.celulasSel, pos) : null;
      const p = pos.get(cel);
      const c = sel ? (direita ? sel.c1 : sel.c0) : (direita ? p.c + cel.colSpan - 1 : p.c);
      const visto = new Set();
      [...t.rows].forEach((tr, r) => {
        const x = grid[r]?.[c];
        if (!x) { tr.append(novaCel()); return; }
        const px = pos.get(x);
        const atravessa = direita ? px.c + x.colSpan - 1 > c : px.c < c;
        if (atravessa) { if (!visto.has(x)) { x.colSpan++; visto.add(x); } return; }
        if (px.r !== r) { inserirNaLinha(tr, pos, direita ? c : c - 1, novaCel()); return; }
        direita ? x.after(novaCel()) : x.before(novaCel());
      });
      // nova coluna divide a largura com a vizinha
      const cols = [...cg.children];
      const viz = cols[c];
      const w = parseFloat(viz.style.width) || 10;
      viz.style.width = (w / 2).toFixed(2) + '%';
      const nova = h('col', { style: { width: (w / 2).toFixed(2) + '%' } });
      direita ? viz.after(nova) : viz.before(nova);
    }
  });

  function excluirLinhaIdx(t, r) {
    const { grid, pos, nCols } = mapear(t);
    const tr = t.rows[r];
    const visto = new Set();
    for (let c = 0; c < nCols; c++) {
      const x = grid[r]?.[c];
      if (!x || visto.has(x)) continue;
      visto.add(x);
      const px = pos.get(x);
      if (x.rowSpan > 1) {
        if (px.r === r) {
          const prox = t.rows[r + 1];
          x.rowSpan--;
          inserirNaLinha(prox, pos, px.c - 1, x);
          pos.set(x, { r: r + 1, c: px.c });
        } else x.rowSpan--;
      }
    }
    tr.remove();
  }
  const excluirLinhas = op(() => {
    const t = atual(); const cel = celulaAtual(); if (!cel) return;
    const { pos } = mapear(t);
    const s = ed.celulasSel.length ? retangulo(ed.celulasSel, pos) : { r0: pos.get(cel).r, r1: pos.get(cel).r + cel.rowSpan - 1 };
    for (let r = s.r1; r >= s.r0; r--) excluirLinhaIdx(t, r);
    limparSelecao();
    if (!t.rows.length) removerTabela(t);
  });

  const excluirColunas = op(() => {
    const t = atual(); const cel = celulaAtual(); if (!cel) return;
    const cg = garantirColgroup(t);
    const m0 = mapear(t);
    const s = ed.celulasSel.length ? retangulo(ed.celulasSel, m0.pos) : { c0: m0.pos.get(cel).c, c1: m0.pos.get(cel).c + cel.colSpan - 1 };
    for (let c = s.c1; c >= s.c0; c--) {
      const { grid } = mapear(t);
      const visto = new Set();
      grid.forEach((linha) => {
        const x = linha[c];
        if (!x || visto.has(x)) return;
        visto.add(x);
        if (x.colSpan > 1) x.colSpan--; else x.remove();
      });
      cg.children[c]?.remove();
    }
    normalizarCols(t);
    limparSelecao();
    if (!t.querySelector('td,th')) removerTabela(t);
  });

  function removerTabela(t) {
    const p = h('p', {}, h('br'));
    t.replaceWith(p);
    const r = document.createRange(); r.setStart(p, 0); r.collapse(true);
    ed.selecionarRange(r);
    ed.tabelaAtual = null;
    limparSelecao();
  }
  const excluirTabela = op(() => removerTabela(atual()));

  // ---------------------------------------------------------------- mesclar / dividir
  function limparLinhasVazias(t) {
    [...t.rows].forEach((tr) => {
      if (tr.cells.length) return;
      const r = [...t.rows].indexOf(tr);
      const { grid } = mapear(t);
      new Set(grid[r] || []).forEach((x) => { if (x && x.rowSpan > 1) x.rowSpan--; });
      tr.remove();
    });
  }
  function limparColunasVazias(t) {
    let mudou = true;
    while (mudou) {
      mudou = false;
      const { grid, pos, nCols } = mapear(t);
      for (let c = 1; c < nCols; c++) {
        const ninguemComeca = grid.every((l) => !l[c] || pos.get(l[c]).c < c);
        if (!ninguemComeca) continue;
        new Set(grid.map((l) => l[c]).filter(Boolean)).forEach((x) => { x.colSpan--; });
        const cg = colgroup(t);
        if (cg && cg.children[c]) {
          const w = parseFloat(cg.children[c].style.width) || 0;
          cg.children[c - 1].style.width = ((parseFloat(cg.children[c - 1].style.width) || 0) + w).toFixed(2) + '%';
          cg.children[c].remove();
        }
        mudou = true;
        break;
      }
    }
  }
  const mesclar = op(() => {
    if (ed.celulasSel.length < 2) { toast('Selecione duas ou mais células (arraste o mouse sobre elas ou use Shift+clique).'); return; }
    const t = atual();
    const { grid, pos } = mapear(t);
    const { r0, c0, r1, c1 } = retangulo(ed.celulasSel, pos);
    const alvo = grid[r0][c0];
    const visto = new Set([alvo]);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const x = grid[r][c];
      if (!x || visto.has(x)) continue;
      visto.add(x);
      if (x.textContent.trim() || x.querySelector('img')) {
        if (alvo.textContent.trim() || alvo.querySelector('img')) alvo.append(h('br'));
        alvo.append(...x.childNodes);
      }
      x.remove();
    }
    alvo.rowSpan = r1 - r0 + 1;
    alvo.colSpan = c1 - c0 + 1;
    limparSelecao();
    limparLinhasVazias(t);
    limparColunasVazias(t);
    const r = document.createRange(); r.selectNodeContents(alvo); r.collapse(false);
    ed.selecionarRange(r);
  });

  /** Divide a célula atual em R linhas × C colunas (Dividir Células do Word). */
  const dividir = op((R, C) => {
    const cel = celulaAtual(); if (!cel) return;
    const t = atual();
    garantirColgroup(t);
    let { grid, pos } = mapear(t);
    const { r, c } = pos.get(cel);
    const extraC = Math.max(0, C - cel.colSpan);
    if (extraC) {
      const borda = c + cel.colSpan - 1;
      const visto = new Set([cel]);
      grid.forEach((linha) => { const x = linha[borda]; if (x && !visto.has(x)) { visto.add(x); x.colSpan += extraC; } });
      cel.colSpan += extraC;
      const cols = [...colgroup(t).children];
      const w = parseFloat(cols[borda].style.width) || 10;
      cols[borda].style.width = (w / (extraC + 1)).toFixed(2) + '%';
      for (let i = 0; i < extraC; i++) cols[borda].after(h('col', { style: { width: (w / (extraC + 1)).toFixed(2) + '%' } }));
    }
    const extraR = Math.max(0, R - cel.rowSpan);
    if (extraR) {
      ({ grid } = mapear(t));
      const borda = r + cel.rowSpan - 1;
      const visto = new Set([cel]);
      (grid[borda] || []).forEach((x) => { if (x && !visto.has(x)) { visto.add(x); x.rowSpan += extraR; } });
      cel.rowSpan += extraR;
      let ref = t.rows[borda];
      for (let i = 0; i < extraR; i++) { const tr = h('tr'); ref.after(tr); ref = tr; }
    }
    ({ pos } = mapear(t));
    const partes = (n, k) => Array.from({ length: k }, (_, i) => Math.floor(n / k) + (i < n % k ? 1 : 0));
    const pc = partes(cel.colSpan, C), pr = partes(cel.rowSpan, R);
    cel.colSpan = pc[0];
    cel.rowSpan = pr[0];
    let rr = r;
    pr.forEach((altura, i) => {
      let cc = c;
      pc.forEach((largura, j) => {
        if (i || j) {
          const nova = novaCel();
          nova.rowSpan = altura; nova.colSpan = largura;
          inserirNaLinha(t.rows[rr], pos, cc - 1, nova);
          pos.set(nova, { r: rr, c: cc });
        }
        cc += largura;
      });
      rr += altura;
    });
    limparSelecao();
  });

  async function dialogoDividir() {
    const cel = celulaAtual(); if (!cel) return;
    const nc = h('input', { type: 'number', min: 1, max: 20, value: Math.max(2, cel.colSpan) });
    const nl = h('input', { type: 'number', min: 1, max: 40, value: cel.rowSpan });
    const r = await modal({ titulo: 'Dividir Células', corpo: h('div', { class: 'form-grade' }, campo('Número de colunas', nc), campo('Número de linhas', nl)), acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }] });
    if (r === 'ok') dividir(Math.max(1, +nl.value || 1), Math.max(1, +nc.value || 1));
  }

  const dividirTabela = op(() => {
    const t = atual(); const cel = celulaAtual(); if (!cel) return;
    const { pos } = mapear(t);
    const rIdx = pos.get(cel).r;
    if (rIdx === 0) { t.before(h('p', {}, h('br'))); return; }
    const cruza = [...t.querySelectorAll('td,th')].some((x) => { const p = pos.get(x); return p.r < rIdx && p.r + x.rowSpan - 1 >= rIdx; });
    if (cruza) { toast('Não é possível dividir aqui: há células mescladas atravessando esta linha.', 'erro'); return; }
    const nova = t.cloneNode(false);
    if (colgroup(t)) nova.append(colgroup(t).cloneNode(true));
    const tb = h('tbody');
    [...t.rows].slice(rIdx).forEach((tr) => tb.append(tr));
    nova.append(tb);
    t.after(h('p', {}, h('br')), nova);
    limparSelecao();
  });

  // ---------------------------------------------------------------- seleção de células
  function limparSelecao() {
    ed.celulasSel.forEach((c) => c.classList.remove('cel-sel'));
    ed.celulasSel = [];
  }
  function marcar(cels) {
    limparSelecao();
    ed.celulasSel = cels;
    cels.forEach((c) => c.classList.add('cel-sel'));
    ed.ribbon.atualizar(ed);
  }
  function selecionarRet(t, a, b) {
    const { grid, pos } = mapear(t);
    const pa = pos.get(a), pb = pos.get(b);
    let r0 = Math.min(pa.r, pb.r), c0 = Math.min(pa.c, pb.c);
    let r1 = Math.max(pa.r + a.rowSpan - 1, pb.r + b.rowSpan - 1), c1 = Math.max(pa.c + a.colSpan - 1, pb.c + b.colSpan - 1);
    let expandiu = true;
    while (expandiu) {
      expandiu = false;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const x = grid[r]?.[c]; if (!x) continue;
        const p = pos.get(x);
        if (p.r < r0) { r0 = p.r; expandiu = true; }
        if (p.c < c0) { c0 = p.c; expandiu = true; }
        if (p.r + x.rowSpan - 1 > r1) { r1 = p.r + x.rowSpan - 1; expandiu = true; }
        if (p.c + x.colSpan - 1 > c1) { c1 = p.c + x.colSpan - 1; expandiu = true; }
      }
    }
    const set = new Set();
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (grid[r]?.[c]) set.add(grid[r][c]);
    ed.tabelaAtual = t;
    marcar([...set].sort((x, y) => (pos.get(x).r - pos.get(y).r) || (pos.get(x).c - pos.get(y).c)));
  }
  function selecionar(tipo) {
    const t = atual(); const cel = celulaAtual(); if (!t || !cel) return;
    const { grid, pos } = mapear(t);
    const p = pos.get(cel);
    let cels;
    if (tipo === 'celula') cels = [cel];
    else if (tipo === 'linha') cels = [...new Set(grid[p.r])];
    else if (tipo === 'coluna') cels = [...new Set(grid.map((l) => l[p.c]).filter(Boolean))];
    else cels = [...t.querySelectorAll('td,th')];
    marcar(cels);
  }

  function aoMudarSelecao() {
    const c = ed.elementoAtual()?.closest?.('table.q-tabela');
    const t = c && ed.dentro(c) ? c : null;
    const tabSel = ed.celulasSel[0]?.closest('table') || null;
    if (tabSel && tabSel !== t) limparSelecao();
    ed.tabelaAtual = t || (ed.celulasSel.length ? tabSel : null);
  }

  // ---------------------------------------------------------------- mouse: seleção e redimensionamento
  function hover(e) {
    if (e.buttons) return;
    const cel = e.target.closest?.('td,th');
    zona = null;
    if (cel && ed.dentro(cel)) {
      const r = cel.getBoundingClientRect();
      if (Math.abs(e.clientX - r.right) <= 4) zona = { tipo: 'col', cel };
      else if (Math.abs(e.clientY - r.bottom) <= 4) zona = { tipo: 'lin', cel };
    }
    area.style.cursor = zona ? (zona.tipo === 'col' ? 'col-resize' : 'row-resize') : '';
  }

  function pointerdown(e) {
    const cel = e.target.closest?.('td,th');
    if (zona && cel) { e.preventDefault(); redimensionar(e, zona); return true; }
    if (!cel || !ed.dentro(cel)) { limparSelecao(); return false; }
    const t = cel.closest('table');
    if (e.shiftKey && ed.celulasSel.length && ed.celulasSel[0].closest('table') === t) {
      e.preventDefault(); selecionarRet(t, ed.celulasSel[0], cel); return true;
    }
    if (e.shiftKey) {
      const ini = ed.elementoAtual()?.closest?.('td,th');
      if (ini && ini !== cel && ini.closest('table') === t) { e.preventDefault(); selecionarRet(t, ini, cel); return true; }
    }
    limparSelecao();
    celInicio = cel;
    const mover = (ev) => {
      if (!(ev.buttons & 1)) return;
      const alvo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.('td,th');
      if (!alvo || alvo.closest('table') !== t) return;
      if (alvo === celInicio && !ed.celulasSel.length) return;
      selecionarRet(t, celInicio, alvo);
      getSelection().removeAllRanges();
    };
    const soltar = () => { document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', soltar); celInicio = null; };
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
    return false;
  }

  function redimensionar(e, z) {
    const t = z.cel.closest('table');
    ed.snapshot();
    const x0 = e.clientX, y0 = e.clientY;
    const dica = h('div', { class: 'ed-dica-tam' });
    ed.overlay.append(dica);
    const wr = ed.areaWrap.getBoundingClientRect();
    let mover;
    if (z.tipo === 'col') {
      const cg = garantirColgroup(t);
      const { pos } = mapear(t);
      const b = pos.get(z.cel).c + z.cel.colSpan - 1;
      const cols = [...cg.children];
      const tw0 = t.getBoundingClientRect().width;
      const w = cols.map((c) => parseFloat(c.style.width) || 0);
      const twPct0 = parseFloat(t.style.width) || 100;
      const util = larguraUtil();
      mover = (ev) => {
        const dx = ev.clientX - x0;
        if (cols[b + 1]) {
          const d = (dx / tw0) * 100;
          const nw = Math.max(2, Math.min(w[b] + w[b + 1] - 2, w[b] + d));
          cols[b].style.width = nw.toFixed(2) + '%';
          cols[b + 1].style.width = (w[b] + w[b + 1] - nw).toFixed(2) + '%';
        } else {
          // última coluna: muda a largura da tabela, mantendo as demais colunas
          const novoPx = Math.max(60, Math.min(util, tw0 + dx));
          t.style.width = ((novoPx / util) * 100).toFixed(1) + '%';
          const pxOutras = w.slice(0, b).map((v) => (v / 100) * tw0);
          let soma = 0;
          pxOutras.forEach((px, i) => { const p = (px / novoPx) * 100; cols[i].style.width = p.toFixed(2) + '%'; soma += p; });
          cols[b].style.width = Math.max(2, 100 - soma).toFixed(2) + '%';
        }
        dica.textContent = `Largura: ${(((parseFloat(cols[b].style.width) / 100) * (parseFloat(t.style.width) || twPct0) / 100) * 18.6).toFixed(2)} cm`;
        dica.style.left = ev.clientX - wr.left + 10 + 'px'; dica.style.top = ev.clientY - wr.top + 10 + 'px';
      };
    } else {
      const { pos } = mapear(t);
      const tr = t.rows[pos.get(z.cel).r + z.cel.rowSpan - 1];
      const h0 = tr.getBoundingClientRect().height;
      mover = (ev) => {
        const nh = Math.max(14, h0 + ev.clientY - y0);
        tr.style.height = (nh * 0.0264583).toFixed(2) + 'cm';
        dica.textContent = `Altura: ${(nh * 0.0264583).toFixed(2)} cm`;
        dica.style.left = ev.clientX - wr.left + 10 + 'px'; dica.style.top = ev.clientY - wr.top + 10 + 'px';
      };
    }
    const soltar = () => { document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', soltar); dica.remove(); ed.mudou(); };
    document.addEventListener('pointermove', mover);
    document.addEventListener('pointerup', soltar);
  }

  // ---------------------------------------------------------------- bordas, sombreamento e estilos
  function vizinhos(grid, pos, x, lado) {
    const p = pos.get(x), out = new Set();
    if (lado === 'Top' && p.r > 0) for (let c = p.c; c < p.c + x.colSpan; c++) out.add(grid[p.r - 1]?.[c]);
    if (lado === 'Bottom') for (let c = p.c; c < p.c + x.colSpan; c++) out.add(grid[p.r + x.rowSpan]?.[c]);
    if (lado === 'Left' && p.c > 0) for (let r = p.r; r < p.r + x.rowSpan; r++) out.add(grid[r]?.[p.c - 1]);
    if (lado === 'Right') for (let r = p.r; r < p.r + x.rowSpan; r++) out.add(grid[r]?.[p.c + x.colSpan]);
    out.delete(undefined); out.delete(x);
    return [...out];
  }
  const bordas = op((tipo) => {
    const t = atual();
    const cels = alvos(); if (!cels.length) return;
    const { grid, pos } = mapear(t);
    const { r0, c0, r1, c1 } = retangulo(cels, pos);
    const valor = tipo === 'nenhuma' ? 'none' : `${caneta.esp} ${caneta.estilo} ${caneta.cor}`;
    cels.forEach((x) => {
      const p = pos.get(x);
      const externo = { Top: p.r === r0, Bottom: p.r + x.rowSpan - 1 === r1, Left: p.c === c0, Right: p.c + x.colSpan - 1 === c1 };
      for (const L of ['Top', 'Bottom', 'Left', 'Right']) {
        const ext = externo[L];
        const hz = L === 'Top' || L === 'Bottom';
        const aplica = {
          todas: true, nenhuma: true, externas: ext, internas: !ext, internasH: !ext && hz, internasV: !ext && !hz,
          superior: ext && L === 'Top', inferior: ext && L === 'Bottom', esquerda: ext && L === 'Left', direita: ext && L === 'Right',
        }[tipo];
        if (!aplica) continue;
        x.style['border' + L] = valor;
        vizinhos(grid, pos, x, L).forEach((v) => { v.style['border' + OPOSTO[L]] = valor; });
      }
    });
  });
  const sombreamento = op((cor) => { alvos().forEach((x) => { x.style.background = cor === 'transparent' ? '' : cor; }); });
  const aplicarEstilo = op((id) => {
    const t = atual();
    const def = ESTILOS_TABELA.find((e) => e.id === id);
    t.dataset.estilo = id;
    t.querySelectorAll('td,th').forEach((x) => { ['border', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight', 'background'].forEach((p) => { x.style[p] = ''; }); });
    ['--tb-cor', '--tb-esp', '--tb-estilo'].forEach((v) => t.style.removeProperty(v));
    delete t.dataset.borda;
    if (def) { if (def.cab) t.dataset.cab = '1'; else delete t.dataset.cab; if (def.tiras) t.dataset.tiras = '1'; else delete t.dataset.tiras; }
  });
  const opcao = op((flag, ligado) => { const t = atual(); if (ligado) t.dataset[flag] = '1'; else delete t.dataset[flag]; });

  // ---------------------------------------------------------------- tamanho e alinhamento
  const autoAjuste = op((tipo) => {
    const t = atual();
    if (tipo === 'conteudo') {
      colgroup(t)?.remove();
      t.style.width = 'auto'; t.style.tableLayout = 'auto'; t.dataset.ajuste = 'conteudo';
    } else if (tipo === 'janela') {
      delete t.dataset.ajuste;
      garantirColgroup(t);
      t.style.width = '100%';
    } else {
      garantirColgroup(t);
    }
  });
  const alturaLinha = op((cm) => {
    const t = atual(); const { pos } = mapear(t);
    const linhas = new Set(alvos().map((x) => t.rows[pos.get(x).r]));
    linhas.forEach((tr) => { tr.style.height = cm > 0 ? cm + 'cm' : ''; });
  });
  const larguraColuna = op((cm) => {
    const t = atual(); const cel = celulaAtual(); if (!cel || !(cm > 0)) return;
    const cg = garantirColgroup(t);
    const { pos } = mapear(t);
    const c = pos.get(cel).c + cel.colSpan - 1;
    const cols = [...cg.children];
    const tabCm = ((parseFloat(t.style.width) || 100) / 100) * 18.6;
    const alvo = Math.min(95, (cm / tabCm) * 100);
    const resto = cols.reduce((s, x, i) => (i === c ? s : s + (parseFloat(x.style.width) || 0)), 0) || 1;
    cols.forEach((x, i) => { x.style.width = (i === c ? alvo : ((parseFloat(x.style.width) || 0) / resto) * (100 - alvo)).toFixed(2) + '%'; });
  });
  const distribuirColunas = op(() => {
    const t = atual(); const cg = garantirColgroup(t);
    const { pos, nCols } = mapear(t);
    const s = ed.celulasSel.length > 1 ? retangulo(ed.celulasSel, pos) : { c0: 0, c1: nCols - 1 };
    const cols = [...cg.children].slice(s.c0, s.c1 + 1);
    const tot = cols.reduce((a, c) => a + (parseFloat(c.style.width) || 0), 0);
    cols.forEach((c) => { c.style.width = (tot / cols.length).toFixed(2) + '%'; });
  });
  const distribuirLinhas = op(() => {
    const t = atual();
    const { pos } = mapear(t);
    const s = ed.celulasSel.length > 1 ? retangulo(ed.celulasSel, pos) : { r0: 0, r1: t.rows.length - 1 };
    const trs = [...t.rows].slice(s.r0, s.r1 + 1);
    const maior = Math.max(...trs.map((tr) => tr.getBoundingClientRect().height));
    trs.forEach((tr) => { tr.style.height = (maior * 0.0264583).toFixed(2) + 'cm'; });
  });
  const alinhar = op((v, hz) => { alvos().forEach((x) => { x.style.verticalAlign = v; x.style.textAlign = hz; }); });
  const margens = op((tipo) => {
    const t = atual();
    const v = { estreita: '1px 3px', normal: '', larga: '6px 10px' }[tipo];
    if (v) t.style.setProperty('--tb-pad', v); else t.style.removeProperty('--tb-pad');
  });
  const direcaoTexto = op(() => { alvos().forEach((x) => x.classList.toggle('q-vertical')); });
  const posicao = op((p) => { const t = atual(); if (p) t.dataset.alinh = p; else delete t.dataset.alinh; });

  async function propriedades() {
    const t = atual(); const cel = celulaAtual(); if (!t) return;
    const larg = h('input', { type: 'number', min: 10, max: 100, value: parseFloat(t.style.width) || 100 });
    const alinh = h('select', {}, [['', 'Esquerda'], ['centro', 'Centralizado'], ['dir', 'Direita']].map(([v, n]) => h('option', { value: v, selected: (t.dataset.alinh || '') === v }, n)));
    const tr = cel?.parentElement;
    const alt = h('input', { type: 'number', min: 0, step: 0.1, value: parseFloat(tr?.style.height) || '', placeholder: 'automática' });
    const vert = h('select', {}, [['top', 'Superior'], ['middle', 'Centro'], ['bottom', 'Inferior']].map(([v, n]) => h('option', { value: v, selected: (cel?.style.verticalAlign || 'top') === v }, n)));
    const cs = getComputedStyle(t);
    const corB = h('input', { type: 'color', value: rgbHex(cs.getPropertyValue('--tb-cor').trim()) || '#000000' });
    const espB = h('select', {}, ['0.5px', '1px', '1.5px', '2px', '3px'].map((v) => h('option', { value: v, selected: (cs.getPropertyValue('--tb-esp').trim() || '1px') === v }, v.replace('px', ' pt').replace('.', ','))));
    const estB = h('select', {}, [['solid', 'Sólida'], ['dashed', 'Tracejada'], ['dotted', 'Pontilhada'], ['double', 'Dupla']].map(([v, n]) => h('option', { value: v, selected: (cs.getPropertyValue('--tb-estilo').trim() || 'solid') === v }, n)));
    const r = await modal({
      titulo: 'Propriedades da Tabela', largo: false,
      corpo: h('div', {},
        h('h3', { class: 'dlg-sec' }, 'Tabela'),
        h('div', { class: 'form-grade' }, campo('Largura preferencial (%)', larg), campo('Alinhamento', alinh)),
        h('h3', { class: 'dlg-sec' }, 'Bordas padrão da tabela'),
        h('div', { class: 'form-grade' }, campo('Estilo', estB), campo('Espessura', espB), campo('Cor', corB)),
        cel ? h('div', {}, h('h3', { class: 'dlg-sec' }, 'Linha e célula'),
          h('div', { class: 'form-grade' }, campo('Altura da linha (cm)', alt), campo('Alinhamento vertical da célula', vert))) : null),
      acoes: [{ label: 'Cancelar', value: null }, { label: 'OK', primary: true, value: 'ok' }],
    });
    if (r !== 'ok') return;
    ed.snapshot();
    t.style.width = Math.max(10, Math.min(100, +larg.value || 100)) + '%';
    if (alinh.value) t.dataset.alinh = alinh.value; else delete t.dataset.alinh;
    t.style.setProperty('--tb-cor', corB.value);
    t.style.setProperty('--tb-esp', espB.value);
    t.style.setProperty('--tb-estilo', estB.value);
    if (tr) tr.style.height = +alt.value > 0 ? alt.value + 'cm' : '';
    if (cel) alvos().forEach((x) => { x.style.verticalAlign = vert.value; });
    ed.mudou();
  }

  // ---------------------------------------------------------------- teclado e menu de contexto
  function tab(e) {
    const cel = ed.elementoAtual()?.closest?.('td,th');
    if (!cel || !ed.dentro(cel)) return false;
    const t = cel.closest('table');
    const todas = [...t.querySelectorAll('td,th')];
    let prox = todas[todas.indexOf(cel) + (e.shiftKey ? -1 : 1)];
    if (!prox && !e.shiftKey) {
      // Tab na última célula cria uma nova linha (como no Word)
      ed.tabelaAtual = t;
      inserirLinha(true);
      prox = t.rows[t.rows.length - 1].cells[0];
    }
    if (prox) { const r = document.createRange(); r.selectNodeContents(prox); ed.selecionarRange(r); }
    return true;
  }

  function itensMenu() {
    return [
      { rotulo: 'Inserir', icone: 'insAbaixo', sub: [
        { rotulo: 'Inserir Linhas Acima', icone: 'insAcima', acao: () => inserirLinha(false) },
        { rotulo: 'Inserir Linhas Abaixo', icone: 'insAbaixo', acao: () => inserirLinha(true) },
        { rotulo: 'Inserir Colunas à Esquerda', icone: 'insEsq', acao: () => inserirColuna(false) },
        { rotulo: 'Inserir Colunas à Direita', icone: 'insDir', acao: () => inserirColuna(true) }] },
      { rotulo: 'Excluir', icone: 'excluir', sub: [
        { rotulo: 'Excluir Linhas', acao: excluirLinhas },
        { rotulo: 'Excluir Colunas', acao: excluirColunas },
        { rotulo: 'Excluir Tabela', acao: excluirTabela }] },
      { rotulo: 'Selecionar', icone: 'selecionar', sub: [
        { rotulo: 'Célula', acao: () => selecionar('celula') }, { rotulo: 'Linha', acao: () => selecionar('linha') },
        { rotulo: 'Coluna', acao: () => selecionar('coluna') }, { rotulo: 'Tabela', acao: () => selecionar('tabela') }] },
      { rotulo: 'Mesclar Células', icone: 'mesclar', desabilitado: ed.celulasSel.length < 2, acao: mesclar },
      { rotulo: 'Dividir Células…', icone: 'dividir', acao: dialogoDividir },
      { rotulo: 'Estilos de Borda', icone: iconeBordaMini(), sub: [
        { rotulo: 'Todas as Bordas', acao: () => bordas('todas') }, { rotulo: 'Bordas Externas', acao: () => bordas('externas') },
        { rotulo: 'Bordas Internas', acao: () => bordas('internas') }, { rotulo: 'Sem Borda', acao: () => bordas('nenhuma') }] },
      { rotulo: 'Alinhamento da Célula', icone: 'centro', sub: [['top', 'Superior'], ['middle', 'Centro'], ['bottom', 'Inferior']].flatMap(([v, n]) =>
        [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']].map(([hz, nh]) => ({ rotulo: `${n} · ${nh}`, acao: () => alinhar(v, hz) }))) },
      { rotulo: 'Direção do Texto', icone: 'direcaoTexto', acao: direcaoTexto },
      { rotulo: 'Propriedades da Tabela…', icone: 'propriedades', acao: propriedades },
    ];
  }

  return {
    caneta, inserir, inserirLinha, inserirColuna, excluirLinhas, excluirColunas, excluirTabela, mesclar, dividir, dialogoDividir, dividirTabela,
    selecionar, limparSelecao, aoMudarSelecao, pointerdown, hover, bordas, sombreamento, aplicarEstilo, opcao, autoAjuste, alturaLinha,
    larguraColuna, distribuirColunas, distribuirLinhas, alinhar, margens, direcaoTexto, posicao, propriedades, tab, itensMenu,
    estado() {
      const t = atual(); if (!t) return null;
      const cel = celulaAtual();
      let largCm = '';
      const cg = colgroup(t);
      if (cel && cg) {
        const { pos } = mapear(t);
        const c = pos.get(cel)?.c ?? 0;
        let soma = 0;
        for (let i = c; i < c + cel.colSpan; i++) soma += parseFloat(cg.children[i]?.style.width) || 0;
        largCm = (((soma / 100) * (parseFloat(t.style.width) || 100)) / 100 * 18.6).toFixed(2);
      }
      return {
        estilo: t.dataset.estilo || 'grade', cab: !!t.dataset.cab, tiras: !!t.dataset.tiras, pricol: !!t.dataset.pricol, total: !!t.dataset.total,
        altura: parseFloat(cel?.parentElement?.style.height) || '', largura: largCm, multiplas: ed.celulasSel.length > 1,
      };
    },
  };
}

function iconeBordaMini() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18"/><path d="M3 12h18M12 3v18"/></svg>'; }
function rgbHex(v) {
  if (!v) return '';
  if (v.startsWith('#')) return v.length === 4 ? '#' + [...v.slice(1)].map((c) => c + c).join('') : v;
  const m = v.match(/\d+/g); if (!m) return '';
  return '#' + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join('');
}
