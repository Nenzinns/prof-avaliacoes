import { h, uid, toast, modal, confirmar, campo, vazio, LETRAS, textoDeHtml, dataBR } from './ui.js';
import { db } from './db.js';
import { createEditor } from './editor.js';
import { createRibbon } from './ribbon.js';

export const DIFICULDADES = ['Fácil', 'Média', 'Difícil'];

/** Pré-visualização compacta de uma questão (comando + alternativas, correta em verde). */
export function previewQuestao(q, { alternativas = true } = {}) {
  return h('div', { class: 'q-preview' },
    h('div', { class: 'q-conteudo', html: q.comando || '<p><i>(sem comando)</i></p>' }),
    alternativas ? h('ol', { class: 'q-alts' },
      [q.solucao, ...(q.distratores || [])].map((alt, i) => h('li', { class: i === 0 ? 'correta' : '' },
        h('span', {}, `${LETRAS[i]}) `), h('span', { class: 'q-conteudo', style: { display: 'inline-block', verticalAlign: 'top' }, html: alt || '<i>(vazia)</i>' }), i === 0 ? ' ✔' : ''))) : null);
}

function metaChips(q) {
  return [q.disciplina && h('span', { class: 'chip' }, q.disciplina), q.assunto && h('span', { class: 'chip verde' }, q.assunto),
    q.serie && h('span', { class: 'chip' }, q.serie), q.dificuldade && h('span', { class: 'chip' }, q.dificuldade)].filter(Boolean);
}

