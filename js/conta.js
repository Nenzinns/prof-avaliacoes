// Conta do professor (login) usando o Supabase.
// Entrar com Google ou com um código de 6 dígitos enviado por e-mail.
// A biblioteca do Supabase só é carregada quando necessária (ao abrir a conta ou se já houver login).
import { h, modal, toast } from './ui.js';

const SUPABASE_URL = 'https://qsahfbtfmrsbzzjngjeh.supabase.co';
// chave pública (publishable): pode ficar no app; a proteção dos dados é feita pelas regras do banco
const SUPABASE_CHAVE = 'sb_publishable_ivbvv2yROA93yVgzeoR9VA_oPmfRQZG';
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.min.js';
const CHAVE_SESSAO = 'prof-sessao';
const VOLTAR = 'prof-voltar-login';

let clientePromise = null;
let usuarioAtual = null;

function carregarLib() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = LIB;
    s.onload = () => resolve(window.supabase);
    s.onerror = () => { s.remove(); reject(new Error('Não foi possível conectar ao serviço de contas. Verifique a internet.')); };
    document.head.append(s);
  });
}

/** Cliente do Supabase (carrega a biblioteca na primeira vez). */
export function cliente() {
  if (!clientePromise) {
    clientePromise = carregarLib().then((lib) => {
      const c = lib.createClient(SUPABASE_URL, SUPABASE_CHAVE, {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: CHAVE_SESSAO },
      });
      c.auth.onAuthStateChange((_ev, sessao) => {
        const antes = usuarioAtual?.id;
        usuarioAtual = sessao?.user || null;
        if (antes !== usuarioAtual?.id) window.dispatchEvent(new CustomEvent('prof-conta', { detail: usuarioAtual }));
      });
      return c;
    }).catch((e) => { clientePromise = null; throw e; });
  }
  return clientePromise;
}

export const usuario = () => usuarioAtual;
const temSessaoSalva = () => { try { return !!localStorage.getItem(CHAVE_SESSAO); } catch { return false; } };

/**
 * Chamado ao abrir o app: conclui o login que voltou do Google (?code=…)
 * e restaura a sessão de quem já entrou antes.
 */
export async function iniciarConta() {
  const url = new URL(location.href);
  const voltouDoLogin = url.searchParams.has('code') || url.searchParams.has('error_description');
  if (!voltouDoLogin && !temSessaoSalva()) return;
  try {
    const c = await cliente();
    const { data } = await c.auth.getSession();
    usuarioAtual = data.session?.user || null;
    if (voltouDoLogin) {
      const erro = url.searchParams.get('error_description');
      let destino = '#/configuracoes';
      try { destino = sessionStorage.getItem(VOLTAR) || destino; sessionStorage.removeItem(VOLTAR); } catch { /* sem armazenamento */ }
      history.replaceState(null, '', url.pathname + destino);
      if (erro) toast('Não foi possível entrar: ' + erro, 'erro');
      else if (usuarioAtual) toast('Você entrou como ' + (usuarioAtual.email || 'usuário'), 'ok');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  } catch (e) {
    if (voltouDoLogin) toast(e.message, 'erro');
  }
}

const enderecoDoApp = () => location.origin + location.pathname;

export async function entrarComGoogle() {
  const c = await cliente();
  try { sessionStorage.setItem(VOLTAR, location.hash || '#/'); } catch { /* sem armazenamento */ }
  const { error } = await c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: enderecoDoApp() } });
  if (error) throw traduzir(error);
}

export async function enviarCodigo(email) {
  const c = await cliente();
  const { error } = await c.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: enderecoDoApp() } });
  if (error) throw traduzir(error);
}

export async function confirmarCodigo(email, codigo) {
  const c = await cliente();
  const { data, error } = await c.auth.verifyOtp({ email, token: codigo, type: 'email' });
  if (error) throw traduzir(error);
  usuarioAtual = data.user;
  return data.user;
}

export async function sair() {
  const c = await cliente();
  await c.auth.signOut();
  usuarioAtual = null;
  window.dispatchEvent(new CustomEvent('prof-conta', { detail: null }));
}

function traduzir(e) {
  const m = e?.message || String(e);
  if (/rate limit|too many|security purposes/i.test(m)) return new Error('Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.');
  if (/expired|invalid.*(otp|token)|token.*(invalid|expired)/i.test(m)) return new Error('Código inválido ou vencido. Confira o código ou peça um novo.');
  if (/provider is not enabled|unsupported provider/i.test(m)) return new Error('O login com Google ainda não foi ativado no servidor.');
  if (/invalid.*email|email.*invalid/i.test(m)) return new Error('E-mail inválido.');
  if (/failed to fetch|network/i.test(m)) return new Error('Sem conexão. Verifique a internet.');
  return new Error(m);
}

// ---------------------------------------------------------------- interface
const iconeGoogle = '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';

