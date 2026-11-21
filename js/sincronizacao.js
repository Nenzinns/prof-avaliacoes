// Sincronização entre os aparelhos de quem entrou na conta, como mensagens:
// o servidor NÃO guarda os dados, só entrega. Cada aparelho tem uma "caixa de correio" no Supabase.
// - Cada alteração local fica numa lista de "pendentes" e é colocada na caixa de cada um dos outros aparelhos.
// - Ao abrir, o aparelho pega o que está na sua caixa, aplica e APAGA do servidor (registro e imagens).
// - Aparelho novo: um aparelho que já está na conta manda uma cópia completa assim que for aberto.
// - O que fica esperando mais de 30 dias é apagado; o aparelho recebe depois uma cópia completa.
// - Vale sempre a versão mais recente; o que foi apagado num aparelho é apagado nos outros.
// - Sincroniza: questões, avaliações, gabaritos, chaves de IA e formatação padrão. Resultados dos alunos não.
import { db, SINCRONIZADAS, aoMudarDados, versao } from './db.js';
import { cliente, usuario, sair } from './conta.js';
import { h, modal, toast } from './ui.js';

const LS = 'prof-sync';
const LS_APARELHO = 'prof-aparelho';
const CONFIGS = { ia: 'prof-ia', formato: 'prof-formatacao-padrao' };
const BUCKET = 'imagens';
const CAIXA = 'caixa';
const APARELHOS = 'aparelhos';
const ANTIGA = 'registros'; // tabela da versão anterior (dados guardados): importada uma vez e apagada
const DIAS_ESPERA = 30;
const RE_IMG = /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi;
const RE_REF = /prof-img:([a-z0-9]+-[0-9a-f]{64}\.[a-z0-9]+)/g;
const RE_REF_ANTIGA = /prof-img:([0-9a-f]{64})\.([a-z0-9]+)/g;

// ---------------------------------------------------------------- estado salvo
// { usuario, registrado, migrado, limpezaEm, pend: { 'tipo/id': { v, apagado } }, cfgv: { ia: v, formato: v } }
function ler() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } }
function gravar(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* sem armazenamento */ } }
function alterar(fn) { const s = ler(); fn(s); gravar(s); return s; }

/** Identificador deste aparelho (criado na primeira vez). */
export function idAparelho() {
  let id = null;
  try { id = localStorage.getItem(LS_APARELHO); } catch { /* sem armazenamento */ }
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => ((Math.random() * 16) | (c === 'x' ? 0 : 8)).toString(16));
    try { localStorage.setItem(LS_APARELHO, id); } catch { /* sem armazenamento */ }
  }
  return id;
}

/** Nome amigável do aparelho, ex.: "Android · Chrome". */
function nomeAparelho() {
  const ua = navigator.userAgent;
  const so = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Aparelho';
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return nav ? `${so} · ${nav}` : so;
}

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
let outrosAparelhos = null; // quantos outros aparelhos estão na conta (null = ainda não sabe)
export const estadoSync = () => estado;
export const pendentes = () => Object.keys(ler().pend || {}).length;
export const qtdOutrosAparelhos = () => outrosAparelhos;
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

/** Entrega o que está pendente e recebe o que chegou de outros aparelhos. */
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
    if (!(await registrar(c, u))) return; // aparelho desconectado em outro aparelho
    let mudou = false;
    if (!ler().migrado) mudou = (await migrarAntiga(c, u)) || mudou;
    const outros = await listarOutros(c, u);
    await enviarCopiasCompletas(c, u, outros);
    await enviar(c, u, outros);
    mudou = (await receber(c, u)) || mudou;
    await mesclarChavesIA();
    await limpeza(c, u);
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
  if (e?.code === 'PGRST205' || e?.code === '42P01' || /caixa|aparelhos|relation .* does not exist|schema cache/i.test(m)) {
    return 'A nuvem ainda não foi preparada (falta executar o SQL novo no Supabase).';
  }
  if (/bucket not found/i.test(m)) return 'A pasta de imagens da nuvem não foi criada (falta executar o SQL no Supabase).';
  if (/jwt|session|not authenticated|401/i.test(m)) return 'A sessão expirou. Saia e entre de novo na conta.';
  if (/failed to fetch|network|load failed/i.test(m)) return 'Sem conexão com a nuvem.';
  if (/quota|exceeded|too large|413/i.test(m)) return 'O espaço da nuvem acabou ou o item é grande demais.';
  return m;
}

