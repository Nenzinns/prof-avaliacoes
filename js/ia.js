// Geração de questões com IA usando a chave do próprio professor.
// O serviço é reconhecido pelo formato da chave e o modelo é escolhido automaticamente
// (consultando a lista de modelos do serviço, sem mostrar nada ao usuário).
// A chave fica salva só neste navegador (localStorage) e não entra no backup.
import { h, modal, campo, esc } from './ui.js';
import { ACEITOS, ehPdf, abrirPdf, tamanho, prepararAnexos } from './anexos.js';

const CHAVE_LS = 'prof-ia';

export const NOMES = { gemini: 'Google Gemini', groq: 'Groq', openrouter: 'OpenRouter', openai: 'OpenAI', anthropic: 'Anthropic (Claude)', mistral: 'Mistral' };

/** Lista de chaves em ordem de prioridade: [{ id, chave, provedor, modelo, reservas }]. */
export function lerChaves() {
  let dados = null;
  try { dados = JSON.parse(localStorage.getItem(CHAVE_LS)); } catch { /* sem armazenamento */ }
  if (!dados) return [];
  if (dados.chave) return [{ id: 'k1', ...dados }]; // formato antigo: uma chave só
  return Array.isArray(dados.chaves) ? dados.chaves : [];
}
function gravarChaves(lista) {
  try { lista.length ? localStorage.setItem(CHAVE_LS, JSON.stringify({ chaves: lista })) : localStorage.removeItem(CHAVE_LS); } catch { /* sem armazenamento */ }
}
export const temChave = () => lerChaves().length > 0;
export function removerChave(id) { gravarChaves(lerChaves().filter((k) => k.id !== id)); }
/** Reordena conforme a lista de ids (primeiro = maior prioridade). */
export function reordenarChaves(ids) {
  const mapa = new Map(lerChaves().map((k) => [k.id, k]));
  gravarChaves(ids.map((id) => mapa.get(id)).filter(Boolean));
}
function atualizarChave(id, campos) {
  gravarChaves(lerChaves().map((k) => (k.id === id ? { ...k, ...campos } : k)));
}
/** Chave com o meio escondido, para mostrar na tela. */
export const mascarar = (chave) => (chave.length > 10 ? chave.slice(0, 4) + '…' + chave.slice(-4) : '••••');

// ------------------------------------------------------------------ serviços
const OPENAI_COMPAT = {
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  openai: 'https://api.openai.com/v1',
  mistral: 'https://api.mistral.ai/v1',
};

/** Serviços prováveis para a chave, na ordem em que serão testados. */
function detectar(chave) {
  if (chave.startsWith('AIza') || chave.startsWith('AQ.')) return ['gemini'];
  if (chave.startsWith('gsk_')) return ['groq'];
  if (chave.startsWith('sk-or-')) return ['openrouter'];
  if (chave.startsWith('sk-ant-')) return ['anthropic'];
  if (chave.startsWith('sk-')) return ['openai'];
  // formato desconhecido (ex.: Mistral não usa prefixo; o Google às vezes muda o formato): testa cada um
  return ['mistral', 'gemini', 'anthropic', 'openai'];
}

async function pedir(url, opts) {
  let r;
  try { r = await fetch(url, opts); } catch (e) {
    if (opts?.signal?.aborted) throw opts.signal.reason || e;
    throw new Error('Sem conexão com o serviço de IA. Verifique a internet.');
  }
  const txt = await r.text();
  let j = null;
  try { j = JSON.parse(txt); } catch { /* resposta não-JSON */ }
  if (!r.ok) {
    const msg = j?.error?.message || j?.message || (typeof j?.error === 'string' ? j.error : '') || txt.slice(0, 200);
    const e = new Error(
      r.status === 413 || (r.status === 400 && /too large|too long|context.length|maximum context|tokens? (exceed|limit)/i.test(msg)) ? 'O material anexado é grande demais para este serviço de IA. Indique só as páginas necessárias ou use uma chave do Google Gemini.'
        : r.status === 401 || r.status === 403 || (r.status === 400 && /api[ _-]?key/i.test(msg)) ? 'A chave foi recusada pelo serviço de IA. Confira se ela foi copiada inteira.'
        : r.status === 429 ? 'Limite de uso da IA atingido. Aguarde alguns minutos e tente de novo.'
          : r.status === 402 ? 'O serviço de IA informa que não há saldo/créditos nesta conta.'
            : r.status === 503 || r.status === 529 || r.status === 500 ? 'O serviço de IA está sobrecarregado agora. Tente de novo em alguns minutos.'
              : `Erro do serviço de IA (${r.status}): ${msg}`);
    e.status = r.status; e.detalhe = msg;
    throw e;
  }
  return j;
}

