// Lembrete de backup: como nada fica guardado na nuvem, avisa na tela inicial
// quando faz mais de 30 dias desde o último backup (ou desde que o app começou a ser usado).
import { h, baixar, toast } from './ui.js';
import { db, exportarTudo, STORES } from './db.js';

const LS = 'prof-backup-lembrete'; // { ultimo, inicio, adiadoAte }
const DIA = 86400000;
const INTERVALO = 30 * DIA;

function ler() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } }
function gravar(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* sem armazenamento */ } }

export function marcarBackupFeito() { gravar({ ...ler(), ultimo: Date.now(), adiadoAte: 0 }); }

async function temDados() {
  for (const s of STORES) if ((await db.getAll(s)).length) return true;
  return false;
}

/** Devolve o aviso para a tela inicial, ou null se ainda não é hora. */
export async function avisoBackup() {
  const s = ler();
  const agora = Date.now();
  if (!s.inicio) { gravar({ ...s, inicio: agora }); return null; }
  if (s.adiadoAte && agora < s.adiadoAte) return null;
  const desde = s.ultimo || s.inicio;
  if (agora - desde < INTERVALO) return null;
  if (!(await temDados())) return null;
  const dias = Math.floor((agora - desde) / DIA);
  const el = h('div', { class: 'aviso-backup', role: 'status' },
    h('div', { class: 'aviso-backup-txt' },
      h('b', {}, 'Hora de fazer backup'),
      h('span', {}, s.ultimo ? `Seu último backup foi há ${dias} dias.` : 'Você ainda não fez nenhum backup.',
        ' Como nada fica guardado na nuvem, o backup protege seus dados se o aparelho for perdido.')),
    h('div', { class: 'linha-botoes' },
      h('button', {
        class: 'btn btn-primary btn-sm', type: 'button', onclick: async () => {
          const dados = await exportarTudo();
          baixar(`prof-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(dados));
          marcarBackupFeito();
          el.remove();
          toast('Backup salvo. Guarde o arquivo em um lugar seguro (Drive, e-mail, pendrive).', 'ok');
        },
      }, 'Fazer backup agora'),
      h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { gravar({ ...ler(), adiadoAte: Date.now() + 7 * DIA }); el.remove(); } }, 'Lembrar depois')));
  return el;
}
