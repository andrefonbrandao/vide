// Glossário dos autos: termos que a turma toca para ver a explicação.
// Sem dependências do navegador.

export interface Termo {
  termo: string;
  explicacao: string;
}

/** Os termos que já vêm no Vide. O professor pode acrescentar (ou reescrever) no processo. */
export const GLOSSARIO_PADRAO: Termo[] = [
  { termo: 'conclusos para decisão', explicacao: 'O processo foi para o juiz, que agora vai decidir uma questão.' },
  { termo: 'conclusos para despacho', explicacao: 'O processo foi para o juiz dar o próximo passo (despacho).' },
  { termo: 'conclusos para sentença', explicacao: 'O processo foi para o juiz, que agora vai sentenciar.' },
  { termo: 'conclusos', explicacao: 'O processo foi enviado ao juiz para que ele se manifeste.' },
  { termo: 'juntada', explicacao: 'Um documento foi anexado aos autos.' },
  { termo: 'autos', explicacao: 'O conjunto de tudo o que está no processo: peças, documentos, decisões e certidões.' },
  { termo: 'citação', explicacao: 'Ato que chama o réu ao processo para se defender (art. 238 do CPC).' },
  { termo: 'intimação', explicacao: 'Aviso a alguém sobre um ato do processo, para que faça ou deixe de fazer algo (art. 269 do CPC).' },
  { termo: 'mandado', explicacao: 'Ordem escrita do juiz, cumprida pelo oficial de justiça.' },
  { termo: 'aviso de recebimento', explicacao: 'Comprovante dos Correios de que a carta (de citação ou intimação) foi entregue.' },
  { termo: 'decurso de prazo', explicacao: 'O prazo terminou sem que a parte praticasse o ato.' },
  { termo: 'certidão', explicacao: 'Declaração da secretaria ou do oficial de justiça sobre algo que aconteceu no processo.' },
  { termo: 'despacho', explicacao: 'Ato do juiz que só movimenta o processo, sem decidir uma questão (art. 203, § 3º, do CPC).' },
  { termo: 'decisão interlocutória', explicacao: 'Decisão do juiz no meio do processo, que resolve uma questão sem encerrar a fase (art. 203, § 2º, do CPC).' },
  { termo: 'sentença', explicacao: 'Decisão que encerra a fase de conhecimento ou a execução (art. 203, § 1º, do CPC).' },
  { termo: 'contestação', explicacao: 'A defesa do réu (arts. 335 a 342 do CPC).' },
  { termo: 'réplica', explicacao: 'Resposta do autor à contestação, quando o réu traz defesas ou documentos novos (arts. 350 e 351 do CPC).' },
  { termo: 'revelia', explicacao: 'Quando o réu não contesta: em regra, os fatos alegados pelo autor são presumidos verdadeiros (art. 344 do CPC).' },
  { termo: 'saneamento', explicacao: 'Decisão que organiza o processo: resolve pendências, fixa os pontos controvertidos e as provas (art. 357 do CPC).' },
  { termo: 'tutela de urgência', explicacao: 'Decisão rápida e provisória, antes do fim do processo, quando há probabilidade do direito e perigo na demora (art. 300 do CPC).' },
  { termo: 'tutela provisória', explicacao: 'Decisão dada antes do fim do processo, que pode ser revista depois (arts. 294 a 311 do CPC).' },
  { termo: 'audiência de conciliação', explicacao: 'Encontro para tentar um acordo, em regra antes da contestação (art. 334 do CPC).' },
  { termo: 'audiência de instrução e julgamento', explicacao: 'Audiência em que se ouvem as partes, as testemunhas e o perito; ao final, o juiz pode sentenciar (art. 358 do CPC).' },
  { termo: 'trânsito em julgado', explicacao: 'Quando não cabe mais recurso: a decisão se torna definitiva.' },
  { termo: 'apelação', explicacao: 'Recurso contra a sentença (art. 1.009 do CPC).' },
  { termo: 'contrarrazões', explicacao: 'Resposta da outra parte a um recurso.' },
  { termo: 'agravo de instrumento', explicacao: 'Recurso contra certas decisões interlocutórias (art. 1.015 do CPC).' },
  { termo: 'embargos de declaração', explicacao: 'Recurso para esclarecer obscuridade, eliminar contradição, suprir omissão ou corrigir erro material (art. 1.022 do CPC).' },
  { termo: 'emenda', explicacao: 'Correção da petição inicial pedida pelo juiz (art. 321 do CPC).' },
  { termo: 'procuração', explicacao: 'Documento em que a parte dá poderes ao advogado para atuar por ela.' },
  { termo: 'custas', explicacao: 'Taxas pagas ao Judiciário pelo processo.' },
  { termo: 'gratuidade da justiça', explicacao: 'Dispensa das custas e despesas para quem não pode pagá-las (art. 98 do CPC).' },
  { termo: 'cumprimento de sentença', explicacao: 'Fase em que se exige o que a sentença determinou (art. 513 do CPC).' },
  { termo: 'penhora', explicacao: 'Bloqueio de bens do devedor para pagar a dívida (art. 831 do CPC).' },
  { termo: 'distribuição', explicacao: 'Envio do processo novo a uma vara, por sorteio ou por dependência (art. 284 do CPC).' },
  { termo: 'expedição', explicacao: 'A secretaria preparou um documento (mandado, carta, ofício) para ser enviado.' },
  { termo: 'ato ordinatório', explicacao: 'Ato da secretaria que movimenta o processo sem precisar do juiz (art. 203, § 4º, do CPC).' },
  { termo: 'vista', explicacao: 'Os autos ficam à disposição de uma parte (ou do Ministério Público) para que se manifeste.' },
  { termo: 'petição inicial', explicacao: 'A peça com que o autor começa o processo e faz o pedido (art. 319 do CPC).' },
  { termo: 'petição', explicacao: 'Pedido escrito dirigido ao juiz.' },
  { termo: 'laudo', explicacao: 'O resultado escrito da perícia.' },
];

