import { h, uid, toast, modal, confirmar, campo, vazio, LETRAS, dataBR, baixar, escolherArquivo, carregarPdfJs } from './ui.js';
import { db } from './db.js';
import { lerFolha, paraCanvas, desenharResultado } from './omr-reader.js';
import { ic, icBloco } from './icones.js';

// ---------------------------------------------------------------- Menu do leitor
export async function telaLeitor(app, tela) {
  tela.titulo('Leitor de Gabarito');
  const cols = (await db.getAll('colecoes')).sort((a, b) => b.atualizadoEm - a.atualizadoEm);
  const escolherColecao = async (destino) => {
    if (!cols.length) { toast('Crie primeiro um gabarito em "Gabaritos".', 'erro'); return tela.ir('/leitor/gabaritos'); }
    if (cols.length === 1) return tela.ir(destino(cols[0].id));
    const sel = h('select', {}, cols.map((c) => h('option', { value: c.id }, `${c.nome} (${c.gabaritos.length} gabarito(s))`)));
    const r = await modal({ titulo: 'Escolha a coleção de gabaritos', corpo: campo('Coleção', sel), acoes: [{ label: 'Cancelar', value: null }, { label: 'Continuar', primary: true, value: 'ok' }] });
    if (r === 'ok') tela.ir(destino(sel.value));
  };
  app.append(
    h('div', { class: 'botoes-leitor' },
      h('button', { class: 'botao-acao', onclick: () => escolherColecao((id) => `/leitor/corrigir/${id}?modo=camera`) },
        icBloco('camera'), h('span', {}, 'Corrigir com a câmera', h('small', {}, 'Aponte o celular para a folha de respostas'))),
      h('button', { class: 'botao-acao', onclick: () => escolherColecao((id) => `/leitor/corrigir/${id}?modo=arquivos`) },
        icBloco('escaneadas'), h('span', {}, 'Corrigir provas escaneadas', h('small', {}, 'Fotos ou PDF do scanner, várias de uma vez'))),
      h('a', { class: 'botao-acao', href: '#/leitor/gabaritos' },
        icBloco('pasta'), h('span', {}, 'Gabaritos', h('small', {}, 'Criar e organizar coleções de gabaritos'))),
      h('button', { class: 'botao-acao', onclick: () => escolherColecao((id) => `/leitor/resultados/${id}`) },
        icBloco('grafico'), h('span', {}, 'Resultados', h('small', {}, 'Notas, estatísticas e exportação')))));
  if (cols.length) {
    app.append(h('div', { class: 'secao-head' }, h('h2', {}, 'Coleções recentes')),
      h('div', { class: 'lista' }, cols.slice(0, 6).map((c) => h('a', { class: 'item', href: `#/leitor/colecao/${c.id}` },
        icBloco('pasta', 'pequeno'),
        h('div', { class: 'item-corpo' }, h('div', { class: 'item-titulo' }, c.nome),
          h('div', { class: 'item-sub' }, `${c.gabaritos.length} gabarito(s) · ${c.nQuestoes} questões`))))));
  }
}

// ---------------------------------------------------------------- Correção
export function corrigir(col, gab, respostas) {
  let acertos = 0;
  respostas.forEach((r, q) => { if (gab.anuladas[q] || (r !== null && r >= 0 && r === gab.respostas[q])) acertos++; });
  const nota = Math.round((acertos / col.nQuestoes) * (col.notaMaxima ?? 10) * 100) / 100;
  return { acertos, nota };
}

async function arquivosParaImagens(files) {
  const out = [];
  for (const f of files) {
    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      const pdfjs = await carregarPdfJs();
      const pdf = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
      for (let p = 1; p <= pdf.numPages; p++) {
        out.push({
          nome: `${f.name} — pág. ${p}`,
          carregar: async () => {
            const page = await pdf.getPage(p);
            const vp0 = page.getViewport({ scale: 1 });
            const vp = page.getViewport({ scale: 1800 / Math.max(vp0.width, vp0.height) });
            const c = document.createElement('canvas');
            c.width = vp.width; c.height = vp.height;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
            await page.render({ canvasContext: ctx, viewport: vp }).promise;
            return c;
          },
        });
      }
    } else if (f.type.startsWith('image/')) {
      out.push({
        nome: f.name,
        carregar: async () => {
          const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null);
          if (bmp) return paraCanvas(bmp, 1800);
          const img = new Image();
          img.src = URL.createObjectURL(f);
          await img.decode();
          return paraCanvas(img, 1800);
        },
      });
    }
  }
  return out;
}

