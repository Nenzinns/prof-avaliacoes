import { h, uid, toast, modal, confirmar, campo, vazio, LETRAS, dataBR } from './ui.js';
import { db } from './db.js';
import { maxQuestoes, svgFolha } from './omr-layout.js';

export function novoGabarito(nome, nQuestoes) {
  return { id: uid(), nome, respostas: Array(nQuestoes).fill(null), anuladas: Array(nQuestoes).fill(false) };
}

export function proximoNomeTipo(colecao) {
  return `Tipo ${LETRAS[colecao.gabaritos.length] || colecao.gabaritos.length + 1}`;
}

// ---------------------------------------------------------------- Coleções (pastas)
export async function telaColecoes(app, tela) {
  tela.titulo('Gabaritos');
  tela.acoes(h('button', { class: 'btn btn-primary', onclick: () => dialogoAdicionar(tela) }, '+ Adicionar'));
  const cols = (await db.getAll('colecoes')).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  app.append(h('div', { class: 'secao-head' },
    h('h2', {}, 'Coleções de gabaritos'),
    h('button', { class: 'btn btn-primary', onclick: () => dialogoAdicionar(tela) }, '+ Adicionar gabarito')));
  if (!cols.length) {
    app.append(vazio('📁', 'Nenhuma coleção ainda. Crie um gabarito para começar — ele ficará guardado em uma coleção (pasta).',
      h('button', { class: 'btn btn-primary', onclick: () => dialogoAdicionar(tela) }, '+ Adicionar gabarito')));
    return;
  }
  app.append(h('div', { class: 'grade' }, cols.map((c) => h('a', { class: 'pasta', href: `#/leitor/colecao/${c.id}` },
    h('div', { class: 'pasta-titulo' }, c.nome),
    h('div', { class: 'pasta-sub' }, `${c.gabaritos.length} gabarito(s) · ${c.nQuestoes} questões · ${c.nAlternativas} alternativas`),
    h('div', { class: 'pasta-sub' }, c.gabaritos.map((g) => h('span', { class: 'chip' }, g.nome))),
    h('div', { class: 'pasta-sub' }, 'Atualizada em ' + dataBR(c.atualizadoEm))))));
}

export async function dialogoAdicionar(tela, colecaoFixa = null) {
  const cols = await db.getAll('colecoes');
  const selCol = h('select', {},
    h('option', { value: '' }, '➕ Nova coleção'),
    cols.map((c) => h('option', { value: c.id, selected: colecaoFixa?.id === c.id }, c.nome)));
  const nomeCol = h('input', { type: 'text', placeholder: 'Ex.: Prova de Matemática — 1º bimestre' });
  const nomeGab = h('input', { type: 'text', value: 'Tipo A' });
  const nQ = h('input', { type: 'number', min: 1, max: 120, value: 10 });
  const nA = h('select', {}, [2, 3, 4, 5, 6].map((n) => h('option', { value: n, selected: n === 5 }, `${n} alternativas (${LETRAS.slice(0, n).split('').join(', ')})`)));
  const campoNovaCol = campo('Nome da nova coleção', nomeCol);
  const info = h('small', { class: 'dica' });

  const atualizar = () => {
    const c = cols.find((x) => x.id === selCol.value);
    campoNovaCol.style.display = c ? 'none' : '';
    nQ.disabled = nA.disabled = !!c;
    if (c) {
      nQ.value = c.nQuestoes; nA.value = c.nAlternativas;
      nomeGab.value = proximoNomeTipo(c);
      info.textContent = 'Todos os gabaritos de uma coleção têm a mesma quantidade de questões e alternativas.';
    } else {
      info.textContent = `Máximo de ${maxQuestoes(+nA.value)} questões na folha de respostas com ${nA.value} alternativas.`;
    }
  };
  selCol.addEventListener('change', atualizar);
  nA.addEventListener('change', atualizar);
  atualizar();
  if (colecaoFixa) selCol.disabled = true;

  const r = await modal({
    titulo: 'Adicionar gabarito',
    corpo: h('div', {},
      campo('Coleção (pasta)', selCol),
      campoNovaCol,
      campo('Nome do gabarito', nomeGab, 'Ex.: Tipo A, Tipo B, Turma 8ºA…'),
      h('div', { class: 'form-grade' }, campo('Quantidade de questões', nQ), campo('Quantidade de alternativas', nA)),
      info),
    acoes: [
      { label: 'Cancelar', value: null },
      {
        label: 'Criar gabarito', primary: true, value: 'ok', onClick: () => {
          const max = maxQuestoes(+nA.value);
          if (!(+nQ.value >= 1 && +nQ.value <= max)) { toast(`Informe de 1 a ${max} questões.`, 'erro'); return false; }
          if (!selCol.value && !nomeCol.value.trim()) { toast('Dê um nome para a coleção.', 'erro'); return false; }
        },
      },
    ],
  });
  if (r !== 'ok') return;
  let col = cols.find((x) => x.id === selCol.value);
  if (!col) {
    col = { id: uid(), nome: nomeCol.value.trim(), nQuestoes: +nQ.value, nAlternativas: +nA.value, notaMaxima: 10, gabaritos: [] };
  }
  const g = novoGabarito(nomeGab.value.trim() || proximoNomeTipo(col), col.nQuestoes);
  col.gabaritos.push(g);
  await db.put('colecoes', col);
  tela.ir(`/leitor/gabarito/${col.id}/${g.id}`);
}

