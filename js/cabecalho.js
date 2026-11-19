// Cabeçalho personalizado da avaliação: uma imagem (ex.: cabeçalho oficial da escola)
// que substitui o cabeçalho padrão, com tamanho e posição ajustáveis.

import { h, modal, toast, lerImagem, escolherArquivo, esc } from './ui.js';
import { escolherCorte } from './editor-imagem.js';

export const LARGURA_UTIL_MM = 186; // largura útil da página A4 (margens de 12 mm)

function carregar(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

/** Aplica o corte à imagem original e devolve {src, aspecto}. */
async function gerarImagem(orig, crop) {
  const o = await carregar(orig);
  if (!crop) return { src: orig, aspecto: o.naturalWidth / o.naturalHeight };
  const W = o.naturalWidth, H = o.naturalHeight;
  const cw = Math.max(1, Math.round(W * crop.w)), ch = Math.max(1, Math.round(H * crop.h));
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const ctx = c.getContext('2d');
  const png = orig.startsWith('data:image/png');
  if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch); }
  ctx.drawImage(o, W * crop.x, H * crop.y, W * crop.w, H * crop.h, 0, 0, cw, ch);
  return { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.92), aspecto: cw / ch };
}

export function alturaImagem(cab) { return cab.larguraMm / (cab.aspecto || 4); }
export function alturaArea(cab) { return Math.max(8, (cab.y || 0) + alturaImagem(cab) + (cab.espacoAbaixo ?? 2)); }

/** HTML do cabeçalho personalizado na prova. tipo: letra do tipo (versões) ou null. */
export function htmlCabecalho(cab, { tipo = null } = {}) {
  // Tudo proporcional à largura útil real (que muda com as margens escolhidas):
  // "largura total" sempre ocupa exatamente o espaço entre as margens, sem ultrapassá-las.
  const hA = alturaArea(cab);
  const pct = (v) => ((v / LARGURA_UTIL_MM) * 100).toFixed(3) + '%';
  const larg = Math.min(cab.larguraMm, LARGURA_UTIL_MM);
  const x = Math.max(0, Math.min(LARGURA_UTIL_MM - larg, cab.x || 0));
  return `<div class="cab-pers" style="aspect-ratio:${LARGURA_UTIL_MM} / ${hA.toFixed(3)}">
    <img src="${cab.src}" alt="" style="left:${pct(x)};top:${(((cab.y || 0) / hA) * 100).toFixed(3)}%;width:${pct(larg)}">
    ${tipo ? `<div class="pc-tipo cab-pers-tipo"><small>TIPO</small>${esc(tipo)}</div>` : ''}
  </div>`;
}

