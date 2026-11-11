# Teste de peso do Vide

**Para que serve:** conferir, de tempos em tempos, se o Vide continua leve para um notebook de
entrada. Se algum número passar do limite, o Claude avisa o professor e recomenda a melhoria
(por exemplo, dividir o programa em partes, para cada tela carregar só o que precisa).

**Quando:** a cada 5 pacotes publicados, ao fechar os pacotes **15, 20, 25, 30…**
(o próximo é o pacote 15). Também quando o professor pedir.

**Como:** `npm run peso` (leva uns 10 minutos). Ele:
1. faz o build;
2. sobe o site no próprio computador (`wrangler dev`, porta 8790);
3. cria uma lei de exemplo do tamanho do CPC e um PDF com slides de fotos grandes;
4. abre o Vide com o processador **4 vezes mais lento** (imita um notebook de entrada) e mede;
5. acrescenta o resultado no fim deste arquivo, com o veredito.

Para só ver o resultado, sem registrar aqui: `npm run build && node scripts/peso/medir-peso.mjs --sem-registro`.

## Limites

| Medida | Limite |
|---|---|
| JS principal baixado ao abrir (gzip) | 400 KB |
| Abrir o Vide pela primeira vez | 2 s |
| Digitar um artigo até aparecer a alternativa | 0,4 s |
| Clicar e o artigo aparecer no projetor | 0,4 s |
| Passar para um slide com foto grande | 1,5 s |
| Busca geral (Ctrl K) | 0,6 s |
| Memória (Aula + projeção + PDF) | 80 MB |
| Processador com a aula aberta e parada | 3% |

Passou de um limite → recomendar a melhoria ao professor (explicando o custo) antes de mexer.
Chegou perto (mais de 75% do limite) → comentar no fechamento do pacote, sem mexer.

## Medições

### 2026-11-11 · versão 0.30.0 (referência, pacote 14)

Processador 4 vezes mais lento (imita um notebook de entrada). Baixado só quando usado (gzip): leitor de PDF (parte que roda à parte) 384 KB, montador do PDF dos autos 171 KB, leitor de PDF 143 KB, autosPdf 3 KB.

| Medida | Resultado | Limite | |
|---|---|---|---|
| JS principal (gzip), baixado ao abrir | 245 KB | 400 KB | ok |
| Visual (CSS, gzip) | 36 KB | — | ok |
| Abrir o Vide (primeira vez) | 815 ms | 2000 ms | ok |
| Abrir de novo (com cache) | 321 ms | — | ok |
| Importar uma lei do tamanho do CPC | 911 ms | — | ok |
| Abrir a Aula | 89 ms | — | ok |
| Digitar artigo até a alternativa | 104 ms | 400 ms | ok |
| Clicar e o artigo aparecer no projetor | 125 ms | 400 ms | ok |
| Primeira página do PDF no projetor | 287 ms | — | ok |
| Passar para um slide com foto grande | 157 ms | 1500 ms | ok |
| Busca geral (Ctrl K) | 48 ms | 600 ms | ok |
| Memória (Aula + projeção + PDF) | 9.3 MB | 80 MB | ok |
| Processador com a aula parada | 0.5% | 3% | ok |

**Veredito: leve.** Nenhum limite passou; não é preciso mexer.

### 2026-11-11 · versão 0.31.0

Processador 4 vezes mais lento (imita um notebook de entrada). Baixado só quando usado (gzip): leitor de PDF (parte que roda à parte) 384 KB, montador do PDF dos autos 171 KB, leitor de PDF 143 KB, autosPdf 3 KB.

| Medida | Resultado | Limite | |
|---|---|---|---|
| JS principal (gzip), baixado ao abrir | 252 KB | 400 KB | ok |
| Visual (CSS, gzip) | 36 KB | — | ok |
| Abrir o Vide (primeira vez) | 964 ms | 2000 ms | ok |
| Abrir de novo (com cache) | 341 ms | — | ok |
| Importar uma lei do tamanho do CPC | 939 ms | — | ok |
| Abrir a Aula | 108 ms | — | ok |
| Digitar artigo até a alternativa | 109 ms | 400 ms | ok |
| Clicar e o artigo aparecer no projetor | 155 ms | 400 ms | ok |
| Primeira página do PDF no projetor | 329 ms | — | ok |
| Passar para um slide com foto grande | 196 ms | 1500 ms | ok |
| Busca geral (Ctrl K) | 52 ms | 600 ms | ok |
| Memória (Aula + projeção + PDF) | 9.4 MB | 80 MB | ok |
| Processador com a aula parada | 0.5% | 3% | ok |

**Veredito: leve.** Nenhum limite passou; não é preciso mexer.

