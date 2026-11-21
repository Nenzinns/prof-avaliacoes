// Leitura do material de referência anexado à geração com IA (livro didático, apostila, slides…).
// Tudo é lido no próprio navegador: PDF (pdf.js), Word/PowerPoint/LibreOffice (descompactando o arquivo),
// texto e imagens. PDFs digitalizados (sem texto) viram imagens das páginas.
import { carregarPdfJs, lerImagem } from './ui.js';

export const ACEITOS = '.pdf,.docx,.pptx,.odt,.odp,.txt,.md,.csv,.html,.htm,image/*';
export const LIMITE_TEXTO = 300000; // caracteres (~75 mil palavras): acima disso o material é cortado
export const MAX_IMAGENS = 20;

export const ehPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
const ehImagem = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name);
const extensao = (f) => (f.name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();

export function tamanho(bytes) {
  if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

/** "45-60, 72" → lista de páginas válidas (1..total). Vazio → todas. Lança erro se inválido. */
export function lerIntervalo(txt, total) {
  txt = String(txt || '').trim();
  if (!txt) return Array.from({ length: total }, (_, i) => i + 1);
  const pags = new Set();
  for (const parte of txt.split(/[,;\s]+/).filter(Boolean)) {
    const m = parte.match(/^(\d+)(?:[-–a](\d+))?$/);
    if (!m) throw new Error(`Páginas inválidas: "${txt}". Use, por exemplo, 45-60 ou 12, 15-18.`);
    let [a, b] = [+m[1], +(m[2] || m[1])];
    if (a > b) [a, b] = [b, a];
    for (let p = Math.max(1, a); p <= Math.min(total, b); p++) pags.add(p);
  }
  if (!pags.size) throw new Error(`As páginas "${txt}" não existem neste PDF (ele tem ${total} página${total > 1 ? 's' : ''}).`);
  return [...pags].sort((x, y) => x - y);
}

/** Abre o PDF (para saber o número de páginas antes de gerar). */
export async function abrirPdf(f) {
  const pdfjs = await carregarPdfJs();
  try {
    return await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
  } catch (e) {
    throw new Error(e?.name === 'PasswordException' ? 'PDF protegido por senha.' : 'Não consegui abrir este PDF.');
  }
}

async function paginaParaImagem(page) {
  const vp0 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: 1600 / Math.max(vp0.width, vp0.height) });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  return { mime: 'image/jpeg', dados: c.toDataURL('image/jpeg', 0.85).split(',')[1] };
}

async function lerPdf(pdf, paginas, vagasImagem) {
  const partes = [], semTexto = [], imagens = [];
  for (const n of paginas) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const texto = tc.items.map((it) => (it.str || '') + (it.hasEOL ? '\n' : '')).join('').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (texto.replace(/\s/g, '').length < 25) semTexto.push({ n, page });
    else partes.push(`[página ${n}]\n${texto}`);
  }
  // páginas sem texto (digitalizadas/fotos): manda a imagem da página
  for (const { page } of semTexto.slice(0, vagasImagem)) imagens.push(await paginaParaImagem(page));
  return { texto: partes.join('\n\n'), imagens, ignoradas: Math.max(0, semTexto.length - vagasImagem) };
}

// ---------------------------------------------------------------- Office (zip + XML)
async function lerZip(buf, quer) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), dec = new TextDecoder();
  let e = buf.byteLength - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error('arquivo corrompido');
  const total = dv.getUint16(e + 10, true);
  let off = dv.getUint32(e + 16, true);
  const out = {};
  for (let i = 0; i < total && dv.getUint32(off, true) === 0x02014b50; i++) {
    const metodo = dv.getUint16(off + 10, true), tam = dv.getUint32(off + 20, true);
    const nlen = dv.getUint16(off + 28, true), xlen = dv.getUint16(off + 30, true), clen = dv.getUint16(off + 32, true);
    const local = dv.getUint32(off + 42, true);
    const nome = dec.decode(u8.subarray(off + 46, off + 46 + nlen));
    off += 46 + nlen + xlen + clen;
    if (!quer(nome)) continue;
    const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const dados = u8.subarray(ini, ini + tam);
    const bytes = metodo === 0 ? dados
      : new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    out[nome] = dec.decode(bytes);
  }
  return out;
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function textoDeXml(xml) {
  return xml
    .replace(/<\/(w:p|a:p|text:p|text:h)>/g, '\n')
    .replace(/<(w:tab|text:tab)\b[^>]*\/?>/g, '\t')
    .replace(/<(w:br|a:br|text:line-break)\b[^>]*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, c) => (c[0] === '#' ? String.fromCodePoint(c[1] === 'x' || c[1] === 'X' ? parseInt(c.slice(2), 16) : +c.slice(1)) : ENT[c] ?? m))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