export async function telaCorrigir(app, tela, colId, params) {
  const col = await db.get('colecoes', colId);
  if (!col) { app.append(vazio('busca', 'Coleção não encontrada.')); return; }
  tela.titulo(`Corrigir · ${col.nome}`);
  const modo = params.get('modo') || 'camera';
  const cfg = { nQuestoes: col.nQuestoes, nAlt: col.nAlternativas, nTipos: col.gabaritos.length > 1 ? col.gabaritos.length : 0 };
  const incompletos = col.gabaritos.filter((g) => g.respostas.some((r, q) => r === null && !g.anuladas[q]));
  tela.acoes(h('a', { class: 'btn', href: `#/leitor/resultados/${col.id}` }, 'Resultados'));

  app.append(h('div', { class: 'abas' },
    h('a', { class: `aba ${modo === 'camera' ? 'ativa' : ''}`, href: `#/leitor/corrigir/${col.id}?modo=camera` }, ic('camera'), 'Câmera'),
    h('a', { class: `aba ${modo === 'arquivos' ? 'ativa' : ''}`, href: `#/leitor/corrigir/${col.id}?modo=arquivos` }, ic('escaneadas'), 'Arquivos escaneados')));
  if (incompletos.length) {
    app.append(h('div', { class: 'erro', style: { marginBottom: '12px' } },
      `Atenção: ${incompletos.map((g) => g.nome).join(', ')} tem questões sem resposta no gabarito. `,
      h('a', { href: `#/leitor/colecao/${col.id}` }, 'Completar gabaritos')));
  }
  const area = h('div');
  const revisaoEl = h('div');
  app.append(area, revisaoEl);

  // painel de revisão compartilhado
  const revisar = (leitura, origem) => new Promise((resolve) => {
    area.style.display = 'none';
    mostrarRevisao(revisaoEl, col, leitura, origem, (salvo) => {
      revisaoEl.replaceChildren();
      area.style.display = '';
      resolve(salvo);
    });
  });

  if (modo === 'camera') await modoCamera(area, tela, cfg, revisar);
  else modoArquivos(area, cfg, revisar);
}

async function modoCamera(area, tela, cfg, revisar) {
  const video = h('video', { autoplay: true, playsinline: true, muted: true });
  const status = h('div', { class: 'camera-status' }, 'Iniciando câmera…');
  const box = h('div', { class: 'camera-box' }, video, h('div', { class: 'camera-guia' }, h('i'), h('i'), h('i'), h('i')), status);
  const auto = h('input', { type: 'checkbox', checked: true });
  let pausado = false, ocupado = false, seguidos = 0, stream = null, timer = null;

  const capturar = async () => {
    if (ocupado || !video.videoWidth) return;
    ocupado = true; pausado = true;
    status.textContent = 'Lendo…';
    const canvas = paraCanvas(video, 1800);
    const leitura = lerFolha(canvas, cfg, { maxLado: 1800 });
    if (!leitura.ok) {
      toast(leitura.erro, 'erro');
      ocupado = false; pausado = false; seguidos = 0;
      return;
    }
    if (navigator.vibrate) navigator.vibrate(60);
    await revisar(leitura, 'câmera');
    ocupado = false; pausado = false; seguidos = 0;
  };

  area.append(box,
    h('div', { class: 'camera-controles' },
      h('label', { class: 'campo-check', style: { margin: 0 } }, auto, 'Captura automática'),
      h('button', { class: 'btn-captura', title: 'Capturar', 'aria-label': 'Capturar', onclick: capturar }),
      h('span', { class: 'dica', style: { maxWidth: '220px' } }, 'Enquadre a folha inteira, com boa iluminação e sem sombras.')));

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
    video.srcObject = stream;
    await video.play().catch(() => {});
  } catch (e) {
    status.textContent = 'Câmera indisponível';
    area.prepend(h('div', { class: 'erro', style: { marginBottom: '12px' } },
      'Não foi possível acessar a câmera. Verifique a permissão do navegador (o app precisa ser aberto por https ou localhost). ',
      'Você também pode usar a aba "Arquivos escaneados" e enviar fotos.'));
    return;
  }
  timer = setInterval(() => {
    if (pausado || ocupado || !video.videoWidth) return;
    const r = lerFolha(video, cfg, { maxLado: 720, soDetectar: true });
    box.classList.toggle('detectado', r.ok);
    seguidos = r.ok ? seguidos + 1 : 0;
    status.textContent = r.ok ? (auto.checked ? 'Folha encontrada — segure firme…' : 'Folha encontrada — toque para capturar') : 'Procurando os 4 quadrados dos cantos…';
    if (auto.checked && seguidos >= 3) capturar();
  }, 350);
  tela.aoSair(() => { clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); });
}

