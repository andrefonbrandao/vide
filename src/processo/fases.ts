// Mapa do procedimento comum: as fases e em qual delas cada evento está.
// Sem dependências do navegador.

export type FaseId = 'inicial' | 'citacao' | 'resposta' | 'saneamento' | 'instrucao' | 'sentenca' | 'recurso' | 'cumprimento';

export interface Fase {
  id: FaseId;
  nome: string;
  artigos: string;
  explicacao: string;
}

export const FASES: Fase[] = [
  { id: 'inicial', nome: 'Petição inicial', artigos: 'arts. 319 a 331 do CPC', explicacao: 'O autor apresenta o pedido; o juiz confere se a petição está em ordem.' },
  { id: 'citacao', nome: 'Citação', artigos: 'arts. 238 a 259 e 334', explicacao: 'O réu é chamado ao processo; pode haver audiência de conciliação.' },
  { id: 'resposta', nome: 'Contestação e réplica', artigos: 'arts. 335 a 353', explicacao: 'O réu se defende e o autor responde à defesa.' },
  { id: 'saneamento', nome: 'Saneamento', artigos: 'art. 357', explicacao: 'O juiz organiza o processo: pontos controvertidos e provas.' },
  { id: 'instrucao', nome: 'Instrução', artigos: 'arts. 358 a 484', explicacao: 'Produção das provas: perícia, testemunhas, depoimentos.' },
  { id: 'sentenca', nome: 'Sentença', artigos: 'arts. 485 a 495', explicacao: 'O juiz decide a causa.' },
  { id: 'recurso', nome: 'Recurso', artigos: 'arts. 994 a 1.044', explicacao: 'A parte vencida pede a revisão da decisão.' },
  { id: 'cumprimento', nome: 'Cumprimento', artigos: 'arts. 513 a 538', explicacao: 'Exige-se o que a sentença determinou.' },
];

const REGRAS: [RegExp, FaseId][] = [
  [/cumprimento de senten|penhora|bloqueio|impugnacao ao cumprimento|execucao/, 'cumprimento'],
  [/apelac|recurso|agravo|embargos de declarac|contrarraz|acordao/, 'recurso'],
  [/sentenc/, 'sentenca'],
  [/audiencia de instruc|pericia|laudo|perito|testemunh|depoimento|provas?\b|alegacoes finais|memoriais/, 'instrucao'],
  [/saneamento|organizacao do processo/, 'saneamento'],
  [/contestac|replica|reconvenc|revelia/, 'resposta'],
  [/citac|mandado de cita|carta de cita|aviso de recebimento|conciliac|mediac/, 'citacao'],
  [/peticao inicial|inicial|distribuic|emenda|procurac/, 'inicial'],
];

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** A fase que a descrição sugere ("CONTESTAÇÃO" -> resposta). null = não dá para saber (ex.: DESPACHO). */
export function faseSugerida(descricao: string): FaseId | null {
  const t = semAcento(descricao);
  return REGRAS.find(([re]) => re.test(t))?.[1] ?? null;
}

/** A fase de um evento: a escolhida pelo professor ou a sugerida pela descrição. */
export function faseDoEvento(e: { fase?: FaseId | null; descricao: string }): FaseId | null {
  return e.fase ?? faseSugerida(e.descricao);
}

/** Onde o processo está: a fase do último evento que tem fase (os sem fase herdam a anterior). */
export function faseAtual(eventos: { fase?: FaseId | null; descricao: string }[]): FaseId | null {
  let atual: FaseId | null = null;
  for (const e of eventos) atual = faseDoEvento(e) ?? atual;
  return atual;
}

export function indiceFase(f: FaseId | null): number {
  return f ? FASES.findIndex((x) => x.id === f) : -1;
}
