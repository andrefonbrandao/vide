// @vitest-environment node
import { expect, test } from 'vitest';
import { gerarRelatorioPdf, interacoesDoPeriodo, nomeArquivoRelatorio } from './relatorioPdf';
import type { Interacao, Trabalho } from './tipos';

const base = { usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null };
const trabalho: Trabalho = {
  ...base, id: 't', orientandoId: 'o', titulo: 'Precedentes', tipo: 'TCC', inicio: '2026-08-01', situacao: 'andamento',
  etapas: [{ id: 'e', nome: 'Capítulo 1', prazo: '2026-09-01', concluida_em: '2026-08-30' }],
  elementos: { tema: 'Precedentes', delimitacao: '', problema: 'Os juízes aplicam o art. 927, § 1º?', hipoteses: '', justificativa: '', objetivoGeral: 'Analisar…', objetivosEspecificos: ['Identificar', '', 'Comparar'], metodologia: '' },
};
const sessao = (id: string, em: string): Interacao => ({ ...base, id, trabalhoId: 't', canal: 'sessao', em, resumo: 'Resumo ✓ com símbolo', texto: '', encaminhamentos: [{ id: id + 'x', tipo: 'comando', texto: 'Ler', situacao: 'pendente' }], transcricao: '[10:00] fala' });

test('período das sessões', () => {
  const l = [sessao('b', '2026-10-05T10:00'), sessao('a', '2026-09-01T10:00'), sessao('c', '2026-11-01T10:00')];
  expect(interacoesDoPeriodo(l, '2026-09-15').map((i) => i.id)).toEqual(['b', 'c']);
  expect(interacoesDoPeriodo(l, '', '2026-10-05').map((i) => i.id)).toEqual(['a', 'b']);
});

test('gera o PDF com tudo marcado (acentos e símbolos não quebram)', async () => {
  const blob = await gerarRelatorioPdf(
    { orientando: { ...base, id: 'o', nome: 'João Ávila', email: '', telefone: '', curso: 'Direito', observacoes: '' }, trabalho, interacoes: [sessao('a', '2026-09-01T10:00')], versoes: [{ id: 'v', rotulo: 'Versão 1', nomeArquivo: 'cap1.docx', recebida_em: '2026-09-02', etapaId: 'e', notas: 'ok' }], hoje: '2026-11-19' },
    { elementos: true, cronograma: true, pendencias: true, sessoes: true, transcricoes: true, conversas: true, versoes: true, orientador: 'Prof.' },
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  expect(nomeArquivoRelatorio('João Ávila', '2026-11-19')).toBe('Orientacao - Joao Avila - 2026-11-19.pdf');
});