// ---------------------------------------------------------------- aparelhos
/** Registra este aparelho na conta (ou atualiza "visto em"). Devolve false se ele foi desconectado. */
async function registrar(c, u) {
  const me = idAparelho();
  const { data, error } = await c.from(APARELHOS).update({ visto_em: new Date().toISOString(), nome: nomeAparelho() }).eq('id', me).select('id');
  if (error) throw error;
  if (data?.length) return true;
  if (ler().registrado) {
    // estava registrado e outro aparelho o desconectou: sai da conta (os dados deste aparelho continuam aqui)
    esquecerRegistro();
    await sair().catch(() => {});
    mudar('parado');
    toast('Este aparelho foi desconectado da conta em outro aparelho.', 'erro');
    return false;
  }
  // primeira vez: se já houver outros aparelhos, pede a eles uma cópia completa
  const { count, error: e1 } = await c.from(APARELHOS).select('id', { count: 'exact', head: true }).neq('id', me);
  if (e1) throw e1;
  let { error: e2 } = await c.from(APARELHOS).insert({ id: me, nome: nomeAparelho(), precisa_copia: (count || 0) > 0 });
  if (e2?.code === '23505') {
    // identificador ainda registrado em outra conta (a saída anterior não chegou ao servidor): usa um novo
    try { localStorage.removeItem(LS_APARELHO); } catch { /* sem armazenamento */ }
    ({ error: e2 } = await c.from(APARELHOS).insert({ id: idAparelho(), nome: nomeAparelho(), precisa_copia: (count || 0) > 0 }));
  }
  if (e2) throw e2;
  alterar((s) => { s.registrado = true; });
  return true;
}

async function listarOutros(c) {
  const { data, error } = await c.from(APARELHOS).select('id,precisa_copia').neq('id', idAparelho());
  if (error) throw error;
  outrosAparelhos = data.length;
  return data;
}

/** Lista os aparelhos da conta (para a tela de Configurações). */
export async function listarAparelhos() {
  const c = await cliente();
  const { data, error } = await c.from(APARELHOS).select('id,nome,criado_em,visto_em').order('visto_em', { ascending: false });
  if (error) throw new Error(traduzir(error));
  return data.map((a) => ({ ...a, este: a.id === idAparelho() }));
}

/** Desconecta outro aparelho: apaga o registro dele, a caixa e as imagens que esperavam por ele. */
export async function desconectarAparelho(id) {
  const u = usuario();
  if (!u) throw new Error('Entre na conta primeiro.');
  const c = await cliente();
  await esvaziarCaixa(c, u, id);
  const { error } = await c.from(APARELHOS).delete().eq('id', id);
  if (error) throw new Error(traduzir(error));
  sincronizar();
}

/** Pede de novo uma cópia completa para este aparelho (útil se algo ficou faltando). */
export async function pedirCopiaCompleta() {
  const c = await cliente();
  const { error } = await c.from(APARELHOS).update({ precisa_copia: true }).eq('id', idAparelho());
  if (error) throw new Error(traduzir(error));
}

/** Ao sair da conta: tira este aparelho da lista e apaga o que esperava por ele. */
export async function removerEsteAparelho() {
  const u = usuario();
  if (!u) return;
  try {
    const c = await cliente();
    await esvaziarCaixa(c, u, idAparelho());
    await c.from(APARELHOS).delete().eq('id', idAparelho());
  } catch (e) { console.error(e); }
  esquecerRegistro();
}

/** Esquece o registro deste aparelho, mas mantém a conta anterior e as alterações ainda não enviadas. */
function esquecerRegistro() {
  const s = ler();
  gravar({ usuario: s.usuario, pend: s.pend, cfgv: s.cfgv });
}

async function esvaziarCaixa(c, u, para) {
  const { error } = await c.from(CAIXA).delete().eq('para', para);
  if (error) throw new Error(traduzir(error));
  await apagarPasta(c, `${u.id}/${para}`);
}