const cabecalhos = (prov, chave) => {
  if (prov === 'gemini') return { 'x-goog-api-key': chave, 'content-type': 'application/json' };
  if (prov === 'anthropic') return { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true', 'content-type': 'application/json' };
  return { authorization: `Bearer ${chave}`, 'content-type': 'application/json' };
};

const versao = (s) => { const m = s.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
const porVersao = (lista) => [...lista].sort((a, b) => versao(b) - versao(a));
/** Junta listas em ordem de preferência, sem repetir, até 5 modelos. */
const ranking = (...listas) => [...new Set(listas.flat().filter(Boolean))].slice(0, 5);

/** Lista os modelos do serviço e devolve os adequados para gerar texto, do preferido ao reserva. */
async function escolherModelos(prov, chave) {
  if (prov === 'gemini') {
    const j = await pedir('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000', { headers: cabecalhos(prov, chave) });
    const ids = (j.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => /^gemini-\d/.test(n) && !/(tts|image|embed|live|audio|robotics|computer|transcribe|omni|thinking-exp|learnlm|customtools)/.test(n));
    const estaveis = ids.filter((n) => !/(preview|exp|latest|\d{3,})/.test(n));
    const flash = porVersao(estaveis.filter((n) => /-flash$/.test(n)));
    // o mais novo costuma ficar sobrecarregado no plano grátis: reservas são versões anteriores e o "lite"
    return ranking(flash, porVersao(estaveis.filter((n) => /-flash-lite$/.test(n))).slice(0, 1),
      ids.includes('gemini-flash-latest') && 'gemini-flash-latest', porVersao(ids.filter((n) => /flash/.test(n))));
  }
  if (prov === 'anthropic') {
    const j = await pedir('https://api.anthropic.com/v1/models?limit=100', { headers: cabecalhos(prov, chave) });
    const ids = (j.data || []).map((m) => m.id); // já vem do mais novo para o mais antigo
    return ranking(ids.filter((i) => /opus/.test(i)).slice(0, 1), ids.filter((i) => /sonnet/.test(i)).slice(0, 1), ids.filter((i) => /haiku/.test(i)).slice(0, 1));
  }
  const j = await pedir(`${OPENAI_COMPAT[prov]}/models`, { headers: cabecalhos(prov, chave) });
  const ids = (j.data || []).map((m) => m.id);
  const naoTexto = /(whisper|tts|embed|guard|moderation|audio|realtime|image|dall|transcribe|search|vision|ocr|instruct|davinci|babbage|codex|compound|distil)/;
  const texto = ids.filter((i) => !naoTexto.test(i));
  if (prov === 'openai') {
    return ranking(porVersao(texto.filter((i) => /^gpt-\d+(\.\d+)?-mini$/.test(i))), porVersao(texto.filter((i) => /^gpt-\d+(\.\d+)?$/.test(i))));
  }
  if (prov === 'groq') {
    return ranking(texto.filter((i) => /gpt-oss-120b/.test(i)), texto.filter((i) => /llama-3\.3-70b/.test(i)), texto.filter((i) => /70b|120b|maverick|gpt-oss/.test(i)), texto[0]);
  }
  if (prov === 'openrouter') {
    // só modelos gratuitos, para nunca gerar cobrança sem o professor saber
    const gratis = texto.filter((i) => i.endsWith(':free'));
    return ranking(ids.includes('openrouter/free') && 'openrouter/free', gratis.filter((i) => /gemini|gpt-oss|deepseek|llama-3\.3-70b|qwen/.test(i)), gratis);
  }
  if (prov === 'mistral') {
    return ranking(['mistral-medium-latest', 'mistral-large-latest', 'mistral-small-latest'].filter((i) => ids.includes(i)), texto.filter((i) => /mistral/.test(i)));
  }
  return ranking(texto);
}

/** Verifica a chave e descobre o serviço e os modelos (não salva). */
async function analisarChave(chave) {
  const candidatos = detectar(chave);
  let prov, modelos, erro;
  for (const p of candidatos) {
    try { modelos = await escolherModelos(p, chave); prov = p; break; } catch (e) {
      erro = e;
      if (![400, 401, 403].includes(e.status)) throw e; // sem internet, limite… não adianta testar outro serviço
    }
  }
  if (!prov) {
    throw candidatos.length > 1 ? new Error('Não reconheci esta chave em nenhum serviço de IA. Confira se ela foi copiada inteira.') : erro;
  }
  if (!modelos.length) throw new Error('A chave funciona, mas não encontrei um modelo de texto disponível nesta conta.');
  return { provedor: prov, modelo: modelos[0], reservas: modelos.slice(1) };
}

/** Verifica e adiciona uma chave no fim da fila de prioridade. */
export async function adicionarChave(chave) {
  chave = chave.trim();
  if (!chave) throw new Error('Cole a chave da API.');
  if (lerChaves().some((k) => k.chave === chave)) throw new Error('Esta chave já está na lista.');
  const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), chave, ...(await analisarChave(chave)) };
  gravarChaves([...lerChaves(), item]);
  return item;
}

