// Armazenamento local (IndexedDB) — funciona offline, no próprio aparelho.
const DB_NAME = 'prof-avaliacoes';
const DB_VERSION = 1;
export const STORES = ['colecoes', 'resultados', 'questoes', 'avaliacoes'];

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
  put: (store, obj, { manterData = false } = {}) => {
    if (!manterData || !obj.atualizadoEm) obj.atualizadoEm = Date.now();
    if (!obj.criadoEm) obj.criadoEm = obj.atualizadoEm;
    return tx(store, 'readwrite', (s) => s.put(obj));
  },
  del: (store, id) => tx(store, 'readwrite', (s) => s.delete(id)),
  byIndex: (store, index, value) =>
    tx(store, 'readonly', (s) => s.index(index).getAll(value)),
  clear: (store) => tx(store, 'readwrite', (s) => s.clear()),
};

export async function exportarTudo() {
  const out = { app: 'prof-avaliacoes', versao: 1, exportadoEm: new Date().toISOString() };
  for (const s of STORES) out[s] = await db.getAll(s);
  return out;
}

export async function importarTudo(dados) {
  if (!dados || dados.app !== 'prof-avaliacoes') throw new Error('Arquivo de backup inválido.');
  for (const s of STORES) {
    for (const obj of dados[s] || []) await tx(s, 'readwrite', (st) => st.put(obj));
  }
}