/** Diálogo de login por e-mail: pede o e-mail, envia o código e confere. */
async function dialogoEmail() {
  const email = h('input', { class: 'inp', type: 'email', autocomplete: 'email', placeholder: 'seu@email.com' });
  const codigo = h('input', { class: 'inp', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 10, placeholder: 'Código de 6 dígitos' });
  const etapa2 = h('div', { hidden: true },
    h('p', {}, 'Abra o e-mail e toque no link ', h('b', {}, '"Sign in"'), ' neste mesmo aparelho. O Prof abre já com a sua conta.'),
    h('label', { class: 'campo' }, h('span', { class: 'campo-label' }, 'Ou, se o e-mail trouxer um código, digite-o aqui'), codigo));
  const aviso = h('p', { class: 'dica', role: 'status' });
  let enviado = false;
  // se o login terminar pelo link (em outra aba), fecha este diálogo
  const aoEntrar = (e) => {
    if (!e.detail) return;
    window.removeEventListener('prof-conta', aoEntrar);
    [...document.querySelectorAll('.modal-foot .btn')].find((b) => b.textContent === 'Cancelar')?.click();
  };
  window.addEventListener('prof-conta', aoEntrar);
  return modal({
    titulo: 'Entrar com e-mail',
    corpo: h('div', {},
      h('p', { class: 'dica' }, 'Enviaremos um link de acesso para o seu e-mail. Não é preciso criar senha.'),
      h('label', { class: 'campo' }, h('span', { class: 'campo-label' }, 'E-mail'), email),
      etapa2, aviso),
    acoes: [{ label: 'Cancelar', value: null }, {
      label: 'Continuar', primary: true, onClick: async () => {
        const btn = [...document.querySelectorAll('.modal-foot .btn')].find((b) => b.textContent === 'Continuar');
        btn.disabled = true;
        try {
          if (!enviado) {
            if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) throw new Error('Digite um e-mail válido.');
            aviso.textContent = 'Enviando o código…';
            await enviarCodigo(email.value.trim());
            enviado = true;
            email.disabled = true;
            etapa2.hidden = false;
            aviso.textContent = 'E-mail enviado. Se não aparecer na caixa de entrada, veja o spam.';
            codigo.focus();
            return false;
          }
          const tok = codigo.value.replace(/\D/g, '');
          if (tok.length < 6) throw new Error('Digite o código que chegou no e-mail.');
          aviso.textContent = 'Conferindo…';
          await confirmarCodigo(email.value.trim(), tok);
          return true;
        } catch (e) {
          aviso.textContent = e.message;
          return false;
        } finally { btn.disabled = false; }
      },
    }],
  }).finally(() => window.removeEventListener('prof-conta', aoEntrar));
}

/** Seção "Conta" da tela de Configurações. */
export function secaoConta() {
  const corpo = h('div');
  const sec = h('section', { class: 'cartao secao' }, h('h2', { class: 'cfg-tit' }, 'Conta'), corpo);

  const render = () => {
    const u = usuarioAtual;
    if (u) {
      const nome = u.user_metadata?.full_name || u.user_metadata?.name || '';
      const foto = u.user_metadata?.avatar_url;
      corpo.replaceChildren(
        h('div', { class: 'conta-usuario' },
          foto ? h('img', { class: 'conta-foto', src: foto, alt: '', referrerpolicy: 'no-referrer' }) : h('span', { class: 'conta-foto conta-inicial' }, (nome || u.email || '?')[0].toUpperCase()),
          h('div', { class: 'conta-info' }, nome ? h('div', { class: 'cfg-nome' }, nome) : null, h('div', { class: 'cfg-sub' }, u.email || '')),
          h('button', {
            class: 'btn btn-sm', type: 'button', onclick: async () => {
              try { await sair(); toast('Você saiu da conta'); } catch (e) { toast(e.message, 'erro'); }
            },
          }, 'Sair')),
        h('p', { class: 'dica' }, 'Em breve: sincronização das questões, avaliações e configurações entre os seus aparelhos.'));
    } else {
      corpo.replaceChildren(
        h('p', { class: 'dica' }, 'Entre para, em breve, usar as suas questões, avaliações e configurações em qualquer aparelho. Sem conta, o Prof continua funcionando normalmente neste aparelho.'),
        h('div', { class: 'linha-botoes' },
          h('button', {
            class: 'btn btn-google', type: 'button', onclick: async (e) => {
              e.currentTarget.disabled = true;
              try { await entrarComGoogle(); } catch (err) { toast(err.message, 'erro'); e.target.closest('button').disabled = false; }
            },
          }, h('span', { html: iconeGoogle }), 'Entrar com Google'),
          h('button', {
            class: 'btn', type: 'button', onclick: async () => {
              try { if (await dialogoEmail()) toast('Você entrou como ' + (usuarioAtual?.email || ''), 'ok'); } catch (err) { toast(err.message, 'erro'); }
            },
          }, 'Entrar com e-mail')));
    }
  };

  const aoMudar = () => { if (sec.isConnected) render(); else window.removeEventListener('prof-conta', aoMudar); };
  window.addEventListener('prof-conta', aoMudar);
  render();
  // garante o estado atualizado (sessão salva de outro acesso)
  if (!usuarioAtual && temSessaoSalva()) cliente().then((c) => c.auth.getSession()).then(({ data }) => { usuarioAtual = data.session?.user || null; render(); }).catch(() => {});
  return sec;
}
