// Manual do orientando ("Como usar" na página de orientação). É a fonte única sobre o app para o
// aluno: quando algo mudar na página, atualize aqui. As respostas aceitam **negrito**.

export interface Pergunta {
  p: string;
  r: string[];
}
export interface SecaoManual {
  id: string;
  titulo: string;
  perguntas: Pergunta[];
}

/** O manual, conforme o que a página do orientando mostra (formulário ligado ou não, pré-projeto ou trabalho final). */
export function manualDoAluno(formulario: 'pre' | 'final' | null): SecaoManual[] {
  const aba = formulario === 'final' ? '"Meu trabalho final"' : '"Meu pré-projeto"';
  const s: SecaoManual[] = [
    {
      id: 'pagina',
      titulo: 'A sua página',
      perguntas: [
        {
          p: 'O que é esta página?',
          r: [
            'É o seu espaço de orientação: o cronograma do trabalho, as pendências combinadas com o orientador, os elementos do trabalho e os modelos para baixar.' +
              (formulario ? ` Na aba ${aba}, você escreve o trabalho, que sai formatado pelo manual da instituição.` : ''),
            'A página é atualizada pelo orientador e muda sozinha alguns segundos depois de cada mudança dele.',
          ],
        },
        {
          p: 'O que é o combinado de orientação?',
          r: [
            'São as regras do nosso trabalho: o que cabe a você, o que cabe ao orientador e quais fontes usar (e quais não usar) no trabalho. Fica na aba **Combinado**.',
            'Leia com atenção e toque em **Li e compreendi o combinado**: o orientador vê que você confirmou.',
          ],
        },
        {
          p: 'Preciso guardar o código de 6 números?',
          r: [
            'Sim: o link e o código vêm juntos na mensagem do orientador. Neste aparelho, o código fica lembrado enquanto a aba estiver aberta; em outro aparelho, digite de novo.',
            'Depois de **8 códigos errados**, a página fica bloqueada por 15 minutos. Se perdeu o código, peça ao orientador: ele pode ver ou trocar.',
          ],
        },
        {
          p: 'Funciona no celular?',
          r: [
            'Funciona. Dica: no celular, use "Adicionar à tela de início" (no menu de compartilhar do navegador) para abrir a página como um aplicativo.',
            'Para escrever textos longos, o computador é mais confortável; no celular, o botão **⤢ Ampliar** ajuda.',
          ],
        },
        {
          p: 'Como vejo de novo o passeio de boas-vindas?',
          r: ['Toque no **?** no alto da página.'],
        },
      ],
    },
    {
      id: 'acompanhamento',
      titulo: 'Acompanhamento',
      perguntas: [
        {
          p: 'O que é a "etapa da vez"?',
          r: ['É a próxima etapa do cronograma que ainda não foi cumprida, com quanto tempo falta. Etapas sem data completa aparecem como "previsto para…" ou "a definir".'],
        },
        {
          p: 'Qual a diferença entre "fazer" e "sugestão" nas pendências?',
          r: [
            '**Fazer** é um comando: algo que você deve fazer até o prazo. **Sugestão** é uma ideia para você avaliar.',
            'A pendência sai da lista quando o orientador marca como cumprida (normalmente na sessão seguinte).',
          ],
        },
        {
          p: 'Onde estão o manual de normalização e o modelo do trabalho?',
          r: ['Em "Modelos e orientações", no fim da aba Acompanhamento. Toque em **Baixar**.'],
        },
      ],
    },
  ];
  if (!formulario) return s;
  s.push(
    {
      id: 'escrever',
      titulo: 'Escrevendo o trabalho',
      perguntas: [
        {
          p: 'Onde escrevo?',
          r: [
            `Na aba ${aba}. Cada parte do trabalho tem o seu campo` +
              (formulario === 'final' ? ', e o texto começa com o que você escreveu no pré-projeto, já no lugar certo.' : '. Os elementos que você e o orientador já definiram (tema, problema, objetivos…) entram já preenchidos.'),
            'Cada Enter começa um parágrafo novo.',
          ],
        },
        {
          p: 'Escrevo no Word (ou no Google Docs). Como trago o texto?',
          r: [
            'Use **Importar do Word**, no alto do formulário, e escolha o arquivo .docx (no Google Docs: Arquivo › Fazer download › Microsoft Word). O Vide distribui o texto pelas partes do formulário e traz junto as notas de rodapé, as citações recuadas, as tabelas e as figuras.',
            'Antes, formate os títulos com os estilos do Word (**Título 1** para "1 INTRODUÇÃO", "REFERÊNCIAS"…; **Título 2** e **Título 3** para os subtítulos): é por eles que o Vide sabe onde começa cada parte. O botão "Saiba como" mostra o passo a passo.',
            'Uma tela de conferência mostra para onde vai cada parte antes de importar. O texto importado substitui o do formulário; se não gostar, use **Desfazer a importação**.',
            'Para trechos menores, copie no Word e cole no campo: negrito, itálico, tabelas, citações e notas vêm junto.',
          ],
        },
        {
          p: 'Preciso salvar?',
          r: [
            'Não: o texto é salvo sozinho, alguns segundos depois de você parar de digitar. Confira o aviso "Salvo às…" no alto.',
            'Sem internet, aparece "Não foi salvo": continue escrevendo, que a página tenta de novo na próxima mudança. Evite fechar a página antes de ver "Salvo".',
          ],
        },
        {
          p: 'Posso escrever no computador e no celular?',
          r: ['Pode. Se o texto mudar em outro aparelho, a página avisa e pergunta qual texto manter. Ao voltar para a página, o texto mais novo é trazido sozinho.'],
        },
        {
          p: 'O orientador vê o que eu escrevo?',
          r: [
            'Sim: o orientador consegue ler o texto atual a qualquer momento e fazer apontamentos nele.',
            '**Enviar ao orientador** marca uma versão oficial, com data, que fica guardada no caderno dele (em PDF). Envie quando terminar uma etapa ou quando ele pedir.',
          ],
        },
        {
          p: 'Como formato o texto (negrito, itálico, subtítulo)?',
          r: [
            'Use os botões da barra acima de cada campo. O texto já aparece formatado; as marcas (como ** para negrito) só aparecem, em cinza, na linha em que está o cursor.',
            'Atalhos: **Ctrl+B** (negrito) e **Ctrl+I** (itálico; no trabalho, só para palavras estrangeiras). Ao **colar do Word**, o negrito e o itálico vêm junto.',
            '**Subtítulo** divide o capítulo (3.1, 3.2…)' + (formulario === 'final' ? '; **Sub-subtítulo** cria 3.1.1.' : '.') + ' A numeração é automática.',
          ],
        },
        {
          p: 'Como faço uma citação longa e uma nota de rodapé?',
          r: [
            '**Citação longa** (mais de três linhas): ponha o cursor no parágrafo e toque em "Citação longa". Ela sai com recuo de 4 cm e letra menor.',
            '**Nota de rodapé**: ponha o cursor logo depois da palavra e toque em "Nota de rodapé"; escreva o texto da nota no lugar do exemplo. O número e a nota vão para o pé da página no PDF.',
          ],
        },
        {
          p: 'Como insiro uma tabela ou um quadro?',
          r: [
            'Toque em **Tabela ou quadro**: abre uma grade para preencher o título, as células e a fonte. A primeira linha é o cabeçalho; linhas e colunas vazias saem sozinhas.',
            'Tabela é para dados numéricos; quadro, para informações em texto. Para corrigir, toque na tabela no texto.',
          ],
        },
        {
          p: 'Para que serve o botão ⤢ Ampliar?',
          r: ['Abre o campo na tela toda, com letra maior, para escrever textos longos. "Fechar" (ou Esc) volta.'],
        },
        {
          p: 'Como vejo o trabalho pronto, em PDF ou Word?',
          r: [
            '**Pré-visualizar** abre o PDF numa aba nova; **Baixar o PDF** e **Baixar em Word** salvam no aparelho. Isso é só para você: nada vai ao orientador.',
            'O arquivo sai com capa, folha de rosto, sumário e a formatação do manual (margens, fonte, espaçamento, citações e notas). Se o Word perguntar se deseja atualizar os campos, clique em **Sim** (é o sumário).',
          ],
        },
      ],
    },
  );
  if (formulario === 'final')
    s[s.length - 1].perguntas.push(
      {
        p: 'Como crio, renomeio ou mudo a ordem dos capítulos?',
        r: [
          'Em "Desenvolvimento: capítulos": **+ Adicionar capítulo** cria um novo; o nome se escreve no campo ao lado do número; as setas **↑ ↓** mudam a ordem; **Remover** apaga (o desenvolvimento precisa de pelo menos um capítulo).',
          'Cada capítulo começa numa página nova, numerado na ordem (3, 4, 5…). Apêndices e anexos funcionam do mesmo jeito.',
        ],
      },
      {
        p: 'Como insiro uma figura ou um gráfico?',
        r: [
          'Toque em **Figura ou gráfico**, escolha a imagem (PNG ou JPEG, do computador ou do celular), escreva o título e a fonte e escolha a largura. A página reduz a imagem antes de enviar.',
          'Gráfico: faça no Excel ou no Google Planilhas e salve como imagem (ou tire um print). Com três ou mais figuras (ou gráficos, ou tabelas), a lista entra sozinha no começo do trabalho.',
        ],
      },
    );
  s.push(
    {
      id: 'apontamentos',
      titulo: 'Apontamentos do orientador',
      perguntas: [
        {
          p: 'Onde vejo os apontamentos?',
          r: [
            `No alto da aba ${aba}, o quadro amarelo "Apontamentos do orientador" lista os que estão em aberto; toque num deles para ir até lá.`,
            'No texto, o trecho comentado aparece **em amarelo**, e o comentário fica logo abaixo do campo.',
          ],
        },
        {
          p: 'Como respondo e dou baixa?',
          r: [
            'No cartão do apontamento, escreva no campo "Responder…" e toque em **Responder**. Quando tiver feito o ajuste, toque em **Marcar como resolvido** (dá para reabrir depois).',
            'Se você reescrever o trecho comentado, o apontamento continua no cartão como "trecho alterado", com o texto original citado.',
          ],
        },
      ],
    },
    {
      id: 'problemas',
      titulo: 'Problemas comuns',
      perguntas: [
        {
          p: 'Apareceu "[imagem não encontrada]".',
          r: ['A imagem da figura não pôde ser carregada. Confira a internet e recarregue a página; se continuar, toque na figura e escolha a imagem de novo.'],
        },
        {
          p: 'Meu texto sumiu.',
          r: [
            'Recarregue a página: o texto fica guardado no serviço, não no aparelho. Se você escreveu sem internet e fechou a página antes de ver "Salvo", o último trecho pode ter se perdido.',
            'O orientador também guarda cópias do seu texto. Em caso de dúvida, fale com ele.',
          ],
        },
      ],
    },
  );
  return s;
}
