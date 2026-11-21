// Sincronização com a nuvem (Supabase) para quem entrou na conta.
// - Cada alteração local fica numa lista de "pendentes" e é enviada logo depois (ou quando a internet voltar).
// - Ao receber, vale a versão mais recente; o que foi apagado num aparelho é apagado nos outros.
// - Imagens embutidas (data:image…) vão para o armazenamento de arquivos e voltam a ser embutidas ao baixar.
// - Sincroniza: questões, avaliações, gabaritos, chaves de IA e formatação padrão. Resultados dos alunos não.
import { db, SINCRONIZADAS, aoMudarDados, versao } from './db.js';
import { cliente, usuario } from './conta.js';
import { h, modal } from './ui.js';

const LS = 'prof-sync';
const CONFIGS = { ia: 'prof-ia', formato: 'prof-formatacao-padrao' };
const BUCKET = 'imagens';
const TABELA = 'registros';
const RE_IMG = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
const RE_REF = /prof-img:([0-9a-f]{64})\.([a-z0-9]+)/g;

// ---------------------------------------------------------------- estado salvo
// { usuario, cursor, pend: { 'tipo/id': { v, apagado } }, cfgv: { ia: v, formato: v } }
function ler() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } }
function gravar(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* sem armazenamento */ } }
function alterar(fn) { const s = ler(); fn(s); gravar(s); return s; }

const chaveImgs = (uid) => 'prof-sync-imgs-' + uid;
function lerImgs(uid) { try { return JSON.parse(localStorage.getItem(chaveImgs(uid))) || {}; } catch { return {}; } }
function gravarImgs(uid, m) { try { localStorage.setItem(chaveImgs(uid), JSON.stringify(m)); } catch { /* sem armazenamento */ } }

function marcar(tipo, id, v, apagado) {
  alterar((s) => { (s.pend ||= {})[`${tipo}/${id}`] = { v, apagado: !!apagado }; });
  agendar();
}
aoMudarDados((store, id, v, apagado) => marcar(store, id, v, apagado));
window.addEventListener('prof-config-mudou', (e) => {
  const id = e.detail;
  if (!CONFIGS[id]) return;
  const v = Date.now();
  let vazio = true;
  try { vazio = localStorage.getItem(CONFIGS[id]) === null; } catch { /* sem armazenamento */ }
  alterar((s) => { (s.cfgv ||= {})[id] = v; });
  marcar('config', id, v, vazio);
});

// ---------------------------------------------------------------- estado visível
let estado = { fase: 'parado', msg: '', quando: 0 };
export const estadoSync = () => estado;
export const pendentes = () => Object.keys(ler().pend || {}).length;
function mudar(fase, msg = '') {
  estado = { fase, msg, quando: fase === 'ok' ? Date.now() : estado.quando };
  window.dispatchEvent(new CustomEvent('prof-sync-estado', { detail: estado }));
}

// ---------------------------------------------------------------- ciclo
let timer = null, rodando = null, deNovo = false;
function agendar(ms = 2500) {
  clearTimeout(timer);
  timer = setTimeout(() => { if (usuario()) sincronizar(); }, ms);
}

/** Envia o que está pendente e recebe o que mudou em outros aparelhos. */
export function sincronizar() {
  if (rodando) { deNovo = true; return rodando; }
  rodando = (async () => {
    try { do { deNovo = false; await ciclo(); } while (deNovo); } finally { rodando = null; }
  })();
  return rodando;
}

async function ciclo() {
  const u = usuario();
  if (!u) { mudar('parado'); return; }
  if (!navigator.onLine) { mudar('offline'); return; }
  mudar('sincronizando');
  try {
    const c = await cliente();
    const s = ler();
    if (s.usuario !== u.id && !(await trocarUsuario(s, u))) { mudar('parado'); return; }
    await enviar(c, u);
    const mudou = await receber(c, u);
    await mesclarChavesIA();
    mudar('ok');
    if (mudou) window.dispatchEvent(new CustomEvent('prof-dados-atualizados'));
  } catch (e) {
    console.error(e);
    if (!navigator.onLine) mudar('offline');
    else mudar('erro', traduzir(e));
  }
}

