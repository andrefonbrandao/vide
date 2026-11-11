# Vide — instruções para o Claude

O Vide é o app de aula de um professor de Direito (React/Vite + Cloudflare Worker). O professor
é iniciante em programação: explique em português simples.

## Como trabalhamos (pacotes)
- Nada vai para o site sem o professor autorizar ("pode publicar", "pode fechar", "pode mandar").
- As mudanças se acumulam no ramo `pacote` e ficam anotadas em `PACOTE.md` (seção "Situação").
  Depois de cada ideia, pergunte: "Quer mandar a próxima, ou já concluiu as solicitações deste pacote?".
  Avise antes quando uma ideia for trabalhosa ou deixar o app mais pesado.
- O site é publicado a partir do ramo `claude/wizardly-clarke-nwd93w` (avanço rápido a partir de `pacote`).
- Ao publicar: aumentar a versão (package.json e package-lock.json), marcar o pacote como publicado em
  `PACOTE.md`, rodar `npx tsc -b`, `npx tsc --noEmit -p worker/tsconfig.json`, `npx vitest run` e
  `npm run build`, guardar e enviar, levar para o ramo do site e conferir que o site mudou.

## Teste de peso (a cada 5 pacotes)
- Ao fechar os pacotes **15, 20, 25, 30…**, rode `npm run peso` (cerca de 10 minutos) e veja o veredito
  no fim de `PESO.md`. Os limites estão lá.
- Se algum limite passou, recomende ao professor a melhoria (por exemplo, dividir o programa em partes
  para cada tela carregar só o que precisa), explicando o custo, antes de mexer. Se só chegou perto,
  comente no fechamento do pacote.
- Se o professor pedir, rode o teste a qualquer momento.