async function apagarPasta(c, pasta, filtro = () => true) {
  for (;;) {
    const { data, error } = await c.storage.from(BUCKET).list(pasta, { limit: 1000 });
    if (error) { if (/not.?found/i.test(error.message)) return; throw error; }
    const arquivos = (data || []).filter((f) => f.id && filtro(f));
    if (!arquivos.length) return;
    const { error: e2 } = await c.storage.from(BUCKET).remove(arquivos.map((f) => `${pasta}/${f.name}`));
    if (e2) throw e2;
    if (data.length < 1000) return;
  }
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
    // versão baixa: se os outros aparelhos já tiverem esta configuração, a deles prevalece
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
  // chaves recebidas + as deste aparelho que ainda não estavam lá; depois envia a lista junta
  const lista = [...atual, ...locais.filter((k) => !atual.some((a) => a.chave === k.chave))];
  if (lista.length === atual.length && atual.length) return;
  try { localStorage.setItem(CONFIGS.ia, JSON.stringify({ chaves: lista })); } catch { return; }
  window.dispatchEvent(new CustomEvent('prof-config-mudou', { detail: 'ia' }));
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
          h('li', {}, h('b', {}, 'Juntar: '), 'envia também os dados deste aparelho para os aparelhos desta conta.'),
          h('li', {}, h('b', {}, 'Substituir: '), 'apaga os dados deste aparelho e recebe os desta conta.'))),
      acoes: [{ label: 'Cancelar', value: null }, { label: 'Substituir', danger: true, value: 'sub' }, { label: 'Juntar', primary: true, value: 'juntar' }],
    });
    if (!r) return false;
    substituir = r === 'sub';
  }
  const novo = { usuario: u.id, pend: {}, cfgv: {} };
  if (substituir) {
    for (const store of SINCRONIZADAS) await db.limparRemoto(store);
    for (const chave of Object.values(CONFIGS)) { try { localStorage.removeItem(chave); } catch { /* sem armazenamento */ } }
  } else {
    await marcarTudo(novo);
    try {
      const d = JSON.parse(localStorage.getItem(CONFIGS.ia));
      const ks = d?.chaves || (d?.chave ? [{ id: 'k1', ...d }] : []);
      if (ks.length) chavesParaMesclar = ks; // junta as chaves deste aparelho às recebidas
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
const nonce = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Separa as imagens embutidas de um item: devolve o JSON com referências e a lista de imagens. */
async function prepararImagens(dados) {
  let json = JSON.stringify(dados);
  const achadas = [...new Set(json.match(RE_IMG) || [])];
  if (!achadas.length) return { json, imagens: [] };
  const n = nonce();
  const imagens = [];
  for (const url of achadas) {
    const mime = url.slice(5, url.indexOf(';')).toLowerCase();
    const nome = `${n}-${await sha256(url)}.${extDe(mime)}`;
    imagens.push({ nome, url, mime });
    json = json.split(url).join(`prof-img:${nome}`);
  }
  return { json, imagens };
}

/** Envia as imagens de um item para a pasta do aparelho de destino. */
async function subirImagens(c, u, para, imagens) {
  for (const im of imagens) {
    const blob = await (await fetch(im.url)).blob();
    const { error } = await c.storage.from(BUCKET).upload(`${u.id}/${para}/${im.nome}`, blob, { contentType: im.mime, upsert: true });
    if (error) throw error;
  }
}

const VAZIA = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
function paraDataUrl(blob, mime) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result).replace(/^data:[^;]*;/, `data:${mime};`));
    fr.onerror = rej;
    fr.readAsDataURL(blob);
  });
}

async function baixarArquivo(c, caminho, ext) {
  const { data, error } = await c.storage.from(BUCKET).download(caminho);
  if (error) {
    if (/not.?found|404|400/i.test(error.message + (error.statusCode || ''))) return VAZIA; // imagem perdida: não trava a sincronização
    throw error;
  }
  return paraDataUrl(data, MIME[ext] || data.type || 'image/png');
}

/** Troca as referências pelas imagens embutidas (baixando da caixa deste aparelho). Devolve também os arquivos usados. */
async function baixarImagens(c, u, dados) {
  let json = JSON.stringify(dados);
  const nomes = [...new Set([...json.matchAll(RE_REF)].map((m) => m[1]))];
  const pasta = `${u.id}/${idAparelho()}`;
  for (const nome of nomes) {
    const url = await baixarArquivo(c, `${pasta}/${nome}`, nome.split('.').pop());
    json = json.split(`prof-img:${nome}`).join(url);
  }
  return { dados: JSON.parse(json), arquivos: nomes.map((n) => `${pasta}/${n}`) };
}

// ---------------------------------------------------------------- enviar
/** Monta o conteúdo de um item pendente (null = apagado). */
async function conteudo(tipo, id, apagado) {
  if (apagado) return null;
  if (tipo === 'config') {
    let raw = null;
    try { raw = localStorage.getItem(CONFIGS[id]); } catch { /* sem armazenamento */ }
    return raw === null ? null : JSON.parse(raw);
  }
  return (await db.get(tipo, id)) || null;
}

