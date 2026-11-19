# Prof — Avaliações

Aplicativo web (funciona no computador e no celular, inclusive offline) com duas ferramentas:

## Leitor de Gabarito
- **Gabaritos**: coleções (pastas) de gabaritos. *Adicionar* → escolhe quantidade de questões e de alternativas → abre o gabarito em branco para marcar as respostas (ou digitar rápido, ex.: `ABCDA*`, onde `*` anula a questão).
- **Anti-cola**: uma coleção pode ter vários gabaritos (Tipo A, B, C…). A folha de respostas tem a bolinha "Tipo de prova", e o leitor escolhe o gabarito certo automaticamente.
- **Folhas de resposta**: impressas pelo app (A4, escala 100%). Os 4 quadrados pretos e a barra no topo são usados na leitura.
- **Correção**: pela câmera (captura automática quando a folha é encontrada) ou enviando fotos/PDFs escaneados (vários de uma vez). Sempre há uma tela para conferir e ajustar antes de salvar.
- **Resultados**: notas, média, acertos por questão e exportação em CSV (abre no Excel).

## Formatador de Avaliações
- Histórico das avaliações geradas + botão de criar nova.
- **Banco de questões**: comando (editor completo), solução e distratores, com disciplina/assunto/série/dificuldade e busca.
- **Editor no estilo do Word**: uma faixa de opções única no topo da questão, que age no campo onde está o cursor (comando, solução ou distrator).
  - *Página Inicial*: colar/recortar/copiar, Pincel de Formatação, fonte e tamanho, aumentar/diminuir fonte, Maiúsculas e Minúsculas, sublinhados (duplo, ondulado…), cores no padrão do Word, realce, marcadores e numeração (a), 1), I.…), recuo, espaçamento, sombreamento e bordas de parágrafo, estilos (Título 1, Citação…), Localizar e Substituir, diálogos Fonte e Parágrafo.
  - *Inserir*: tabela (grade, diálogo e tabelas rápidas), imagens, caixa de texto, linhas para resposta, equações (fração, raízes) e símbolos por categoria.
  - *Design da Tabela* / *Layout* (aparecem ao clicar numa tabela): estilos de tabela, linha de cabeçalho/total/tiras, sombreamento, bordas com caneta (estilo, espessura, cor), inserir/excluir linhas e colunas, mesclar, dividir células N×M, dividir tabela, AutoAjuste, altura/largura, distribuir, alinhamento em 9 posições, direção do texto, margens, propriedades. Colunas e linhas são redimensionadas arrastando a borda.
  - *Formato da Imagem* (aparece ao clicar numa imagem): 8 alças de redimensionamento, Opções de Layout, quebra de texto (alinhado, quadrado, superior e inferior), posição, arrastar para mover, girar/inverter, correções de brilho/contraste, cor (cinza, P&B, sépia), cortar (inclusive por proporção), estilos de imagem, borda, legenda, texto alternativo, tamanho em cm e Redefinir (as edições guardam a imagem original).
  - Menu de botão direito e atalhos do Word (Ctrl+E, Ctrl+J, Ctrl+Shift+>, Ctrl+], Ctrl+=, Ctrl+Shift+C/V…).
- **Avaliação**: cabeçalho (escola, logo, professor, turma, data, valor, instruções), 1 ou 2 colunas, versões embaralhadas (tipos A–F), impressão/PDF com folha de respostas e gabarito do professor, e criação automática dos gabaritos no Leitor.

## Como rodar
```bash
node serve.js
```
Abra http://localhost:5173. Para usar a câmera no celular o app precisa ser servido por **https** (ex.: GitHub Pages, Netlify) — basta publicar esta pasta como site estático. No celular, use "Adicionar à tela inicial" para instalar.

Os dados ficam salvos no próprio navegador (IndexedDB). Use **Backup e restauração** na tela inicial para exportar/importar.
