# Vide — protótipo de risco

App pessoal para aulas expositivas. Ele ouve a fala do professor, reconhece citações ao CPC ("artigo 70", "inciso sexto do 485") e mostra os dispositivos citados como candidatos na tela do apresentador. Um candidato só vai para o projetor quando o professor clica.

Este protótipo serve para **testar em sala se o reconhecimento de voz funciona**. A especificação completa está em [ESPECIFICACAO.md](ESPECIFICACAO.md). O roteiro de teste para a aula está em [ROTEIRO-DE-TESTE.md](ROTEIRO-DE-TESTE.md).

## O que o protótipo faz

- **Voz contínua em português** (Chrome ou Edge), com reinício automático quando a sessão cai.
- **Transcrição bruta ao vivo** na tela do apresentador: em preto o texto definitivo, em cinza o provisório.
- **Importação de leis** a partir do HTML salvo do Planalto (ou de um .txt): CPC, CF (com o ADCT separado), Código Civil, LINDB, CDC, Leis 9.099, 12.016, 7.347, 6.830 e 9.307, e qualquer **outra lei** cadastrada pelo professor (abreviação, número e apelidos falados). Uma **lei principal** (padrão: CPC) vale quando a lei não é dita. O app:
  - fatia o texto em artigo, parágrafo, inciso e alínea;
  - descarta a redação revogada (texto tachado);
  - lista as duplicidades encontradas.
- **Detecção de referências**, por exemplo:
  - "artigo 70 do CPC", "art 70", "artigo setenta", "artigo mil e quinze";
  - "c p c", "código de processo civil";
  - "parágrafo primeiro do artigo 300", "inciso sexto do 485", "alínea b do inciso segundo do artigo 1.015";
  - "e o inciso sétimo", logo depois de citar um artigo.
- **Frases de outra lei são ignoradas**, como "artigo 5º da Constituição" e "art. 186 do Código Civil".
- **Duas janelas.** A do apresentador mostra de 3 a 5 candidatos, os mais recentes no topo. A de projeção usa letra grande e alto contraste. As duas conversam pelo próprio navegador (BroadcastChannel).
- **Controles por mouse:**
  - roda: percorre os candidatos;
  - clique esquerdo: projeta o candidato selecionado;
  - clique direito: volta à tela preta;
  - clique na roda: alterna a roda entre "percorrer candidatos" e "rolar o texto projetado".
- **Comandos de voz** (só quando há algo projetado): "tira da tela", "aumenta a fonte" e "diminui a fonte".
- **Atalhos de teclado** (opcionais): setas ou PageUp/PageDown = roda; Enter = projetar; B = recolher; R = alternar a roda; M = marcar momento; + e − mudam a fonte.
- **Registro de teste** com horário: falas, referências detectadas, projeções, recolhimentos, comandos de voz, quedas da voz e momentos marcados. Exporta em **.txt** e **.csv** (abre no Excel).

O acervo e o registro ficam no **IndexedDB**, um banco interno do navegador. Ficam neste navegador, neste computador. Login e sincronização (Supabase) ficam para a próxima etapa. O modelo de dados já está pronto para isso; veja `supabase/esquema.sql`.

## Material do professor (slides, PDFs, imagens)

- Carregue PDFs (slides exportados do PowerPoint, acórdãos, textos) ou imagens na aba **Acervo** ou pelo seletor **Material** da aula. Ficam guardados no navegador, organizados em **pastas** (com subpastas, "Processo Civil II/Sentença") e **etiquetas**. O seletor da aula tem **busca** (nome, pasta, etiqueta) e mostra os usados recentemente.
- Com material na tela: **roda** passa as páginas; **arrastar** sobre a miniatura amplia um trecho (o zoom completa a proporção da tela do projetor); **clique esquerdo** projeta o candidato mais recente, que **desliza ao lado do slide**; **clique direito** recolhe o artigo e o slide volta.
- O PDF é desenhado pelo pdf.js (edição "legacy", compatível com navegadores um pouco mais antigos), carregado só quando é usado.
- Limitação: o PDF não tem as animações nem os vídeos do PowerPoint.

## Controlar pelo celular (iPhone)

O computador continua mostrando a projeção; o iPhone vira microfone e controle remoto.

- Na tela da **Aula**, clique em **Celular** › **Gerar QR code** e aponte a câmera do iPhone para o código. A página abre no Safari.
- O acervo (leis e materiais) continua no computador; o celular só manda a voz e os comandos.
- Os dois aparelhos precisam de internet. O texto falado passa pelo Cloudflare só para chegar ao computador; não fica guardado lá.
- Por dentro: um Worker do Cloudflare (`worker/index.ts`) com um Durable Object ("Sala") repassa as mensagens entre o computador e o celular por WebSocket.

## Publicar no Cloudflare (sem instalar nada no notebook)

Você faz isso **uma vez só**, pelo navegador. Depois, cada atualização que eu enviar ao GitHub é publicada sozinha.

1. Entre em <https://dash.cloudflare.com> com a mesma conta do Serestapp.
2. No menu da esquerda, clique em **Workers & Pages** (às vezes aparece como **Compute (Workers)**).
3. Clique em **Create** (ou **Create application**).
4. Escolha **Import a repository** (ou "Connect to Git").
   - Se o Cloudflare pedir acesso ao GitHub, autorize. Escolha **Only select repositories** e marque **vide**.
5. Selecione o repositório **andrefonbrandao/vide**.
6. Confira as configurações. Normalmente o Cloudflare já preenche sozinho:
   - **Project name:** `vide`
   - **Build command:** `npm run build`
   - **Deploy command** (se aparecer): `npx wrangler deploy`
   - Se aparecer **Build output directory** em vez de "Deploy command" (é a tela antiga, chamada "Pages"), escreva `dist`. Se aparecer **Framework preset**, escolha **React (Vite)**.
   - **Branch:** `claude/wizardly-clarke-nwd93w`, que é o único branch do repositório e o principal.
7. Clique em **Deploy** (ou **Save and Deploy**) e espere uns 2 minutos.
8. No fim, o Cloudflare mostra o endereço do app, algo como `https://vide.SEU-USUARIO.workers.dev` ou `https://vide.pages.dev`. **Guarde esse endereço**: é por ele que você abre o Vide no notebook.

Para conferir se deu certo: abra o endereço no Chrome. A tela com o logo "vide" e as abas **Aula · Acervo · Registro** deve aparecer.

## Como funciona por dentro (para referência)

| Pasta | O que tem |
| --- | --- |
| `src/fatiador/` | Leitura do HTML/TXT do Planalto e o fatiador por dispositivo |
| `src/voz/` | Números por extenso, normalização da fala, detector de referências, reconhecimento de voz e comandos |
| `src/comum/` | Montagem do que vai para a tela, canal entre as janelas, registro de teste e logo |
| `src/dados/` | Modelo do "item genérico" e o banco local (IndexedDB) |
| `src/telas/` | Telas: Aula (apresentador), Projeção, Acervo e Registro |
| `src/material/` | Leitura de PDF/imagem, zoom e passagem de páginas do material do professor |
| `supabase/` | Esquema previsto para a sincronização (ainda não usado) |
| `public/vide-simbolo.svg`, `public/vide-icone-app.svg` | Símbolo do logo (cabeçalho) e ícone do app (favicon). Regras de uso em `marca/LEIA-ME.md` |

Os testes automáticos ficam em `src/**/*.test.ts` e rodam com `npm test`. Eles cobrem o detector (dezenas de frases) e o fatiador. Não é preciso rodá-los no seu notebook.