/** Coloca os itens na caixa de cada aparelho de destino. itens: [[chave, { v, apagado }]] */
async function entregar(c, u, destinos, itens, { tirarDosPendentes = true } = {}) {
  const me = idAparelho();
  for (let i = 0; i < itens.length; i += 25) {
    const lote = itens.slice(i, i + 25);
    const linhas = [];
    for (const [k, p] of lote) {
      const [tipo, ...resto] = k.split('/');
      const id = resto.join('/');
      const dados = await conteudo(tipo, id, p.apagado);
      const prep = dados ? await prepararImagens(dados) : null;
      for (const para of destinos) {
        let json = prep?.json ?? null;
        if (prep?.imagens.length) {
          // cada entrega tem as próprias imagens: quem recebe apaga sem afetar os outros
          const n = nonce();
          const imagens = prep.imagens.map((im) => ({ ...im, nome: im.nome.replace(/^[a-z0-9]+-/, `${n}-`) }));
          imagens.forEach((im, j) => { json = json.split(`prof-img:${prep.imagens[j].nome}`).join(`prof-img:${im.nome}`); });
          await subirImagens(c, u, para, imagens);
        }
        linhas.push({ para, de: me, tipo, item_id: id, dados: json ? JSON.parse(json) : null, apagado: !json, versao: p.v });
      }
    }
    if (linhas.length) {
      const { error } = await c.from(CAIXA).insert(linhas);
      if (error) throw error;
    }
    await yield_(); // deixa a interface respirar entre lotes
    // tira da lista só o que não mudou de novo enquanto enviava
    if (tirarDosPendentes) alterar((s) => { for (const [k, p] of lote) if (s.pend?.[k]?.v === p.v) delete s.pend[k]; });
  }
}
const yield_ = () => new Promise((r) => setTimeout(r, 0));

async function enviar(c, u, outros) {
  const itens = Object.entries(ler().pend || {});
  if (!itens.length) return;
  // sem outros aparelhos não há para quem entregar (um aparelho novo recebe a cópia completa)
  if (!outros.length) {
    alterar((s) => { for (const [k, p] of itens) if (s.pend?.[k]?.v === p.v) delete s.pend[k]; });
    return;
  }
  await entregar(c, u, outros.map((a) => a.id), itens);
}

/** Manda uma cópia completa para os aparelhos novos (ou que ficaram muito tempo sem abrir). */
async function enviarCopiasCompletas(c, u, outros) {
  for (const a of outros.filter((x) => x.precisa_copia)) {
    // "reserva" o pedido: se outro aparelho já estiver enviando, este não envia de novo
    const { data, error } = await c.from(APARELHOS).update({ precisa_copia: false }).eq('id', a.id).eq('precisa_copia', true).select('id');
    if (error) throw error;
    if (!data?.length) continue;
    try {
      const tudo = {};
      await marcarTudo(tudo);
      for (const id of Object.keys(CONFIGS)) {
        let tem = false;
        try { tem = localStorage.getItem(CONFIGS[id]) !== null; } catch { /* sem armazenamento */ }
        if (tem) tudo.pend[`config/${id}`] = { v: ler().cfgv?.[id] || 1, apagado: false };
      }
      // entrega sem mexer na lista de pendentes deste aparelho (eles ainda vão para os outros)
      await entregar(c, u, [a.id], Object.entries(tudo.pend), { tirarDosPendentes: false });
    } catch (e) {
      await c.from(APARELHOS).update({ precisa_copia: true }).eq('id', a.id); // tenta de novo depois
      throw e;
    }
  }
}

// ---------------------------------------------------------------- receber
async function receber(c, u) {
  const me = idAparelho();
  let mudou = false;
  for (;;) {
    const { data, error } = await c.from(CAIXA).select('id,tipo,item_id,dados,apagado,versao').eq('para', me).order('id').limit(100);
    if (error) throw error;
    if (!data.length) break;
    const arquivos = [];
    for (const r of data) {
      const res = await aplicar(c, u, r);
      if (res.mudou) mudou = true;
      arquivos.push(...res.arquivos);
    }
    // recebido: apaga do servidor o registro e as imagens
    const { error: e2 } = await c.from(CAIXA).delete().in('id', data.map((r) => r.id));
    if (e2) throw e2;
    if (arquivos.length) await c.storage.from(BUCKET).remove(arquivos).catch(() => {});
    if (data.length < 100) break;
  }
  return mudou;
}

