// A ordem e a numeração das partes do pré-projeto (para o PDF e o Word saírem iguais):
// 1 Introdução (1.1 Problema, 1.2 Hipóteses), 2 Objetivos e justificativa (2.1 geral, 2.2
// específicos, 2.3 justificativa), 3 Fundamentação teórica (com subtítulos), 4 Procedimentos
// metodológicos (4.1 a 4.4), 5 Cronograma das atividades (quadro; 5.1 Recursos), Referências.
// Seção vazia não aparece, e a numeração se ajusta.
import { lerParagrafos, ordenarReferencias, type Paragrafo } from './marcacao';
import { emOrdem } from './prazos';
import type { Etapa, TextoProjeto } from './tipos';

export type Bloco =
  | { tipo: 'titulo'; nivel: 1 | 2; rotulo: string; texto: string }
  | { tipo: 'par'; p: Paragrafo }
  | { tipo: 'cronograma'; etapas: Etapa[] }
  | { tipo: 'referencias'; lista: string[] };

/** Objetivos específicos: frases completas, sem marcador, com ponto final. */
export function especificosFormatados(texto: string): string {
  return texto
    .split('\n')
    .map((x) => x.trim().replace(/^[-•*]\s*/, '').replace(/[;,]$/, ''))
    .filter(Boolean)
    .map((x) => (/[.!?]$/.test(x) ? x : `${x}.`))
    .join('\n');
}

export function estruturaPreProjeto(t: TextoProjeto, etapasBrutas: Etapa[]): Bloco[] {
  const out: Bloco[] = [];
  let sec = 0;
  const secao = (nome: string) => {
    sec++;
    out.push({ tipo: 'titulo', nivel: 1, rotulo: String(sec), texto: nome });
    return String(sec);
  };
  const corrido = (texto: string, rotuloPai = '', comSub = false) => {
    let sub = 0;
    for (const p of lerParagrafos(texto, comSub)) {
      if (p.tipo === 'sub') out.push({ tipo: 'titulo', nivel: 2, rotulo: `${rotuloPai}.${++sub}`, texto: p.trechos.map((x) => ('t' in x ? x.t : '')).join('') });
      else out.push({ tipo: 'par', p });
    }
  };
  const subsecao = (pai: string, n: number, nome: string, texto: string) => {
    if (!texto.trim()) return n;
    out.push({ tipo: 'titulo', nivel: 2, rotulo: `${pai}.${n}`, texto: nome });
    corrido(texto);
    return n + 1;
  };
  if (t.introducao.trim() || t.problema.trim() || t.hipoteses.trim()) {
    const s = secao('Introdução');
    corrido(t.introducao);
    let n = subsecao(s, 1, 'Problema de pesquisa', t.problema);
    n = subsecao(s, n, 'Hipótese(s)', t.hipoteses);
  }
  if (t.objetivoGeral.trim() || t.objetivosEspecificos.trim() || t.justificativa.trim()) {
    const s = secao('Objetivos e justificativa');
    let n = subsecao(s, 1, 'Objetivo geral', t.objetivoGeral);
    n = subsecao(s, n, 'Objetivos específicos', especificosFormatados(t.objetivosEspecificos));
    subsecao(s, n, 'Justificativa', t.justificativa);
  }
  if (t.fundamentacao.trim()) {
    const s = secao('Fundamentação teórica');
    corrido(t.fundamentacao, s, true);
  }
  if ([t.metodo, t.populacao, t.coleta, t.analise].some((x) => x.trim())) {
    const s = secao('Procedimentos metodológicos');
    let n = subsecao(s, 1, 'Método(s) de pesquisa', t.metodo);
    n = subsecao(s, n, 'Delimitação da população (amostragem) ou objeto da investigação', t.populacao);
    n = subsecao(s, n, 'Técnicas de coleta de dados', t.coleta);
    subsecao(s, n, 'Técnicas de análise de dados', t.analise);
  }
  const etapas = emOrdem(etapasBrutas);
  if (etapas.length || t.recursos.trim()) {
    const s = secao('Cronograma das atividades');
    if (etapas.length) out.push({ tipo: 'cronograma', etapas });
    subsecao(s, 1, 'Recursos', t.recursos);
  }
  const lista = ordenarReferencias(t.referencias);
  if (lista.length) out.push({ tipo: 'referencias', lista });
  return out;
}
