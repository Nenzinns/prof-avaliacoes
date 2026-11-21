// Tela de Ajuda (botão "?"): tópicos explicando como usar o Prof.
import { h } from './ui.js';

const TOPICOS = [
  {
    titulo: 'Primeiros passos',
    itens: [
      ['Entrar ou usar sem conta', 'Ao abrir o Prof você pode entrar com Google ou com e-mail (um código de 6 dígitos chega na sua caixa de entrada, sem senha). Também pode tocar em "Continuar sem conta": o app funciona normalmente, mas os dados ficam só neste aparelho.'],
      ['Instalar no celular ou computador', 'No Chrome do Android, toque no menu ⋮ e em "Instalar app" (ou "Adicionar à tela inicial"). No iPhone, use o Safari: Compartilhar → "Adicionar à Tela de Início". No computador, clique no ícone de instalar na barra de endereço. Depois de instalado, o Prof funciona mesmo sem internet.'],
      ['Navegação', 'A tela inicial leva ao Leitor de Gabarito e às Avaliações. A seta no canto superior esquerdo volta uma tela. No topo ficam também a Ajuda (?), o Apoie (♥) e as Configurações (engrenagem).'],
    ],
  },
  {
    titulo: 'Leitor de Gabarito',
    itens: [
      ['1. Crie uma coleção de gabaritos', 'Em Leitor de Gabarito → Gabaritos, crie uma coleção (uma pasta para a prova) e informe o número de questões, de alternativas e a nota máxima. Dentro dela, adicione um gabarito para cada tipo de prova (Tipo A, Tipo B…). Na digitação rápida, digite as letras em sequência; use * para anular uma questão e . para deixar em branco.'],
      ['2. Imprima as folhas de resposta', 'Na coleção, toque em "Folhas de resposta" e imprima. Se houver vários tipos, é possível imprimir uma folha por tipo com a bolinha do tipo já preenchida. Imprima sempre em tamanho real (100%), sem "ajustar à página".'],
      ['3. Corrija com a câmera', 'Toque em "Corrigir com a câmera" e aponte para a folha inteira, com boa luz e sem sombras. Quando os 4 cantos forem encontrados, a captura é automática. Confira a leitura, ajuste se precisar e salve.'],
      ['3. Ou corrija provas escaneadas', 'Toque em "Corrigir provas escaneadas" e escolha várias fotos ou um PDF do scanner de uma vez. Escaneie em 200 dpi ou mais, em tons de cinza ou colorido.'],
      ['4. Veja os resultados', 'Em Resultados aparecem as notas, a média, a maior e a menor nota e os acertos por questão. Dá para exportar a planilha. Os resultados dos alunos ficam somente no aparelho em que as folhas foram lidas.'],
    ],
  },
  {
    titulo: 'Avaliações',
    itens: [
      ['Banco de questões', 'Em Avaliações → Questões, cadastre questões de múltipla escolha: o comando, a alternativa correta (solução) e as incorretas (distratores). O editor aceita negrito, listas, tabelas e imagens (é possível cortar e redimensionar). Marque com ★ as favoritas.'],
      ['Gerar questões com IA', 'Com uma chave de IA cadastrada em Configurações, toque em "Gerar com IA", informe disciplina, assunto e série e, se quiser, anexe material de referência (livro, apostila, slides ou fotos). Revise sempre as questões geradas antes de usar.'],
      ['Faixa de opções da avaliação', 'No topo da avaliação há uma faixa como a do Word. Página Inicial: Cabeçalho, Estilo do cabeçalho, Instruções (com modelos prontos), questões, Fonte, Parágrafo, padrões e Imprimir. Layout: margens, papel, colunas, número de página, espaçamento e linha entre questões, valor de cada questão e mensagem final. Questões: modelos de numeração e de alternativas. Gabarito: folha de respostas, gabarito simplificado, gabarito do professor, versões e Leitor. Cada botão com seta abre uma lista de modelos e, no final, a opção personalizada. As setas ↶ ↷ desfazem e refazem (Ctrl+Z / Ctrl+Y).'],
      ['Gerar a prova inteira com IA', 'Toque em "Gerar prova com IA", informe disciplina, assunto, série, quantidade de questões e, se quiser, anexe o material de referência pelo clipe (livro, apostila, slides, fotos). Revise as questões geradas: as escolhidas entram na avaliação e no seu banco de questões.'],
      ['Montar a avaliação', 'Toque em "+ Nova avaliação". Use Cabeçalho para título, escola, logotipo, professor(a), turma, data e valor (ou uma imagem de cabeçalho personalizada) e Instruções para o texto aos alunos. Adicione questões salvas, crie novas ou gere com IA; use ▲▼ para mudar a ordem. A pré-visualização ao lado mostra a página e a quantidade estimada de páginas.'],
      ['Padrões de formatação', '"Padrão ABNT" aplica as normas da ABNT; "Padrão Customizado" aplica a formatação que você salvou; "Definir como padrão" salva a formatação atual para as próximas avaliações. O botão do padrão em uso fica destacado.'],
      ['Fonte da prova', 'No grupo Fonte (guia Página Inicial) você escolhe fonte e tamanho, letras como digitado ou MAIÚSCULAS, enunciados em negrito ou itálico, título sublinhado e a cor do texto. A borracha volta para Arial 12 em preto.'],
      ['Pesos das questões', 'Na guia Layout, toque em Pesos (ou no valor ao lado de cada questão, na lista) e digite o valor das questões que valem diferente, por exemplo 2,0. As que ficarem em branco dividem igualmente o que sobra do valor da prova. Os pesos aparecem na prova (em "Valor da questão") e também valem na correção pelo Leitor: depois de mudar, toque em "Atualizar gabaritos no Leitor".'],
      ["Marca d'água e rodapé", "Na guia Layout, Marca d'água coloca o logotipo da escola bem claro no centro de cada página (ou outra imagem que você escolher). Rodapé põe um texto no pé de todas as páginas, com modelos feitos a partir dos dados do Cabeçalho ou um texto livre."],
      ['Versões anti-cola', 'Escolha de 2 a 6 tipos para gerar a mesma prova com questões e/ou alternativas em ordens diferentes. Cada tipo tem o próprio gabarito.'],
      ['Imprimir e corrigir', 'Imprimir (guia Página Inicial) abre a prova pronta para imprimir ou salvar em PDF, com o que estiver ligado na guia Gabarito. "Criar gabaritos no Leitor" (guia Gabarito) monta automaticamente a coleção de gabaritos para corrigir essa prova.'],
    ],
  },
  {
    titulo: 'Conta e aparelhos',
    itens: [
      ['Como funciona a sincronização', 'Quando você entra na conta, questões, avaliações, gabaritos, chaves de IA e a formatação padrão passam de um aparelho para o outro, como no WhatsApp: o servidor só entrega as alterações e as apaga assim que todos os seus aparelhos as recebem. Nada fica guardado na nuvem.'],
      ['Aparelho novo', 'Entre com a mesma conta no aparelho novo e abra o Prof em um aparelho que você já usa: ele envia uma cópia completa automaticamente. Deixe os dois com o app aberto e com internet até terminar.'],
      ['Aparelho que ficou muito tempo sem abrir', 'As alterações esperam no máximo 30 dias. Depois disso, o aparelho recebe uma cópia completa de novo a partir de outro aparelho seu.'],
      ['Aparelhos conectados', 'Em Configurações → Conta você vê os aparelhos ligados à conta e pode desconectar os que não usa mais.'],
      ['Importante: faça backup', 'Como nada fica guardado na nuvem, se todos os aparelhos forem perdidos os dados também se perdem. Exporte um backup de tempos em tempos (o app lembra você a cada 30 dias).'],
    ],
  },
  {
    titulo: 'Configurações',
    itens: [
      ['Chaves de IA', 'Cadastre chaves do Google Gemini, OpenAI ou Anthropic. A IA usa a primeira da lista; se ela falhar, passa para a seguinte. Arraste pela alça ⠿ para mudar a ordem.'],
      ['Backup e restauração', 'Exporte um arquivo com todos os seus dados e importe em outro aparelho ou depois de reinstalar o app. Também é possível apagar dados escolhendo o que remover.'],
    ],
  },
  {
    titulo: 'Privacidade e apoio',
    itens: [
      ['Privacidade', 'O Prof não mostra anúncios, não vende dados e não envia para a internet os resultados dos alunos. Detalhes na Política de privacidade, em Configurações → Conta.'],
      ['Apoie o Prof', 'O Prof é gratuito. Se ele economiza o seu tempo, você pode contribuir com qualquer valor pelo Pix no botão ♥.'],
      ['Contato', 'Dúvidas, sugestões ou problemas: prof.avaliacoes@gmail.com.'],
    ],
  },
];

export function telaAjuda(app, tela) {
  tela.titulo('Ajuda');
  const secoes = TOPICOS.map((t) => {
    const d = h('details', { class: 'cartao ajuda-topico' },
      h('summary', {}, t.titulo),
      h('div', { class: 'ajuda-itens' }, t.itens.map(([tit, txt]) => h('div', { class: 'ajuda-item' }, h('h3', {}, tit), h('p', {}, txt)))));
    // abrir um tópico fecha o anterior
    d.addEventListener('toggle', () => { if (d.open) secoes.forEach((o) => { if (o !== d) o.open = false; }); });
    return d;
  });
  app.append(h('div', { class: 'ajuda' }, h('p', { class: 'dica' }, 'Toque em um tópico para ver as explicações.'), ...secoes));
}
