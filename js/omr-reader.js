// Leitura óptica (OMR) da folha de respostas, sem bibliotecas externas.
// 1. converte a imagem para tons de cinza e binariza com limiar adaptativo
// 2. encontra os 4 marcadores quadrados dos cantos (componentes conexos)
// 3. usa a barra de orientação para descobrir o lado "de cima"
// 4. calcula a homografia folha(mm) -> imagem(px) e mede o preenchimento de cada bolha

import { FOLHA, geometriaFolha, geometriaCompacta } from './omr-layout.js';

export function paraCanvas(fonte, maxLado) {
  const w0 = fonte.videoWidth || fonte.naturalWidth || fonte.width;
  const h0 = fonte.videoHeight || fonte.naturalHeight || fonte.height;
  const esc = Math.min(1, maxLado / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.round(w0 * esc);
  c.height = Math.round(h0 * esc);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(fonte, 0, 0, c.width, c.height);
  return c;
}

function cinza(canvas) {
  const { width: w, height: h } = canvas;
  const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const g = new Uint8ClampedArray(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
  return { g, w, h };
}

function binarizar({ g, w, h }) {
  // imagem integral para média local
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let soma = 0;
    for (let x = 0; x < w; x++) {
      soma += g[y * w + x];
      I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + soma;
    }
  }
  const r = Math.max(8, Math.round(Math.max(w, h) / 14));
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const area = (x1 - x0) * (y1 - y0);
      const s = I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0];
      const media = s / area;
      const v = g[y * w + x];
      bin[y * w + x] = v < media * 0.7 && v < 170 ? 1 : 0;
    }
  }
  return bin;
}

function componentes(bin, w, h) {
  const rot = new Int32Array(w * h);
  const pilha = new Int32Array(w * h);
  const comps = [];
  let id = 0;
  for (let i = 0; i < bin.length; i++) {
    if (!bin[i] || rot[i]) continue;
    id++;
    let topo = 0;
    pilha[topo++] = i;
    rot[i] = id;
    let area = 0, sx = 0, sy = 0, minx = w, maxx = 0, miny = h, maxy = 0;
    while (topo) {
      const p = pilha[--topo];
      const x = p % w, y = (p - x) / w;
      area++; sx += x; sy += y;
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (y < miny) miny = y; if (y > maxy) maxy = y;
      if (x > 0 && bin[p - 1] && !rot[p - 1]) { rot[p - 1] = id; pilha[topo++] = p - 1; }
      if (x < w - 1 && bin[p + 1] && !rot[p + 1]) { rot[p + 1] = id; pilha[topo++] = p + 1; }
      if (y > 0 && bin[p - w] && !rot[p - w]) { rot[p - w] = id; pilha[topo++] = p - w; }
      if (y < h - 1 && bin[p + w] && !rot[p + w]) { rot[p + w] = id; pilha[topo++] = p + w; }
    }
    if (area >= 30) comps.push({ area, x: sx / area, y: sy / area, bw: maxx - minx + 1, bh: maxy - miny + 1 });
  }
  return comps;
}