function traduzir(e) {
  const m = e?.message || String(e);
  if (e?.code === 'PGRST205' || e?.code === '42P01' || /registros|relation .* does not exist|schema cache/i.test(m)) {
    return 'A nuvem ainda não foi preparada (falta executar o SQL no Supabase).';
  }
  if (/bucket not found/i.test(m)) return 'A pasta de imagens da nuvem não foi criada (falta executar o SQL no Supabase).';
  if (/jwt|session|not authenticated|401/i.test(m)) return 'A sessão expirou. Saia e entre de novo na conta.';
  if (/failed to fetch|network|load failed/i.test(m)) return 'Sem conexão com a nuvem.';
  if (/quota|exceeded|too large|413/i.test(m)) return 'O espaço da nuvem acabou ou o item é grande demais.';
  return m;
}

// ---------------------------------------------------------------- primeira vez / troca de conta
async function marcarTudo(s) {
  s.pend ||= {};
  for (const store of SINCRONIZADAS) {
    for (const obj of await db.getAll(store)) s.pend[`${store}/${obj.id}`] = { v: versao(obj), apagado: false };
  }
  s.cfgv ||= {};
  for (const [id, chave] of Object.entries(CONFIGS)) {
    let tem = false;
    try { tem = localStorage.getItem(chave) !== null; } catch { /* sem armazenamento */ }
    // versão baixa: se a conta já tiver esta configuração, a da conta prevalece
    if (tem && id !== 'ia') { s.cfgv[id] = s.cfgv[id] || 1; s.pend[`config/${id}`] = { v: s.cfgv[id], apagado: false }; }
  }
}

let chavesParaMesclar = null;
async function mesclarChavesIA() {
  if (!chavesParaMesclar) return;
  const locais = chavesParaMesclar;
  chavesParaMesclar = null;
  let atual = [];
  try { const d = JSON.parse(localStorage.getItem(CONFIGS.ia)); atual = d?.chaves || (d?.chave ? [{ id: 'k1', ...d }] : []); } catch { /* vazio */ }
  // chaves da conta (já baixadas) + as deste aparelho que a conta ainda não tem; depois envia a lista junta
  const lista = [...atual, ...locais.filter((k) => !atual.some((a) => a.chave === k.chave))];
  try { localStorage.setItem(CONFIGS.ia, JSON.stringify({ chaves: lista })); } catch { return; }
  window.dispatchEvent(new CustomEvent('prof-config-mudou', { detail: 'ia' })); // envia na próxima rodada
}

async function trocarUsuario(s, u) {
  let substituir = false;
  if (s.usuario) {
    // este aparelho já sincronizou com outra conta
    const r = await modal({
      titulo: 'Outra conta',
      corpo: h('div', {},
        h('p', {}, `Os dados deste aparelho estavam ligados a outra conta. O que fazer ao entrar como ${u.email || 'esta conta'}?`),
        h('ul', {},
          h('li', {}, h('b', {}, 'Juntar: '), 'envia também os dados deste aparelho para esta conta.'),
          h('li', {}, h('b', {}, 'Substituir: '), 'apaga os dados deste aparelho e baixa os desta conta.'))),
      acoes: [{ label: 'Cancelar', value: null }, { label: 'Substituir', danger: true, value: 'sub' }, { label: 'Juntar', primary: true, value: 'juntar' }],
    });
    if (!r) return false;
    substituir = r === 'sub';
  }
  const novo = { usuario: u.id, cursor: null, pend: {}, cfgv: {} };
  if (substituir) {
    for (const store of SINCRONIZADAS) await db.limparRemoto(store);
    for (const chave of Object.values(CONFIGS)) { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } }
  } else {
    await marcarTudo(novo);
    try {
      const d = JSON.parse(localStorage.getItem(CONFIGS.ia));
      const ks = d?.chaves || (d?.chave ? [{ id: 'k1', ...d }] : []);
      if (ks.length) chavesParaMesclar = ks; // junta as chaves deste aparelho às da conta, depois de baixar
    } catch { /* sem chaves */ }
  }
  gravar(novo);
  return true;
}