// ------------------------------------------------------------------ chamada
const SISTEMA = 'Você é um professor experiente que elabora questões de múltipla escolha para avaliações escolares brasileiras. ' +
  'Escreva em português do Brasil, com linguagem adequada à série indicada. Cada questão tem exatamente uma alternativa correta; ' +
  'os distratores devem ser plausíveis, baseados em erros comuns dos alunos, e claramente incorretos para quem domina o conteúdo. ' +
  'Responda somente com JSON válido, sem texto antes ou depois e sem blocos de código.';

function montarPedido(p, material) {
  const linhas = [
    material?.texto && `Material de referência enviado pelo professor:\n<material>\n${material.texto}\n</material>\n`,
    material?.imagens?.length && `As ${material.imagens.length} imagem(ns) anexada(s) também fazem parte do material de referência (páginas de livro, fotos, etc.).\n`,
    `Crie ${p.quantidade} questão(ões) de múltipla escolha.`,
    p.disciplina && `Disciplina: ${p.disciplina}`,
    p.assunto && `Assunto/conteúdo: ${p.assunto}`,
    p.serie && `Série/ano: ${p.serie}`,
    p.dificuldade && `Dificuldade: ${p.dificuldade}`,
    `Cada questão deve ter ${p.alternativas} alternativas: 1 correta e ${p.alternativas - 1} distratores.`,
    p.observacao && `Orientações do professor: ${p.observacao}`,
    material && 'Elabore as questões com base no material de referência: use os conceitos, exemplos, a terminologia e o nível de aprofundamento dele, ' +
      'sem cobrar conteúdo que não esteja no material (a menos que as orientações peçam). Os textos de apoio podem citar ou adaptar trechos do material.',
    '\nFormato da resposta (JSON):',
    '{"questoes":[{"comando":"enunciado da questão","correta":"texto da alternativa correta","distratores":["alternativa errada", "..."]}]}',
    '\nRegras: não escreva letras (A, B, C…) no início das alternativas; elas são colocadas pelo aplicativo. ' +
    'Pode usar estas marcações HTML simples quando ajudarem: <b>, <i>, <sub>, <sup>, <br>, <ul>/<ol>/<li> e <table> com <tr>/<th>/<td>. ' +
    'Não use imagens nem LaTeX; escreva fórmulas com <sup>/<sub> e símbolos Unicode (√, π, ≤, ×, ÷).',
  ];
  return linhas.filter(Boolean).join('\n');
}