// ---------------------------------------------------------------- Uma coleção
export async function telaColecao(app, tela, colId) {
  const col = await db.get('colecoes', colId);
  if (!col) { app.append(vazio('❓', 'Coleção não encontrada.')); return; }
  tela.titulo(col.nome);
  const resultados = await db.byIndex('resultados', 'colecaoId', colId);
  const salvar = () => db.put('colecoes', col);

  const nomeInp = h('input', { class: 'inp', value: col.nome, onchange: async () => { col.nome = nomeInp.value.trim() || col.nome; await salvar(); tela.titulo(col.nome); } });
  const notaInp = h('input', { class: 'inp', type: 'number', min: 1, step: 0.5, value: col.notaMaxima ?? 10, style: { maxWidth: '110px' }, onchange: async () => { col.notaMaxima = +notaInp.value || 10; await salvar(); toast('Nota máxima atualizada'); } });

  app.append(
    h('div', { class: 'cartao secao' },
      h('div', { class: 'form-grade' }, campo('Nome da coleção', nomeInp), campo('Nota máxima', notaInp)),
      h('div', {}, h('span', { class: 'chip' }, `${col.nQuestoes} questões`), h('span', { class: 'chip' }, `${col.nAlternativas} alternativas`),
        col.avaliacaoId ? h('a', { class: 'chip verde', href: `#/formatador/avaliacao/${col.avaliacaoId}` }, 'Gerada pelo Formatador ↗') : null),
      h('div', { class: 'linha-botoes', style: { marginTop: '14px' } },
        h('a', { class: 'btn btn-ok', href: `#/leitor/corrigir/${col.id}` }, '📷 Corrigir provas'),
        h('a', { class: 'btn', href: `#/leitor/resultados/${col.id}` }, `📊 Resultados (${resultados.length})`),
        h('a', { class: 'btn', href: `#/leitor/folhas/${col.id}` }, '🖨️ Imprimir folhas de resposta'),
        h('span', { class: 'espaco' }),
        h('button', {
          class: 'btn btn-danger btn-sm', onclick: async () => {
            if (!(await confirmar(`Excluir a coleção "${col.nome}" com ${col.gabaritos.length} gabarito(s) e ${resultados.length} resultado(s)?`, { ok: 'Excluir', perigo: true }))) return;
            for (const r of resultados) await db.del('resultados', r.id);
            await db.del('colecoes', col.id);
            toast('Coleção excluída');
            tela.ir('/leitor/gabaritos');
          },
        }, 'Excluir coleção'))));

  const lista = h('div', { class: 'grade' });
  app.append(h('div', { class: 'secao' },
    h('div', { class: 'secao-head' }, h('h2', {}, 'Gabaritos desta coleção'),
      h('button', { class: 'btn btn-primary', onclick: () => dialogoAdicionar(tela, col) }, '+ Adicionar gabarito')),
    lista,
    col.gabaritos.length > 1 ? h('p', { class: 'dica' }, 'Anti-cola: na correção, o tipo de prova é lido da bolinha "Tipo de prova" da folha de respostas e o gabarito correspondente é usado automaticamente.') : null));

  const render = () => {
    lista.replaceChildren(...col.gabaritos.map((g, i) => {
      const preenchidas = g.respostas.filter((r) => r !== null).length + 0;
      const anul = g.anuladas.filter(Boolean).length;
      return h('div', { class: 'cartao' },
        h('div', { class: 'item-titulo' }, g.nome),
        h('div', { class: 'item-sub' }, `${preenchidas}/${col.nQuestoes} respostas` + (anul ? ` · ${anul} anulada(s)` : '')),
        h('div', { class: 'item-sub', style: { fontFamily: 'monospace', letterSpacing: '1px', margin: '8px 0', wordBreak: 'break-all' } },
          g.respostas.map((r, q) => (g.anuladas[q] ? '*' : r === null ? '·' : LETRAS[r])).join('')),
        h('div', { class: 'linha-botoes' },
          h('a', { class: 'btn btn-sm btn-primary', href: `#/leitor/gabarito/${col.id}/${g.id}` }, 'Editar'),
          h('button', {
            class: 'btn btn-sm', onclick: async () => {
              const copia = { ...structuredClone(g), id: uid(), nome: proximoNomeTipo(col) };
              col.gabaritos.push(copia); await salvar(); render();
            },
          }, 'Duplicar'),
          h('button', {
            class: 'btn btn-sm', disabled: col.gabaritos.length === 1, onclick: async () => {
              if (!(await confirmar(`Excluir o gabarito "${g.nome}"?`, { ok: 'Excluir', perigo: true }))) return;
              col.gabaritos.splice(i, 1); await salvar(); render();
            },
          }, 'Excluir')));
    }));
  };
  render();
}

