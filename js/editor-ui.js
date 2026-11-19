// Componentes visuais do editor no estilo do Word: botões, menus suspensos,
// paletas de cores, menus de contexto e ícones.

import { h } from './ui.js';

// ------------------------------------------------------------------ ícones (24×24, traço)
const T = (s, x = 2, y = 18, tam = 15, peso = 700) => `<text x="${x}" y="${y}" font-size="${tam}" font-weight="${peso}" font-family="Segoe UI, Arial" fill="currentColor" stroke="none">${s}</text>`;
export const ICONE = {
  desfazer: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  refazer: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
  colar: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2.5h6V4"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  recortar: '<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8 16 18 3M16 16 6 3"/>',
  copiar: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M4 16V5a2 2 0 0 1 2-2h9"/>',
  pincel: '<rect x="4" y="3" width="13" height="6" rx="1"/><path d="M17 6h3v5h-8v3"/><rect x="10.5" y="14" width="3" height="7" rx="1"/>',
  aumentarFonte: T('A', 1, 19, 17) + '<path d="M16 9l3.5-4 3.5 4"/>',
  diminuirFonte: T('A', 1, 19, 13) + '<path d="M15 5l3.5 4 3.5-4"/>',
  maiusculas: T('Aa', 0, 17, 13),
  limparFmt: T('A', 2, 17, 14) + '<path d="M14 14l7 7M21 14l-7 7" stroke="#d24"/>',
  negrito: T('N', 5, 18, 16, 800),
  italico: '<path d="M10 4h8M6 20h8M14 4 10 20"/>',
  sublinhado: T('S', 6, 16, 14, 600) + '<path d="M5 21h14"/>',
  tachado: T('abc', 1, 16, 10, 600) + '<path d="M2 12.5h20"/>',
  subscrito: T('x', 2, 15, 15, 500) + T('2', 13, 21, 9, 700),
  sobrescrito: T('x', 2, 19, 15, 500) + T('2', 13, 9, 9, 700),
  corFonte: T('A', 5, 16, 16, 700),
  realce: '<path d="m9 15 7-11 4 2.5-7 11z"/><path d="M9 15l-1.5 3.5 4-1"/>',
  marcadores: '<circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/><path d="M9 6h12M9 12h12M9 18h12"/>',
  numeracao: T('1', 1, 9, 7) + T('2', 1, 15, 7) + T('3', 1, 21, 7) + '<path d="M9 6h12M9 12h12M9 18h12"/>',
  recuoMenos: '<path d="M21 6H11M21 12H11M21 18H11M7 8l-4 4 4 4"/>',
  recuoMais: '<path d="M21 6H11M21 12H11M21 18H11M3 8l4 4-4 4"/>',
  marcas: T('¶', 6, 18, 17, 700),
  esq: '<path d="M3 5h18M3 10h12M3 15h18M3 20h12"/>',
  centro: '<path d="M3 5h18M6 10h12M3 15h18M6 20h12"/>',
  dir: '<path d="M3 5h18M9 10h12M3 15h18M9 20h12"/>',
  just: '<path d="M3 5h18M3 10h18M3 15h18M3 20h18"/>',
  espacamento: '<path d="M11 6h10M11 12h10M11 18h10M5 4v16M2.5 6.5 5 4l2.5 2.5M2.5 17.5 5 20l2.5-2.5"/>',
  sombreamento: '<path d="M4 12 11 5l7 7-7 7z"/><path d="M20 14s2 2.4 2 3.8a2 2 0 0 1-4 0c0-1.4 2-3.8 2-3.8z"/>',
  bordaPar: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="1.5 2.5"/><path d="M3 20h18" stroke-width="2.6"/>',
  substituir: '<path d="M4 8h12l-3-3M20 16H8l3 3"/>',
  tabela: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/>',
  imagem: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
  caixaTexto: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
  linhas: '<path d="M3 8h18M3 14h18M3 20h18" stroke-dasharray="2 2"/>',
  linhaH: '<path d="M3 12h18"/>',
  equacao: T('π', 5, 18, 17, 600),
  simbolo: T('Ω', 4, 18, 16, 600),
  fracao: '<rect x="8.5" y="2.5" width="7" height="7" rx="1"/><path d="M4 12h16"/><rect x="8.5" y="14.5" width="7" height="7" rx="1"/>',
  raiz: '<path d="M2 13h3l3.5 7L14 4h8"/>',
  insAcima: '<rect x="3" y="11" width="18" height="10"/><path d="M3 16h18M9 11v10M15 11v10M12 2v6M9 5h6"/>',
  insAbaixo: '<rect x="3" y="3" width="18" height="10"/><path d="M3 8h18M9 3v10M15 3v10M12 16v6M9 19h6"/>',
  insEsq: '<rect x="11" y="3" width="10" height="18"/><path d="M16 3v18M11 9h10M11 15h10M2 12h6M5 9v6"/>',
  insDir: '<rect x="3" y="3" width="10" height="18"/><path d="M8 3v18M3 9h10M3 15h10M16 12h6M19 9v6"/>',
  excluir: '<rect x="3" y="3" width="14" height="14"/><path d="M3 10h14M10 3v14M15 15l6 6M21 15l-6 6" />',
  mesclar: '<rect x="3" y="5" width="18" height="14"/><path d="M4 12h5M15 12h5M7 9.5 9.5 12 7 14.5M17 9.5 14.5 12l2.5 2.5"/>',
  dividir: '<rect x="3" y="5" width="18" height="14"/><path d="M12 5v14M7 9.5 4.5 12 7 14.5M17 9.5l2.5 2.5-2.5 2.5"/>',
  dividirTabela: '<rect x="3" y="3" width="18" height="7"/><rect x="3" y="14" width="18" height="7"/><path d="M12 3v7M12 14v7"/>',
  grade: '<rect x="3" y="3" width="18" height="18" stroke-dasharray="2 2"/><path d="M3 12h18M12 3v18" stroke-dasharray="2 2"/>',
  selecionar: '<path d="M5 3l13 7.5-6 1.5-2.5 6z"/>',
  propriedades: '<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M9 9v12"/><circle cx="15.5" cy="15" r="2.5"/>',
  autoAjuste: '<path d="M3 4v16M21 4v16M6 12h12M8.5 9.5 6 12l2.5 2.5M15.5 9.5 18 12l-2.5 2.5"/>',
  distLinhas: '<rect x="4" y="3" width="16" height="18"/><path d="M4 9h16M4 15h16M12 5v2M12 11v2M12 17v2"/>',
  distColunas: '<rect x="3" y="4" width="18" height="16"/><path d="M9 4v16M15 4v16M5 12h2M11 12h2M17 12h2"/>',
  direcaoTexto: '<path d="M14 5h7M17.5 5v13M6 4v16M3 17l3 3 3-3"/>',
  margens: '<rect x="3" y="3" width="18" height="18"/><rect x="7.5" y="7.5" width="9" height="9" stroke-dasharray="2 2"/>',
  correcoes: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  cor: '<path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-1 1-2-.6-1.3.3-2 1.5-2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7" r="1.2" fill="currentColor"/><circle cx="15" cy="7" r="1.2" fill="currentColor"/>',
  alterar: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 12h9M13 9l3 3-3 3"/>',
  redefinir: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1L3 9"/><path d="M3 3.5V9h5.5"/>',
  bordaImg: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-width="3"/>',
  textoAlt: '<rect x="2.5" y="5" width="19" height="14" rx="2"/>' + T('ALT', 5, 15.5, 7.5, 700),
  quebra: '<rect x="3" y="4" width="8" height="8"/><path d="M14 5h7M14 9h7M3 15.5h18M3 19.5h18"/>',
  posicao: '<rect x="9" y="8" width="6" height="8"/><path d="M3 4h18M3 20h18"/>',
  girar: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.5V8h-4.5"/>',
  legenda: '<rect x="4" y="3" width="16" height="12" rx="1"/><path d="M6 19h12"/>',
  cortar: '<path d="M6 2v16h16M2 6h16v16"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  cadeadoAberto: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  layoutOpcoes: '<rect x="3" y="3" width="10" height="10"/><path d="M16 5h5M16 9h5M3 16h18M3 20h18"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  caret: '<path d="m7 10 5 5 5-5"/>',
  seta: '<path d="m9 6 6 6-6 6"/>',
  lancador: '<path d="M6 6h12v12M18 18 8 8"/>',
};

