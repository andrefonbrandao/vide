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

## Situação

**Pacote 8** aberto em 2026-11-10, a partir da versão 0.23.0 (já publicada).

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Pedido para a IA (Acervo › Casos): deixa claro que é preciso variar quem consulta (mulher ou homem; jovem, adulto ou idoso) e quem responde (juiz ou advogado), para os casos não saírem todos com o mesmo tipo de personagem; explica que o Vide sorteia se quem responde aparece como homem ou mulher | Pronta |

## Pacotes anteriores

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
