// Apontamentos do orientador no texto do orientando: um comentário preso a um trecho de um
// campo do formulário. O orientando responde e marca como resolvido. Ficam guardados na
// página do orientando (o serviço), separados do texto: não vão para o PDF nem para o Word.
import { FINAL_VAZIO, finalDoPreProjeto } from './trabalhoFinalEstrutura';
import type { TextoProjeto } from './tipos';

export interface Apontamento {
  id: string;
  /** Campo do formulário: "pre.problema", "final.introducao", "final.cap.<id>", "final.ap.<id>", "final.an.<id>". */
  campo: string;
  trecho: string;
  /** O que vem logo antes do trecho (para achar o lugar certo quando o trecho se repete). */
  prefixo: string;
  texto: string;
  em: string;
  respostas: { autor: 'professor' | 'aluno'; texto: string; em: string }[];
  resolvido: { por: 'professor' | 'aluno'; em: string } | null;
}

export interface CampoDoTrabalho {
  chave: string;
  nome: string;
  valor: string;
  subtitulos: boolean;
}

const PRE: [keyof TextoProjeto, string, boolean?][] = [
  ['titulo', 'Título'],
  ['subtitulo', 'Subtítulo'],
  ['resumo', 'Resumo'],
  ['palavrasChave', 'Palavras-chave'],
  ['introducao', '1 Introdução'],
  ['problema', '1.1 Problema de pesquisa'],
  ['hipoteses', '1.2 Hipótese(s)'],
  ['objetivoGeral', '2.1 Objetivo geral'],
  ['objetivosEspecificos', '2.2 Objetivos específicos'],
  ['justificativa', '2.3 Justificativa'],
  ['fundamentacao', '3 Fundamentação teórica', true],
  ['metodo', '4.1 Método(s) de pesquisa'],
  ['populacao', '4.2 Delimitação da população ou objeto'],
  ['coleta', '4.3 Técnicas de coleta de dados'],
  ['analise', '4.4 Técnicas de análise de dados'],
  ['recursos', '5.1 Recursos'],
  ['referencias', 'Referências'],
];

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Os campos do trabalho, na ordem do formulário (para ler e comentar). */
export function camposDoTrabalho(texto: TextoProjeto, formato: 'pre' | 'final'): CampoDoTrabalho[] {
  if (formato === 'pre') return PRE.map(([c, nome, sub]) => ({ chave: `pre.${c}`, nome, valor: String(texto[c] ?? ''), subtitulos: !!sub }));
  const f = { ...FINAL_VAZIO, ...(texto.final ?? finalDoPreProjeto(texto)) };
  const simples = (c: keyof typeof f, nome: string, subtitulos = false): CampoDoTrabalho => ({ chave: `final.${c}`, nome, valor: String(f[c] ?? ''), subtitulos });
  return [
    simples('titulo', 'Título'),
    simples('subtitulo', 'Subtítulo'),
    simples('tituloIngles', 'Título em inglês'),
    simples('dedicatoria', 'Dedicatória'),
    simples('agradecimentos', 'Agradecimentos'),
    simples('epigrafe', 'Epígrafe'),
    simples('resumo', 'Resumo'),
    simples('palavrasChave', 'Palavras-chave'),
    simples('abstract', 'Abstract'),
    simples('keywords', 'Keywords'),
    simples('siglas', 'Siglas'),
    simples('introducao', '1 Introdução', true),
    simples('objetivoGeral', '2.1 Objetivo geral'),
    simples('objetivosEspecificos', '2.1.1 Objetivos específicos'),
    simples('justificativa', '2.2 Justificativa'),
    ...f.capitulos.map((c, k) => ({ chave: `final.cap.${c.id}`, nome: `${k + 3} ${c.titulo || 'Capítulo sem nome'}`, valor: c.texto, subtitulos: true })),
    simples('consideracoes', `${f.capitulos.length + 3} Considerações finais`, true),
    simples('referencias', 'Referências'),
    ...f.apendices.map((c, k) => ({ chave: `final.ap.${c.id}`, nome: `Apêndice ${LETRAS[k] ?? k + 1} – ${c.titulo || 'sem título'}`, valor: c.texto, subtitulos: false })),
    ...f.anexos.map((c, k) => ({ chave: `final.an.${c.id}`, nome: `Anexo ${LETRAS[k] ?? k + 1} – ${c.titulo || 'sem título'}`, valor: c.texto, subtitulos: false })),
  ];
}

/** Onde está o trecho comentado no texto do campo (ou null, se o orientando já o reescreveu). */
export function localizar(valor: string, a: Pick<Apontamento, 'trecho' | 'prefixo'>): { de: number; ate: number } | null {
  if (!a.trecho) return null;
  if (a.prefixo) {
    const k = valor.indexOf(a.prefixo + a.trecho);
    if (k >= 0) return { de: k + a.prefixo.length, ate: k + a.prefixo.length + a.trecho.length };
  }
  const k = valor.indexOf(a.trecho);
  return k >= 0 ? { de: k, ate: k + a.trecho.length } : null;
}

export const emAberto = (l: Apontamento[]) => l.filter((a) => !a.resolvido);

export async function lerApontamentos(codigo: string, cabecalho: Record<string, string>): Promise<Apontamento[]> {
  const r = await fetch(`/api/orientacao/${codigo}/apontamentos`, { headers: cabecalho });
  if (!r.ok) throw new Error(`Não foi possível ler os apontamentos (${r.status}).`);
  return ((await r.json()) as { apontamentos: Apontamento[] }).apontamentos;
}

export type AcaoApontamento =
  | { acao: 'criar'; campo: string; trecho: string; prefixo: string; texto: string }
  | { acao: 'responder'; id: string; texto: string }
  | { acao: 'resolver'; id: string; resolvido: boolean }
  | { acao: 'editar'; id: string; texto: string }
  | { acao: 'apagar'; id: string };

export async function mudarApontamento(codigo: string, cabecalho: Record<string, string>, corpo: AcaoApontamento): Promise<Apontamento[]> {
  const r = await fetch(`/api/orientacao/${codigo}/apontamentos`, { method: 'POST', headers: { ...cabecalho, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  if (!r.ok) throw new Error(`Não foi possível salvar (${r.status}). Confira a internet e tente de novo.`);
  return ((await r.json()) as { apontamentos: Apontamento[] }).apontamentos;
}
