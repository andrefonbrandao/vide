// Os campos dos elementos do trabalho (para o relatório e a página do orientando).
import type { ConfigPreProjeto, Elementos } from './tipos';

/** Os campos dos elementos, na ordem do projeto de pesquisa. */
export const CAMPOS_ELEMENTOS: { campo: Exclude<keyof Elementos, 'atualizado_em'>; nome: string }[] = [
  { campo: 'tema', nome: 'Tema' },
  { campo: 'delimitacao', nome: 'Delimitação do tema' },
  { campo: 'problema', nome: 'Problema de pesquisa' },
  { campo: 'hipoteses', nome: 'Hipótese(s)' },
  { campo: 'objetivoGeral', nome: 'Objetivo geral' },
  { campo: 'objetivosEspecificos', nome: 'Objetivos específicos' },
  { campo: 'justificativa', nome: 'Justificativa' },
  { campo: 'metodologia', nome: 'Metodologia' },
];

/** Texto padrão da natureza do trabalho na folha de rosto (pré-projeto ou trabalho final). */
export const naturezaDe = (c: ConfigPreProjeto): string => (c.formato === 'final' ? c.naturezaFinal : c.natureza)?.trim() || naturezaPadrao(c);

export function naturezaPadrao(c: Pick<ConfigPreProjeto, 'curso' | 'instituicao'> & { formato?: ConfigPreProjeto['formato'] }): string {
  const inst = c.instituicao === 'Ftec' ? 'da Ftec Faculdades' : 'do Centro Universitário Uniftec';
  if (c.formato === 'final') return `Trabalho apresentado para o Curso de ${c.curso || 'Xxxx'}, ${inst}, como parte dos requisitos para avaliação da unidade curricular de Trabalho de Conclusão de Curso II.`;
  return `Pré-projeto de pesquisa apresentado ao Curso de ${c.curso || 'Xxxx'} ${inst}, como parte dos requisitos para avaliação da unidade curricular de Trabalho de Conclusão de Curso I.`;
}
