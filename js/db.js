// Armazenamento local (IndexedDB) — funciona offline, no próprio aparelho.
const DB_NAME = 'prof-avaliacoes';
const DB_VERSION = 1;
export const STORES = ['colecoes', 'resultados', 'questoes', 'avaliacoes'];
/** Coleções enviadas para a nuvem (os resultados dos alunos ficam só no aparelho). */
export const SINCRONIZADAS = ['questoes', 'avaliacoes', 'colecoes'];

/** Versão de um registro (para decidir qual alteração é a mais recente). */
export const versao = (o) => o?._v || o?.atualizadoEm || o?.criadoEm || 0;
const novaVersao = (o) => Math.max(Date.now(), (o?._v || 0) + 1);

// avisa a sincronização sobre cada alteração local
const ouvintes = [];
export const aoMudarDados = (fn) => ouvintes.push(fn);
function avisar(store, id, v, apagado) {
  if (!SINCRONIZADAS.includes(store)) return;
  for (const fn of ouvintes) { try { fn(store, id, v, apagado); } catch (e) { console.error(e); } }
}

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) {
        if (!db.objectStoreNames.contains(s)) {
          const store = db.createObjectStore(s, { keyPath: 'id' });
          if (s === 'resultados') store.createIndex('colecaoId', 'colecaoId');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const db = {
  getAll: (store) => tx(store, 'readonly', (s) => s.getAll()),
  get: (store, id) => tx(store, 'readonly', (s) => s.get(id)),
  /** `manterData`: grava sem mudar "atualizado em" (ex.: marcar como favorito). */
  put: async (store, obj, { manterData = false } = {}) => {
    if (!manterData || !obj.atualizadoEm) obj.atualizadoEm = Date.now();
    if (!obj.criadoEm) obj.criadoEm = obj.atualizadoEm;
    obj._v = novaVersao(obj); // muda sempre (inclusive favoritos), para sincronizar
    const r = await tx(store, 'readwrite', (s) => s.put(obj));
    avisar(store, obj.id, obj._v, false);
    return r;
  },
  del: async (store, id) => {
    const r = await tx(store, 'readwrite', (s) => s.delete(id));
    avisar(store, id, Date.now(), true);
    return r;
  },
  byIndex: (store, index, value) =>
    tx(store, 'readonly', (s) => s.index(index).getAll(value)),
  clear: async (store) => {
    const ids = await tx(store, 'readonly', (s) => s.getAllKeys());
    await tx(store, 'readwrite', (s) => s.clear());
    const v = Date.now();
    for (const id of ids) avisar(store, id, v, true);
  },
  // usados pela sincronização: gravam o que veio da nuvem sem gerar novo envio
  putRemoto: (store, obj) => tx(store, 'readwrite', (s) => s.put(obj)),
  delRemoto: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
  limparRemoto: (store) => tx(store, 'readwrite', (s) => s.clear()),
};

export async function exportarTudo() {
  const out = { app: 'prof-avaliacoes', versao: 1, exportadoEm: new Date().toISOString() };
  for (const s of STORES) out[s] = await db.getAll(s);
  return out;
}

export async function importarTudo(dados) {
  if (!dados || dados.app !== 'prof-avaliacoes') throw new Error('Arquivo de backup inválido.');
  for (const s of STORES) {
    for (const obj of dados[s] || []) {
      obj._v = novaVersao(obj); // importar conta como alteração nova
      await tx(s, 'readwrite', (st) => st.put(obj));
      avisar(s, obj.id, obj._v, false);
    }
  }
}