/** Um pedaço do texto: comum, ou um termo do glossário. */
export interface PedacoTexto {
  texto: string;
  termo?: Termo;
}

function chave(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Os termos do processo por cima dos do Vide (mesmo termo: vale o do professor). */
export function glossarioCompleto(proprios: Termo[] = []): Termo[] {
  const mapa = new Map<string, Termo>();
  for (const t of GLOSSARIO_PADRAO) mapa.set(chave(t.termo), t);
  for (const t of proprios) if (t.termo.trim() && t.explicacao.trim()) mapa.set(chave(t.termo.trim()), { termo: t.termo.trim(), explicacao: t.explicacao.trim() });
  return [...mapa.values()];
}

const LETRA = /[\p{L}\p{N}]/u;

/** Separa o texto nos termos do glossário (o mais longo primeiro; maiúsculas e acentos não importam). */
export function marcarTermos(texto: string, termos: Termo[]): PedacoTexto[] {
  if (!texto) return [];
  // Texto sem acento com o mesmo comprimento (letra por letra).
  const plano = [...texto].map((c) => chave(c).slice(0, 1) || c).join('');
  const letras = [...texto];
  const ordem = [...termos].sort((a, b) => b.termo.length - a.termo.length).map((t) => ({ t, k: chave(t.termo) }));
  const saida: PedacoTexto[] = [];
  let i = 0;
  let comum = '';
  while (i < letras.length) {
    const antes = i > 0 ? letras[i - 1] : '';
    let achou: { t: Termo; k: string } | undefined;
    if (!antes || !LETRA.test(antes)) {
      achou = ordem.find(({ k }) => plano.startsWith(k, i) && !LETRA.test(letras[i + k.length] ?? ''));
    }
    if (achou) {
      if (comum) saida.push({ texto: comum });
      comum = '';
      saida.push({ texto: letras.slice(i, i + achou.k.length).join(''), termo: achou.t });
      i += achou.k.length;
    } else {
      comum += letras[i];
      i++;
    }
  }
  if (comum) saida.push({ texto: comum });
  return saida;
}