export function svg(nome, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONE[nome] || nome}</svg>`;
}

/** Ícone de bordas de tabela (estilo Word): linhas pontilhadas + as bordas ativas em traço cheio. */
export function iconeBorda(tipo) {
  const L = { sup: 'M3 3h18', inf: 'M3 21h18', esq: 'M3 3v18', dir: 'M21 3v18', iH: 'M3 12h18', iV: 'M12 3v18' };
  const ativos = {
    inferior: ['inf'], superior: ['sup'], esquerda: ['esq'], direita: ['dir'], nenhuma: [],
    todas: ['sup', 'inf', 'esq', 'dir', 'iH', 'iV'], externas: ['sup', 'inf', 'esq', 'dir'], internas: ['iH', 'iV'], internasH: ['iH'], internasV: ['iV'],
  }[tipo];
  const base = Object.values(L).map((d) => `<path d="${d}" stroke-dasharray="1 2.2" stroke-width="1.2" opacity=".55"/>`).join('');
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="square">${base}${ativos.map((k) => `<path d="${L[k]}" stroke-width="2.4"/>`).join('')}</svg>`;
}

// ------------------------------------------------------------------ popover genérico
let pop = null;
function foraPop(e) { if (pop && !pop.contains(e.target) && !pop._ancora?.contains(e.target)) fecharPop(); }
function escPop(e) { if (e.key === 'Escape') fecharPop(); }

