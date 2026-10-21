# Roteiro de teste do Vide

O objetivo é responder a uma pergunta: **o reconhecimento de voz funciona bem o bastante em sala?** Siga as três partes na ordem: preparar em casa, ensaiar em casa e usar na aula.

---

## Parte 1 — Preparar (em casa, uns 15 minutos, uma vez só)

1. **Abra o Vide no Chrome** pelo endereço do Cloudflare (veja o LEIAME).
2. **Importe o CPC:**
   1. Numa nova aba, abra <https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm>.
   2. Aperte **Ctrl + S** e salve o arquivo (por exemplo, em Downloads).
   3. Volte ao Vide, clique na aba **Acervo** e depois em **Escolher arquivo**. Selecione o arquivo salvo.
   4. Confira o resumo. O esperado é **cerca de 1.073 artigos**, dezenas de trechos tachados descartados e **0 duplicidades**.
   5. Clique em **Guardar no acervo**.
3. **Confira dois artigos:** em "Conferir um artigo", digite `485` e depois `1015`. Veja se os incisos e parágrafos estão certos.
4. **Teste o detector sem microfone:** em "Testar o detector", escreva frases como você falaria:
   - "inciso sexto do 485"
   - "parágrafo primeiro do artigo 300"
   - "artigo mil e quinze"
   - "artigo quinto da Constituição" (esta deve ser **ignorada**)
5. **Atenção:** o acervo fica no navegador onde você importou. Se for usar outro navegador (por exemplo, o Edge) ou outro computador, importe o CPC de novo nele.

## Parte 2 — Ensaiar (em casa, uns 10 minutos)

1. Na aba **Aula**, clique em **Iniciar escuta**.
2. O navegador vai perguntar se o site pode usar o microfone. Clique em **Permitir**. O indicador deve mostrar **"Ouvindo"**, com a luz verde.
3. Fale em voz normal: "Vamos ver o artigo 70 do CPC." Em 1 ou 2 segundos devem aparecer:
   - a frase na **Transcrição bruta**, à direita;
   - o candidato **art. 70 CPC**, à esquerda.
4. Clique em **Abrir projeção**. Uma segunda janela abre.
   - Sem projetor, ela fica por cima. Arraste-a para o lado.
   - Se o navegador avisar "pop-up bloqueado", clique no ícone da barra de endereço, escolha **Sempre permitir** e clique de novo em **Abrir projeção**.
5. Treine os controles com o mouse sobre a tela do apresentador:
   - **Roda:** muda o candidato selecionado (o de fundo escuro).
   - **Clique esquerdo:** projeta.
   - **Clique direito:** volta à tela preta.
   - **Clique na roda:** o selo muda para "ROLAR O TEXTO PROJETADO". Agora a roda rola o texto no projetor. Experimente com "artigo mil e quinze". Clique na roda de novo para voltar.
6. Com algo projetado, diga **"aumenta a fonte"**, depois **"diminui a fonte"** e depois **"tira da tela"**.
7. Abra a aba **Registro**, clique em **Ver** e confira se tudo ficou anotado. Depois clique em **Começar uma nova sessão agora** (ou em **Nova sessão**, na tela da Aula). A tela de trabalho fica limpa e o ensaio não se mistura com a aula; o registro do ensaio continua guardado.
8. (Opcional) Repita os passos 1 a 3 no **Edge**, para comparar. Lembre-se de importar o CPC nele também.

## Parte 3 — Na aula

### Antes de começar (5 minutos)

1. Ligue o notebook no projetor. Aperte **Windows + P** e escolha **Estender**. Assim o projetor vira uma segunda tela, e a turma não vê a tela do apresentador.
2. Conecte-se ao **Wi-Fi** da sala. O reconhecimento de voz precisa de internet.
3. Abra o Vide e clique em **Abrir projeção**.
   - Se a janela abrir no notebook, arraste-a para a tela do projetor. Para isso, leve-a para além da borda da tela.
   - Na janela de projeção, clique em **"Clique aqui para tela cheia"** ou aperte **F11**. A tela do projetor fica preta.
4. Volte com o mouse para o notebook e clique em **Tela cheia** na tela do apresentador. Assim nenhum clique cai em outra janela.
5. Clique em **Iniciar escuta** e confira se aparece **"Ouvindo"**.
6. **Avise a turma** de que a aula está sendo transcrita para teste (LGPD).

### Durante a aula

