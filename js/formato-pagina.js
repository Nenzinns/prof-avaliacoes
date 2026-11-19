// Configuração de página da prova (papel, margens, colunas, parágrafo) e o padrão ABNT.

export const PAPEIS = {
  A4: { nome: 'A4', w: 210, h: 297, desc: '21 × 29,7 cm' },
  oficio: { nome: 'Ofício', w: 216, h: 330, desc: '21,6 × 33 cm' },
  carta: { nome: 'Carta', w: 215.9, h: 279.4, desc: '21,59 × 27,94 cm' },
};

// Predefinições de margens (cm), como no Word, mais a ABNT e uma econômica para provas.
export const MARGENS_PRESET = {
  abnt: { nome: 'ABNT', sup: 3, inf: 2, esq: 3, dir: 2, desc: 'NBR 14724' },
  normal: { nome: 'Normal', sup: 2.5, inf: 2.5, esq: 3, dir: 3 },
  estreita: { nome: 'Estreita', sup: 1.27, inf: 1.27, esq: 1.27, dir: 1.27 },
  moderada: { nome: 'Moderada', sup: 2.54, inf: 2.54, esq: 1.91, dir: 1.91 },
  larga: { nome: 'Larga', sup: 2.54, inf: 2.54, esq: 5.08, dir: 5.08 },
  economica: { nome: 'Econômica', sup: 1.3, inf: 1.3, esq: 1.2, dir: 1.2, desc: 'economiza papel' },
};

/** Padrão ABNT (NBR 14724) aplicado às provas. */
export const PADRAO_ABNT = {
  papel: 'A4', margemPreset: 'abnt', margem: { sup: 3, inf: 2, esq: 3, dir: 2 },
  fonte: 'Arial', tamanho: 12, alinhamento: 'justify', entreLinhas: '1.5', espAntes: 0, espDepois: 0, recuo: 1.25,
  colunas: 1, espacoColunas: 1, linhaColunas: '1', numPagina: '1', posNumPagina: 'topo-dir',
};

const CHAVES_ABNT = ['papel', 'fonte', 'tamanho', 'alinhamento', 'entreLinhas', 'recuo', 'colunas', 'numPagina', 'posNumPagina'];

const cm = (v) => `${(+v).toFixed(2)}cm`;
export const fmtCm = (v) => (+v).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' cm';

/** Margens efetivas (cm) a partir das opções (inclui as opções antigas "estreita/normal/larga"). */
export function margemDe(F) {
  if (F.margem && typeof F.margem === 'object') return F.margem;
  return { estreita: { sup: 0.8, inf: 0.8, esq: 0.8, dir: 0.8 }, larga: { sup: 2, inf: 2, esq: 2, dir: 2 } }[F.margens] || MARGENS_PRESET.economica;
}
export function margemCss(F) { const m = margemDe(F); return `${cm(m.sup)} ${cm(m.dir)} ${cm(m.inf)} ${cm(m.esq)}`; }
export function papelDe(F) { return PAPEIS[F.papel] || PAPEIS.A4; }

/** Verifica se a formatação segue a ABNT. Retorna a lista do que diverge. */
export function divergenciasABNT(av, F) {
  const out = [];
  const m = margemDe(F);
  const a = PADRAO_ABNT.margem;
  if (m.sup !== a.sup || m.inf !== a.inf || m.esq !== a.esq || m.dir !== a.dir) out.push('margens (3, 2, 3, 2 cm)');
  if (!['Arial', 'Times New Roman'].includes(av.fonte)) out.push('fonte Arial ou Times');
  if (+av.tamanho !== 12) out.push('tamanho 12');
  if (F.papel !== 'A4') out.push('papel A4');
  if (F.alinhamento !== 'justify') out.push('texto justificado');
  if (String(F.entreLinhas) !== '1.5') out.push('espaçamento 1,5');
  if (+F.recuo !== 1.25) out.push('recuo de 1,25 cm');
  if (+av.colunas !== 1) out.push('1 coluna');
  if (!F.numPagina || F.posNumPagina !== 'topo-dir') out.push('nº da página no canto superior direito');
  return out;
}

/** Aplica o padrão ABNT a uma avaliação. */
export function aplicarABNT(av) {
  Object.assign(av, structuredClone(PADRAO_ABNT));
  return av;
}

// "Definir como padrão" (como no Word): formatação usada nas próximas avaliações.
const CHAVE_PADRAO = 'prof-formatacao-padrao';
export const CAMPOS_FORMATACAO = ['papel', 'margemPreset', 'margem', 'fonte', 'tamanho', 'alinhamento', 'entreLinhas', 'espAntes', 'espDepois', 'recuo',
  'colunas', 'espacoColunas', 'linhaColunas', 'linhaDivisoria', 'espacoQuestoes', 'numPagina', 'posNumPagina', 'caixaTexto',
  'rotulo', 'caixaRotulo', 'zeros', 'sufixo', 'estiloNum', 'posNum', 'estiloAlt', 'letraNegrito', 'dispoAlt'];

export function definirComoPadrao(av) {
  const dados = Object.fromEntries(CAMPOS_FORMATACAO.filter((k) => av[k] !== undefined).map((k) => [k, structuredClone(av[k])]));
  try { localStorage.setItem(CHAVE_PADRAO, JSON.stringify(dados)); return true; } catch { return false; }
}
export function padraoUsuario() {
  try { const s = localStorage.getItem(CHAVE_PADRAO); return s ? JSON.parse(s) : null; } catch { return null; }
}
export function restaurarPadraoABNT() { try { localStorage.removeItem(CHAVE_PADRAO); } catch { /* sem armazenamento */ } }

/** Formatação inicial de uma nova avaliação: a do usuário (se definida) ou a ABNT. */
export function formatacaoInicial() {
  return { ...structuredClone(PADRAO_ABNT), ...(padraoUsuario() || {}) };
}

export { CHAVES_ABNT };