function modoArquivos(area, cfg, revisar) {
  const info = h('div', { class: 'fila-arquivos' });
  const enviar = async () => {
    const files = await escolherArquivo('image/*,application/pdf,.pdf', true);
    if (!files.length) return;
    info.textContent = 'Preparando arquivos…';
    let itens;
    try { itens = await arquivosParaImagens(files); } catch (e) { toast(e.message, 'erro'); info.textContent = ''; return; }
    let salvos = 0, falhas = [];
    for (let i = 0; i < itens.length; i++) {
      info.textContent = `Lendo ${i + 1} de ${itens.length}: ${itens[i].nome}`;
      const canvas = await itens[i].carregar();
      const leitura = lerFolha(canvas, cfg, { maxLado: 1800 });
      if (!leitura.ok) { falhas.push(itens[i].nome); continue; }
      const s = await revisar(leitura, `${itens[i].nome} (${i + 1}/${itens.length})`);
      if (s === 'parar') break;
      if (s) salvos++;
    }
    info.replaceChildren(`Concluído: ${salvos} folha(s) salva(s).`, falhas.length ? h('span', { style: { color: 'var(--verm)' } }, ` Não foi possível ler: ${falhas.join(', ')}.`) : '');
  };
  area.append(
    h('div', { class: 'cartao', style: { textAlign: 'center', padding: '34px 16px' } },
      icBloco('escaneadas', 'grande'),
      h('p', {}, 'Envie fotos (JPG, PNG) ou PDFs do scanner com as folhas de resposta. Pode selecionar vários arquivos de uma vez.'),
      h('button', { class: 'btn btn-primary btn-grande', onclick: enviar }, 'Selecionar arquivos'),
      h('p', { class: 'dica' }, 'Dica: escaneie em 200 dpi ou mais, em tons de cinza ou colorido.')),
    info);
}

