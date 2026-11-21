import { h } from './ui.js';
import * as leitor from './leitor.js';
import * as gabaritos from './gabaritos.js';
import * as questoes from './questoes.js';
import * as avaliacoes from './avaliacoes.js';
import { telaConfiguracoes } from './configuracoes.js';
import { iniciarConta } from './conta.js';
import { iniciarSincronizacao } from './sincronizacao.js';

const app = document.getElementById('app');
const tituloEl = document.getElementById('titulo-tela');
const acoesEl = document.getElementById('topbar-acoes');
const voltarBtn = document.getElementById('btn-voltar');

let limparTela = null; // função de limpeza da tela atual (ex.: parar câmera)

/** Contexto passado a cada tela. */
export const tela = {
  titulo(t) { tituloEl.textContent = t; document.title = 'Prof'; },
  acoes(...els) { acoesEl.replaceChildren(...els); },
  aoSair(fn) { limparTela = fn; },
  ir(rota) { location.hash = rota; },
};

const rotas = [
  [/^\/?$/, inicio],
  [/^\/configuracoes$/, telaConfiguracoes],
  [/^\/leitor$/, leitor.telaLeitor],
  [/^\/leitor\/corrigir\/([^/]+)$/, leitor.telaCorrigir],
  [/^\/leitor\/resultados\/([^/]+)$/, leitor.telaResultados],
  [/^\/leitor\/gabaritos$/, gabaritos.telaColecoes],
  [/^\/leitor\/colecao\/([^/]+)$/, gabaritos.telaColecao],
  [/^\/leitor\/gabarito\/([^/]+)\/([^/]+)$/, gabaritos.telaGabarito],
  [/^\/leitor\/folhas\/([^/]+)$/, gabaritos.telaFolhas],
  [/^\/formatador$/, avaliacoes.telaFormatador],
  [/^\/formatador\/questoes$/, questoes.telaBanco],
  [/^\/formatador\/avaliacoes$/, avaliacoes.telaAvaliacoes],
  [/^\/formatador\/questao\/([^/]+)$/, questoes.telaQuestao],
  [/^\/formatador\/avaliacao\/([^/]+)$/, avaliacoes.telaAvaliacao],
  [/^\/formatador\/imprimir\/([^/]+)$/, avaliacoes.telaImprimir],
];

async function navegar() {
  if (limparTela) { try { limparTela(); } catch (e) { console.error(e); } limparTela = null; }
  const [caminho, qs] = location.hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(qs || '');
  tela.acoes();
  tela.titulo('');
  document.body.dataset.rota = caminho.split('/')[1] || 'inicio';
  voltarBtn.style.visibility = caminho && caminho !== '/' ? 'visible' : 'hidden';
  app.replaceChildren();
  window.scrollTo(0, 0);
  for (const [re, fn] of rotas) {
    const m = caminho.match(re);
    if (m) {
      try {
        await fn(app, tela, ...m.slice(1).map(decodeURIComponent), params);
      } catch (e) {
        console.error(e);
        app.replaceChildren(h('div', { class: 'erro' }, 'Ocorreu um erro: ' + e.message));
      }
      return;
    }
  }
  app.replaceChildren(h('div', { class: 'erro' }, 'Página não encontrada.'));
}

voltarBtn.addEventListener('click', () => {
  const [caminho] = location.hash.replace(/^#/, '').split('?');
  const partes = caminho.split('/').filter(Boolean);
  // volta um nível lógico
  const pais = {
    corrigir: '/leitor', resultados: '/leitor', gabaritos: '/leitor', colecao: '/leitor/gabaritos',
    questoes: '/formatador', questao: '/formatador/questoes', avaliacao: '/formatador', avaliacoes: '/formatador',
  };
  if (partes[1] === 'gabarito') return (location.hash = `/leitor/colecao/${partes[2]}`);
  if (partes[1] === 'folhas') return (location.hash = `/leitor/colecao/${partes[2]}`);
  if (partes[1] === 'imprimir') return (location.hash = `/formatador/avaliacao/${partes[2]}`);
  location.hash = pais[partes[1]] || '/';
});

function inicio(app, tela) {
  tela.titulo('');
  app.append(
    h('section', { class: 'inicio' },
      h('div', { class: 'inicio-cabecalho' },
        h('h1', {}, 'Prof'),
        h('p', {}, 'Correção de gabaritos e formatação de avaliações')),
      h('div', { class: 'inicio-botoes' },
        h('a', { href: '#/leitor', class: 'botao-grande leitor' },
          h('span', { class: 'bg-icone', html: iconeLeitor }),
          h('span', { class: 'bg-titulo' }, 'Leitor de Gabarito'),
          h('span', { class: 'bg-desc' }, 'Corrija provas com a câmera ou escaneando as folhas de resposta')),
        h('a', { href: '#/formatador', class: 'botao-grande formatador' },
          h('span', { class: 'bg-icone', html: iconeFormatador }),
          h('span', { class: 'bg-titulo' }, 'Formatador de Avaliações'),
          h('span', { class: 'bg-desc' }, 'Monte provas a partir das suas questões')))));
}

const iconeLeitor = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M8 18V10a2 2 0 0 1 2-2h8M46 8h8a2 2 0 0 1 2 2v8M56 46v8a2 2 0 0 1-2 2h-8M18 56h-8a2 2 0 0 1-2-2v-8"/><circle cx="22" cy="24" r="4" fill="currentColor"/><circle cx="34" cy="24" r="4"/><circle cx="46" cy="24" r="4"/><circle cx="22" cy="36" r="4"/><circle cx="34" cy="36" r="4" fill="currentColor"/><circle cx="46" cy="36" r="4"/><path d="M14 46h36" stroke-dasharray="2 5"/></svg>`;
const iconeFormatador = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 6h24l12 12v38a2 2 0 0 1-2 2H16a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M40 6v12h12"/><path d="M22 28h20M22 36h20M22 44h12"/><rect x="36" y="40" width="8" height="8" rx="1"/></svg>`;

window.addEventListener('hashchange', navegar);
navegar();
iniciarConta().finally(iniciarSincronizacao);

// chegou alteração de outro aparelho: atualiza as telas de lista (as de edição ficam como estão)
const TELAS_DE_LISTA = /^\/?$|^\/formatador(\/questoes|\/avaliacoes)?$|^\/leitor(\/gabaritos)?$/;
window.addEventListener('prof-dados-atualizados', () => {
  const [caminho] = location.hash.replace(/^#/, '').split('?');
  if (TELAS_DE_LISTA.test(caminho) && !document.querySelector('.modal-overlay')) navegar();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