async function lerOffice(f) {
  const ext = extensao(f);
  const buf = await f.arrayBuffer();
  if (ext === 'docx') {
    const z = await lerZip(buf, (n) => n === 'word/document.xml');
    return textoDeXml(z['word/document.xml'] || '');
  }
  if (ext === 'pptx') {
    const z = await lerZip(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    return Object.keys(z).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0])
      .map((n, i) => `[slide ${i + 1}]\n${textoDeXml(z[n])}`).join('\n\n');
  }
  const z = await lerZip(buf, (n) => n === 'content.xml'); // odt / odp
  return textoDeXml(z['content.xml'] || '');
}

// ---------------------------------------------------------------- tudo junto
/**
 * Lê os anexos: [{ arquivo, pdf?, paginas? (texto do intervalo) }].
 * Devolve { texto, imagens: [{mime, dados(base64)}], avisos: [] }.
 */
export async function prepararAnexos(itens, progresso) {
  const blocos = [], imagens = [], avisos = [];
  for (const it of itens) {
    const f = it.arquivo;
    progresso?.(`Lendo ${f.name}…`);
    try {
      if (ehPdf(f)) {
        const pdf = await (it.pdf || abrirPdf(f));
        const r = await lerPdf(pdf, lerIntervalo(it.paginas, pdf.numPages), MAX_IMAGENS - imagens.length);
        if (r.texto) blocos.push({ nome: f.name, texto: r.texto });
        imagens.push(...r.imagens);
        if (r.imagens.length && !r.texto) avisos.push(`${f.name} parece digitalizado: as páginas serão enviadas como imagem.`);
        if (r.ignoradas) avisos.push(`${r.ignoradas} página(s) digitalizada(s) de ${f.name} ficaram de fora (máximo de ${MAX_IMAGENS} imagens). Indique as páginas do capítulo.`);
      } else if (ehImagem(f)) {
        if (imagens.length >= MAX_IMAGENS) { avisos.push(`${f.name} ficou de fora (máximo de ${MAX_IMAGENS} imagens).`); continue; }
        let url;
        try { url = await lerImagem(f, 1600); } catch { throw new Error('formato de imagem não suportado pelo navegador (use JPG ou PNG)'); }
        const [cab, dados] = url.split(',');
        imagens.push({ mime: cab.match(/data:([^;]+)/)[1], dados });
      } else if (['docx', 'pptx', 'odt', 'odp'].includes(extensao(f))) {
        blocos.push({ nome: f.name, texto: await lerOffice(f) });
      } else if (['html', 'htm'].includes(extensao(f))) {
        const doc = new DOMParser().parseFromString(await f.text(), 'text/html');
        blocos.push({ nome: f.name, texto: (doc.body?.innerText || doc.body?.textContent || '').trim() });
      } else if (['doc', 'ppt', 'xls', 'xlsx'].includes(extensao(f))) {
        throw new Error('formato não suportado; salve como PDF ou .docx');
      } else {
        blocos.push({ nome: f.name, texto: (await f.text()).trim() });
      }
    } catch (e) {
      throw new Error(`Não consegui ler "${f.name}": ${e.message}`);
    }
  }
  let texto = blocos.filter((b) => b.texto).map((b) => `=== Arquivo: ${b.nome} ===\n${b.texto}`).join('\n\n');
  if (texto.length > LIMITE_TEXTO) {
    texto = texto.slice(0, LIMITE_TEXTO) + '\n[…material cortado por ser muito longo…]';
    avisos.push('O material é muito longo e foi cortado. Para um resultado melhor, indique só as páginas do capítulo.');
  }
  if (!texto && !imagens.length) throw new Error('Não encontrei texto nos arquivos anexados.');
  return { texto, imagens, avisos };
}