export function fecharPop() {
  if (!pop) return;
  pop._ancora?.classList.remove('aberto');
  pop.remove();
  pop = null;
  document.removeEventListener('mousedown', foraPop, true);
  document.removeEventListener('keydown', escPop, true);
}

export function abrirPop(ancora, conteudo, pos = null) {
  const mesmo = pop && ancora && pop._ancora === ancora;
  fecharPop();
  if (mesmo) return null; // segundo clique fecha
  const p = h('div', { class: 'ed-pop' }, conteudo);
  p._ancora = ancora;
  // mantém a seleção do editor, exceto em campos
  p.addEventListener('mousedown', (e) => { if (!e.target.closest('input,select,textarea,label')) e.preventDefault(); });
  document.body.append(p);
  let left, top;
  if (ancora) { const r = ancora.getBoundingClientRect(); left = r.left; top = r.bottom + 3; ancora.classList.add('aberto'); }
  else { left = pos.x; top = pos.y; }
  const pw = p.offsetWidth, ph = p.offsetHeight;
  if (left + pw > innerWidth - 8) left = Math.max(8, innerWidth - pw - 8);
  if (top + ph > innerHeight - 8) top = ancora ? Math.max(8, ancora.getBoundingClientRect().top - ph - 3) : Math.max(8, innerHeight - ph - 8);
  p.style.left = left + 'px';
  p.style.top = top + 'px';
  pop = p;
  setTimeout(() => {
    document.addEventListener('mousedown', foraPop, true);
    document.addEventListener('keydown', escPop, true);
  });
  return p;
}

// ------------------------------------------------------------------ botões
const semFoco = (e) => e.preventDefault();

/** Botão de comando. tam: 'p' (só ícone), 'r' (ícone + rótulo), 'g' (grande, rótulo embaixo). */
export function botao({ icone, rotulo, titulo, acao, tam = 'p', estado, classe = '' }) {
  const b = h('button', {
    type: 'button', class: `ed-b ed-b-${tam} ${classe}`, title: titulo || rotulo, 'aria-label': titulo || rotulo,
    onmousedown: semFoco, onclick: (e) => acao?.(e),
  });
  if (icone) b.append(h('span', { class: 'ed-ic', html: icone.startsWith('<') ? icone : svg(icone) }));
  if (rotulo && tam !== 'p') b.append(h('span', { class: 'ed-rot' }, rotulo));
  if (estado) b.dataset.estado = estado;
  return b;
}