async function chamar(cfg, pedido, sinal, imagens = []) {
  const { provedor: prov, chave, modelo } = cfg;
  if (prov === 'gemini') {
    const j = await pedir(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST', signal: sinal, headers: cabecalhos(prov, chave),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SISTEMA }] },
        contents: [{ role: 'user', parts: [...imagens.map((im) => ({ inlineData: { mimeType: im.mime, data: im.dados } })), { text: pedido }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
      }),
    });
    const cand = j.candidates?.[0];
    if (!cand) throw new Error('A IA recusou o pedido' + (j.promptFeedback?.blockReason ? ` (${j.promptFeedback.blockReason}).` : '.'));
    return (cand.content?.parts || []).map((p) => p.text || '').join('');
  }
  if (prov === 'anthropic') {
    const conteudo = imagens.length
      ? [...imagens.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.dados } })), { type: 'text', text: pedido }]
      : pedido;
    const corpo = { model: modelo, max_tokens: 16000, system: SISTEMA, messages: [{ role: 'user', content: conteudo }] };
    const hdr = cabecalhos(prov, chave);
    // modelos que aceitam o desvio automático para outro modelo quando um filtro de segurança recusa
    if (/claude-(fable-5-[12]|opus-5(-5)?|sonnet-5-5)$/.test(modelo)) {
      hdr['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      corpo.fallbacks = 'default';
    }
    const j = await pedir('https://api.anthropic.com/v1/messages', { method: 'POST', signal: sinal, headers: hdr, body: JSON.stringify(corpo) });
    if (j.stop_reason === 'refusal') throw new Error('A IA recusou o pedido. Tente reformular o assunto ou as orientações.');
    return (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  const conteudo = imagens.length
    ? [{ type: 'text', text: pedido }, ...imagens.map((im) => ({ type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.dados}` } }))]
    : pedido;
  const corpo = { model: modelo, messages: [{ role: 'system', content: SISTEMA }, { role: 'user', content: conteudo }] };
  if (prov !== 'openrouter') corpo.response_format = { type: 'json_object' };
  const hdr = cabecalhos(prov, chave);
  if (prov === 'openrouter') hdr['X-Title'] = 'Prof';
  const j = await pedir(`${OPENAI_COMPAT[prov]}/chat/completions`, { method: 'POST', signal: sinal, headers: hdr, body: JSON.stringify(corpo) });
  return j.choices?.[0]?.message?.content || '';
}

// ------------------------------------------------------------------ resposta → questões
const PERMITIDAS = new Set(['P', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'SUB', 'SUP', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH']);

/** Mantém só marcações simples e seguras; texto puro vira parágrafos. */
function limparHtml(txt, { paragrafo = true } = {}) {
  let s = String(txt ?? '').trim().replace(/^\s*[A-Ja-j][).]\s+/, '');
  if (!/<(p|ul|ol|table)\b/i.test(s)) {
    const temTags = /<[a-z]/i.test(s);
    s = s.split(/\n{2,}/).map((p) => (temTags ? p : esc(p)).replace(/\n/g, '<br>')).map((p) => (paragrafo ? `<p>${p}</p>` : p)).join(paragrafo ? '' : '<br>');
  }
  const tpl = document.createElement('template');
  tpl.innerHTML = s;
  const limpar = (no) => {
    for (const filho of [...no.childNodes]) {
      if (filho.nodeType === 1) {
        limpar(filho);
        if (!PERMITIDAS.has(filho.tagName)) { filho.replaceWith(...filho.childNodes); continue; }
        for (const a of [...filho.attributes]) if (!(['colspan', 'rowspan'].includes(a.name) && /^\d+$/.test(a.value))) filho.removeAttribute(a.name);
      } else if (filho.nodeType !== 3) filho.remove();
    }
  };
  limpar(tpl.content);
  if (tpl.content.querySelector('table')) tpl.content.querySelectorAll('table').forEach((t) => t.setAttribute('border', '1'));
  let out = tpl.innerHTML.trim();
  if (paragrafo && out && !/^<(p|ul|ol|table)/i.test(out)) out = `<p>${out}</p>`;
  return out;
}

function extrairJson(txt) {
  const t = String(txt || '').replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(t); } catch { /* tenta recortar */ }
  const ini = t.search(/[[{]/);
  const fim = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (ini >= 0 && fim > ini) { try { return JSON.parse(t.slice(ini, fim + 1)); } catch { /* falhou */ } }
  throw new Error('A IA respondeu num formato inesperado. Tente gerar de novo.');
}

function converter(dados, meta) {
  const lista = Array.isArray(dados) ? dados : dados.questoes || dados.questions || [];
  return lista.map((x) => ({
    comando: limparHtml(x.comando || x.enunciado || x.pergunta || ''),
    solucao: limparHtml(x.correta || x.solucao || x.resposta || '', { paragrafo: false }),
    distratores: (x.distratores || x.erradas || x.incorretas || []).map((d) => limparHtml(d, { paragrafo: false })).filter(Boolean),
    disciplina: meta.disciplina || '', assunto: meta.assunto || '', serie: meta.serie || '', dificuldade: meta.dificuldade || '',
    geradaPorIA: true,
  })).filter((q) => q.comando && q.solucao && q.distratores.length);
}

/** Serviços cujos modelos escolhidos aceitam imagens. */
const LEEM_IMAGEM = ['gemini', 'anthropic', 'openai', 'mistral'];

const LIMITE_MS = 150000; // tempo máximo de espera por modelo
const OCUPADO = [429, 500, 503, 529];

function sinalComLimite(sinal) {
  const limite = AbortSignal.timeout ? AbortSignal.timeout(LIMITE_MS) : null;
  if (!limite) return sinal;
  if (!sinal) return limite;
  return AbortSignal.any ? AbortSignal.any([sinal, limite]) : sinal;
}

/** Tenta gerar com uma chave, passando pelos modelos dela. */
async function gerarComChave(k, pedido, p, { sinal, progresso, imagens }) {
  if (!k.reservas) { Object.assign(k, await analisarChave(k.chave)); atualizarChave(k.id, k); } // formato antigo
  let modelos = [k.modelo, ...k.reservas], reconfigurou = false, ultimoErro = null;
  for (let i = 0; i < modelos.length; i++) {
    const modelo = modelos[i];
    if (i > 0) progresso?.(`O modelo ${modelos[i - 1]} não respondeu a tempo ou está ocupado. Tentando ${modelo}…`);
    try {
      const txt = await chamar({ ...k, modelo }, pedido, sinalComLimite(sinal), imagens);
      const qs = converter(extrairJson(txt), p);
      if (!qs.length) throw new Error('A IA não devolveu nenhuma questão completa. Tente gerar de novo.');
      if (i > 0) atualizarChave(k.id, { modelo, reservas: modelos.filter((m) => m !== modelo) }); // usa primeiro o que funcionou
      return qs;
    } catch (e) {
      if (sinal?.aborted) throw new Error('Geração cancelada.');
      ultimoErro = e;
      if (e.name === 'TimeoutError' || e.name === 'AbortError') { ultimoErro = new Error('A IA demorou demais para responder. Tente com menos questões ou mais tarde.'); continue; }
      if (OCUPADO.includes(e.status)) continue;
      if (!reconfigurou && (e.status === 404 || (e.status === 400 && /model/i.test(e.detalhe || '')))) {
        reconfigurou = true; Object.assign(k, await analisarChave(k.chave)); atualizarChave(k.id, k);
        modelos = [k.modelo, ...k.reservas]; i = -1; continue;
      }
      throw e; // chave recusada, sem saldo, resposta inválida…: passa para a próxima chave
    }
  }
  throw ultimoErro || new Error('Não foi possível gerar as questões agora.');
}

/**
 * Gera questões usando as chaves em ordem de prioridade. Em cada chave, se o modelo estiver ocupado,
 * demorar demais ou tiver sido desligado, passa para o modelo reserva; se a chave inteira falhar,
 * passa para a próxima chave. `sinal` cancela; `progresso(texto)` informa as trocas.
 */
export async function gerarQuestoes(p, { sinal, progresso, material } = {}) {
  let chaves = lerChaves();
  if (!chaves.length) throw new Error('Nenhuma chave de IA configurada.');
  const imagens = material?.imagens || [];
  if (imagens.length) {
    // imagens (fotos, PDF digitalizado) só funcionam nos serviços que "enxergam"
    const comVisao = chaves.filter((k) => LEEM_IMAGEM.includes(k.provedor));
    if (!comVisao.length) {
      throw new Error(`Imagens e PDFs digitalizados precisam de uma chave do Google Gemini, Anthropic (Claude), OpenAI ou Mistral. ` +
        `Sua(s) chave(s) (${[...new Set(chaves.map((k) => NOMES[k.provedor]))].join(', ')}) só leem texto: envie PDF com texto, Word ou .txt.`);
    }
    chaves = comVisao;
  }
  const pedido = montarPedido(p, material);
  let ultimoErro = null;
  for (let n = 0; n < chaves.length; n++) {
    const k = chaves[n];
    if (n > 0) progresso?.(`A chave ${n} (${NOMES[chaves[n - 1].provedor] || ''}) falhou: ${ultimoErro?.message || ''} Tentando a chave ${n + 1} (${NOMES[k.provedor] || ''})…`);
    try {
      return await gerarComChave(k, pedido, p, { sinal, progresso, imagens });
    } catch (e) {
      if (sinal?.aborted) throw new Error('Geração cancelada.');
      ultimoErro = e;
    }
  }
  if (chaves.length > 1 && ultimoErro) throw new Error('Nenhuma das chaves funcionou agora. Último erro: ' + ultimoErro.message);
  throw ultimoErro || new Error('Não foi possível gerar as questões agora.');
}

// ------------------------------------------------------------------ diálogo
/**
 * Formulário de geração. `inicial`: valores (disciplina, assunto…); `umaSo`: gera 1 questão (editor).
 * Retorna a lista de questões geradas ou null.
 */
export async function dialogoGerar({ inicial = {}, umaSo = false, irConfig } = {}) {
  if (!temChave()) {
    const ir = await modal({
      titulo: 'Gerar com IA',
      corpo: h('p', {}, 'Para gerar questões com IA, adicione a sua chave de API em Configurações.'),
      acoes: [{ label: 'Cancelar', value: false }, { label: 'Abrir Configurações', primary: true, value: true }],
    });
    if (ir) irConfig?.();
    return null;
  }
  const inp = (nome, ph, tipo = 'text') => h('input', { class: 'inp', type: tipo, value: inicial[nome] || '', placeholder: ph });
  const f = {
    disciplina: inp('disciplina', 'Ex.: Matemática'),
    assunto: inp('assunto', 'Ex.: Frações'),
    serie: inp('serie', 'Ex.: 7º ano'),
    dificuldade: h('select', { class: 'inp' }, h('option', { value: '' }, '—'), ['Fácil', 'Média', 'Difícil'].map((d) => h('option', { selected: inicial.dificuldade === d }, d))),
    quantidade: h('input', { class: 'inp', type: 'number', min: 1, max: 20, value: 5 }),
    alternativas: h('select', { class: 'inp' }, [2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: n === (inicial.alternativas || 5) }, n))),
    observacao: h('textarea', { class: 'inp', rows: 3, placeholder: 'Opcional. Ex.: questões contextualizadas, estilo ENEM, com tabela de dados…' }),
  };
  const aviso = h('p', { class: 'dica', role: 'status' });

  // material de referência anexado (livro didático, apostila, slides, fotos de páginas…)
  const anexos = [];
  const listaAnexos = h('div', { class: 'anexos-lista' });
  const desenharAnexos = () => {
    listaAnexos.replaceChildren(...anexos.map((it) => h('div', { class: 'anexo' },
      h('span', { class: 'anexo-nome', title: it.arquivo.name }, it.arquivo.name),
      h('small', { class: 'dica anexo-info' }, it.info),
      it.campoPaginas || null,
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Remover ${it.arquivo.name}`, title: 'Remover', onclick: () => { anexos.splice(anexos.indexOf(it), 1); desenharAnexos(); } }, '×'))));
  };
  const adicionar = (arquivos) => {
    for (const arquivo of arquivos) {
      if (anexos.some((a) => a.arquivo.name === arquivo.name && a.arquivo.size === arquivo.size)) continue;
      const it = { arquivo, info: tamanho(arquivo.size) };
      if (ehPdf(arquivo)) {
        it.campoPaginas = h('input', { class: 'inp anexo-pag', placeholder: 'Páginas: todas', title: 'Páginas a usar. Ex.: 45-60 ou 12, 15-18', 'aria-label': `Páginas de ${arquivo.name}` });
        it.pdf = abrirPdf(arquivo);
        it.pdf.then((pdf) => { it.info = `${pdf.numPages} pág. · ${tamanho(arquivo.size)}`; desenharAnexos(); }, (e) => { it.info = e.message; desenharAnexos(); });
        it.pdf.catch(() => {});
      }
      anexos.push(it);
    }
    desenharAnexos();
  };
  const seletor = h('input', { type: 'file', multiple: true, accept: ACEITOS, style: { display: 'none' }, onchange: () => { adicionar([...seletor.files]); seletor.value = ''; } });
  const dica = 'Anexar material (livro didático, apostila, slides, fotos das páginas): PDF, Word, PowerPoint, texto ou imagem';
  const btnClipe = h('button', {
    type: 'button', class: 'btn btn-clipe', title: dica, 'aria-label': dica, onclick: () => seletor.click(),
    html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/></svg>',
  });
  // campo montado à mão (e não com <label>) para o botão não virar o alvo do rótulo
  const campoObs = h('div', {
    class: 'campo campo-obs',
    ondragover: (e) => { if (e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); campoObs.classList.add('arrastando'); } },
    ondragleave: () => campoObs.classList.remove('arrastando'),
    ondrop: (e) => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); campoObs.classList.remove('arrastando'); adicionar([...e.dataTransfer.files]); },
  },
  h('div', { class: 'campo-obs-topo' }, h('span', { class: 'campo-label' }, 'Orientações para a IA'), btnClipe),
  f.observacao, seletor, listaAnexos);

  let resultado = null, controle = null, relogio = null;
  const parar = () => { clearInterval(relogio); relogio = null; };
  const ok = await modal({
    titulo: umaSo ? 'Gerar questão com IA' : 'Gerar questões com IA',
    corpo: h('div', {},
      h('div', { class: 'form-grade' },
        campo('Disciplina', f.disciplina), campo('Assunto / conteúdo', f.assunto),
        campo('Série / ano', f.serie), campo('Dificuldade', f.dificuldade),
        umaSo ? null : campo('Quantidade de questões', f.quantidade), campo('Alternativas por questão', f.alternativas)),
      campoObs,
      aviso),
    acoes: [{ label: 'Cancelar', value: false, onClick: () => { controle?.abort(); parar(); } }, {
      label: 'Gerar', primary: true, onClick: async () => {
        if (!f.assunto.value.trim() && !f.observacao.value.trim() && !anexos.length) { aviso.textContent = 'Informe pelo menos o assunto.'; return false; }
        const btnGerar = [...document.querySelectorAll('.modal-foot .btn')].find((b) => b.textContent === 'Gerar');
        btnGerar.disabled = true;
        controle = new AbortController();
        let material = null, extra = '';
        if (anexos.length) {
          try {
            material = await prepararAnexos(anexos.map((it) => ({ arquivo: it.arquivo, pdf: it.pdf, paginas: it.campoPaginas?.value })), (t) => { aviso.textContent = t; });
          } catch (e) {
            aviso.textContent = e.message; btnGerar.disabled = false; return false;
          }
          if (controle.signal.aborted) return false;
          extra = material.avisos.join(' ');
        }
        const inicio = Date.now();
        const mostrar = () => {
          const s = Math.round((Date.now() - inicio) / 1000);
          aviso.textContent = `Gerando… ${s} s. A IA "pensa" antes de responder; pode levar até 1–2 minutos.${extra ? ' ' + extra : ''}`;
        };
        mostrar();
        relogio = setInterval(mostrar, 1000);
        try {
          resultado = await gerarQuestoes({
            disciplina: f.disciplina.value.trim(), assunto: f.assunto.value.trim(), serie: f.serie.value.trim(), dificuldade: f.dificuldade.value,
            quantidade: umaSo ? 1 : Math.max(1, Math.min(20, +f.quantidade.value || 5)), alternativas: +f.alternativas.value,
            observacao: f.observacao.value.trim(),
          }, { sinal: controle.signal, material, progresso: (t) => { extra = t; mostrar(); } });
          parar();
          return true;
        } catch (e) {
          parar();
          aviso.textContent = e.message;
          btnGerar.disabled = false;
          return false;
        }
      },
    }],
  });
  parar();
  return ok ? resultado : null;
}