async function aplicar(c, u, r) {
  const nada = { mudou: false, arquivos: [] };
  const k = `${r.tipo}/${r.item_id}`;
  const v = Number(r.versao);
  const p = ler().pend?.[k];
  // a alteração deste aparelho é mais nova: será enviada (mas as imagens recebidas são apagadas)
  const soArquivos = () => ({ mudou: false, arquivos: [...JSON.stringify(r.dados || '').matchAll(RE_REF)].map((m) => `${u.id}/${idAparelho()}/${m[1]}`) });
  if (p && p.v >= v) return soArquivos();
  const limparPend = () => alterar((s) => { if (s.pend?.[k] && s.pend[k].v < v) delete s.pend[k]; });

  if (r.tipo === 'config') {
    const chave = CONFIGS[r.item_id];
    if (!chave || v <= (ler().cfgv?.[r.item_id] || 0)) return chave ? soArquivos() : nada;
    let arquivos = [];
    try {
      if (r.apagado || !r.dados) localStorage.removeItem(chave);
      else { const b = await baixarImagens(c, u, r.dados); arquivos = b.arquivos; localStorage.setItem(chave, JSON.stringify(b.dados)); }
    } catch { return soArquivos(); }
    alterar((s) => { (s.cfgv ||= {})[r.item_id] = v; });
    limparPend();
    return { mudou: true, arquivos };
  }
  if (!SINCRONIZADAS.includes(r.tipo)) return soArquivos();
  const local = await db.get(r.tipo, r.item_id);
  if (local && versao(local) >= v) return soArquivos();
  if (r.apagado || !r.dados) {
    if (!local) return nada;
    await db.delRemoto(r.tipo, r.item_id);
    limparPend();
    return { mudou: true, arquivos: [] };
  }
  const b = await baixarImagens(c, u, r.dados);
  const obj = b.dados;
  obj.id = r.item_id;
  obj._v = v;
  await db.putRemoto(r.tipo, obj);
  limparPend();
  return { mudou: true, arquivos: b.arquivos };
}

// ---------------------------------------------------------------- versão anterior (dados guardados na nuvem)
/** Importa uma vez o que estava guardado no modelo antigo e apaga tudo do servidor. */
async function migrarAntiga(c, u) {
  let mudou = false;
  let desde = null;
  for (;;) {
    let q = c.from(ANTIGA).select('tipo,id,dados,apagado,atualizado_em,servidor_em').eq('usuario', u.id).order('servidor_em').limit(200);
    if (desde) q = q.gt('servidor_em', desde);
    const { data, error } = await q;
    if (error) {
      if (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message)) break; // não existe mais
      throw error;
    }
    for (const r of data) {
      if (r.dados) r.dados = await embutirAntigas(c, u, r.dados);
      const res = await aplicar(c, u, { tipo: r.tipo, item_id: r.id, dados: r.dados, apagado: r.apagado, versao: r.atualizado_em });
      if (res.mudou) mudou = true;
      desde = r.servidor_em;
    }
    if (data.length < 200) break;
  }
  const { error: e1 } = await c.from(ANTIGA).delete().eq('usuario', u.id);
  if (e1 && !(e1.code === 'PGRST205' || e1.code === '42P01' || /does not exist|schema cache/i.test(e1.message))) throw e1;
  await apagarPasta(c, u.id); // só os arquivos soltos do modelo antigo (as pastas dos aparelhos ficam)
  try { localStorage.removeItem('prof-sync-imgs-' + u.id); } catch { /* sem armazenamento */ }
  alterar((s) => { s.migrado = true; });
  return mudou;
}

async function embutirAntigas(c, u, dados) {
  let json = JSON.stringify(dados);
  const refs = [...new Set([...json.matchAll(RE_REF_ANTIGA)].map((m) => m[0]))];
  for (const ref of refs) {
    const [, hash, ext] = ref.match(/prof-img:([0-9a-f]{64})\.([a-z0-9]+)/);
    json = json.split(ref).join(await baixarArquivo(c, `${u.id}/${hash}.${ext}`, ext));
  }
  return JSON.parse(json);
}

// ---------------------------------------------------------------- limpeza (no máximo uma vez por dia)
async function limpeza(c, u) {
  const s = ler();
  if (s.limpezaEm && Date.now() - s.limpezaEm < 86400000) return;
  const limite = new Date(Date.now() - DIAS_ESPERA * 86400000).toISOString();
  // aparelhos parados há mais de 30 dias: apaga o que esperava por eles; ao voltar, recebem cópia completa
  const { data, error } = await c.from(APARELHOS).select('id').lt('visto_em', limite).neq('id', idAparelho());
  if (error) throw error;
  for (const a of data) {
    await esvaziarCaixa(c, u, a.id);
    await c.from(APARELHOS).update({ precisa_copia: true }).eq('id', a.id);
  }
  // imagens soltas na pasta deste aparelho (entregas que não chegaram a ser concluídas)
  const umaHora = Date.now() - 3600000;
  await apagarPasta(c, `${u.id}/${idAparelho()}`, (f) => new Date(f.created_at || f.updated_at || 0).getTime() < umaHora).catch(() => {});
  alterar((x) => { x.limpezaEm = Date.now(); });
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
