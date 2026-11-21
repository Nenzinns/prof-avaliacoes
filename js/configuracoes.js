// Tela de Configurações: conta, chaves de IA (fila de prioridade) e backup/restauração.
import { h, toast, modal, baixar, escolherArquivo, confirmar } from './ui.js';
import { db, exportarTudo, importarTudo } from './db.js';
import { secaoConta } from './conta.js';
import { lerChaves, adicionarChave, removerChave, reordenarChaves, mascarar, NOMES } from './ia.js';

export function telaConfiguracoes(app, tela) {
  tela.titulo('Configurações');

  // ---------------------------------------------------------------- backup
  const backup = h('section', { class: 'cartao secao' },
    h('h2', { class: 'cfg-tit' }, 'Backup e restauração'),
    h('p', { class: 'dica' }, 'Os dados ficam salvos somente neste aparelho/navegador. Exporte um backup para guardar ou levar para outro aparelho.'),
    h('div', { class: 'linha-botoes' },
      h('button', {
        class: 'btn btn-primary', onclick: async () => {
          const dados = await exportarTudo();
          baixar(`prof-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dados));
        },
      }, 'Exportar backup'),
      h('button', {
        class: 'btn', onclick: async () => {
          const [f] = await escolherArquivo('application/json,.json');
          if (!f) return;
          try {
            await importarTudo(JSON.parse(await f.text()));
            toast('Backup importado com sucesso!', 'ok');
          } catch (e) { toast(e.message, 'erro'); }
        },
      }, 'Importar backup')));

  // ---------------------------------------------------------------- IA
  const status = h('p', { class: 'cfg-status', role: 'status' });
  const chave = h('input', { class: 'inp', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'Cole aqui uma chave de API' });
  const mostrar = h('button', { class: 'btn', type: 'button', onclick: () => { chave.type = chave.type === 'password' ? 'text' : 'password'; mostrar.textContent = chave.type === 'password' ? 'Mostrar' : 'Ocultar'; } }, 'Mostrar');
  const adicionar = h('button', { class: 'btn btn-primary', type: 'button' }, 'Adicionar chave');
  const lista = h('ol', { class: 'cfg-fila' });
  const dicaFila = h('p', { class: 'dica' });

  const render = () => {
    const chaves = lerChaves();
    dicaFila.textContent = chaves.length > 1
      ? 'A IA usa a primeira chave da lista; se ela falhar, passa para a seguinte. Arraste pela alça ⠿ para mudar a ordem.'
      : chaves.length ? 'Adicione outras chaves para usar como reserva quando esta falhar.' : '';
    lista.replaceChildren(...chaves.map((k, i) => {
      const li = h('li', { class: 'cfg-item', 'data-id': k.id },
        h('span', { class: 'cfg-alca', title: 'Arraste para mudar a prioridade', 'aria-label': 'Arrastar' }, '⠿'),
        h('span', { class: 'cfg-num' }, i + 1),
        h('div', { class: 'cfg-info' },
          h('div', { class: 'cfg-nome' }, NOMES[k.provedor] || k.provedor),
          h('div', { class: 'cfg-sub' }, `${mascarar(k.chave)} · ${k.modelo}`)),
        h('button', {
          class: 'btn btn-sm', type: 'button', onclick: async () => {
            if (!(await confirmar(`Remover a chave ${NOMES[k.provedor] || ''} (${mascarar(k.chave)}) deste aparelho?`, { ok: 'Remover', perigo: true }))) return;
            removerChave(k.id); render(); toast('Chave removida');
          },
        }, 'Remover'));
      arrastavel(li);
      return li;
    }));
    if (!chaves.length) lista.append(h('li', { class: 'cfg-vazio' }, 'Nenhuma chave configurada.'));
  };

  // arrastar com mouse ou dedo (eventos de ponteiro funcionam nos dois)
  function arrastavel(li) {
    const alca = li.querySelector('.cfg-alca');
    alca.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      li.classList.add('arrastando');
      const meio = (x) => { const r = x.getBoundingClientRect(); return r.top + r.height / 2; };
      const mover = (e) => {
        let prox = li.nextElementSibling, ant = li.previousElementSibling;
        while (prox && e.clientY > meio(prox)) { prox.after(li); prox = li.nextElementSibling; }
        while (ant && e.clientY < meio(ant)) { ant.before(li); ant = li.previousElementSibling; }
      };
      // ouvimos no documento: mover o item na página faz o navegador soltar a "captura" do ponteiro
      const soltar = () => {
        document.removeEventListener('pointermove', mover);
        document.removeEventListener('pointerup', soltar);
        document.removeEventListener('pointercancel', soltar);
        li.classList.remove('arrastando');
        const ids = [...lista.children].map((x) => x.dataset.id).filter(Boolean);
        const antes = lerChaves().map((k) => k.id).join();
        if (ids.join() !== antes) { reordenarChaves(ids); toast('Prioridade atualizada'); }
        render();
      };
      document.addEventListener('pointermove', mover);
      document.addEventListener('pointerup', soltar);
      document.addEventListener('pointercancel', soltar);
    });
  }

  adicionar.addEventListener('click', async () => {
    adicionar.disabled = true;
    status.className = 'cfg-status';
    status.textContent = 'Verificando a chave…';
    try {
      const k = await adicionarChave(chave.value);
      chave.value = '';
      status.className = 'cfg-status ok';
      status.textContent = `Chave adicionada: ${NOMES[k.provedor] || k.provedor} · ${k.modelo}`;
      render();
    } catch (e) {
      status.className = 'cfg-status erro';
      status.textContent = e.message;
    }
    adicionar.disabled = false;
  });
  chave.addEventListener('keydown', (e) => { if (e.key === 'Enter') adicionar.click(); });

  const ia = h('section', { class: 'cartao secao' },
    h('h2', { class: 'cfg-tit' }, 'Inteligência artificial'),
    h('p', { class: 'dica' }, 'Cole a chave de API do serviço de IA que você usa. O Prof reconhece o serviço e escolhe o modelo sozinho.'),
    lista, dicaFila,
    h('div', { class: 'cfg-chave' }, chave, mostrar, adicionar),
    status,
    h('p', { class: 'dica' }, 'As chaves ficam salvas só neste aparelho e não vão no backup. Não salve chaves em computador compartilhado. ',
      'Só o pedido (disciplina, assunto, série…) é enviado à IA; nenhum dado de aluno sai do aplicativo.'));

  render();
  app.append(h('div', { class: 'cfg' }, secaoConta(), ia, backup, secaoApagar(exportar)));
}

async function exportar() {
  const dados = await exportarTudo();
  baixar(`prof-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dados));
}

// ---------------------------------------------------------------- apagar dados
function secaoApagar(exportarBackup) {
  const opcoes = [
    { id: 'questoes', rotulo: 'Questões', stores: ['questoes'] },
    { id: 'avaliacoes', rotulo: 'Avaliações', stores: ['avaliacoes'] },
    { id: 'colecoes', rotulo: 'Gabaritos (coleções e folhas de resposta)', stores: ['colecoes'] },
    { id: 'resultados', rotulo: 'Resultados das correções (notas)', stores: ['resultados'] },
    { id: 'ia', rotulo: 'Chaves de IA deste aparelho', ia: true },
  ];
  const marcas = {};
  const linhas = opcoes.map((o) => {
    marcas[o.id] = h('input', { type: 'checkbox' });
    return h('label', { class: 'campo-check' }, marcas[o.id], o.rotulo);
  });
  // sem os gabaritos, os resultados ficam sem referência: apagam juntos
  marcas.colecoes.addEventListener('change', () => {
    marcas.resultados.disabled = marcas.colecoes.checked;
    if (marcas.colecoes.checked) marcas.resultados.checked = true;
  });
  const btn = h('button', { class: 'btn btn-danger', type: 'button' }, 'Apagar selecionados');
  btn.addEventListener('click', async () => {
    const escolhidas = opcoes.filter((o) => marcas[o.id].checked);
    if (!escolhidas.length) { toast('Marque o que deseja apagar.', 'erro'); return; }
    const r = await modal({
      titulo: 'Apagar dados',
      corpo: h('div', {},
        h('p', {}, 'Serão apagados deste aparelho:'),
        h('ul', {}, escolhidas.map((o) => h('li', {}, o.rotulo))),
        h('p', {}, h('b', {}, 'Isso não pode ser desfeito.'), ' Se quiser guardar uma cópia, exporte um backup antes.')),
      acoes: [
        { label: 'Cancelar', value: null },
        { label: 'Exportar backup', value: null, onClick: async () => { await exportarBackup(); return false; } },
        { label: 'Apagar', danger: true, value: 'apagar' },
      ],
    });
    if (r !== 'apagar') return;
    for (const o of escolhidas) {
      if (o.ia) lerChaves().forEach((k) => removerChave(k.id));
      for (const s of o.stores || []) await db.clear(s);
    }
    Object.values(marcas).forEach((m) => { m.checked = false; m.disabled = false; });
    toast('Dados apagados', 'ok');
    if (escolhidas.some((o) => o.ia)) location.reload();
  });
  return h('section', { class: 'cartao secao' },
    h('h2', { class: 'cfg-tit' }, 'Apagar dados'),
    h('p', { class: 'dica' }, 'Escolha o que apagar deste aparelho. Os outros dados continuam como estão.'),
    h('div', { class: 'cfg-apagar' }, linhas),
    h('div', { class: 'linha-botoes' }, btn));
}