function mostrarRevisao(el, col, leitura, origem, concluir) {
  const multiplos = col.gabaritos.length > 1;
  const respostas = [...leitura.respostas];
  let tipoIdx = multiplos ? leitura.tipo : 0;
  const numInp = h('input', { class: 'inp', value: leitura.numero || '', inputmode: 'numeric', style: { maxWidth: '90px' } });
  const nomeInp = h('input', { class: 'inp', placeholder: 'Nome (opcional)' });
  const tipoSel = h('select', { class: 'inp', style: { maxWidth: '160px' } },
    multiplos && tipoIdx === null ? h('option', { value: '' }, '— escolha —') : null,
    col.gabaritos.map((g, i) => h('option', { value: i, selected: i === tipoIdx }, g.nome)));
  const placar = h('div', { class: 'placar' });
  const grade = h('div', { class: 'resp-grade' });
  const imgWrap = h('div');

  const render = () => {
    const gab = tipoIdx === null ? null : col.gabaritos[tipoIdx];
    imgWrap.replaceChildren(desenharResultado(leitura, respostas, gab ? gab.respostas : [], gab ? gab.anuladas : []));
    if (gab) {
      const { acertos, nota } = corrigir(col, gab, respostas);
      placar.replaceChildren(h('span', { class: 'nota' }, nota.toLocaleString('pt-BR')),
        h('span', {}, `${acertos} de ${col.nQuestoes} acertos`), h('span', { class: 'chip' }, gab.nome));
    } else {
      placar.replaceChildren(h('span', { class: 'chip verm' }, 'Tipo de prova não identificado — escolha o tipo.'));
    }
    grade.replaceChildren(...respostas.map((r, q) => {
      const cls = !gab ? '' : gab.anuladas[q] ? 'anul' : r !== null && r === gab.respostas[q] ? 'ok' : 'erro';
      const sel = h('select', { 'aria-label': `Resposta da questão ${q + 1}` },
        h('option', { value: '' }, '—'),
        Array.from({ length: col.nAlternativas }, (_, a) => h('option', { value: a, selected: r === a }, LETRAS[a])),
        h('option', { value: '-1', selected: r === -1 }, 'múlt.'));
      sel.addEventListener('change', () => { respostas[q] = sel.value === '' ? null : +sel.value; render(); });
      return h('div', { class: `resp-item ${cls}` }, h('b', {}, `${q + 1}.`), sel,
        gab && !gab.anuladas[q] && cls === 'erro' && gab.respostas[q] !== null ? h('small', { class: 'dica' }, `(${LETRAS[gab.respostas[q]]})`) : null);
    }));
  };
  tipoSel.addEventListener('change', () => { tipoIdx = tipoSel.value === '' ? null : +tipoSel.value; render(); });

  const salvar = async () => {
    if (tipoIdx === null) { toast('Escolha o tipo de prova.', 'erro'); return; }
    const gab = col.gabaritos[tipoIdx];
    const { acertos, nota } = corrigir(col, gab, respostas);
    const aluno = numInp.value.trim();
    const existentes = await db.byIndex('resultados', 'colecaoId', col.id);
    const dup = aluno && existentes.find((r) => r.aluno === aluno);
    if (dup && !(await confirmar(`Já existe um resultado para o aluno nº ${aluno}. Substituir?`, { ok: 'Substituir' }))) return;
    if (dup) await db.del('resultados', dup.id);
    const mini = paraCanvas(imgWrap.querySelector('canvas'), 900).toDataURL('image/jpeg', 0.7);
    await db.put('resultados', {
      id: uid(), colecaoId: col.id, gabaritoId: gab.id, aluno, nome: nomeInp.value.trim(),
      respostas, acertos, nota, imagem: mini,
    });
    col.atualizadoEm = Date.now();
    await db.put('colecoes', col);
    toast(`Salvo: ${aluno ? 'aluno nº ' + aluno : 'sem número'} — nota ${nota.toLocaleString('pt-BR')}`, 'ok');
    concluir(true);
  };

  el.replaceChildren(h('div', { class: 'cartao' },
    h('div', { class: 'secao-head' }, h('h2', {}, 'Conferir leitura'), h('span', { class: 'dica' }, origem)),
    h('div', { class: 'revisao' },
      imgWrap,
      h('div', {},
        placar,
        h('div', { class: 'linha-botoes', style: { marginBottom: '12px' } },
          h('label', {}, 'Nº ', numInp), multiplos ? h('label', {}, 'Tipo ', tipoSel) : null, nomeInp),
        !leitura.numero && leitura.formato !== 'compacto' ? h('p', { class: 'dica' }, 'Número do aluno não marcado/identificado na folha.') : null,
        leitura.formato === 'compacto' ? h('p', { class: 'dica' }, 'Gabarito da prova (sem número do aluno): digite o nº ou o nome.') : null,
        grade,
        h('div', { class: 'linha-botoes', style: { marginTop: '16px' } },
          h('button', { class: 'btn btn-ok btn-grande', onclick: salvar }, ic('check'), 'Salvar e continuar'),
          h('button', { class: 'btn', onclick: () => concluir(false) }, 'Descartar'))))));
  render();
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------- Resultados
export async function telaResultados(app, tela, colId) {
  const col = await db.get('colecoes', colId);
  if (!col) { app.append(vazio('busca', 'Coleção não encontrada.')); return; }
  tela.titulo(`Resultados · ${col.nome}`);
  const res = (await db.byIndex('resultados', 'colecaoId', colId))
    .sort((a, b) => (a.aluno || '999').localeCompare(b.aluno || '999', 'pt', { numeric: true }));
  tela.acoes(h('a', { class: 'btn btn-primary', href: `#/leitor/corrigir/${col.id}` }, ic('camera'), 'Corrigir'));
  if (!res.length) { app.append(vazio('grafico', 'Nenhuma prova corrigida nesta coleção ainda.', h('a', { class: 'btn btn-primary', href: `#/leitor/corrigir/${col.id}` }, 'Corrigir provas'))); return; }

  const gabDe = (r) => col.gabaritos.find((g) => g.id === r.gabaritoId);
  const notas = res.map((r) => r.nota);
  const media = notas.reduce((a, b) => a + b, 0) / notas.length;
  const fmt = (n) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

  // acerto por questão — numeração do gabarito de cada aluno
  const porTipo = col.gabaritos.map((g) => {
    const rs = res.filter((r) => r.gabaritoId === g.id);
    return { g, n: rs.length, taxa: g.respostas.map((c, q) => rs.length ? rs.filter((r) => g.anuladas[q] || r.respostas[q] === c).length / rs.length : 0) };
  }).filter((t) => t.n);

  const exportar = () => {
    const linhas = [['Nº', 'Nome', 'Tipo', 'Acertos', 'Nota', 'Data', ...Array.from({ length: col.nQuestoes }, (_, i) => `Q${i + 1}`)]];
    res.forEach((r) => linhas.push([r.aluno, r.nome, gabDe(r)?.nome || '', r.acertos, fmt(r.nota), dataBR(r.criadoEm),
      ...r.respostas.map((x) => (x === null ? '' : x === -1 ? '*' : LETRAS[x]))]));
    const csv = '﻿' + linhas.map((l) => l.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
    baixar(`resultados-${col.nome.replace(/[^\w-]+/g, '_')}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const tbody = h('tbody');
  app.append(
    h('div', { class: 'grade secao' },
      h('div', { class: 'cartao' }, h('div', { class: 'item-sub' }, 'Provas corrigidas'), h('div', { class: 'placar' }, h('span', { class: 'nota' }, res.length))),
      h('div', { class: 'cartao' }, h('div', { class: 'item-sub' }, 'Média'), h('div', { class: 'placar' }, h('span', { class: 'nota' }, fmt(media)))),
      h('div', { class: 'cartao' }, h('div', { class: 'item-sub' }, 'Maior / menor nota'), h('div', { class: 'placar' }, h('span', { class: 'nota', style: { fontSize: '30px' } }, `${fmt(Math.max(...notas))} / ${fmt(Math.min(...notas))}`)))),
    h('div', { class: 'secao' },
      h('div', { class: 'secao-head' }, h('h2', {}, 'Alunos'), h('button', { class: 'btn', onclick: exportar }, '⬇️ Exportar planilha (CSV)')),
      h('div', { class: 'tabela-wrap' }, h('table', { class: 'tabela' },
        h('thead', {}, h('tr', {}, ['Nº', 'Nome', 'Tipo', 'Acertos', 'Nota', 'Data', ''].map((t) => h('th', {}, t)))), tbody))),
    h('details', { class: 'cartao secao', open: true },
      h('summary', {}, 'Acertos por questão'),
      porTipo.map((t) => h('div', { style: { marginBottom: '14px' } },
        porTipo.length > 1 ? h('h3', { style: { fontSize: '15px' } }, `${t.g.nome} (${t.n} aluno(s))`) : null,
        h('div', { class: 'resp-grade' }, t.taxa.map((x, q) => h('div', { class: 'resp-item', title: `${Math.round(x * 100)}%` },
          h('b', {}, `${q + 1}.`), h('div', { class: 'barra', style: { flex: 1 } }, h('span', { style: { width: `${x * 100}%`, background: x < 0.4 ? 'var(--verm)' : x < 0.7 ? 'var(--amar)' : 'var(--ver)' } })),
          h('small', {}, `${Math.round(x * 100)}%`))))))));

  res.forEach((r) => {
    const tr = h('tr', {},
      h('td', {}, r.aluno || '—'), h('td', {}, r.nome || ''), h('td', {}, gabDe(r)?.nome || '?'),
      h('td', {}, `${r.acertos}/${col.nQuestoes}`), h('td', {}, h('b', {}, fmt(r.nota))), h('td', {}, dataBR(r.criadoEm)),
      h('td', { style: { whiteSpace: 'nowrap' } },
        h('button', { class: 'btn btn-sm', onclick: () => verResultado(col, r, gabDe(r)) }, 'Ver'), ' ',
        h('button', {
          class: 'btn btn-sm', onclick: async () => {
            if (!(await confirmar(`Excluir o resultado do aluno ${r.aluno || 'sem número'}?`, { ok: 'Excluir', perigo: true }))) return;
            await db.del('resultados', r.id); tr.remove(); toast('Resultado excluído');
          },
        }, 'Excluir')));
    tbody.append(tr);
  });
}

function verResultado(col, r, gab) {
  modal({
    titulo: `Aluno ${r.aluno || 'sem número'}${r.nome ? ' — ' + r.nome : ''}`,
    largo: true,
    corpo: h('div', { class: 'revisao' },
      r.imagem ? h('img', { src: r.imagem, style: { width: '100%', borderRadius: '8px', border: '1px solid var(--borda)' } }) : h('div'),
      h('div', {},
        h('div', { class: 'placar' }, h('span', { class: 'nota' }, r.nota.toLocaleString('pt-BR')), h('span', {}, `${r.acertos}/${col.nQuestoes} acertos`), gab ? h('span', { class: 'chip' }, gab.nome) : null),
        h('div', { class: 'resp-grade' }, r.respostas.map((x, q) => {
          const certo = gab && (gab.anuladas[q] || x === gab.respostas[q]);
          return h('div', { class: `resp-item ${gab?.anuladas[q] ? 'anul' : certo ? 'ok' : 'erro'}` }, h('b', {}, `${q + 1}.`),
            x === null ? '—' : x === -1 ? 'múlt.' : LETRAS[x], !certo && gab?.respostas[q] != null ? h('small', { class: 'dica' }, ` (${LETRAS[gab.respostas[q]]})`) : '');
        })))),
  });
}
