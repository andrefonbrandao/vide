// Pedido pronto para a IA organizar o registro de uma sessão (ou conversa) de orientação
// a partir da transcrição, e a leitura da resposta para preencher o registro sozinho.
import { dataBR, dataHoraBR, emOrdem, situacaoEtapa, rotuloDias, type Pendencia } from './prazos';
import type { Encaminhamento, Interacao, Trabalho, Versao } from './tipos';

export interface ContextoPedido {
  trabalho: Trabalho;
  interacao: Interacao;
  /** Pendências de registros anteriores (numeradas no pedido). */
  anteriores: Pendencia[];
  versao?: Versao;
  hoje: string;
}

export function pedidoRegistroIA({ trabalho, interacao, anteriores, versao, hoje }: ContextoPedido): string {
  const sessao = interacao.canal === 'sessao';
  const etapas = emOrdem(trabalho.etapas)
    .map((e) => {
      const s = situacaoEtapa(e, hoje);
      return `- ${e.nome}: prazo ${dataBR(e.prazo)} (${s.tipo === 'concluida' ? 'cumprida' : rotuloDias(s.dias)})`;
    })
    .join('\n');
  const pend = anteriores.length
    ? anteriores.map((p, k) => `${k + 1}. [${p.enc.tipo === 'comando' ? 'comando' : 'sugestão'}] ${p.enc.texto} (de ${dataBR(p.interacao.em)}${p.enc.prazo ? `, prazo ${dataBR(p.enc.prazo)}` : ''})`).join('\n')
    : '(nenhuma)';
  const fonte = [
    interacao.transcricao?.trim() ? `TRANSCRIÇÃO AUTOMÁTICA DA ${sessao ? 'SESSÃO' : 'CONVERSA'} (reconhecimento de voz: sem pontuação, pode ter palavras trocadas; não identifica quem fala — em geral é a voz do orientador):\n${interacao.transcricao.trim()}` : '',
    interacao.texto.trim() ? `${sessao ? 'ANOTAÇÕES DO ORIENTADOR' : 'CONVERSA COLADA'}:\n${interacao.texto.trim()}` : '',
    interacao.resumo.trim() ? `RASCUNHO DE RESUMO DO ORIENTADOR:\n${interacao.resumo.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return `Você está me ajudando a registrar ${sessao ? 'uma sessão de orientação' : 'uma comunicação com um(a) orientando(a)'} de trabalho acadêmico. Sou o orientador (professor de Direito). Organize o registro a partir do material abaixo.

TRABALHO: ${trabalho.tipo}${trabalho.titulo ? ` — "${trabalho.titulo}"` : ''}
${sessao ? `SESSÃO: ${dataHoraBR(interacao.em)}${interacao.modo ? ` (${interacao.modo})` : ''}` : `DATA: ${dataHoraBR(interacao.em)}`}${versao ? `\nVERSÃO DO TRABALHO DISCUTIDA: ${versao.rotulo} (recebida em ${dataBR(versao.recebida_em)})` : ''}

CRONOGRAMA:
${etapas || '(sem etapas)'}

PENDÊNCIAS ANTERIORES DO(A) ORIENTANDO(A):
${pend}

${fonte || '(sem material)'}

Responda SOMENTE neste formato, sem nada antes ou depois:

RESUMO:
(de 3 a 8 linhas, em terceira pessoa, objetivo: o que foi discutido, os problemas apontados no trabalho e o que ficou decidido)

SUGESTÕES E COMANDOS:
- [comando] o que o(a) orientando(a) deve fazer | até DD/MM/AAAA
- [sugestão] o que ele(a) pode fazer, a critério dele(a)

PENDÊNCIAS ANTERIORES CUMPRIDAS:
- (o número de cada pendência anterior que, pelo material, já foi cumprida; ou "nenhuma")

Regras:
- "comando" é o que o orientador determinou ou pediu; "sugestão" é recomendação opcional ("vale a pena", "se quiser", "talvez"). Na dúvida, use "sugestão".
- Uma tarefa por linha, começando com um verbo ("Reescrever…", "Ler…", "Enviar…"), concreta e curta.
- Só ponha prazo ("| até DD/MM/AAAA") se ele foi dito; converta datas relativas ("até sexta", "na semana que vem") a partir da data ${sessao ? 'da sessão' : 'da conversa'}. Sem prazo dito, não escreva o "| até".
- Não invente tarefas, problemas ou referências que não estejam no material. Corrija os erros evidentes da transcrição ao entender o sentido.
- Não repita como nova uma pendência anterior que continua em aberto.`;
}

export interface RespostaIA {
  resumo: string;
  encaminhamentos: Pick<Encaminhamento, 'tipo' | 'texto' | 'prazo'>[];
  /** Números (a partir de 1) das pendências anteriores cumpridas. */
  cumpridas: number[];
}

function data(d: string): string | undefined {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(d);
  if (!m) return undefined;
  const a = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** Lê a resposta da IA (tolerante a negrito, títulos com "#" e pequenas variações). */
export function lerRespostaIA(texto: string): RespostaIA {
  const limpo = texto.replace(/\r/g, '').replace(/\*\*/g, '');
  const secoes: Record<'resumo' | 'tarefas' | 'cumpridas', string[]> = { resumo: [], tarefas: [], cumpridas: [] };
  let atual: keyof typeof secoes | null = null;
  for (const bruta of limpo.split('\n')) {
    const l = bruta.replace(/^#+\s*/, '').trim();
    const cab = /^(resumo|sugest[õo]es e comandos|comandos e sugest[õo]es|tarefas|pend[êe]ncias anteriores cumpridas|pend[êe]ncias cumpridas)\s*:?\s*(.*)$/i.exec(l);
    if (cab) {
      atual = /^resumo/i.test(cab[1]) ? 'resumo' : /cumpridas/i.test(cab[1]) ? 'cumpridas' : 'tarefas';
      if (cab[2]) secoes[atual].push(cab[2]);
      continue;
    }
    if (atual) secoes[atual].push(bruta);
  }
  const encaminhamentos = lerEncaminhamentos(secoes.tarefas.join('\n')).itens;
  const cumpridas = [...new Set(secoes.cumpridas.join(' ').match(/\d+/g)?.map(Number) ?? [])];
  return { resumo: secoes.resumo.join('\n').trim(), encaminhamentos, cumpridas };
}

type Enc = Pick<Encaminhamento, 'tipo' | 'texto' | 'prazo'>;

/**
 * Lê sugestões e comandos colados em bloco (como a IA formata):
 * "- [comando] Reescrever… | até 21/11/2026", "Sugestão: Ler…", ou listas sob títulos
 * "COMANDOS:" / "SUGESTÕES:". Sem marcação nem título, vale o tipo `padrao`.
 */
export function lerEncaminhamentos(texto: string, padrao: Enc['tipo'] = 'sugestao'): { itens: Enc[]; comResumo: boolean } {
  const itens: Enc[] = [];
  /** Seção em que a linha está: só comandos, só sugestões, mista, ou fora (resumo, pendências cumpridas). */
  let secao: 'comando' | 'sugestao' | 'misto' | 'fora' = 'misto';
  let comResumo = false;
  const MARCADOR = /^(?:[-*•–]|\d+[.)]|[a-z][.)])\s|^(?:[-*•–]\s*)?(?:\[\s*(?:comando|sugest[ãa]o)\s*\]|\(\s*(?:comando|sugest[ãa]o)\s*\)|(?:comando|sugest[ãa]o)\s*[:–-])/i;
  const linhas = texto.replace(/\r/g, '').replace(/\*\*/g, '').split('\n');
  // Com lista marcada, frases soltas ("Aqui estão as tarefas:") não viram tarefa.
  const soMarcadas = linhas.some((x) => MARCADOR.test(x.trim()));
  for (const bruta of linhas) {
    const l = bruta.replace(/^#+\s*/, '').trim();
    if (!l) continue;
    const tit = /^(resumo|pend[êe]ncias anteriores cumpridas|pend[êe]ncias cumpridas|sugest[õo]es e comandos|comandos e sugest[õo]es|tarefas|encaminhamentos|comandos?|sugest[õo]es|sugest[ãa]o)\s*:?\s*$/i.exec(l);
    if (tit) {
      const t = tit[1].toLowerCase();
      if (t === 'resumo') comResumo = true;
      secao = t === 'resumo' || t.includes('cumpridas') ? 'fora' : t.startsWith('comando') && !t.includes(' e ') ? 'comando' : t.startsWith('sugest') && !t.includes(' e ') ? 'sugestao' : 'misto';
      continue;
    }
    if (secao === 'fora') continue;
    if (soMarcadas && !MARCADOR.test(l)) continue;
    const m = /^(?:[-*•–]|\d+[.)]|[a-z][.)])?\s*(?:\[\s*(comando|sugest[ãa]o)\s*\]|\(\s*(comando|sugest[ãa]o)\s*\)|(comando|sugest[ãa]o)\s*[:–-])?\s*(.+)$/i.exec(l);
    if (!m) continue;
    const marca = m[1] ?? m[2] ?? m[3];
    const tipo: Enc['tipo'] = marca ? (/sugest/i.test(marca) ? 'sugestao' : 'comando') : secao === 'misto' ? padrao : secao;
    let corpo = m[4].trim();
    let prazo: string | undefined;
    const p = /\s*[|(–—-]\s*(?:at[ée]|prazo:?)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\)?\s*$/i.exec(corpo);
    if (p) {
      prazo = data(p[1]);
      corpo = corpo.slice(0, p.index).trim();
    }
    corpo = corpo.replace(/[.;]$/, '').trim();
    if (corpo && !/^nenhum/i.test(corpo)) itens.push({ tipo, texto: corpo, prazo });
  }
  return { itens, comResumo };
}