// ---------------------------------------------------------------- Editor de gabarito
export async function telaGabarito(app, tela, colId, gabId) {
  const col = await db.get('colecoes', colId);
  const g = col?.gabaritos.find((x) => x.id === gabId);
  if (!g) { app.append(vazio('❓', 'Gabarito não encontrado.')); return; }
  tela.titulo(`${col.nome} · ${g.nome}`);
  let timer = null;
  const salvar = () => { clearTimeout(timer); timer = setTimeout(() => db.put('colecoes', col), 250); };
  tela.aoSair(() => { clearTimeout(timer); db.put('colecoes', col); });

  const progresso = h('span', { class: 'chip' });
  const nomeInp = h('input', { class: 'inp', value: g.nome, oninput: () => { g.nome = nomeInp.value; salvar(); } });
  const rapido = h('input', {
    class: 'inp', placeholder: `Ex.: ${'ABCDE'.slice(0, col.nAlternativas).repeat(2)}…`, style: { fontFamily: 'monospace', textTransform: 'uppercase' },
    value: g.respostas.map((r) => (r === null ? '' : LETRAS[r])).join('').length === col.nQuestoes ? g.respostas.map((r) => LETRAS[r]).join('') : '',
  });
  const aplicarRapido = () => {
    const letras = rapido.value.toUpperCase().replace(/[^A-Z?.*-]/g, '');
    [...letras].slice(0, col.nQuestoes).forEach((ch, q) => {
      const i = LETRAS.indexOf(ch);
      if (ch === '*') { g.anuladas[q] = true; }
      else if (i >= 0 && i < col.nAlternativas) { g.respostas[q] = i; g.anuladas[q] = false; }
      else g.respostas[q] = null;
    });
    salvar(); render();
  };
  rapido.addEventListener('input', aplicarRapido);

  const grade = h('div', { class: 'gab-grade' });
  app.append(
    h('div', { class: 'cartao secao' },
      h('div', { class: 'form-grade' },
        campo('Nome do gabarito', nomeInp),
        campo('Digitação rápida', rapido, 'Digite as letras em sequência. Use * para anular e . para deixar em branco.')),
      h('div', { class: 'linha-botoes' }, progresso, h('span', { class: 'espaco' }),
        h('button', { class: 'btn btn-sm', onclick: async () => { if (await confirmar('Limpar todas as respostas deste gabarito?')) { g.respostas.fill(null); g.anuladas.fill(false); rapido.value = ''; salvar(); render(); } } }, 'Limpar'),
        h('a', { class: 'btn btn-sm btn-primary', href: `#/leitor/colecao/${col.id}` }, 'Concluir'))),
    h('div', { class: 'cartao' }, grade));

  function render() {
    const n = g.respostas.filter((r, q) => r !== null || g.anuladas[q]).length;
    progresso.textContent = `${n} de ${col.nQuestoes} preenchidas`;
    progresso.className = 'chip ' + (n === col.nQuestoes ? 'verde' : '');
    grade.replaceChildren(...g.respostas.map((resp, q) => h('div', { class: `gab-linha ${g.anuladas[q] ? 'anulada' : ''}` },
      h('span', { class: 'gab-num' }, q + 1),
      Array.from({ length: col.nAlternativas }, (_, a) => h('button', {
        class: `bolha ${resp === a ? 'marcada' : ''}`, 'aria-label': `Questão ${q + 1}, alternativa ${LETRAS[a]}`,
        onclick: () => { g.respostas[q] = resp === a ? null : a; salvar(); render(); },
      }, LETRAS[a])),
      h('button', { class: 'gab-anular', title: 'Questão anulada: vale ponto para todos', onclick: () => { g.anuladas[q] = !g.anuladas[q]; salvar(); render(); } }, g.anuladas[q] ? 'ANULADA' : 'anular'))));
  }
  render();
}

