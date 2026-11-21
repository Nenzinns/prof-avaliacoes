// Utilitários de interface: criação de elementos, modais, toasts.
import { ICONES, icBloco } from './icones.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const LETRAS = 'ABCDEFGHIJ';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function textoDeHtml(html) {
  const d = document.createElement('div');
  d.innerHTML = (html || '').replace(/<\/(p|td|th|li|div|h\d|figure)>|<br\s*\/?>/gi, ' $&');
  return (d.textContent || '').replace(/\s+/g, ' ').trim();
}

export function dataBR(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function toast(msg, tipo = 'info') {
  const t = h('div', { class: `toast toast-${tipo}` }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('saindo'), 2600);
  setTimeout(() => t.remove(), 3000);
}

/**
 * Abre um modal. `acoes`: [{label, primary, danger, value, onClick}]
 * Retorna Promise com o `value` da ação clicada (ou null se fechado).
 * Se onClick retornar false, o modal permanece aberto.
 */
export function modal({ titulo, corpo, acoes = [{ label: 'Fechar', value: null }], largo = false }) {
  return new Promise((resolve) => {
    const fechar = (v) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape') fechar(null); };
    const box = h('div', { class: `modal ${largo ? 'modal-largo' : ''}`, role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' },
        h('h2', {}, titulo),
        h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: () => fechar(null) }, '×')),
      h('div', { class: 'modal-body' }, corpo),
      h('div', { class: 'modal-foot' },
        acoes.map((a) => h('button', {
          class: `btn ${a.primary ? 'btn-primary' : ''} ${a.danger ? 'btn-danger' : ''}`,
          onclick: async () => {
            if (a.onClick) {
              const r = await a.onClick();
              if (r === false) return;
            }
            fechar(a.value === undefined ? true : a.value);
          },
        }, a.label))));
    const overlay = h('div', { class: 'modal-overlay no-print', onmousedown: (e) => { if (e.target === overlay) fechar(null); } }, box);
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    const f = box.querySelector('input, select, textarea');
    if (f) setTimeout(() => f.focus(), 30);
  });
}

export function confirmar(msg, { ok = 'Confirmar', perigo = false } = {}) {
  return modal({
    titulo: 'Confirmar',
    corpo: h('p', {}, msg),
    acoes: [{ label: 'Cancelar', value: false }, { label: ok, primary: !perigo, danger: perigo, value: true }],
  });
}

export function campo(label, input, dica) {
  return h('label', { class: 'campo' }, h('span', { class: 'campo-label' }, label), input, dica ? h('small', { class: 'dica' }, dica) : null);
}

export function vazio(icone, texto, ...extra) {
  const el = ICONES[icone] ? icBloco(icone, 'grande') : h('div', { class: 'vazio-icone' }, icone);
  return h('div', { class: 'vazio' }, el, h('p', {}, texto), ...extra);
}

/** Lê arquivo de imagem e devolve dataURL redimensionado (JPEG/PNG). */
export function lerImagem(file, maxLado = 1400) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const esc = Math.min(1, maxLado / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * esc);
        c.height = Math.round(img.height * esc);
        const ctx = c.getContext('2d');
        const png = file.type === 'image/png' || file.type === 'image/gif';
        if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.88));
      };
      img.onerror = reject;
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export function escolherArquivo(accept, multiplo = false) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept, multiple: multiplo, style: { display: 'none' } });
    inp.addEventListener('change', () => { resolve([...inp.files]); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

export function baixar(nome, conteudo, tipo = 'application/json') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const a = h('a', { href: URL.createObjectURL(blob), download: nome });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/** Embaralhamento Fisher-Yates (cópia). */
export function embaralhar(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let pdfjsPromise = null;
/** Carrega o pdf.js (sob demanda, da CDN). */
export function carregarPdfJs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = () => { pdfjsPromise = null; reject(new Error('Não foi possível carregar o leitor de PDF (verifique a internet).')); };
    document.head.append(s);
  });
  return pdfjsPromise;
}
