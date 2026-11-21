// Tela "Apoie o Prof": contribuição voluntária por Pix (QR Code e Pix copia e cola).
import { h, toast } from './ui.js';

// Código Pix estático (sem valor definido: quem contribui escolhe o valor no app do banco)
export const PIX = '00020126910014br.gov.bcb.pix0136bf6a3f3c-4d14-4f34-a163-3fda7ac015700229Agradecemos sua contribuicao.5204000053039865802BR5923WEMERSON NUNES DA SILVA6009Sao Paulo62080504Prof630438DE';
const RECEBEDOR = 'Wemerson Nunes da Silva';

async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; } catch { /* sem permissão: usa o jeito antigo */ }
  const t = h('textarea', { style: { position: 'fixed', opacity: '0' } }, texto);
  document.body.append(t);
  t.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { /* nada */ }
  t.remove();
  return ok;
}

export function telaApoie(app, tela) {
  tela.titulo('Apoie o Prof');
  const codigo = h('textarea', { class: 'inp apoie-codigo', readonly: true, rows: 3, 'aria-label': 'Código Pix copia e cola' }, PIX);
  codigo.addEventListener('focus', () => codigo.select());
  const btnCopiar = h('button', {
    class: 'btn btn-primary btn-grande', type: 'button', onclick: async () => {
      if (await copiar(PIX)) { btnCopiar.textContent = '✓ Código copiado'; toast('Código Pix copiado. Cole no app do seu banco.', 'ok'); setTimeout(() => { btnCopiar.textContent = 'Copiar código Pix'; }, 3000); }
      else { codigo.focus(); toast('Selecione o código e copie manualmente.', 'erro'); }
    },
  }, 'Copiar código Pix');

  app.append(h('div', { class: 'apoie' },
    h('section', { class: 'cartao apoie-cartao' },
      h('div', { class: 'apoie-coracao', 'aria-hidden': 'true' }, '♥'),
      h('h2', {}, 'Gostou do Prof?'),
      h('p', {}, 'O Prof é feito por um professor, para professores. Se ele economiza o seu tempo, considere contribuir com qualquer valor. A contribuição é voluntária e ajuda a manter o app no ar e a criar novos recursos.'),
      h('img', { class: 'apoie-qr', src: 'icons/pix-qr.svg', alt: 'QR Code Pix para contribuir com o Prof', width: 240, height: 240 }),
      h('p', { class: 'dica' }, 'Abra o app do seu banco, escolha ', h('b', {}, 'Pix → Ler QR Code'), ' e aponte para a imagem. Você escolhe o valor.'),
      h('div', { class: 'apoie-ou' }, 'ou use o Pix copia e cola'),
      btnCopiar,
      codigo,
      h('p', { class: 'dica' }, 'No app do banco: ', h('b', {}, 'Pix → Pix copia e cola'), ', cole o código e digite o valor.'),
      h('p', { class: 'dica apoie-recebedor' }, `O Pix vai para ${RECEBEDOR}. Confira o nome antes de confirmar.`)),
    h('p', { class: 'dica apoie-obrigado' }, 'Obrigado por apoiar! 💙')));
}