/** Filtros + lista de questões. Usado no banco e no seletor da avaliação. */
export function listaFiltravel(questoes, renderItem) {
  const busca = h('input', { class: 'inp', type: 'search', placeholder: 'Buscar no texto das questões…' });
  const opts = (campo) => [...new Set(questoes.map((q) => q[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
  const selDisc = h('select', { class: 'inp' }, h('option', { value: '' }, 'Todas as disciplinas'), opts('disciplina').map((d) => h('option', {}, d)));
  const selAss = h('select', { class: 'inp' }, h('option', { value: '' }, 'Todos os assuntos'), opts('assunto').map((d) => h('option', {}, d)));
  const selDif = h('select', { class: 'inp' }, h('option', { value: '' }, 'Qualquer dificuldade'), DIFICULDADES.map((d) => h('option', {}, d)));
  const lista = h('div', { class: 'lista' });
  const contador = h('span', { class: 'dica' });
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const render = () => {
    const t = norm(busca.value.trim());
    const fil = questoes.filter((q) => (!selDisc.value || q.disciplina === selDisc.value) && (!selAss.value || q.assunto === selAss.value) &&
      (!selDif.value || q.dificuldade === selDif.value) &&
      (!t || norm(textoDeHtml(q.comando) + ' ' + textoDeHtml(q.solucao) + ' ' + (q.assunto || '')).includes(t)));
    contador.textContent = `${fil.length} questão(ões)`;
    lista.replaceChildren(...fil.map(renderItem));
    if (!fil.length) lista.append(h('p', { class: 'dica' }, 'Nenhuma questão encontrada.'));
  };
  [busca, selDisc, selAss, selDif].forEach((el) => el.addEventListener('input', render));
  render();
  return { el: h('div', {}, h('div', { class: 'busca' }, busca, selDisc, selAss, selDif), contador, lista), render };
}

export async function telaBanco(app, tela) {
  tela.titulo('Banco de questões');
  tela.acoes(h('a', { class: 'btn btn-primary', href: '#/formatador/questao/nova' }, '+ Nova questão'));
  const questoes = (await db.getAll('questoes')).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  app.append(h('div', { class: 'secao-head' }, h('h2', {}, 'Banco de questões'), h('a', { class: 'btn btn-primary', href: '#/formatador/questao/nova' }, '+ Adicionar nova questão')));
  if (!questoes.length) {
    app.append(vazio('📝', 'Seu banco de questões está vazio.', h('a', { class: 'btn btn-primary', href: '#/formatador/questao/nova' }, '+ Adicionar nova questão')));
    return;
  }
  const { el } = listaFiltravel(questoes, (q) => {
    const it = h('div', { class: 'item', style: { alignItems: 'flex-start' } },
      h('div', { class: 'item-corpo' },
        h('div', {}, metaChips(q)),
        h('div', { class: 'item-texto' }, textoDeHtml(q.comando) || '(questão sem texto — contém imagem/tabela)'),
        h('div', { class: 'item-sub' }, `${1 + (q.distratores?.length || 0)} alternativas · atualizada em ${dataBR(q.atualizadoEm)}`)),
      h('div', { class: 'linha-botoes' },
        h('button', { class: 'btn btn-sm', onclick: () => modal({ titulo: 'Questão', largo: true, corpo: previewQuestao(q) }) }, 'Ver'),
        h('a', { class: 'btn btn-sm btn-primary', href: `#/formatador/questao/${q.id}` }, 'Editar'),
        h('button', {
          class: 'btn btn-sm', onclick: async () => {
            const c = { ...structuredClone(q), id: uid(), criadoEm: 0 };
            await db.put('questoes', c); toast('Questão duplicada'); tela.ir(`/formatador/questao/${c.id}`);
          },
        }, 'Duplicar'),
        h('button', {
          class: 'btn btn-sm', onclick: async () => {
            const avs = (await db.getAll('avaliacoes')).filter((a) => a.questoes.includes(q.id));
            const aviso = avs.length ? ` Ela está em ${avs.length} avaliação(ões) e será removida delas.` : '';
            if (!(await confirmar('Excluir esta questão?' + aviso, { ok: 'Excluir', perigo: true }))) return;
            for (const a of avs) { a.questoes = a.questoes.filter((x) => x !== q.id); a.versoes = []; await db.put('avaliacoes', a); }
            await db.del('questoes', q.id); it.remove(); toast('Questão excluída');
          },
        }, 'Excluir')));
    return it;
  });
  app.append(el);
}

export async function telaQuestao(app, tela, id, params) {
  const nova = id === 'nova';
  const q = nova ? { id: uid(), comando: '', solucao: '', distratores: ['', '', '', ''], disciplina: '', assunto: '', serie: '', dificuldade: '' } : await db.get('questoes', id);
  if (!q) { app.append(vazio('❓', 'Questão não encontrada.')); return; }
  const avaliacaoId = params.get('avaliacao');
  tela.titulo(nova ? 'Nova questão' : 'Editar questão');
  const todas = await db.getAll('questoes');
  const dl = (idL, campo) => h('datalist', { id: idL }, [...new Set(todas.map((x) => x[campo]).filter(Boolean))].map((v) => h('option', { value: v })));

  const inp = (campoQ, ph, lista) => h('input', { value: q[campoQ] || '', placeholder: ph, list: lista, oninput: (e) => { q[campoQ] = e.target.value; agendar(); } });
  const selDif = h('select', { onchange: (e) => { q.dificuldade = e.target.value; agendar(); } }, h('option', { value: '' }, '—'), DIFICULDADES.map((d) => h('option', { selected: q.dificuldade === d }, d)));

  // uma única faixa de opções (como no Word) que age no campo onde está o cursor
  const ribbon = createRibbon();
  const edCmd = createEditor({ html: q.comando, modo: 'completo', placeholder: 'Escreva o enunciado da questão. Use a faixa de opções acima para imagens, tabelas, fontes…', minAltura: '180px', ribbon, rotulo: 'Comando da questão' });
  const edSol = createEditor({ html: q.solucao, modo: 'simples', placeholder: 'Alternativa correta', ribbon, rotulo: 'Solução' });
  const novoDistrator = (html = '') => createEditor({ html, modo: 'simples', placeholder: 'Alternativa incorreta', ribbon });
  const distratores = q.distratores.map((html) => novoDistrator(html));
  const listaDist = h('div');
  const status = h('span', { class: 'dica' });

  let timer = null, salvoUmaVez = !nova;
  const coletar = () => {
    q.comando = edCmd.getHTML();
    q.solucao = edSol.getHTML();
    q.distratores = distratores.map((d) => d.getHTML());
  };
  const salvar = async () => {
    clearTimeout(timer);
    coletar();
    if (!q.comando && !q.solucao && !q.distratores.some(Boolean)) return false;
    await db.put('questoes', q);
    salvoUmaVez = true;
    status.textContent = 'Salvo automaticamente ✓';
    return true;
  };
  const agendar = () => { status.textContent = 'Editando…'; clearTimeout(timer); timer = setTimeout(salvar, 900); };
  [edCmd, edSol].forEach((e) => e.area.addEventListener('ed-change', agendar));

  const renderDist = () => {
    listaDist.replaceChildren(...distratores.map((d, i) => {
      d.area.removeEventListener('ed-change', agendar);
      d.area.addEventListener('ed-change', agendar);
      d.ed.rotulo = `Distrator ${i + 1}`;
      return h('div', { class: 'distrator' }, h('span', { class: 'letra' }, i + 1), h('div', { class: 'ed-wrap-outer', style: { flex: 1, minWidth: 0 } }, d.el),
        h('button', { class: 'icon-btn', title: 'Remover distrator', onclick: () => { distratores.splice(i, 1); renderDist(); agendar(); } }, '×'));
    }));
  };
  renderDist();

  const concluir = async () => {
    coletar();
    if (!q.comando) { toast('Escreva o comando da questão.', 'erro'); return; }
    if (!q.solucao) { toast('Informe a solução (alternativa correta).', 'erro'); return; }
    if (!q.distratores.filter(Boolean).length) { toast('Adicione pelo menos um distrator.', 'erro'); return; }
    q.distratores = q.distratores.filter(Boolean);
    await db.put('questoes', q);
    if (avaliacaoId) {
      const a = await db.get('avaliacoes', avaliacaoId);
      if (a && !a.questoes.includes(q.id)) { a.questoes.push(q.id); a.versoes = []; await db.put('avaliacoes', a); }
      toast('Questão salva e adicionada à avaliação', 'ok');
      return tela.ir(`/formatador/avaliacao/${avaliacaoId}`);
    }
    toast('Questão salva', 'ok');
    tela.ir('/formatador/questoes');
  };
  const previa = () => { coletar(); modal({ titulo: 'Pré-visualização', largo: true, corpo: previewQuestao(q) }); };

  tela.acoes(h('button', { class: 'btn', onclick: previa }, 'Pré-visualizar'), h('button', { class: 'btn btn-primary', onclick: concluir }, 'Salvar'));
  tela.aoSair(() => { if (salvoUmaVez || timer) salvar(); });

  app.append(
    h('details', { class: 'cartao secao', open: nova },
      h('summary', {}, 'Classificação ', h('span', { class: 'dica', style: { fontWeight: 400 } }, '(disciplina, assunto, série, dificuldade)')),
      h('div', { class: 'form-grade' },
        campo('Disciplina', inp('disciplina', 'Ex.: Matemática', 'dl-disc')),
        campo('Assunto / conteúdo', inp('assunto', 'Ex.: Frações', 'dl-ass')),
        campo('Série / ano', inp('serie', 'Ex.: 7º ano', 'dl-serie')),
        campo('Dificuldade', selDif)),
      dl('dl-disc', 'disciplina'), dl('dl-ass', 'assunto'), dl('dl-serie', 'serie')),
    ribbon.el,
    h('div', { class: 'editor-bloco' },
      h('h3', {}, h('span', { class: 'tag', style: { background: 'var(--pri)' } }), 'Comando da questão'),
      edCmd.el),
    h('div', { class: 'editor-bloco' },
      h('h3', {}, h('span', { class: 'tag', style: { background: 'var(--ver)' } }), 'Solução ', h('span', { class: 'dica', style: { fontWeight: 400 } }, '(resposta correta)')),
      edSol.el),
    h('div', { class: 'editor-bloco' },
      h('h3', {}, h('span', { class: 'tag', style: { background: 'var(--verm)' } }), 'Distratores ', h('span', { class: 'dica', style: { fontWeight: 400 } }, '(alternativas erradas)')),
      listaDist,
      h('button', { class: 'btn btn-sm', onclick: () => { if (distratores.length >= 9) return; const d = novoDistrator(); distratores.push(d); renderDist(); d.focus(); } }, '+ Adicionar distrator'),
      h('p', { class: 'dica' }, 'Na prova, a solução e os distratores viram as alternativas (A, B, C…), podendo ser embaralhadas.')),
    h('div', { class: 'linha-botoes' }, status, h('span', { class: 'espaco' }),
      h('button', { class: 'btn', onclick: previa }, 'Pré-visualizar'),
      h('button', { class: 'btn btn-primary btn-grande', onclick: concluir }, avaliacaoId ? 'Salvar e adicionar à avaliação' : 'Salvar questão')));
}