- Dê a aula normalmente e cite os dispositivos do jeito que você costuma citar. **Não fale de um jeito artificial para o app**: o teste é justamente ver se ele entende o seu jeito natural.
- Quando um candidato útil aparecer, projete-o com o clique esquerdo. Para tirar, use o clique direito ou diga "tira da tela".
- **Se você citar algo e nada aparecer, ou aparecer errado, aperte "Marcar momento" (ou a tecla M).** Isso deixa uma anotação no registro, com o horário e a última frase ouvida. Essas marcas são o dado mais importante do teste.
- Para usar outro material (slides, por exemplo), clique em **Sair**. A escuta pausa e o projetor fica preto. Para voltar, clique em **Retomar a aula**.
- Se a luz da voz ficar **laranja** ("Reconectando…"), espere alguns segundos: o app reconecta sozinho. Se demorar mais de 30 segundos, confira o Wi-Fi.

### Depois da aula

1. Abra a aba **Registro**. A sessão da aula estará no topo.
2. Clique em **Exportar .txt**. É a transcrição, com as projeções marcadas no ponto em que aconteceram.
3. Clique em **Exportar .csv (Excel)**. É a mesma informação em tabela, boa para contar.
4. Os dois arquivos vão para a pasta **Downloads**.

## Usar seus slides ou PDFs junto com os artigos

**Preparar (em casa):**
1. No PowerPoint, salve os slides em PDF: **Arquivo › Exportar › Criar PDF**. Também servem PDFs de acórdãos, textos e imagens (PNG, JPG).
2. No Vide, na aba **Acervo**, use **Materiais (slides e PDFs) › Carregar PDF ou imagem**. Ou, na aba **Aula**, no seletor **Material**, escolha **+ carregar PDF ou imagem…**.

**Na aula:**
1. No seletor **Material** (no alto da tela), escolha o arquivo. O projetor mostra a página 1.
2. **Roda do mouse** passa as páginas. O passador de slides (PageDown/PageUp) também funciona.
3. **Para ampliar uma parte da página:** na miniatura do centro da sua tela, **arraste o mouse** desenhando um retângulo sobre o trecho. O projetor mostra só aquele trecho, ocupando a tela inteira.
   - Com zoom, a roda **desce dentro da página**; no fim, continua no alto da página seguinte (bom para PDF em pé).
   - **Duplo clique** na miniatura (ou o botão **Página inteira**, ou a tecla **0**) volta à página inteira.
4. Quando um artigo aparecer na lista, o **clique esquerdo** projeta **o mais recente**. Para projetar outro, **clique direto nele**.
   - O artigo **desliza da direita** e ocupa cerca de 40% da tela; o slide continua visível ao lado.
   - Botão **Artigo: ao lado do slide / em tela cheia** (ou tecla **L**) troca entre os dois jeitos.
   - Artigo longo: **clique na roda** e a roda passa a rolar o artigo; clique na roda de novo para voltar às páginas.
5. **Clique direito** (ou "tira da tela") recolhe o artigo, e o slide volta a ocupar a tela, no mesmo ponto.
6. **Tela preta** (botão ou tecla **.** ponto) esconde o material por um momento; clique de novo para voltar.

## Como medir os acertos

Com o .csv aberto no Excel, use a coluna **tipo** para filtrar. Anote:

| Medida | Como contar |
| --- | --- |
| Citações feitas | Leia a transcrição (.txt) e conte quantas vezes você citou um dispositivo do CPC |
| **Acertos** | Linhas `detectado` que correspondem a uma citação real e trazem o dispositivo certo |
| **Erros** | Linhas `detectado` que trazem o dispositivo errado (ex.: você disse 485 e veio 405) ou que não correspondem a nenhuma citação |
| **Faltas** | Citações que você fez e que não viraram `detectado`, incluindo os momentos em que você apertou "Marcar momento" |
| Transcrição ruim × detector ruim | Em cada falta, veja a linha `fala` daquele horário. Se o texto está certo e o app não detectou, o problema é do detector, e eu corrijo. Se o texto já veio errado, o problema é do reconhecedor de voz |
| Estabilidade | Conte as linhas `voz` com "voz caiu; reiniciando". Muitas quedas seguidas indicam Wi-Fi instável |
| Utilidade | Linhas `projetado`. A coluna de detalhes mostra a posição do candidato na lista e quantos segundos ele esperou até o clique |

**Para me mandar o resultado:** envie o .txt e o .csv, ou só os trechos com problema. Com eles eu ajusto o detector para o seu jeito de falar.

## Perguntas que o teste deve responder

1. A transcrição entende bem os números ("quatrocentos e oitenta e cinco", "mil e quinze")?
2. O microfone do notebook capta bem a sua voz de onde você costuma ficar? Ou vai ser preciso um microfone de lapela?
3. O reconhecimento aguenta a aula inteira sem cair muito?
4. Chrome ou Edge: qual acertou mais?
5. Os candidatos aparecem rápido o bastante para serem úteis?
