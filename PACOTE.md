# Pacote de mudanças em preparação

**O que é este ramo (`pacote`):** uma cópia de segurança do trabalho ainda **não publicado**.
O site (https://vide.andre-pge-rs.workers.dev) é publicado a partir do ramo
`claude/wizardly-clarke-nwd93w`. Este ramo junta várias mudanças pequenas para que
sejam publicadas de uma vez só, quando o professor autorizar ("pode publicar").

**Regras**
- Nada deste ramo vai para o site até a autorização.
- Ao publicar, o conteúdo deste ramo é levado para `claude/wizardly-clarke-nwd93w` e este
  arquivo passa a registrar o pacote como publicado (com a data e a versão).
- Mudanças mais trabalhosas ou arriscadas são avisadas antes e podem ficar fora do pacote.
- A cada 5 pacotes publicados (pacotes 15, 20, 25…), roda-se o **teste de peso** (`npm run peso`, ver `PESO.md`); se o Vide estiver pesado, o Claude recomenda a melhoria antes de mexer.

## Próximas etapas anotadas

**Orientação de trabalhos acadêmicos** (a parte 1, o caderno do orientador, com transcrição e IA, foi publicada na 0.37.0)
- **Parte 2 — página do orientando:** feita no pacote 22, publicada na 0.38.0 (cronograma, pendências, elementos, modelos para baixar, com código de acesso). **Falta:** o orientando **enviar as versões** do trabalho pela página.
- **Parte 3 — e-mails ao orientando** (pelo Gmail do professor, enviados quando o Vide estiver aberto). **Em pausa (20/11/2026): o professor vai repensar.** Proposta feita: etapa A — ligar o Gmail API e a permissão "gmail.send" no projeto do Google Cloud do login do Vide (o Google mostra o aviso de "app não verificado" na 1ª vez), campo "Resumo para o orientando" no registro da sessão e botão "Enviar ao orientando"; etapa B — lembretes automáticos (fila para aprovar ou automático; antecedência 7 e 1 dia; aviso de vencido; cópia ao professor). Alternativa citada: envio pelo serviço do Vide (funciona com o Vide fechado, mas sai de outro endereço e exige um serviço de envio contratado).
  - **Lembretes de prazo:** o prazo é calculado na hora do envio (não quando o lembrete foi agendado); vários avisos atrasados viram um só; prazo vencido com o Vide fechado: aviso de "venceu em…" ou nada (o professor escolhe); cada envio fica marcado e vai para o Drive, para outro computador não repetir.
  - **Resumo da sessão para o orientando:** no registro da sessão, um **campo próprio para o resumo feito pela IA** (separado das anotações internas do professor, editável antes de enviar) e um botão para **mandar ao orientando por e-mail**, com as sugestões e os comandos e seus prazos; o envio fica registrado na linha do tempo. (A IA pode já escrever esse resumo dirigido ao orientando.)
- **Trabalho final (TCC II):** parte 1 (formulário, PDF e Word, capítulos com nome, tabelas e quadros) no pacote 31; parte 2 (figuras e gráficos) no pacote 32.
- **Assistente de IA para o orientando** (ideia): testar primeiro pelo NotebookLM com o manual do aluno (manualAluno.ts) como fonte; se os alunos usarem, levar para dentro do Vide (chat com um modelo de IA, limite de perguntas, só sobre o app, sem escrever o trabalho).
- **Dicas do orientador** (encontros, fichamento, bibliotecas, prompts úteis de IA — do PDF "Orientação de TCC"): seção na página do orientando que o professor **edita no Vide** (mudam com frequência).
- **Parte 4 — importar conversas:** e-mails trocados com o orientando direto do Gmail (o "copiar e colar" do WhatsApp e do e-mail já existe na parte 1).

## Situação

**Pacote 39** aberto em 2026-11-22, a partir da versão 0.54.0 (já publicada).

| # | Ideia | Situação |
|---|---|---|
| 1 | **Tabelas e sumário do Word (caso real).** (a) **Tabela truncada**: no Word do aluno, a primeira linha era uma célula mesclada com o título ("Inscrição indevida em bancos de dados…" ocupando as 6 colunas); o Vide a lia como uma célula e dava quase toda a largura à primeira coluna ("Câ-mar-a", "Recur-so"). Agora: ao importar, a célula mesclada que ocupa a linha toda vira o título da tabela; ao desenhar (PDF, Word e editor), uma linha só com a primeira célula preenchida sai como faixa mesclada; e a largura das colunas garante que a palavra mais longa de cada coluna caiba inteira. (b) **Sumário do Word desregulado ao editar**: as linhas do sumário eram texto fixo; agora cada título tem uma marca (indicador) e cada linha do sumário é um link para ela, com o número da página como campo (PAGEREF), como o próprio Word faz — "Atualizar campo" funciona depois de editar; o mesmo nas listas de tabelas, quadros, figuras e gráficos. Linhas longas do sumário quebram alinhadas (recuo de 1 cm) | No pacote |

## Pacotes anteriores

### Pacote 38 (publicado como 0.54.0 em 2026-11-22)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Importar do Word: correções do primeiro caso real** (TCC no modelo da Uniftec). (a) O **resumo ia para os agradecimentos**: no modelo, o resumo fica numa página com título, autor e orientador e começa com "Resumo:" dentro do parágrafo, sem um título "RESUMO". Agora "Resumo:"/"Palavras-chave:" e "Abstract:"/"Keywords:" são reconhecidos onde estiverem (o abstract todo em itálico perde o itálico), e os agradecimentos param quando o título do trabalho (que já apareceu na capa) se repete — agradecimentos sem texto ficam de fora. (b) **Linhas do sumário** ("INTRODUÇÃO 9") e títulos sem texto não aparecem mais na conferência (antes, "Introdução" e "Considerações finais" apareciam repetidas). (c) **Siglas** separadas por tabulação ("CC  Código Civil") viram "CC – Código Civil", sem a linha de cabeçalho ("Sigla  Significado") | Publicada (0.54.0) |

### Pacote 37 (publicado como 0.53.0 em 2026-11-22)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Proteção extra da senha:** o Vide passa a não apagar, ao publicar, as variáveis criadas no painel do Cloudflare ("keep_vars"). A senha do professor deve ser criada como **Secret** (assim ela nunca é apagada); na publicação da 0.52.0 ela tinha sido criada como texto e sumiu — recriada como Secret em 22/11 | Publicada (0.53.0) |

### Pacote 36 (publicado como 0.52.0 em 2026-11-22)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Importar do Word.** Botão **"Importar do Word"** no formulário do orientando (pré-projeto e trabalho final). Primeiro, uma janela lembra de formatar títulos e subtítulos com os **estilos de título do Word** (Título 1, 2, 3), com **"Saiba como"** (passo a passo no Word e no Google Docs). O Vide lê o .docx (sem bibliotecas: src/orientacao/lerDocx.ts) — títulos pelos estilos (ou, sem estilos, linhas curtas em negrito numeradas ou em maiúsculas), negrito e itálico, **notas de rodapé de verdade**, **citações** pelo recuo, **tabelas** e **figuras** (as imagens são reduzidas e enviadas), legendas ("Tabela 1 – …") e fontes ("Fonte: …") — e distribui pelo formulário (src/orientacao/importarWord.ts): resumo e palavras-chave, abstract, agradecimentos, siglas, introdução, objetivos (geral, específicos, justificativa), **cada título do desenvolvimento vira um capítulo com o mesmo nome**, considerações finais, referências, apêndices e anexos; no pré-projeto, problema, hipóteses, fundamentação, as quatro partes da metodologia e recursos. Os números dos títulos saem (o Vide numera). Capa, sumário e listas ficam de fora. Uma **tela de conferência** mostra para onde vai cada parte (parágrafos, subtítulos, tabelas, figuras, notas) e os avisos; o importado **substitui** o texto, com **"Desfazer a importação"** (cópia do texto anterior guardada no aparelho). **Colar melhorado**: tabelas coladas viram tabelas, parágrafos recuados viram citação longa, notas de rodapé do Word e do Google Docs vêm junto e os números dos títulos saem. Manual do aluno atualizado | Publicada (0.52.0) |

### Pacote 35 (publicado como 0.51.0 em 2026-11-20)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Senha do professor (porteiro).** O endereço principal do Vide (o app do professor) só abre com a senha do professor: num aparelho novo aparece a tela "Vide — entrar"; acertando, o aparelho fica liberado por um ano (cookie assinado; trocar a senha desconecta todos). Continuam abertos, como antes: as páginas dos alunos (/j jogo, /t treino, /p processo, /o orientação), o controle pelo celular (QR da sala) e os arquivos do app. Criar treinos, processos e páginas de orientação também passa a exigir a sessão do professor. 8 senhas erradas seguidas (do mesmo endereço de internet) bloqueiam por 15 minutos. **A senha é o segredo SENHA_PROFESSOR, guardado no painel do Cloudflare** (sem ele, o porteiro fica desligado). /api/sair desconecta o aparelho | Publicada (0.51.0) |

### Pacote 34 (publicado como 0.50.0 em 2026-11-20)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Mensagem ao orientando sempre à mão.** Na Visão geral do orientando, o quadro "Página do orientando" ganhou o botão **"Copiar mensagem ao orientando"**: a mesma saudação, com o link e o código de acesso, para colar no WhatsApp ou no e-mail, a qualquer momento depois de criada a página. A mensagem agora também conta, quando o formulário está ligado, que na aba "Meu pré-projeto"/"Meu trabalho final" ele escreve, vê os apontamentos, baixa em PDF ou Word e envia as versões. Em Compartilhar, o botão do link virou **"Copiar só o link"** (para não ser confundido com a mensagem completa). O quadro mostra qual formulário está valendo (pré-projeto ou trabalho final) | Publicada (0.50.0) |
| 2 | **Comentar no texto a partir da linha do tempo:** cada versão enviada pelo orientando pelo formulário ("Pré-projeto/Trabalho final — enviado em…") ganhou o botão **"Comentar no texto"**, que abre a tela de leitura com apontamentos. No alto, um aviso diz se aquele é exatamente o texto enviado ou se o orientando já mudou o texto depois do envio (os apontamentos ficam no texto atual; a versão enviada continua no PDF) | Publicada (0.50.0) |
| 3 | **Boas-vindas e manual para o orientando.** (a) **Passeio de boas-vindas** no primeiro acesso de cada aparelho: o fundo escurece e cada parte da página é destacada com um balão curto (etapa da vez, pendências, cronograma, modelos, a aba do formulário, "Como usar" e o "?"), com Próximo/Voltar/pular; o **?** no alto refaz o passeio. (b) Aba **"Como usar"** com o manual em perguntas e respostas, com **busca**: a sua página (código, celular), acompanhamento (etapa da vez, fazer × sugestão, modelos), escrevendo o trabalho (salvar, dois aparelhos, o que o orientador vê, formatação, citação, nota, tabela, ampliar, PDF/Word; no trabalho final, capítulos e figuras), apontamentos (ver, responder, resolver) e problemas comuns. O manual se ajusta ao que a página mostra (formulário desligado, pré-projeto ou trabalho final) e é a fonte única sobre o app para o aluno (src/orientacao/manualAluno.ts) | Publicada (0.50.0) |
| 4 | **Combinado de orientação.** Nova aba **"Combinado"** na página do orientando, com o conteúdo do PDF "Orientação de TCC" do professor (fixo, em src/orientacao/combinado.ts): **responsabilidades** (cada tarefa com o selo "Você", "Orientador" ou "Os dois") e **fontes de pesquisa** (use como fonte · use com cautela · não use como fonte, cada grupo com uma frase do porquê). No primeiro acesso, a página abre no combinado; o orientando toca em **"Li e compreendi o combinado"** (fica registrado com data e hora) e só então começa o passeio de boas-vindas. Enquanto não confirmar, um **aviso amarelo no alto** da página. No caderno do professor, o quadro "Página do orientando" mostra **"Combinado: lido em…"** ou **"ainda não lido"**. A mensagem de boas-vindas pede para começar pelo combinado; o manual e o passeio falam dele. As dicas do orientador (encontros, fichamento, bibliotecas, prompts de IA) ficaram para depois, com um jeito de o professor editar | Publicada (0.50.0) |

### Pacote 33 (publicado como 0.49.0 em 2026-11-20)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Apontamentos do orientador no texto do orientando.** Na aba Trabalho, o cartão do formulário mostra quantos apontamentos estão em aberto (e quantos têm resposta do orientando) e o botão **"Ler e comentar"**: abre o texto atual do orientando já formatado, campo por campo; o professor **seleciona um trecho e clica em "Comentar"**. À direita, os apontamentos (em aberto ou todos), com a conversa; o professor responde, edita, apaga, marca como resolvido ou reabre; clicar num apontamento leva ao trecho. Na página do orientando: um **painel "Apontamentos do orientador"** no alto (com atalho para cada um), o **trecho em amarelo no texto** e, logo abaixo do campo, o cartão com o comentário, onde ele **responde** e **marca como resolvido**. Se o orientando reescrever o trecho, o apontamento continua no cartão como "trecho alterado"; se a parte (capítulo, apêndice) for apagada, ele aparece no painel. Os apontamentos ficam guardados na página do orientando, à parte do texto: não vão para o PDF nem para o Word | Publicada (0.49.0) |
| 2 | **Correção: o cursor não sai do lugar ao usar a barra** (negrito, itálico, subtítulo, citação, nota…). Os botões não tiram mais o foco do texto (no Safari, o cursor pulava para o fim). E "Subtítulo"/"Citação longa" numa linha com texto não seleciona mais a linha inteira (a próxima letra apagava a linha): o cursor fica onde estava | Publicada (0.49.0) |

### Pacote 32 (publicado como 0.48.0 em 2026-11-20)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Trabalho final (TCC II), parte 2: figuras e gráficos.** Botão **"Figura ou gráfico"** nos capítulos, na introdução, nos apêndices e nos anexos: o orientando escolhe a imagem (PNG ou JPEG, do computador ou do celular), dá o título e a fonte e escolhe a largura (inteira, três quartos ou metade). O Vide **reduz a imagem no navegador** (no máximo 1600 px; gráficos em PNG continuam nítidos) e a guarda na página do orientando; no texto fica só o código. Abaixo do campo, **miniaturas** das figuras e tabelas, que abrem a edição com um clique. Figuras e gráficos numerados (Figura 1, Gráfico 1…), com **lista de figuras e lista de gráficos** quando há três ou mais (na ordem do modelo: figuras, quadros, gráficos, tabelas). No PDF e no Word: título em cima, imagem centralizada, fonte embaixo; no Word a imagem vai dentro do arquivo e a numeração é campo do Word. O professor vê as imagens nos PDFs e Words (rascunho e envios). Limites: 900 KB por imagem (depois de reduzida) e 150 imagens por trabalho. Se a página for desativada, as imagens são apagadas (os PDFs já recebidos continuam com elas) | Publicada (0.48.0) |
| 2 | **Ampliar o campo de escrita:** nos campos de texto longos (capítulos, introdução, considerações, apêndices…), o botão **⤢ Ampliar** abre o campo na tela toda, com letra maior e a mesma barra (negrito, subtítulo, tabela, figura…); **Fechar (Esc)** volta. O texto continua sendo salvo sozinho | Publicada (0.48.0) |
| 3 | **Texto já formatado enquanto se escreve (como no Obsidian):** os campos de texto do formulário (pré-projeto e trabalho final) viraram um editor com visualização ao vivo — subtítulos grandes e em negrito, **negrito** e _itálico_ formatados, citação longa recuada e menor, nota de rodapé como um selo "nota" (o texto aparece ao passar o mouse), **tabelas e quadros desenhados** e **figuras e gráficos com a imagem** (um clique abre a edição). As marcações (##, **, _, >, [[ ]], :::) só aparecem, em cinza, na linha em que está o cursor. **Colar do Word** traz o negrito, o itálico e os parágrafos; Ctrl+B e Ctrl+I. Usa o CodeMirror (o motor do Obsidian), carregado só na página do orientando (cerca de 90 KB) | Publicada (0.48.0) |

### Pacote 31 (publicado como 0.47.0 em 2026-11-20)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Trabalho final (TCC II), parte 1: formulário, PDF e Word, com tabelas e quadros.** Em Compartilhar › Formulário do trabalho, o professor escolhe **Pré-projeto (TCC I)** ou **Trabalho final (TCC II)** e, no final, informa o e-mail dele e os dois avaliadores da banca. Na página do orientando, a aba vira **"Meu trabalho final"**, já com o texto do pré-projeto em cada lugar (o pré-projeto continua guardado). Partes, pelo modelo da Uniftec: identificação (título e subtítulo em português e em inglês, e-mail), dedicatória/agradecimentos/epígrafe (entram se escritos), resumo (com contagem de 150 a 500 palavras) e abstract, siglas, 1 Introdução, 2 Objetivos e justificativa (2.1, 2.1.1, 2.2), **capítulos do desenvolvimento que o orientando cria, nomeia, ordena e remove (pelo menos um)**, numerados 3, 4, 5…, com subtítulos (3.1) e sub-subtítulos (3.1.1), Considerações finais, Referências, **apêndices e anexos** com nome (Apêndice A, B…). **Tabelas e quadros** montados numa grade (título, células, fonte), numerados sozinhos, com lista automática quando há três ou mais. PDF e Word: capa, folha de rosto, folha de aprovação com a banca, dedicatória e epígrafe no pé da página, página do resumo com autor e orientador e e-mails, página do abstract, listas, sumário, seções primárias em página nova, páginas contadas desde a folha de rosto. Os envios chegam como versões "Trabalho final — enviado em…" | Publicada (0.47.0) |

### Pacote 30 (publicado como 0.46.0 em 2026-11-20)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Correção: sumário do pré-projeto em Word com as páginas certas.** (a) A capa e a folha de rosto passavam um pouco do tamanho da página no Word, e o parágrafo da quebra escorregava para a página seguinte: apareciam **duas páginas em branco** antes do sumário. Agora a página nova começa no próprio título da página seguinte, e os espaços da capa, da folha de rosto e da folha de aprovação se ajustam ao tamanho do título, do subtítulo e da natureza do trabalho, para caber sempre numa página. (b) Os números que o sumário do Word já traz eram calculados com as linhas do PDF, mais baixas que o "1,5" do Word; em trabalhos longos, os títulos caíam em páginas posteriores às indicadas. Agora a conta usa a altura de linha do Word (ao atualizar o sumário, o Word confirma os números). (c) Nas Referências, a linha que é só o título colado junto com a lista ("5. REFERÊNCIAS", "Referências") é descartada (no Word e no PDF) | Publicada (0.46.0) |

### Pacote 29 (publicado como 0.45.0 em 2026-11-20)

| # | Ideia | Situação |
|---|---|---|
| 1 | **Correção: Drive no Safari em aba privada.** O Safari privado recusa guardar arquivos (PDF, imagem, Word) no banco do navegador e a sincronização parava com "Error preparing Blob/File data to be stored in object store". Agora o Vide testa isso ao abrir e, quando o navegador recusa, guarda os bytes do arquivo (formato que todo navegador aceita) e os lê de volta como arquivo normal — materiais, versões e modelos da orientação. Nos outros navegadores nada muda. Lembrete: a aba privada apaga tudo ao ser fechada; o normal (ou o ícone na tela de início) guarda os dados | Publicada (0.45.0) |

### Pacote 28 (publicado como 0.44.0 em 2026-11-20)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Celular: Drive e Orientação à vista.** (a) No alto da tela do celular, ao lado da busca, um ícone de **nuvem com a luz de situação do Google Drive** (cinza desligado, verde sincronizado, amarelo sincronizando, vermelho reconectar/erro); tocar abre a janela do Drive (entrar, sincronizar). (b) Na barra de baixo, **Orientação** entra no lugar de Aula (no celular a aula não é conduzida; ele vira controle pelo QR da tela do computador), com o ponto vermelho das pendências vencidas. No computador, nada muda | Publicada (0.44.0) |
| 2 | **Logo do Vide na tela de início do celular:** ícones PNG quadrados gerados a partir do logo (180 px para iPhone/iPad, 192 e 512 px para Android, com a versão "maskable" para os recortes do Android) e o manifesto do app (nome "Vide", cores do Vide). Antes, só havia o ícone em SVG, que o iPhone não usa na tela de início — por isso aparecia um "V" genérico. O atalho continua abrindo o Vide no navegador (para o login do Google Drive funcionar) | Publicada (0.44.0) |

### Pacote 27 (publicado como 0.43.0 em 2026-11-20)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Pré-projeto em Word (.docx) e em PDF, para o orientando e para o orientador.** O Word tem a mesma estrutura e formatação do PDF (A4, margens 3/2 cm, Arial 12, entrelinha 1,5, recuo 1,25 cm, citação longa com recuo de 4 cm em fonte 10, títulos como "Título 1/2", **notas de rodapé do Word**, quadro do cronograma, capa com o logotipo, folha de rosto, **sumário do Word já numerado** — e atualizável —, números de página no cabeçalho a partir da introdução, contando desde a folha de rosto). Orientando: "Baixar em Word" ao lado de "Baixar o PDF". Orientador: rascunho atual e cópia guardada em PDF ou Word; cada envio vira versão em PDF com o botão "Word" daquela versão. O PDF e o Word leem a mesma estrutura (numeração e ordem iguais) | Publicada (0.43.0) |
| 2 | **Correção: as Referências começam em página nova** (elemento pós-textual), no PDF e no Word | Publicada (0.43.0) |
| 3 | **Cronograma sugerido com os prazos usuais do TCC I e TCC II** (trabalho novo do tipo TCC ou monografia): Definição do tema; Entrega do pré-projeto (Grau A); Entrega do Capítulo 1 (Grau B); Revisão do Capítulo 1; Entrega do Capítulo 2 (Grau A); Revisão do Capítulo 2; Trabalho completo; Revisão final; Depósito da versão impressa; Defesa — com os prazos espalhados do começo da orientação até a defesa prevista (editáveis). Trabalhos já cadastrados ficam como estão | Publicada (0.43.0) |
| 4 | **Prazo das etapas sem data completa:** cada etapa do cronograma pode ter **data**, só **mês/ano**, só **o ano** ou ficar **a definir** (escolha ao lado do prazo). Sem data completa: "previsto para 03/2027", "previsto para 2027" ou "a definir", sem contagem nem alerta; na ordem, entram pelo que se sabe (depois das datas completas do mesmo mês ou ano) e as "a definir" vão para o fim. Vale na visão geral, na lista, na página do orientando, no relatório, no PDF e no Word do pré-projeto e no pedido à IA. **Editar o cronograma** agora abre numa janela larga (os nomes das etapas aparecem inteiros) | Publicada (0.43.0) |

### Pacote 26 (publicado como 0.42.0 em 2026-11-20)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Orientação reorganizada, parte 2:** **registrar sessão numa tela focada** (cobre a página): no alto, presencial/online e data; à esquerda, o editor com as abas **Anotações · Transcrição** (na comunicação, a conversa colada), "O que foi conversado" e **"Organizar com IA"** num botão só, que abre a janela em dois passos (copiar o pedido · colar a resposta); à direita, **Tarefas para o orientando** (com colar em bloco), **pendências anteriores** para marcar e a versão discutida; rodapé fixo com Cancelar e Registrar. **Linha do tempo unificada:** sessões, comunicações e versões numa lista só, por mês, com filtros (Tudo · Sessões · Comunicações · Versões) e "+ Comunicação" / "+ Versão" (em janela) | Publicada (0.42.0) |
| 2 | **Segurança do rascunho do pré-projeto:** (a) o Vide guarda uma **cópia do rascunho** do orientando no computador e no **Drive** (ao abrir a Orientação e a cada 5 minutos), visível na aba Trabalho com "ver (PDF)"; (b) **desativar a página** avisa que o rascunho será apagado do serviço e guarda a cópia antes; ao **criar uma página nova**, o rascunho volta para ela; (c) **dois aparelhos**: o serviço não grava por cima de um texto mais novo — o orientando vê "O texto foi alterado em outro aparelho" e escolhe qual manter; ao voltar para a aba, o texto mais novo é trazido sozinho | Publicada (0.42.0) |

### Pacote 25 (publicado como 0.41.0 em 2026-11-20)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Pré-projeto (TCC I) na página do orientando:** o professor liga o formulário na aba "Página do orientando" e define a capa e a folha de rosto (Uniftec com o logotipo, ou Ftec; curso, cidade, ano, orientador, coorientador, natureza do trabalho; resumo e folha de aprovação opcionais). Na página, a aba **"Meu pré-projeto"** traz os campos do projeto de pesquisa do manual (introdução, 1.1 problema, 1.2 hipóteses, 2.1 objetivo geral, 2.2 específicos, 2.3 justificativa, 3 fundamentação teórica com subtítulos, 4.1 a 4.4 metodologia, 5.1 recursos, referências), **já começando com os elementos do trabalho**; barra com negrito, itálico, citação longa, nota de rodapé e subtítulo; guarda sozinho no serviço. **"Ver o PDF"** monta o pré-projeto pelas regras do manual: A4, margens 3/2 cm, Arial (Helvetica) 12, entrelinha 1,5, recuo de 1,25 cm, citação longa com recuo de 4 cm em fonte 10, **notas de rodapé** no pé da página, capa com o logotipo, folha de rosto (natureza com recuo de 7,5 cm), sumário com as páginas, cronograma como "Quadro 1" (vem do cronograma da orientação), referências em ordem alfabética, páginas contadas desde a folha de rosto e numeradas a partir da introdução. **"Enviar ao orientador"** guarda uma cópia datada, que chega ao professor como **versão em PDF** (ao abrir a Orientação, a cada 5 minutos ou em "Buscar envios agora"); "Ver o rascunho atual (PDF)" mostra o que está escrito agora | Publicada (0.41.0) |
| 2 | **Pré-visualizar o pré-projeto (só para o orientando):** na aba "Meu pré-projeto", **"Pré-visualizar"** abre o PDF numa aba nova e **"Baixar o PDF"** salva no aparelho — nada vai ao orientador; o aviso deixa claro que o orientador só recebe com "Enviar ao orientador" | Publicada (0.41.0) |
| 3 | **Orientação reorganizada (parte 1 da maquete aprovada):** **lista de orientandos** em linhas (silhueta, nome e trabalho, barra de progresso do cronograma, próximo prazo, pendências, último contato), com filtros **Em andamento · Com atraso · Concluídos** e busca; "Modelos e orientações" no menu ⋯. **Orientando:** cabeçalho com **Compartilhar**, **+ Registrar sessão** (▾ para comunicação) e ⋯ (relatório em PDF, modelos, voltar); **4 abas** — **Visão geral** (próximo prazo em destaque, pendências com ✓ e ✕/lixeira ao passar o mouse, cronograma como linha do tempo visual com "Editar", últimas atividades, situação da página do orientando), **Linha do tempo** (sessões e comunicações · versões), **Trabalho** (elementos e pré-projeto), **Ajustes** (dados e modelos só dele). **Compartilhar** reúne link, código com QR, "copiar mensagem", o formulário do pré-projeto (liga/desliga) e a capa; relatório e modelos em janelas. Avisos um de cada vez. **Parte 2 (próximo pacote):** a tela focada de registrar sessão e a linha do tempo unificada | Publicada (0.41.0) |

### Pacote 24 (publicado como 0.40.0 em 2026-11-20)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Sugestões e comandos: ✕ e lixeira.** No lugar de "tirar" (que apagava) e "descartar", cada sugestão ou comando tem dois ícones — no formulário da sessão, na linha do tempo e na lista de pendências: **✕** registra como **não cumprido** (comando) ou **rejeitada** (sugestão), com a data — continua guardado, riscado em vermelho com traço duplo (as cumpridas ficam com risco cinza simples); clicar no ✕ de novo desfaz; **lixeira** apaga de vez (com confirmação fora do formulário). Não cumpridas e rejeitadas saem das pendências, do alerta vermelho e da página do orientando; no relatório em PDF aparecem com um ✕ vermelho na coluna Check e "não cumprido em…" | Publicada (0.40.0) |

### Pacote 23 (publicado como 0.39.0 em 2026-11-20)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Alerta de pendência vencida:** quando passa o prazo de uma sugestão ou comando de orientação sem baixa, aparece um **círculo vermelho com o número** ao lado de "Orientandos" na barra lateral (um ponto vermelho no ícone, com a barra recolhida na aula, e na aba "Turma" do celular); some quando você marca como cumprida ou descarta. Também: selo "N vencidas" no cartão do orientando e o prazo vencido em vermelho nas pendências. Contam só os trabalhos em andamento; o alerta se atualiza com as mudanças, ao voltar para a aba e ao virar o dia | Publicada (0.39.0) |
| 2 | **Silhueta do orientando:** nos quadros de "Orientandos", uma silhueta humana em tom neutro (cinza, cabeça e ombros num círculo) ao lado do nome | Publicada (0.39.0) |
| 3 | **Relatório em PDF mais bem formatado:** uma família de fontes só (Helvetica: normal, negrito e itálico) em tamanhos padronizados; cabeçalho com ficha em duas colunas (curso, e-mail, orientador, início, defesa, situação, data); títulos de seção em verde com fio; **pendências em tabela** (Tipo — COMANDO/SUGESTÃO —, Descrição com a data em que foi combinada, Prazo com "venceu há…" em vermelho, Check com caixinha para marcar); cronograma, sugestões e comandos de cada sessão e versões também em tabela; rodapé com "página X de Y". Na linha do tempo, o que foi cumprido ou descartado mostra a data | Publicada (0.39.0) |

### Pacote 22 (publicado como 0.38.0 em 2026-11-20)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Orientação: elementos do trabalho e relatório em PDF.** Nova aba "Elementos do trabalho" (tema, delimitação, problema, hipóteses, objetivo geral, objetivos específicos — um por linha —, justificativa e metodologia, como no projeto de pesquisa do manual de normalização), guardada sozinha, com a data da última alteração. Botão **"Relatório em PDF"**: escolher o que entra (elementos, cronograma, pendências, sessões e comunicações — com período e, se quiser, anotações, conversas e transcrições —, versões), atalhos "Só os elementos", "Só as orientações" e "Tudo", nome do orientador no cabeçalho; o PDF é montado no computador (o leitor de PDF é baixado só no clique) | Publicada (0.38.0) |
| 2 | **Página do orientando** (link `/o/…` com **código de acesso de 6 números**): cronograma com quanto falta para cada etapa e a "etapa da vez", pendências (sugestões e comandos em aberto), elementos do trabalho (só leitura) e **modelos e orientações para baixar** a qualquer momento; sem e-mail, telefone, sessões, conversas ou versões. **Modelos e orientações** (em Orientandos): arquivos (PDF, Word, até 10 MB) ou orientações escritas, para todos os orientandos ou só para um; vão para o Drive. A página **se atualiza sozinha** alguns segundos depois de cada mudança; "Copiar mensagem para o orientando" (link + código), QR, trocar o código, desativar. Segurança: 8 códigos errados bloqueiam por 15 minutos; o código fica guardado no serviço só como "impressão digital" (hash). Correção junto: mudar o cronograma e logo os elementos (ou os dados) não desfaz mais o que a outra aba acabou de gravar | Publicada (0.38.0) |
| 3 | **Sugestões e comandos colados em bloco:** colar várias linhas no campo de sugestões e comandos separa cada uma e classifica pelo que a IA escreve ("[comando]", "[sugestão]", "Comando:", "Sugestão –") ou pelos títulos "Comandos:" e "Sugestões:"; o prazo ("| até 30/11/2026") entra junto; frases soltas fora da lista são ignoradas; sem marcação, vale o tipo escolhido ao lado; não repete o que já está na lista. Colar a resposta inteira da IA (com "RESUMO:") no mesmo campo preenche também o resumo e as pendências cumpridas | Publicada (0.38.0) |

### Pacote 21 (publicado como 0.37.0 em 2026-11-19)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Orientação, parte 1 (caderno do orientador):** nova seção "Orientação › Orientandos". Cadastro do orientando (nome, e-mail, telefone, curso) e do trabalho (TCC, monografia, artigo, dissertação, tese), com **cronograma sugerido** pelo tipo e prazos espalhados até a defesa (editável; "faltam 7 dias", "venceu há 2 dias"); **sessões e comunicações** em linha do tempo, com **colar a conversa** do WhatsApp ou do e-mail (o Vide reconhece o canal, a data, quem falou e faz o resumo); **sugestões e comandos** em cada registro, que viram **pendências** até serem cumpridas (e podem ser marcadas na sessão seguinte); **versões** do trabalho (PDF, Word…), com data, etapa e anotações; outro trabalho do mesmo orientando. Tudo neste computador e no Google Drive (as versões como arquivos próprios). A tela é baixada só quando aberta (não pesa na aula). **Próximas partes:** página do orientando (com envio de versões e modelos), lembretes por e-mail (pelo Gmail, com o Vide aberto, calculando o prazo na hora do envio) | Publicada (0.37.0) |
| 2 | **Transcrever a sessão de orientação:** no registro da sessão, "Transcrever a sessão" liga o microfone (o mesmo reconhecimento de voz da aula; se a escuta da aula estiver ligada, ela pausa); cada trecho entra com o horário ("[14:03] …") e o registro é guardado enquanto se fala (não se perde se a página mudar); pausar e continuar, inclusive depois, pelo "editar"; a transcrição pode ser corrigida à mão e aparece na linha do tempo em "ver a transcrição" | Publicada (0.37.0) |
| 3 | **Organizar a sessão com a IA:** no registro da sessão (ou da comunicação), "Copiar o pedido para a IA" monta um pedido com a transcrição, as anotações, o cronograma com os prazos e as pendências anteriores numeradas (sem o nome do orientando); cola-se no Claude (ou outra IA); "Colar a resposta da IA" › "Usar a resposta" preenche o resumo, acrescenta as sugestões e os comandos (com prazo, se foi dito) e marca as pendências anteriores já cumpridas, para conferir e registrar | Publicada (0.37.0) |

### Pacote 20 (publicado como 0.36.0 em 2026-11-19)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Correção: projeção abrindo e fechando sem parar.** Quando a aba principal estava aberta desde antes de uma publicação e a janela de projeção já vinha com a versão nova, a aba principal pedia à projeção que se recarregasse a cada 15 s, sem fim. Agora só pede quando a projeção é a mais antiga; quando a projeção é a mais nova, a tela da aula avisa: "recarregue esta página (F5)" | Publicada (0.36.0) |

### Pacote 19 (publicado como 0.35.0 em 2026-11-17)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **QR do processo na projeção:** com o processo aberto na aula (tela do eproc), um QR flutuante no canto da projeção leva a turma ao link do processo no celular ou no notebook, com o endereço escrito embaixo; no painel, "Ampliar o QR" (grande no meio, para escanear de longe), "QR no canto" e "Esconder o QR"; sem link publicado, o painel avisa que não há QR | Publicada (0.35.0) |

### Pacote 18 (publicado como 0.34.0 em 2026-11-17)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Processos no Google Drive:** criar ou editar um processo (e também casos, disciplinas e turmas) agora avisa o Drive na hora, como já acontecia com as questões e os materiais; antes, só subia na verificação de 2 em 2 minutos e se perdia se a aba fosse fechada antes. O resumo do Drive diz o que foi enviado ("enviado: processos") | Publicada (0.34.0) |

### Pacote 17 (publicado como 0.33.0 em 2026-11-12)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Sugestão mais rápida na aula:** quando o artigo é a última coisa dita, o Vide sugere depois de uma pausa curta (0,6 s), sem esperar o texto definitivo do reconhecedor (que pode levar de 1 a 3 s); se a fala continua a mesma citação ("quatrocentos… e oitenta e seis", "…inciso sexto"), a sugestão é trocada ou refinada; "do"/"da" no fim continua esperando a lei. **Medição:** cada sugestão registra a espera do Vide, e o Registro das aulas mostra a média de cada aula | Publicada (0.33.0) |

### Pacote 16 (publicado como 0.32.0 em 2026-11-12)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Perguntas sobre o processo em **quadros por evento** na página da turma: lado a lado, cada um com o evento, quantas perguntas e o progresso do aluno ("2 de 4 feitas", "concluído ✓", "novo" no mais recente); ao tocar, abrem só as perguntas daquele evento (com "recomeçar este evento"); atalho "N perguntas" na tabela de eventos | Publicada (0.32.0) |
| 2 | **Só esta turma** para materiais e questionários (avaliações aplicadas, planos de aula): aparecem só na turma escolhida, não nas outras turmas da mesma disciplina; ao adicionar no modo da turma, escolha "toda a disciplina" ou "só a turma", com a **pasta da turma sugerida sozinha** (ex.: "PC1 · 2026.2/Avaliações"); selo "só PC1 · 2026.2"; mudar em Organizar, no editor do questionário ou em Recursos › Materiais/Questionários da turma | Publicada (0.32.0) |
| 3 | Selo do personagem juiz: **balança em equilíbrio** no lugar do martelo (que não se usa nos tribunais brasileiros) | Publicada (0.32.0) |

### Pacote 15 (publicado como 0.31.0 em 2026-11-11)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | **Minhas turmas**, parte 1: disciplinas (nome, sigla, cor e **lei principal obrigatória**) e turmas (período, dias e horários, começo e fim do semestre, arquivar); **modo da turma** (seletor no alto da barra lateral): as listas mostram só o que é da turma e o que ainda não tem disciplina (marcado "sem disciplina"), com "mostrar tudo"; a lei principal da disciplina vale na aula; o que é criado no modo da turma já nasce ligado (conteúdo à disciplina; processos, links e resultados à turma); **aviso na hora da aula** (de 15 minutos antes até o fim, com o Vide aberto); disciplinas e turmas vão para o Google Drive | Publicada (0.31.0) |
| 2 | **Minhas turmas**, parte 2: **Recursos** de cada disciplina (ver e vincular em lote materiais, questões, questionários e casos, com atalhos por pasta e por assunto; escolher a turma de processos, links de treino e resultados); disciplina ao **organizar um material** e turma na **capa do processo**; o **registro de cada aula** guarda a turma (selo e filtro no Registro); **Início** com o nome da turma e a próxima aula | Publicada (0.31.0) |

### Pacote 14 (publicado como 0.30.0 em 2026-11-11)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Processo fictício, fase 3a: **jeito de conduzir** cada processo — **ilustrativo** (o professor monta tudo; o editor fica enxuto, com "Mais recursos" para fase, prazo e "E agora?"), **colaborativo** (a turma analisa cada ato em sala; o professor anota a **deliberação da turma** na Aula ou no editor, com as votações "E agora?" e os vícios mostrados entrando sozinhos; o Vide monta o **pedido do próximo ato para a IA** e recebe a resposta colada; a turma vê "O que a turma decidiu antes deste ato") e **participativo** (aparece como "projeto futuro": escritórios e envio de peças ficam para depois, para o app não pesar) | Publicada (0.30.0) |
| 2 | Processo fictício, fase 3c: **perguntas sobre o processo** (aba Perguntas: pedido pronto para a IA com o processo até um evento, colar no formato das Questões, cada pergunta ligada a um evento); na página da turma, "Teste o que você sabe sobre o processo", só com as perguntas dos eventos liberados, conferidas no próprio aparelho; as perguntas ficam no banco com o assunto "processo: <nome>", para o jogo, a forca e o treino em casa | Publicada (0.30.0) |

### Pacote 13 (publicado como 0.29.0 em 2026-11-11)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Processo fictício, fase 2b: **caça aos vícios** (o professor seleciona o trecho com defeito e explica; a turma toca nos parágrafos suspeitos; a conferência fica fechada até o professor liberar, e os vícios nem vão para o link antes disso; na aula, "Mostrar os vícios" destaca todos na projeção) | Publicada (0.29.0) |
| 2 | **"E agora?"**: num evento, uma pergunta com opções; na aula, antes de liberar o evento, a turma vota pelo celular (mesma sala do jogo, sem pontos) e o resultado aparece no projetor | Publicada (0.29.0) |
| 3 | **PDF dos autos**: na página da turma, um botão monta os autos num PDF (capa, partes, eventos, peças escritas e PDFs anexados), com folhas numeradas e a marca "PROCESSO FICTÍCIO"; só os eventos liberados. Usa a biblioteca pdf-lib, carregada só no clique. "Vício:" e "E agora:" também no processo em texto e no pedido para a IA | Publicada (0.29.0) |

### Pacote 12 (publicado como 0.28.0 em 2026-11-11)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Processo fictício, fase 2a: **mapa do procedimento** na página da turma ("o processo está aqui", fase sugerida pela descrição ou escolhida no evento); **prazos correndo** (o evento abre um prazo em dias úteis ou corridos, sem feriados; vencimento e dias que faltam; desafio **"Quando vence?"**, em que o aluno faz a conta e confere); **glossário** (termos dos eventos sublinhados com a explicação; o Vide traz uma lista e o professor acrescenta os seus); **cliente em cena** (um caso da Consulta abre a página da turma, com o cliente contando o problema); "Fase:" e "Prazo:" no processo em texto e no pedido para a IA | Publicada (0.28.0) |

### Pacote 11 (publicado como 0.27.0 em 2026-11-11)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Nova organização, parte 1: **barra lateral clara** (Início, Aula; Biblioteca: Leis, Materiais; Atividades: Questões, Casos, Processos, Links da turma; Turma: Resultados, Registro das aulas; Ajustes), que se recolhe durante a aula; tela de **Início** ("Pronto para a aula?", continue de onde parou, criar rápido, links ativos); botão **+ Criar**; **busca geral** (Ctrl K) por artigos, materiais, questões, casos e processos, levando o artigo para a aula; **Links da turma** num lugar só; páginas com o mesmo cabeçalho; avisos rápidos e janelas de confirmação do próprio Vide no lugar das do navegador; telas vazias com personagem e o que fazer; barra inferior no celular | Publicada (0.27.0) |
| 2 | Nova organização, parte 2: tela da **Aula** mais limpa (situação da escuta, da projeção e do celular em "pílulas" no alto; botão de tela cheia só com ícone; **No projetor agora** à direita, mostrando o artigo projetado, quando não há material nem atividade; rodapé discreto com a hora de início da sessão); **Atividades** viram uma galeria com personagens (Jogo de perguntas, Forca, Consulta, Processo da turma) e um passo a passo: escolher a atividade › conteúdo e opções; nas listas vazias, botões para criar o primeiro caso ou processo | Publicada (0.27.0) |
| 3 | Nova organização, parte 3: **Materiais** em cartões com a capa (a primeira página do PDF ou a imagem, desenhada quando o cartão aparece); **Processos** em cartões (número, partes, progresso dos eventos liberados, publicado ou não) e o atalho "Peça um processo pronto à IA"; telas vazias com personagem em Questões, Questionários e Registro das aulas; **celular**: logo e ajustes no alto, botão **+** flutuante, abas para as outras páginas do grupo (ex.: Leis e Materiais), barra de baixo também na Aula, que no celular explica como usá-lo como microfone e controle | Publicada (0.27.0) |

### Pacote 10 (publicado como 0.26.0 em 2026-11-11)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Processo em texto: **Colar processo** (capa, partes, eventos e peças num formato de texto, com prévia e avisos; documentos "(PDF)" ficam com "falta anexar o PDF"); **Colar eventos** num processo existente (siglas repetidas renumeradas); **Copiar como texto** (o processo inteiro no mesmo formato, para revisar ou pedir à IA que continue); **pedido pronto para a IA** (tema, até que fase, quantos eventos, data de início e defeitos para plantar) | Publicada (0.26.0) |

### Pacote 9 (publicado como 0.25.0 em 2026-11-10)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Processo fictício, etapa 1a: nova seção **Acervo › Processos** (biblioteca; novo processo em branco); capa (número no formato do CNJ com "tribunal 99", que não existe), partes e advogados, eventos com peças escritas no Vide (títulos, citações, listas, negrito, itálico); cada evento segurado, agendado ou liberado; publicar para a turma (link e QR) com atualização automática; página da turma `/p/<código>` inspirada no eproc, com a marca "PROCESSO FICTÍCIO — USO DIDÁTICO", novidades desde a última visita e leitura das peças; o serviço só entrega aos alunos os eventos já liberados | Publicada (0.25.0) |
| 2 | Processo fictício, etapa 1b: PDFs anexados às peças (ficam nos materiais do acervo e vão para o Google Drive; até 10 MB; o serviço só entrega o PDF de evento já liberado); artigos citados nas peças ("art. 319 do CPC") viram links com o texto da lei; **Atividades › Processo da turma** projeta o processo como a turma vê, com as peças que o professor abrir e a rolagem acompanhando, e libera eventos durante a aula (atualiza o link); **Copiar** um processo para outro semestre, com as datas reprogramadas; processos sincronizados com o Google Drive | Publicada (0.25.0) |

### Pacote 8 (publicado como 0.24.0 em 2026-11-10)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Pedido para a IA (Acervo › Casos): deixa claro que é preciso variar quem consulta (mulher ou homem; jovem, adulto ou idoso) e quem responde (juiz ou advogado), para os casos não saírem todos com o mesmo tipo de personagem; explica que o Vide sorteia se quem responde aparece como homem ou mulher | Publicada (0.24.0) |
| 2 | Personagens da Consulta com acabamento refinado: luz e sombra, contornos no tom da cor, rosto mais cuidado, círculo de fundo, selo de martelo (juiz) ou pasta (advogado); animações: piscar, respirar, troca suave de expressão, "digitando…" antes de cada fala, balões com sombra e "rabinho", quem responde entra deslizando | Publicada (0.24.0) |

### Pacote 7 (publicado como 0.23.0 em 2026-11-10)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Novo jogo "Consulta": um personagem (elenco de 16 desenhado no estilo do Vide, com 4 expressões, sorteado pela linha "Pessoa") conta um caso em balões no projetor; a turma discute em grupo (cronômetro, pausar, +1 minuto; o professor vê a resposta só na sua tela); no fim do tempo o advogado ou o juiz responde, com o fundamento (que pode ser projetado). Sem celular. Nova seção **Acervo › Casos** (colar casos com prévia, pedido pronto para a IA, editar, apagar, sincroniza com o Drive) e treino em casa com casos (o aluno escreve a resposta, vê a do advogado/juiz e se autoavalia; PDF). Os casos discutidos entram no pacote da aula para o Claude | Publicada (0.23.0) |

### Pacote 6 (publicado como 0.22.0 em 2026-11-09)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Jogo de forca: em sala, a turma toda (cada aluno vota numa letra pelo celular; a mais votada entra; quem souber pode digitar a palavra; até 6 erros; sem ranking); no treino em casa, forca individual (formato "Forca" ao gerar o link). A palavra é o conceito das questões "Adivinhe o conceito" | Publicada (0.22.0) |

### Pacote 5 (publicado como 0.21.0 em 2026-11-09)

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Acervo › Questões: tela inicial com atalhos (novo treino em casa, adicionar questões, novo questionário) e seções separadas (Questões, Questionários, Treinos em casa, Resultados), em vez de tudo numa página longa | Publicada (0.21.0) |
| 2 | "Adivinhe o conceito": resposta tolerante (pequenos erros de digitação, plural, hífen/espaço, "é a…"; nunca a resposta exata de outro conceito); mensagem de erro com o texto digitado; no fim da rodada o aluno vê o que digitou; respostas digitadas guardadas sem nomes nos Resultados, com "Aceitar nas próximas"; mesma tolerância no treino em casa | Publicada (0.21.0) |
| 3 | Tela de aula em coluna única: só as alternativas; a transcrição e as referências detectadas aparecem apenas ao clicar em "mostrar transcrição e referências" (na barra de baixo, junto com Nova sessão) | Publicada (0.21.0) |

### Pacote 4 (publicado como 0.20.0 em 2026-11-06)


| # | Ideia | Situação |
|---|-------|----------|
| 1 | Treino em casa: o aluno pode salvar o PDF a qualquer momento, mesmo sem terminar (link "salvar PDF até aqui" durante a sessão: resultado parcial só com as questões já respondidas, sem mostrar as que faltam) | Publicada (0.20.0) |
| 2 | Projetor do jogo: texto das alternativas, das dicas e do enunciado diminui sozinho para caber inteiro no quadro (em vez de ficar cortado) | Publicada (0.20.0) |
| 3 | Jogo: QR code do canto maior (de 8% para 14% da largura da tela) e botão "Mostrar QR grande" no painel do professor, que põe o QR grande no meio do projetor até ser escondido | Publicada (0.20.0) |

### Pacote 3 (publicado como 0.19.0 em 2026-11-03)


| # | Ideia | Situação |
|---|-------|----------|
| 1 | Treino em casa: botões para baixar o QR code como imagem (PNG) e copiar a imagem, para divulgar no Moodle, em slides ou impresso (imagem PNG com o QR, o título e o link) | Publicada (0.19.0) |
| 2 | Atividades: escolher o tempo ao abrir a sala, separado para múltipla escolha/V-F e para "Adivinhe o conceito" (ou manter o tempo sugerido de cada questão); a escolha fica guardada; no cadastro, o tempo vira "sugerido" | Publicada (0.19.0) |
| 3 | "Adivinhe o conceito": o projetor deixa de mostrar quem acertou; mostra só quantos acertaram com 1, 2, 3… dicas | Publicada (0.19.0) |
| 4 | Jogo: QR code pequeno e código fixos no canto do projetor durante as perguntas, resultados e placar, para alunos entrarem com o jogo já começado | Publicada (0.19.0) |

### Pacote 2 (publicado como 0.18.0 em 2026-11-03)


| # | Ideia | Situação |
|---|-------|----------|
| 1 | Atividades › Sortear por assunto: campo de busca de assunto (sem diferença de maiúsculas e acentos; Enter escolhe o primeiro) com a lista filtrada, no lugar da caixa de seleção | Publicada (0.18.0) |
| 2 | Acervo › Materiais: ver o conteúdo do PDF/imagem (clique no nome ou em "Ver"), com as páginas e, ao lado, renomear, mudar de pasta e etiquetas; "Próximo ▶" passa ao seguinte da mesma pasta guardando as mudanças | Publicada (0.18.0) |
| 3 | Treino em casa: link (e QR) com um grupo de questões — por assunto (sorteio a cada sessão ou lista fixa), questionário pronto ou escolhidas uma a uma; aluno resolve sozinho, sem tempo nem competição, com a resposta a cada questão ou só no fim, o texto do artigo do fundamento e o resultado em PDF; links listados com Desativar. Requer novo serviço no Cloudflare (Durable Object "Treino") | Publicada (0.18.0) |

### Pacote 1 (publicado como 0.17.0 em 2026-11-03)


| # | Ideia | Situação |
|---|-------|----------|
| 1 | Na Aula, o botão "Perguntas" passa a se chamar "Atividades" (e a janela que ele abre também) | Publicada (0.17.0) |
| 2 | Assuntos nas questões (campo "Assuntos", linha "Assunto:" ao colar, filtro no banco) e, em Atividades, "Sortear por assunto": escolher o assunto e quantas questões (ex.: 10 sobre sentença) e abrir a sala na hora | Publicada (0.17.0) |
| 3 | Nova modalidade "Adivinhe o conceito": dicas graduais (2 a 4, em intervalos iguais), resposta digitada no celular (sem diferença de maiúsculas, acentos e artigo inicial; outras respostas aceitas), espera de 5 s após erro, pontos pelo tempo (1000 a 300), projetor mostra quem acertou e com quantas dicas; cadastro no formulário ou colando "Conceito:/Dica:"; sorteio por tipo de questão | Publicada (0.17.0) |
| 4 | Aula: transcrição bruta oculta por padrão, com o link discreto "mostrar transcrição bruta" na barra de baixo da coluna da direita (a escolha fica guardada; a gravação no Registro continua igual) | Publicada (0.17.0) |
| 5 | Aula: botão "×" no canto direito da barra do material em exibição, para fechá-lo (o projetor fica só com os artigos) | Publicada (0.17.0) |
