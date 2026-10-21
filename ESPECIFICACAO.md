# Vide — Especificação inicial

Oct 21, 2026 · @André

## Conceito

Vide é um app pessoal para aulas expositivas: ouve a fala do professor, reconhece referências a materiais previamente armazenados (ex.: "art. 70 do CPC", "Súmula 410 do STJ", "o conceito de preclusão") e os sugere numa tela só do apresentador. A projeção para a turma acontece apenas quando o professor clica.

O reconhecimento de voz funciona como sugestor, não como gatilho. A decisão de projetar é sempre humana, e erros de transcrição são vistos antes de chegar à turma.

A ideia não é inédita como conceito (há patentes norte-americanas sobre sistemas de apoio a apresentações por reconhecimento de fala), mas não foi encontrado produto equivalente. Para uso pessoal, sem finalidade comercial, as patentes não são obstáculo (LPI, art. 43, I).

**Identidade visual.** Logo "Feixe": o "v" desenhado como cone de projeção, com um ponto no vértice, seguido de "ide" (Manrope ExtraBold, minúsculas). Paleta Lousa:

| Função | Cor |
| --- | --- |
| Tinta (texto, traço do logo) | #1E3A34 |
| Fundo | #EEF0EA |
| Destaque (feixe, ponto, botões) | #E8735A |