/** Botão que abre um painel suspenso. painel(fechar) => Node */
export function suspenso({ icone, rotulo, titulo, tam = 'p', painel, classe = '' }) {
  const b = botao({ icone, rotulo, titulo, tam, classe: `ed-susp ${classe}` });
  b.append(h('span', { class: 'ed-caret', html: svg('caret') }));
  b.addEventListener('click', () => abrirPop(b, painel(fecharPop)));
  return b;
}

/** Botão dividido (ação principal + seta com opções), como Cor da Fonte no Word. */
export function dividido({ icone, rotulo, titulo, tam = 'p', acao, painel, tituloSeta }) {
  const principal = botao({ icone, rotulo, titulo, tam, acao });
  const seta = h('button', { type: 'button', class: 'ed-b ed-seta', title: tituloSeta || titulo, onmousedown: semFoco, html: svg('caret') });
  const wrap = h('span', { class: `ed-split ed-split-${tam}` }, principal, seta);
  seta.addEventListener('click', () => abrirPop(wrap, painel(fecharPop)));
  return { el: wrap, principal };
}

/** Lista de menu. itens: {rotulo, icone, atalho, acao, ativo, desabilitado, sub:[...]} | '-' | {secao} */
export function menu(itens) {
  return h('div', { class: 'ed-menu' }, itens.filter(Boolean).map((it) => {
    if (it === '-') return h('div', { class: 'ed-menu-sep' });
    if (it.secao) return h('div', { class: 'ed-menu-secao' }, it.secao);
    const linha = h('div', {
      class: `ed-menu-item ${it.ativo ? 'ativo' : ''} ${it.desabilitado ? 'desab' : ''} ${it.sub ? 'tem-sub' : ''}`,
      role: 'menuitem',
      onclick: (e) => {
        if (it.desabilitado || it.sub) { e.stopPropagation(); return; }
        fecharPop();
        it.acao?.();
      },
    },
    h('span', { class: 'ed-menu-ic', html: it.icone ? (it.icone.startsWith('<') ? it.icone : svg(it.icone)) : (it.ativo ? '✓' : '') }),
    h('span', { class: 'ed-menu-rot', style: it.estilo || {} }, it.rotulo),
    it.atalho ? h('span', { class: 'ed-menu-atalho' }, it.atalho) : null,
    it.sub ? h('span', { class: 'ed-menu-seta', html: svg('seta') }) : null);
    if (it.sub) linha.append(h('div', { class: 'ed-menu-sub' }, menu(it.sub)));
    return linha;
  }));
}

export function abrirMenuContexto(x, y, itens) {
  return abrirPop(null, menu(itens), { x, y });
}