/** Homografia que leva 4 pontos src -> dst. Retorna função (x,y) => [u,v]. */
export function homografia(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    if (Math.abs(A[c][c]) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const hm = b.map((v, i) => v / A[i][i]);
  return (x, y) => {
    const d = hm[6] * x + hm[7] * y + 1;
    return [(hm[0] * x + hm[1] * y + hm[2]) / d, (hm[3] * x + hm[4] * y + hm[5]) / d];
  };
}

function amostrar(G, proj, cx, cy, raio) {
  // média de cinza num disco (em mm) projetado na imagem
  let soma = 0, n = 0;
  const passos = 4;
  for (let i = -passos; i <= passos; i++) {
    for (let j = -passos; j <= passos; j++) {
      const dx = (i / passos) * raio, dy = (j / passos) * raio;
      if (dx * dx + dy * dy > raio * raio) continue;
      const [u, v] = proj(cx + dx, cy + dy);
      const x = Math.round(u), y = Math.round(v);
      if (x < 0 || y < 0 || x >= G.w || y >= G.h) { soma += 255; n++; continue; }
      soma += G.g[y * G.w + x]; n++;
    }
  }
  return 255 - soma / n; // "escuridão"
}

function cruz(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }

function combinacoes(n, k) {
  const out = [];
  const rec = (ini, acc) => {
    if (acc.length === k) { out.push(acc.slice()); return; }
    for (let i = ini; i < n; i++) { acc.push(i); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}

function acharMarcadores(G, comps, geos) {
  const maxLado = Math.max(G.w, G.h);
  const cands = comps.filter((c) => {
    const asp = c.bw / c.bh;
    const preench = c.area / (c.bw * c.bh);
    return c.bw >= 7 && c.bh >= 7 && asp > 0.5 && asp < 2 && preench > 0.5 &&
      c.bw < maxLado * 0.12 && c.bh < maxLado * 0.12;
  }).sort((a, b) => b.area - a.area).slice(0, 18);
  if (cands.length < 4) return null;

  let melhor = null;
  for (const comb of combinacoes(cands.length, 4)) {
    const pts = comb.map((i) => cands[i]);
    const areas = pts.map((p) => p.area);
    if (Math.max(...areas) / Math.min(...areas) > 3) continue;
    const cx = pts.reduce((s, p) => s + p.x, 0) / 4, cy = pts.reduce((s, p) => s + p.y, 0) / 4;
    pts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
    // convexidade
    let sinal = 0, ok = true;
    for (let i = 0; i < 4; i++) {
      const s = Math.sign(cruz(pts[i], pts[(i + 1) % 4], pts[(i + 2) % 4]));
      if (!sinal) sinal = s; else if (s !== sinal) { ok = false; break; }
    }
    if (!ok) continue;
    let area = 0;
    for (let i = 0; i < 4; i++) area += pts[i].x * pts[(i + 1) % 4].y - pts[(i + 1) % 4].x * pts[i].y;
    area = Math.abs(area) / 2;
    if (melhor && area < melhor.area * 0.5) continue;
    const ladoMarc = Math.sqrt(areas.reduce((a, b) => a + b, 0) / 4);
    for (const geo of geos) {
      // marcadores devem ter o tamanho esperado em relação ao quadrilátero
      const escala = Math.sqrt(area / (geo.W * geo.H)); // px por mm aproximado
      const ladoEsperado = geo.marcador * escala;
      if (ladoMarc < ladoEsperado * 0.45 || ladoMarc > ladoEsperado * 1.8) continue;
      const cantos = [[0, 0], [geo.W, 0], [geo.W, geo.H], [0, geo.H]];
      const B = geo.barra, by = B.y + B.h / 2;
      // testa as 4 rotações possíveis
      for (let k = 0; k < 4; k++) {
        const dst = [0, 1, 2, 3].map((i) => [pts[(i + k) % 4].x, pts[(i + k) % 4].y]);
        const d01 = Math.hypot(dst[1][0] - dst[0][0], dst[1][1] - dst[0][1]);
        const d03 = Math.hypot(dst[3][0] - dst[0][0], dst[3][1] - dst[0][1]);
        const razao = d01 / d03, esperada = geo.W / geo.H;
        if (razao < esperada * 0.7 || razao > esperada * 1.4) continue;
        const proj = homografia(cantos, dst);
        if (!proj) continue;
        const rb = Math.min(1.6, B.h * 0.35);
        const barra = [0.25, 0.5, 0.75].reduce((s, f) => s + amostrar(G, proj, B.x + B.w * f, by, rb), 0);
        const branco = geo.brancos.reduce((s, [x, y]) => s + amostrar(G, proj, x, y, rb), 0);
        const contraste = (barra - branco) / 3;
        if (contraste < 50) continue;
        const pont = area * (1 + contraste / 255);
        if (!melhor || pont > melhor.pont) melhor = { pont, area, dst, proj, contraste, geo };
      }
    }
  }
  return melhor;
}

/**
 * Lê uma folha. cfg: {nQuestoes, nAlt, nTipos}
 * Retorna {ok, erro?, respostas, tipo, numero, canvas, proj, layout, ...}
 */
export function lerFolha(fonte, cfg, { maxLado = 1600, soDetectar = false } = {}) {
  const canvas = fonte instanceof HTMLCanvasElement && Math.max(fonte.width, fonte.height) <= maxLado ? fonte : paraCanvas(fonte, maxLado);
  const G = cinza(canvas);
  const bin = binarizar(G);
  const comps = componentes(bin, G.w, G.h);
  // a folha pode ser a de página inteira ou o gabarito compacto impresso dentro da prova
  const geos = [geometriaFolha(cfg.nQuestoes, cfg.nAlt, cfg.nTipos), geometriaCompacta(cfg.nQuestoes, cfg.nAlt, cfg.nTipos)];
  const m = acharMarcadores(G, comps, geos);
  if (!m) return { ok: false, erro: 'Não encontrei os 4 quadrados pretos dos cantos do gabarito.', canvas };
  if (soDetectar) return { ok: true, canvas, cantos: m.dst, formato: m.geo.formato };

  const { proj, geo: L } = m;
  const rAm = L.raio * 0.6;
  // referência de preto: centro dos marcadores
  const preto = [[0, 0], [L.W, 0], [L.W, L.H], [0, L.H]]
    .reduce((s, [x, y]) => s + amostrar(G, proj, x, y, Math.min(2.5, L.marcador * 0.28)), 0) / 4;
  const medQ = L.questoes.map((linha) => linha.map((p) => amostrar(G, proj, p.x, p.y, rAm)));
  const todos = medQ.flat().sort((a, b) => a - b);
  const vazio = todos[Math.floor(todos.length * 0.25)] ?? 0;
  const faixa = Math.max(40, preto - vazio);
  const limiar = vazio + faixa * 0.4;

  const decidir = (vals) => {
    const marc = vals.map((v, i) => [v, i]).filter(([v]) => v > limiar).sort((a, b) => b[0] - a[0]);
    if (!marc.length) return null;
    if (marc.length === 1) return marc[0][1];
    if (marc[0][0] - marc[1][0] > faixa * 0.35) return marc[0][1];
    return -1; // múltiplas marcações
  };

  const respostas = medQ.map(decidir);
  const medNum = L.numero.map((linha) => linha.map((p) => amostrar(G, proj, p.x, p.y, rAm)));
  const dig = medNum.map(decidir);
  const numero = !dig.length ? '' : dig.every((d) => d !== null && d >= 0) ? `${dig[0]}${dig[1]}` : (dig[1] !== null && dig[1] >= 0 && dig[0] === null ? `0${dig[1]}` : '');
  let tipo = null;
  if (L.tipo.length) {
    const medT = L.tipo.map((p) => amostrar(G, proj, p.x, p.y, rAm));
    const t = decidir(medT);
    tipo = t !== null && t >= 0 ? t : null;
  }
  return { ok: true, canvas, proj, layout: L, formato: L.formato, respostas, numero, tipo, cantos: m.dst, medidas: medQ, limiar };
}

/** Desenha o resultado sobre a imagem lida. respCorretas: índice por questão (ou null). */
export function desenharResultado(leitura, respostas, corretas, anuladas = []) {
  const { canvas, proj, layout, cantos } = leitura;
  const out = document.createElement('canvas');
  out.width = canvas.width; out.height = canvas.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const [ax, ay] = proj(0, 0), [bx, by] = proj(layout.raio || FOLHA.raio, 0);
  const rPx = Math.max(3, Math.hypot(bx - ax, by - ay));
  ctx.lineWidth = Math.max(2, rPx / 3);
  ctx.strokeStyle = '#2f6bff';
  ctx.beginPath();
  cantos.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  layout.questoes.forEach((linha, q) => {
    const certa = corretas[q];
    linha.forEach((p, a) => {
      const [u, v] = proj(p.x, p.y);
      const marcada = respostas[q] === a;
      if (!marcada && a !== certa) return;
      ctx.beginPath();
      ctx.arc(u, v, rPx * 1.25, 0, Math.PI * 2);
      if (anuladas[q]) ctx.strokeStyle = '#888';
      else if (marcada && a === certa) ctx.strokeStyle = '#13a36f';
      else if (marcada) ctx.strokeStyle = '#e0352b';
      else ctx.strokeStyle = 'rgba(19,163,111,.75)';
      ctx.setLineDash(marcada ? [] : [3, 3]);
      ctx.stroke();
    });
    if (respostas[q] === -1) {
      const [u, v] = proj(linha[linha.length - 1].x + 5, linha[0].y);
      ctx.fillStyle = '#e0352b';
      ctx.font = `bold ${rPx * 2.4}px sans-serif`;
      ctx.fillText('!', u, v + rPx);
    }
  });
  ctx.setLineDash([]);
  return out;
}