/** Abre o editor. Retorna o novo objeto de cabeçalho, ou null se cancelado. */
export async function editarCabecalho(atual = null) {
  let cab = atual?.src ? structuredClone(atual) : null;
  if (!cab) {
    const [f] = await escolherArquivo('image/*');
    if (!f) return null;
    const orig = await lerImagem(f, 2400);
    const { src, aspecto } = await gerarImagem(orig, null);
    cab = { ativo: true, orig, crop: null, src, aspecto, larguraMm: LARGURA_UTIL_MM, x: 0, y: 0, espacoAbaixo: 2, manterCampos: true };
  }

  // ---- área de edição (escala mm -> px)
  const larguraPx = Math.min(760, innerWidth - 90);
  const k = larguraPx / LARGURA_UTIL_MM;
  const img = h('img', { class: 'cabed-img', draggable: 'false', alt: '' });
  const alca = h('div', { class: 'cabed-alca', title: 'Arraste para redimensionar (mantém a proporção)' });
  const alcaE = h('div', { class: 'cabed-alca cabed-alca-e', title: 'Arraste para redimensionar' });
  const caixa = h('div', { class: 'cabed-img-caixa' }, img, alca, alcaE);
  const area = h('div', { class: 'cabed-area', style: { width: larguraPx + 'px' } }, caixa, h('div', { class: 'cabed-regua' }));
  const amostra = h('div', { class: 'cabed-amostra', style: { width: larguraPx + 'px' } },
    h('div', { class: 'cabed-linha' }, h('span', {}, 'Aluno(a): ____________________________'), h('span', {}, 'Nº: ____')),
    h('div', { class: 'cabed-linha' }, h('span', {}, 'Turma: ______'), h('span', {}, 'Data: ______'), h('span', {}, 'Nota: ______')));

  const num = (titulo, passo = 0.1) => h('input', { type: 'number', step: passo, class: 'inp', style: { width: '78px' }, title: titulo });
  const inpL = num('Largura (cm)'), inpA = num('Altura (cm)'), inpX = num('Posição horizontal (cm)'), inpY = num('Distância do topo (cm)'), inpEsp = num('Espaço abaixo (cm)');
  const chkCampos = h('input', { type: 'checkbox', checked: cab.manterCampos !== false });
  const limitar = () => {
    cab.larguraMm = Math.max(15, Math.min(LARGURA_UTIL_MM, cab.larguraMm));
    cab.x = Math.max(0, Math.min(LARGURA_UTIL_MM - cab.larguraMm, cab.x));
    cab.y = Math.max(0, Math.min(80, cab.y || 0));
    cab.espacoAbaixo = Math.max(0, Math.min(40, cab.espacoAbaixo ?? 2));
  };
  const desenhar = (exceto) => {
    limitar();
    img.src = cab.src;
    const hImg = alturaImagem(cab);
    Object.assign(caixa.style, { left: cab.x * k + 'px', top: cab.y * k + 'px', width: cab.larguraMm * k + 'px', height: hImg * k + 'px' });
    area.style.height = alturaArea(cab) * k + 'px';
    const cm = (v) => (v / 10).toFixed(2);
    if (exceto !== inpL) inpL.value = cm(cab.larguraMm);
    if (exceto !== inpA) inpA.value = cm(hImg);
    if (exceto !== inpX) inpX.value = cm(cab.x);
    if (exceto !== inpY) inpY.value = cm(cab.y);
    if (exceto !== inpEsp) inpEsp.value = cm(cab.espacoAbaixo);
    amostra.style.display = chkCampos.checked ? '' : 'none';
  };
  inpL.addEventListener('input', () => { cab.larguraMm = (+inpL.value || 0) * 10; desenhar(inpL); });
  inpA.addEventListener('input', () => { cab.larguraMm = (+inpA.value || 0) * 10 * cab.aspecto; desenhar(inpA); });
  inpX.addEventListener('input', () => { cab.x = (+inpX.value || 0) * 10; desenhar(inpX); });
  inpY.addEventListener('input', () => { cab.y = (+inpY.value || 0) * 10; desenhar(inpY); });
  inpEsp.addEventListener('input', () => { cab.espacoAbaixo = (+inpEsp.value || 0) * 10; desenhar(inpEsp); });
  chkCampos.addEventListener('change', () => { cab.manterCampos = chkCampos.checked; desenhar(); });

  // arrastar para mover
  caixa.addEventListener('pointerdown', (e) => {
    if (e.target.classList.contains('cabed-alca')) return;
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY, cx = cab.x, cy = cab.y;
    caixa.setPointerCapture(e.pointerId);
    const mover = (ev) => { cab.x = cx + (ev.clientX - x0) / k; cab.y = cy + (ev.clientY - y0) / k; desenhar(); };
    const soltar = () => { caixa.removeEventListener('pointermove', mover); caixa.removeEventListener('pointerup', soltar); };
    caixa.addEventListener('pointermove', mover);
    caixa.addEventListener('pointerup', soltar);
  });
  // redimensionar pelas alças (proporção mantida)
  [alca, alcaE].forEach((a) => a.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const x0 = e.clientX, w0 = cab.larguraMm;
    a.setPointerCapture(e.pointerId);
    const mover = (ev) => { cab.larguraMm = w0 + (ev.clientX - x0) / k; desenhar(); };
    const soltar = () => { a.removeEventListener('pointermove', mover); a.removeEventListener('pointerup', soltar); };
    a.addEventListener('pointermove', mover);
    a.addEventListener('pointerup', soltar);
  }));

  const b = (rot, titulo, fn) => h('button', { type: 'button', class: 'btn btn-sm', title: titulo, onclick: fn }, rot);
  const alinhar = (pos) => { cab.x = pos === 'esq' ? 0 : pos === 'dir' ? LARGURA_UTIL_MM - cab.larguraMm : (LARGURA_UTIL_MM - cab.larguraMm) / 2; desenhar(); };
  const cortar = async () => {
    const base = await carregar(cab.orig);
    const crop = await escolherCorte(base, cab.crop);
    if (crop === undefined) return;
    const altAntes = alturaImagem(cab);
    cab.crop = crop;
    Object.assign(cab, await gerarImagem(cab.orig, crop));
    // mantém a altura visual próxima da anterior
    cab.larguraMm = Math.min(LARGURA_UTIL_MM, altAntes * cab.aspecto);
    desenhar();
  };
  const trocar = async () => {
    const [f] = await escolherArquivo('image/*');
    if (!f) return;
    cab.orig = await lerImagem(f, 2400);
    cab.crop = null;
    Object.assign(cab, await gerarImagem(cab.orig, null));
    desenhar();
  };

  desenhar();
  const r = await modal({
    titulo: 'Cabeçalho personalizado', largo: true,
    corpo: h('div', { class: 'cabed' },
      h('p', { class: 'dica', style: { marginTop: 0 } }, 'Arraste a imagem para posicionar e use a alça azul para mudar o tamanho. A faixa representa a largura útil da folha (entre as margens). Com margens diferentes, o cabeçalho se ajusta proporcionalmente.'),
      h('div', { class: 'cabed-palco' }, area, amostra),
      h('div', { class: 'linha-botoes', style: { marginTop: '12px' } },
        b('⇤ Esquerda', 'Alinhar à esquerda', () => alinhar('esq')),
        b('↔ Centro', 'Centralizar', () => alinhar('centro')),
        b('Direita ⇥', 'Alinhar à direita', () => alinhar('dir')),
        b('⬌ Largura total', 'Ocupar toda a largura', () => { cab.larguraMm = LARGURA_UTIL_MM; cab.x = 0; desenhar(); }),
        b('✂ Cortar', 'Cortar a imagem', cortar),
        b('🖼 Trocar imagem', 'Escolher outra imagem', trocar)),
      h('div', { class: 'linha-botoes cabed-medidas' },
        h('label', {}, 'Largura ', inpL, ' cm'), h('label', {}, 'Altura ', inpA, ' cm'),
        h('label', {}, 'Horizontal ', inpX, ' cm'), h('label', {}, 'Do topo ', inpY, ' cm'), h('label', {}, 'Espaço abaixo ', inpEsp, ' cm')),
      h('label', { class: 'campo-check', style: { marginTop: '10px' } }, chkCampos, 'Manter abaixo da imagem os campos do aluno (nome, nº, turma, data, nota) e as instruções')),
    acoes: [{ label: 'Cancelar', value: null }, { label: 'Usar este cabeçalho', primary: true, value: 'ok' }],
  });
  if (r !== 'ok') return null;
  cab.ativo = true;
  toast('Cabeçalho personalizado salvo', 'ok');
  return cab;
}
