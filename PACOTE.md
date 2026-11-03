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

**Pacote 3** aberto em 2026-11-03, a partir da versão 0.18.0 (já publicada).

| # | Ideia | Situação |
|---|-------|----------|
| 1 | Treino em casa: botões para baixar o QR code como imagem (PNG) e copiar a imagem, para divulgar no Moodle, em slides ou impresso (imagem PNG com o QR, o título e o link) | Pronta |
| 2 | Atividades: escolher o tempo ao abrir a sala, separado para múltipla escolha/V-F e para "Adivinhe o conceito" (ou manter o tempo sugerido de cada questão); a escolha fica guardada; no cadastro, o tempo vira "sugerido" | Pronta |

## Pacotes anteriores

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