// ---------------------------------------------------------------- Impressão das folhas de resposta
export async function telaFolhas(app, tela, colId) {
  const col = await db.get('colecoes', colId);
  if (!col) { app.append(vazio('❓', 'Coleção não encontrada.')); return; }
  tela.titulo('Folhas de resposta');
  const tipos = col.gabaritos.map((g) => g.nome.replace(/^Tipo\s+/i, '').slice(0, 3));
  const titulo = h('input', { class: 'inp', value: col.nome });
  const sub = h('input', { class: 'inp', placeholder: 'Ex.: Escola, turma, data (opcional)' });
  const copias = h('input', { class: 'inp', type: 'number', min: 1, max: 200, value: 1 });
  const marcarTipo = h('input', { type: 'checkbox', checked: col.gabaritos.length > 1 });
  const preview = h('div', { class: 'preview-folhas' });

  const paginas = () => {
    const out = [];
    const n = Math.max(1, Math.min(200, +copias.value || 1));
    const lista = col.gabaritos.length > 1 && marcarTipo.checked ? col.gabaritos.map((_, i) => i) : [null];
    for (const t of lista) for (let i = 0; i < n; i++) {
      out.push(svgFolha({ titulo: titulo.value, subtitulo: sub.value, nQuestoes: col.nQuestoes, nAlt: col.nAlternativas, tipos: col.gabaritos.length > 1 ? tipos : [], tipoMarcado: t }));
    }
    return out;
  };
  const atualizar = () => {
    const pgs = paginas();
    preview.replaceChildren(...pgs.slice(0, 4).map((s) => h('div', { class: 'pagina-folha tela', html: s })));
    if (pgs.length > 4) preview.append(h('p', { style: { color: '#fff', textAlign: 'center' } }, `… e mais ${pgs.length - 4} página(s)`));
  };
  [titulo, sub, copias, marcarTipo].forEach((el) => el.addEventListener('input', atualizar));

  const imprimir = () => imprimirPaginas(paginas().map((s) => `<div class="pagina-folha">${s}</div>`).join(''));
  tela.acoes(h('button', { class: 'btn btn-primary', onclick: imprimir }, '🖨️ Imprimir'));
  app.append(
    h('div', { class: 'cartao secao' },
      h('div', { class: 'form-grade' },
        campo('Título', titulo), campo('Subtítulo', sub),
        campo(col.gabaritos.length > 1 && marcarTipo.checked ? 'Cópias de cada tipo' : 'Cópias', copias)),
      col.gabaritos.length > 1 ? h('label', { class: 'campo-check' }, marcarTipo, 'Imprimir uma folha para cada tipo, com a bolinha do tipo já preenchida') : null,
      h('p', { class: 'dica' }, 'Imprima em papel A4, escala 100% ("tamanho real"), sem ajustar à página. Os 4 quadrados pretos dos cantos e a barra superior são usados pela leitura.'),
      h('button', { class: 'btn btn-primary', onclick: imprimir }, '🖨️ Imprimir / Salvar PDF')),
    preview);
  atualizar();
}

export function imprimirPaginas(html) {
  const root = document.getElementById('print-root');
  root.innerHTML = html;
  document.body.classList.add('imprimindo');
  const fim = () => { document.body.classList.remove('imprimindo'); root.innerHTML = ''; window.removeEventListener('afterprint', fim); };
  window.addEventListener('afterprint', fim);
  // aguarda imagens carregarem
  const imgs = [...root.querySelectorAll('img')].filter((i) => !i.complete);
  Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 50));
}