[Canvas com o logo](https://claude.ai/artifact/6jBShgqp6s6yZugn3KLLEn)

## Princípios de projeto

- **MVP enxuto.** Testar primeiro o núcleo: reconhecer a fala, pré-exibir e projetar com um clique. Integrações com outros materiais só depois de observar o uso real.
- **Item genérico.** Tudo o que se projeta é um "item" com a mesma base (tipo, título, gatilhos, conteúdo, origem, data). Novos tipos entram sem refazer a tela de projeção.
- **Acervo offline.** Todo o acervo fica armazenado no aparelho; a internet não é usada para consultar materiais durante a aula. O reconhecimento de voz é o mais eficiente disponível, ainda que dependa de conexão (há Wi-Fi nas salas).
- **Pré-exibição obrigatória.** Nenhuma referência vai ao projetor sem clique do professor (exceto os comandos de voz de controle, restritos ao que já está projetado).

## Arquitetura

Web app no navegador, com duas janelas: a do apresentador, no notebook, e a de projeção, no projetor. As janelas se comunicam localmente (BroadcastChannel) e todo o acervo fica no aparelho.

&#91;embedded content: arquitetura do app · do microfone ao projetor\]

A fala percorre a transcrição e o detector, que consulta o acervo e os assuntos da aula; nada chega ao projetor sem passar pela tela do apresentador e pelo clique.

**Ambiente e dados.**

- Aparelho em sala: notebook pessoal com Windows; navegadores candidatos: Chrome e Edge.
- Acervo sincronizado com login, para preparar o material em casa e usá-lo na sala.
- Funcionamento local primeiro: cópia completa no aparelho, sincronizada quando houver conexão. A aula não depende da sincronização.
- Hospedagem no Cloudflare e login, banco de dados e arquivos no Supabase, como no Serestapp.

## Tipos de item

Na importação, o professor escolhe o tipo. O tipo define como o material é recebido, como é chamado pela voz e como aparece na tela.

| Tipo | Importação | Família de gatilho | Exibição | Fase |
| --- | --- | --- | --- | --- |
| Legislação | Texto, HTML ou URL, fatiado por dispositivo | Referência estruturada ("art. X do Y", com apelidos do diploma) | Texto com hierarquia de parágrafos, incisos e alíneas | MVP |
| Precedente | Ficha: tribunal, classe, número, tema, ementa/tese; súmulas e teses em lote | Referência estruturada ("Súmula 7 do STJ", "Tema 1.076") e busca por assunto | Tese em destaque, identificação discreta | MVP |
| Conceito | Verbete: título, expressões-gatilho, texto curto; vários por arquivo | Palavra-chave com marcador de conceito | Título e definição | MVP |
| Imagem | Arquivo de imagem com título e palavras-chave | Palavra-chave | Tela cheia | MVP |
| Gráfico | Tabela de dados + formato (barras, linha, linha do tempo) | Palavra-chave | Gráfico desenhado pelo app | Segunda leva |

Na importação, o app sugere gatilhos e um rótulo curto de assunto a partir do título e da ementa; o professor só ajusta.

## Acervo: importação e atualização

Todo diploma é importado manualmente e armazenado no aparelho. A verificação online de atualizações é opcional, por diploma.

**Importação.** Na importação, o app pede opcionalmente a URL de origem do texto. Textos legais não têm proteção autoral (Lei 9.610/1998, art. 8º, IV), então o CPC pode vir direto do Planalto.

**Fatiador.** Componente que quebra o texto em artigo, parágrafo, inciso e alínea. É o mesmo para arquivos importados e para a verificação online. Precisa tratar a redação revogada tachada do Planalto: descartar o tachado quando receber HTML ou pedir revisão ao encontrar dispositivos duplicados (dois "Art. 1.015").

**Verificação de atualizações.**

- Só para diplomas com URL de origem e com a caixa "verificar atualizações" marcada.
- Feita ao abrir o app, no máximo uma vez por semana por diploma, nunca com o modo aula ativo.
- Comparação dispositivo a dispositivo; a sugestão aponta quais artigos mudaram.
- Nunca substitui sem aprovação. A redação anterior é guardada e pode ser projetada (ex.: direito intertemporal).
- Falha na verificação não afeta nada: o app informa "não foi possível verificar" e segue com a cópia local.
- A tela de cada diploma mostra a data da versão armazenada.

## Assuntos e início da aula

Ao iniciar uma aula, o professor seleciona um ou mais assuntos. Não há numeração de aulas, porque o conteúdo de cada aula muda conforme o andamento.

- **Etiquetas.** Cada item recebe uma ou mais etiquetas de assunto na importação ("preclusão", "tutela provisória").
- **Legislação dispensa etiquetas.** A referência numérica é inequívoca.
- **Filtro parcial.** Referências inequívocas ("art. 70 do CPC", "Súmula 410 do STJ") funcionam sempre. Buscas por proximidade (conceitos, precedentes por assunto) ficam restritas aos assuntos selecionados.
- **Acréscimo durante a aula.** Um botão na tela do apresentador acrescenta assunto sem interromper o modo aula.
- **Agrupamento opcional.** Se as etiquetas crescerem, grupos ("Atos processuais") incluem as etiquetas de dentro. No início, lista simples.

## Acionamento por voz

A fala é transcrita continuamente, normalizada e comparada ao acervo. Cada tipo tem sua regra de detecção.

**Normalização (antes de qualquer busca).** Unificar variações da transcrição: "artigo 70", "art 70", "setenta", "c p c", "código de processo civil". Números por extenso viram algarismos; siglas e apelidos viram o identificador do diploma.

**Legislação.** Basta a referência estruturada. Frases de enquadramento do professor ("e o que está previsto no...", "isso é o que está escrito lá no...") podem dar prioridade ao candidato, mas não são condição.

**Conceitos.** Exigem um marcador de conceito próximo do termo, numa janela de cerca de dez palavras (a pontuação da transcrição não é confiável para delimitar frases).

- Marcadores em lista editável: "conceito", "o que é", "o que se entende por", "definição", "noção".
- Termo composto vence o simples ("preclusão consumativa" antes de "preclusão").
- Ex.: "e qual é o conceito de preclusão?" aciona; "houve preclusão" não aciona.

**Precedentes.** Dois caminhos:

- Referência estruturada ("Súmula 410 do STJ", "Tema 1.076"), quando o professor souber o número.
- Busca por assunto: marcador ("entendimento", "jurisprudência", "o STJ decidiu") + tribunal + termos do assunto, comparados com a ementa e os gatilhos dos precedentes importados, restrita aos assuntos selecionados.

No MVP a busca é por palavras-chave. Busca semântica por IA fica para depois, pois exige internet ou modelo local.

**Imagens e gráficos.** Palavras-chave definidas pelo professor, restritas aos assuntos selecionados.

## Pré-exibição e tela de candidatos

A tela do apresentador mostra uma lista curta de candidatos para escolha de relance, sem exigir leitura.

- Identificação em destaque ("art. 70 CPC", "Súmula 410 STJ").
- Rótulo curto de assunto ao lado, necessário para precedentes cujo número o professor não domina ("Súmula 410 STJ — astreintes, intimação pessoal").
- Início do teor seguido de reticências, sem o texto integral.
- Cor ou ícone por tipo.
- De três a cinco candidatos, os mais recentes no topo; os antigos expiram.
- Fonte grande e destaque forte no candidato selecionado.

## Controles

O controle é feito com um mouse comum (dois botões, roda e clique na roda), que também serve como passador improvisado se for sem fio.

| Controle | Ação |
| --- | --- |
| Roda | Percorre os candidatos |
| Clique esquerdo | Exibe o candidato selecionado; se já houver algo projetado, substitui |
| Clique direito | Recolhe a projeção e volta à tela neutra (preta); menu de contexto desativado |
| Clique na roda | Alterna a roda entre "percorrer candidatos" e "rolar o texto projetado" |

A rolagem atende dispositivos longos, como o art. 1.015 do CPC. A tela do apresentador ocupa o notebook inteiro para que o clique não caia em outra janela.

**Comandos de voz de controle.** "Tira da tela" e "aumenta a fonte". Executam sem pré-exibição e só ficam ativos quando há algo projetado.

**Sair e retomar.** Para usar outro material, o professor sai do app. "Sair" é uma ação única: pausa a escuta e libera a tela do projetor. Ao voltar, o app retoma com os mesmos assuntos selecionados.

## Registro de uso

O app registra discretamente o que foi sugerido, o que foi projetado e quando o professor saiu para outro material. Depois de algumas aulas, o histórico mostra com dados quais materiais foram alternados com o app e se as sugestões acertaram, orientando as próximas versões.

## Transcrição da aula

Com o modo aula ativo, a transcrição é guardada automaticamente, para uso posterior (ex.: elaborar exercícios de revisão).

- **Texto, não áudio.** A gravação de áudio é opcional e fica desligada por padrão.
- **Marcação das projeções.** Cada item projetado entra na transcrição no ponto em que ocorreu ("\[projetado: art. 70 CPC\]").
- **Exportação em texto** para uso com IA externa. Geração de exercícios dentro do app fica para fase posterior.
- **Pausa visível** na tela do apresentador, para trechos que não devem ser registrados.
- **Qualidade esperada:** sem pontuação confiável, com erros pontuais e falas de alunos captadas parcialmente; suficiente para gerar exercícios.
- **Alunos e LGPD:** avisar a turma de que a aula é transcrita.

## Escopo do MVP e fases seguintes

**MVP**

- Tipos: legislação, precedente, conceito e imagem.
- Importação manual com fatiador e etiquetas de assunto.
- Início de aula com seleção de assuntos.
- Reconhecimento de voz, normalização e detecção por tipo (busca por palavras-chave).
- Tela do apresentador com candidatos e janela de projeção.
- Controles por mouse e os dois comandos de voz de controle.
- Sair e retomar; registro de uso; transcrição automática com marcação das projeções e exportação.

**Fases seguintes**

- Gráfico gerado a partir de dados.
- Verificação online de atualizações, com comparação por dispositivo e guarda da redação anterior.
- Agrupamento de etiquetas.
- Busca semântica por IA e geração de exercícios a partir da transcrição dentro do app.
- Convivência com outros materiais (slides em PDF dentro do app ou captura da janela do PowerPoint), conforme o registro de uso indicar.

## Questões em aberto e riscos a testar

- [ ] Comparar os reconhecedores de voz disponíveis (Chrome, Edge, Safari, opções no próprio aparelho) quanto à precisão em linguagem jurídica e escolher o mais eficiente; testar a estabilidade durante uma aula inteira (ruído da sala, distância do microfone, oscilação do Wi-Fi).
- [ ] Verificar se LexML ou a base de normas do Senado oferecem texto estruturado por dispositivo, antes de construir a leitura do HTML do Planalto.
- [ ] Definir o formato do arquivo de importação em lote (verbetes, súmulas, teses).
- [ ] Medir a taxa de falsos positivos de conceitos e precedentes por assunto e ajustar a janela de proximidade e os marcadores.
- [ ] Definir no Supabase a estrutura das tabelas e o armazenamento das imagens.
- [ ] Verificar se a UniFTEC tem norma sobre gravação ou transcrição de aulas.