// ---------------------------------------------------------------- imagens
async function sha256(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const extDe = (mime) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' }[mime] || 'img');
const MIME = { jpg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp' };

/** Troca as imagens embutidas por referências e envia as que ainda não estão na nuvem. */
async function subirImagens(c, u, dados) {
  let json = JSON.stringify(dados);
  const achadas = [...new Set(json.match(RE_IMG) || [])];
  if (!achadas.length) return dados;
  const enviadas = lerImgs(u.id);
  for (const url of achadas) {
    const mime = url.slice(5, url.indexOf(';')).toLowerCase();
    const hash = await sha256(url);
    const nome = `${hash}.${extDe(mime)}`;
    if (!enviadas[hash]) {
      const blob = await (await fetch(url)).blob();
      const { error } = await c.storage.from(BUCKET).upload(`${u.id}/${nome}`, blob, { contentType: mime, upsert: false });
      if (error && !/exists|duplicate|409/i.test(error.message + (error.statusCode || ''))) throw error;
      enviadas[hash] = 1;
      gravarImgs(u.id, enviadas);
    }
    json = json.split(url).join(`prof-img:${nome}`);
  }
  return JSON.parse(json);
}

const cacheImgs = new Map();
const VAZIA = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
function paraDataUrl(blob, mime) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).replace(/^data:[^;]*;/, `data:${mime};`));
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

/** Troca as referências pelas imagens embutidas (baixando da nuvem). */
async function baixarImagens(c, u, dados) {
  let json = JSON.stringify(dados);
  const refs = [...new Set([...json.matchAll(RE_REF)].map((m) => m[0]))];
  if (!refs.length) return dados;
  const enviadas = lerImgs(u.id);
  for (const ref of refs) {
    const [, hash, ext] = ref.match(/prof-img:([0-9a-f]{64})\.([a-z0-9]+)/);
    let url = cacheImgs.get(hash);
    if (!url) {
      const { data, error } = await c.storage.from(BUCKET).download(`${u.id}/${hash}.${ext}`);
      if (error) {
        if (/not.?found|404/i.test(error.message + (error.statusCode || ''))) url = VAZIA; // imagem perdida: não trava a sincronização
        else throw error;
      } else {
        url = await paraDataUrl(data, MIME[ext] || data.type || 'image/png');
        enviadas[hash] = 1;
      }
      cacheImgs.set(hash, url);
    }
    json = json.split(ref).join(url);
  }
  gravarImgs(u.id, enviadas);
  return JSON.parse(json);
}

// ---------------------------------------------------------------- enviar / receber
async function enviar(c, u) {
  const itens = Object.entries(ler().pend || {});
  for (let i = 0; i < itens.length; i += 25) {
    const lote = itens.slice(i, i + 25);
    const linhas = [];
    for (const [k, p] of lote) {
      const [tipo, ...resto] = k.split('/');
      const id = resto.join('/');
      let dados = null, apagado = p.apagado;
      if (!apagado) {
        if (tipo === 'config') {
          let raw = null;
          try { raw = localStorage.getItem(CONFIGS[id]); } catch { /* sem armazenamento */ }
          if (raw === null) apagado = true; else dados = JSON.parse(raw);
        } else {
          const obj = await db.get(tipo, id);
          if (!obj) apagado = true; else dados = obj;
        }
      }
      if (dados) dados = await subirImagens(c, u, dados);
      linhas.push({ usuario: u.id, tipo, id, dados, apagado, atualizado_em: p.v });
    }
    const { error } = await c.from(TABELA).upsert(linhas, { onConflict: 'usuario,tipo,id' });
    if (error) throw error;
    // tira da lista só o que não mudou de novo enquanto enviava
    alterar((s) => { for (const [k, p] of lote) if (s.pend?.[k]?.v === p.v) delete s.pend[k]; });
  }
}

