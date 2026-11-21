// Ícones do app: traço simples (currentColor). Em "bloco" ficam brancos sobre fundo azul.

const S = (corpo) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;

export const ICONES = {
  camera: S('<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.4-2h7l1.4 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.5"/>'),
  escaneadas: S('<path d="M7 3h7l4 4v6"/><path d="M14 3v4h4"/><path d="M5 8v12h9"/><path d="M3 13h18"/><path d="M17 17h4M19 15v4"/>'),
  pasta: S('<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>'),
  grafico: S('<path d="M4 20h16"/><path d="M7 16v-4M12 16V7M17 16v-6"/>'),
  impressora: S('<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/><path d="M17.5 12h.01"/>'),
  lixeira: S('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>'),
  documento: S('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>'),
  questao: S('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8"/><circle cx="9" cy="13" r="1.2"/><circle cx="9" cy="17" r="1.2"/><path d="M12 13h4M12 17h4"/>'),
  busca: S('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  imagem: S('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>'),
  livros: S('<path d="M4 19V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v14M9 19V7a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v12"/><path d="m14.5 7.5 2.9-.8a1 1 0 0 1 1.2.7l2.3 9.6a1 1 0 0 1-.7 1.2l-2.9.8"/><path d="M3 19h18"/>'),
  embaralhar: S('<path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5"/>'),
  atualizar: S('<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>'),
  check: S('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  tesoura: S('<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.8 20 18M8 16.2 20 6"/>'),
  mais: S('<path d="M12 5v14M5 12h14"/>'),
  coracao: S('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
};

/** Ícone dentro de botão/texto (usa a cor do texto). */
function span(classe, nome) { const s = document.createElement('span'); s.className = classe; s.innerHTML = ICONES[nome] || ''; return s; }
export const ic = (nome) => span('ic', nome);
/** Ícone em bloco: branco sobre fundo azul arredondado. */
export const icBloco = (nome, tamanho = '') => span(`ic-bloco ${tamanho}`.trim(), nome);