// ------------------------------------------------------------------ paletas de cores (Word)
const TEMA = ['#FFFFFF', '#000000', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
const PADRAO = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
export const DESTAQUE = ['#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#0000FF', '#FF0000', '#000080', '#008080', '#008000', '#800080', '#800000', '#808000', '#808080', '#C0C0C0', '#000000'];

function misturar(hex, alvo, t) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (alvo - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function tons(base) {
  if (base === '#FFFFFF') return [0.05, 0.15, 0.25, 0.35, 0.5].map((t) => misturar(base, 0, t));
  if (base === '#000000') return [0.5, 0.35, 0.25, 0.15, 0.05].map((t) => misturar(base, 255, t));
  return [misturar(base, 255, 0.8), misturar(base, 255, 0.6), misturar(base, 255, 0.4), misturar(base, 0, 0.25), misturar(base, 0, 0.5)];
}

const amostra = (cor, aoEscolher, titulo) => h('button', {
  type: 'button', class: 'ed-amostra', title: titulo || cor, style: { background: cor }, onmousedown: semFoco,
  onclick: () => { fecharPop(); aoEscolher(cor); },
});

/** Paleta completa: Cores do Tema, Cores Padrão, Mais Cores. */
export function paleta({ aoEscolher, semCor = null, valorSemCor = '' }) {
  const mais = h('input', { type: 'color', value: '#336699' });
  mais.addEventListener('change', () => { fecharPop(); aoEscolher(mais.value); });
  const grade = h('div', { class: 'ed-paleta-grade' }, TEMA.map((c) => amostra(c, aoEscolher)));
  const tonsEl = h('div', { class: 'ed-paleta-grade ed-paleta-tons' });
  for (let i = 0; i < 5; i++) TEMA.forEach((c) => tonsEl.append(amostra(tons(c)[i], aoEscolher)));
  return h('div', { class: 'ed-paleta' },
    semCor ? h('button', { type: 'button', class: 'ed-paleta-sem', onmousedown: semFoco, onclick: () => { fecharPop(); aoEscolher(valorSemCor); } },
      h('span', { class: 'ed-amostra', style: { background: semCor === 'Automático' ? '#000' : 'transparent' } }), semCor) : null,
    h('div', { class: 'ed-paleta-tit' }, 'Cores do Tema'), grade, tonsEl,
    h('div', { class: 'ed-paleta-tit' }, 'Cores Padrão'), h('div', { class: 'ed-paleta-grade' }, PADRAO.map((c) => amostra(c, aoEscolher))),
    h('label', { class: 'ed-paleta-mais' }, mais, 'Mais Cores…'));
}

export function paletaDestaque({ aoEscolher }) {
  return h('div', { class: 'ed-paleta' },
    h('div', { class: 'ed-paleta-grade ed-paleta-destaque' }, DESTAQUE.map((c) => amostra(c, aoEscolher))),
    h('button', { type: 'button', class: 'ed-paleta-sem', onmousedown: semFoco, onclick: () => { fecharPop(); aoEscolher('transparent'); } },
      h('span', { class: 'ed-amostra', style: { background: 'transparent' } }), 'Sem Cor'));
}

/** Grupo da faixa de opções (com nome embaixo e, opcionalmente, o iniciador de caixa de diálogo). */
export function grupo(nome, conteudo, lancador) {
  return h('div', { class: 'ed-grp' },
    h('div', { class: 'ed-grp-corpo' }, conteudo),
    h('div', { class: 'ed-grp-nome' }, nome,
      lancador ? h('button', { type: 'button', class: 'ed-lancador', title: `${nome}: mais opções`, onmousedown: semFoco, onclick: lancador, html: svg('lancador') }) : null));
}

export const col = (...els) => h('div', { class: 'ed-col' }, ...els);
export const lin = (...els) => h('div', { class: 'ed-lin' }, ...els);

/** Caixa de combinação editável (fonte/tamanho): digita e Enter, ou escolhe na lista. */
export function combo({ largura = 120, titulo, opcoes, renderOpcao, aoEscolher }) {
  const inp = h('input', { class: 'ed-combo-inp', title: titulo, 'aria-label': titulo, style: { width: largura + 'px' } });
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aoEscolher(inp.value.trim()); } });
  inp.addEventListener('focus', () => inp.select());
  const btn = h('button', { type: 'button', class: 'ed-combo-btn', onmousedown: semFoco, html: svg('caret'), title: titulo });
  const wrap = h('span', { class: 'ed-combo' }, inp, btn);
  btn.addEventListener('click', () => {
    const lista = h('div', { class: 'ed-combo-lista', style: { minWidth: largura + 20 + 'px' } }, opcoes().map((o) => {
      const it = h('div', { class: `ed-menu-item ${String(o) === inp.value ? 'ativo' : ''}`, onclick: () => { fecharPop(); aoEscolher(String(o)); } }, renderOpcao ? renderOpcao(o) : String(o));
      return it;
    }));
    abrirPop(wrap, lista);
    lista.querySelector('.ativo')?.scrollIntoView({ block: 'center' });
  });
  return { el: wrap, inp };
}

/** Galeria (estilos) — itens: {html|el, titulo, acao, ativo} */
export function galeria(itens, classe = '') {
  return h('div', { class: `ed-galeria ${classe}` }, itens.map((it) => h('button', {
    type: 'button', class: `ed-gal-item ${it.ativo ? 'ativo' : ''}`, title: it.titulo, onmousedown: semFoco, onclick: it.acao,
  }, it.el || h('span', { html: it.html }))));
}
