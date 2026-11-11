// Processo colaborativo: a turma analisa o último ato em sala, o professor anota os pontos
// e a IA escreve o próximo ato a partir deles (o professor cola a resposta no Vide).
import { agoraISO, novoId } from '../dados/modelo';
import { MODELO_PROCESSO, processoParaTexto } from './importar';
import type { Deliberacao, Evento, PontoDeliberacao, Processo } from './tipos';

export function modoDe(p: Pick<Processo, 'modo'>): NonNullable<Processo['modo']> {
  return p.modo ?? 'ilustrativo';
}

/** A deliberação em andamento (a última que ainda não virou eventos). */
export function deliberacaoAberta(p: Pick<Processo, 'deliberacoes'>): Deliberacao | undefined {
  const l = p.deliberacoes ?? [];
  const u = l[l.length - 1];
  return u && !u.eventos?.length ? u : undefined;
}

/** Garante uma deliberação aberta e aplica a mudança nela. */
export function mudarAberta(p: Processo, f: (d: Deliberacao) => Deliberacao): Processo {
  const l = [...(p.deliberacoes ?? [])];
  let d = deliberacaoAberta(p);
  if (!d) {
    d = { id: novoId(), criadaEm: agoraISO(), proximoAto: '', pontos: [] };
    l.push(d);
  }
  const nova = f(d);
  return { ...p, deliberacoes: l.map((x) => (x.id === nova.id ? nova : x)) };
}

/** Acrescenta um ponto (sem repetir o mesmo texto). */
export function comPonto(p: Processo, texto: string, origem: PontoDeliberacao['origem'] = 'professor'): Processo {
  const t = texto.trim();
  if (!t) return p;
  return mudarAberta(p, (d) => (d.pontos.some((x) => x.texto === t) ? d : { ...d, pontos: [...d.pontos, { id: novoId(), texto: t, origem }] }));
}

/** Os eventos colados da resposta da IA entram no fim e fecham a deliberação aberta. */
export function comEventosDaDeliberacao(p: Processo, eventos: Evento[]): Processo {
  const aberta = deliberacaoAberta(p);
  const base = { ...p, eventos: [...p.eventos, ...eventos] };
  if (!aberta || !eventos.length) return base;
  return { ...base, deliberacoes: (p.deliberacoes ?? []).map((d) => (d.id === aberta.id ? { ...d, eventos: eventos.map((e) => e.id) } : d)) };
}

/** Resultado de um "E agora?" como ponto da deliberação. */
export function pontoDaVotacao(pergunta: string, opcoes: string[], votos: number[]): string {
  const total = votos.reduce((a, b) => a + b, 0);
  const partes = opcoes.map((o, i) => `${o}: ${votos[i] ?? 0}`).join('; ');
  return `Votação "${pergunta}" (${total} ${total === 1 ? 'voto' : 'votos'}) — ${partes}.`;
}

/** Pedido pronto para a IA escrever o próximo ato a partir do que a turma decidiu. */
export function pedidoProximoAtoIA(p: Processo, d: Deliberacao): string {
  const ultimo = p.eventos[p.eventos.length - 1];
  const pontos = d.pontos.map((x) => `- ${x.texto}`).join('\n');
  return `Você está me ajudando a conduzir um processo judicial FICTÍCIO, para fins didáticos, numa turma de graduação em Direito Processual Civil (CPC/2015). A turma analisou em sala o andamento do processo e deliberou os pontos abaixo. Agora você vai escrever o próximo ato do processo.

PRÓXIMO ATO: ${d.proximoAto.trim() || '[ex.: CONTESTAÇÃO]'}

O QUE A TURMA DECIDIU (use estes pontos como as teses, críticas e escolhas de quem pratica o ato; não invente outras teses principais):
${pontos || '- [os pontos da turma]'}

O PROCESSO ATÉ AGORA (no formato do Vide):
${processoParaTexto(p).trim()}

Responda SOMENTE com o(s) novo(s) evento(s), sem comentários antes ou depois, neste formato (o mesmo do processo acima):

Evento: DD/MM/AAAA HH:MM | DESCRIÇÃO EM MAIÚSCULAS | USUÁRIO | segurado
Documento: SIGLA1 | Título
texto da peça…

Regras:
- Escreva só o próximo ato (e, se for natural, a certidão ou o despacho que o acompanha imediatamente). Use "segurado" no fim de cada linha "Evento:".
- A data deve vir depois de ${ultimo ? ultimo.data.slice(0, 10).split('-').reverse().join('/') : 'o último evento'} e respeitar os prazos do CPC (dias úteis).
- Mantenha os nomes, o juízo e os fatos do processo. Tudo continua fictício.
- No texto das peças use: "# " para o título, "## " para subtítulos, "> " para citação de lei, "- " para itens, **negrito** e _itálico_. Cite os artigos por extenso ("art. 335 do CPC").
- Peça realista, mas curta: de 1 a 4 parágrafos por seção, para caber na leitura em aula.
- Se quiser, logo abaixo da linha "Evento:": "Fase: …" e "Prazo: 15 dias úteis para …" (como no modelo abaixo).

Modelo do formato completo, para referência:
${MODELO_PROCESSO}`;
}