async function receber(c, u) {
  const s = ler();
  let desde = s.cursor ? new Date(new Date(s.cursor).getTime() - 5000).toISOString() : null; // pequena sobreposição
  let ultimo = s.cursor, mudou = false;
  for (;;) {
    let q = c.from(TABELA).select('tipo,id,dados,apagado,atualizado_em,servidor_em').eq('usuario', u.id).order('servidor_em').limit(200);
    if (desde) q = q.gt('servidor_em', desde);
    const { data, error } = await q;
    if (error) throw error;
    for (const r of data) {
      if (await aplicar(c, u, r)) mudou = true;
      desde = ultimo = r.servidor_em;
      alterar((x) => { x.cursor = ultimo; }); // avança aos poucos: se cair a internet, continua daqui
    }
    if (data.length < 200) break;
  }
  return mudou;
}

async function aplicar(c, u, r) {
  const k = `${r.tipo}/${r.id}`;
  const v = Number(r.atualizado_em);
  const p = ler().pend?.[k];
  if (p && p.v >= v) return false; // a alteração deste aparelho é mais nova: será enviada
  const limparPend = () => alterar((s) => { if (s.pend?.[k] && s.pend[k].v < v) delete s.pend[k]; });

  if (r.tipo === 'config') {
    const chave = CONFIGS[r.id];
    if (!chave || v <= (ler().cfgv?.[r.id] || 0)) return false;
    try {
      if (r.apagado || !r.dados) localStorage.removeItem(chave);
      else localStorage.setItem(chave, JSON.stringify(await baixarImagens(c, u, r.dados)));
    } catch { return false; }
    alterar((s) => { (s.cfgv ||= {})[r.id] = v; });
    limparPend();
    return true;
  }
  if (!SINCRONIZADAS.includes(r.tipo)) return false;
  const local = await db.get(r.tipo, r.id);
  if (local && versao(local) >= v) return false;
  if (r.apagado || !r.dados) {
    if (!local) return false;
    await db.delRemoto(r.tipo, r.id);
  } else {
    const obj = await baixarImagens(c, u, r.dados);
    obj.id = r.id;
    obj._v = v;
    await db.putRemoto(r.tipo, obj);
  }
  limparPend();
  return true;
}

// ---------------------------------------------------------------- apagar da nuvem
/** Apaga todos os dados da conta na nuvem (os dados deste aparelho continuam). */
export async function apagarDadosDaNuvem() {
  const u = usuario();
  if (!u) throw new Error('Entre na conta primeiro.');
  const c = await cliente();
  const { error } = await c.from(TABELA).delete().eq('usuario', u.id);
  if (error) throw new Error(traduzir(error));
  for (;;) {
    const { data, error: e2 } = await c.storage.from(BUCKET).list(u.id, { limit: 1000 });
    if (e2) { if (/not.?found/i.test(e2.message)) break; throw new Error(traduzir(e2)); }
    if (!data?.length) break;
    const { error: e3 } = await c.storage.from(BUCKET).remove(data.map((f) => `${u.id}/${f.name}`));
    if (e3) throw new Error(traduzir(e3));
    if (data.length < 1000) break;
  }
  try { localStorage.removeItem(chaveImgs(u.id)); } catch { /* sem armazenamento */ }
  gravar({}); // ao entrar de novo, os dados deste aparelho serão enviados como na primeira vez
}

// ---------------------------------------------------------------- início
let iniciado = false;
export function iniciarSincronizacao() {
  if (iniciado) return;
  iniciado = true;
  window.addEventListener('prof-conta', (e) => { if (e.detail) sincronizar(); else mudar('parado'); });
  window.addEventListener('online', () => agendar(500));
  window.addEventListener('offline', () => { if (usuario()) mudar('offline'); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && usuario() && Date.now() - (estado.quando || 0) > 30000) sincronizar();
  });
  setInterval(() => { if (document.visibilityState === 'visible' && usuario()) sincronizar(); }, 120000);
  if (usuario()) sincronizar();
}
