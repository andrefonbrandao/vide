// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { datasDasAulas, diasDaTurma, feriadosNacionais, lerPlanoAulaDocx } from './planoAula';

test('feriados: Páscoa móvel (Carnaval, Sexta-feira Santa, Corpus Christi) e os fixos', () => {
  const f = feriadosNacionais(2026);
  expect(f.get('2026-02-16')).toBe('Carnaval');
  expect(f.get('2026-02-17')).toBe('Carnaval');
  expect(f.get('2026-04-03')).toBe('Sexta-feira Santa');
  expect(f.get('2026-06-04')).toBe('Corpus Christi');
  expect(f.get('2026-11-20')).toContain('Consciência Negra');
});

test('datas das aulas: terças de 03/08 a 15/12/2026, sem feriados, com exceções e troca à mão', () => {
  const t = { inicio: '2026-08-03', fim: '2026-12-15', horarios: [{ dia: 2, inicio: '19:00', fim: '22:00' }] };
  const dias = diasDaTurma(t);
  expect(dias.filter((d) => d.aula)).toHaveLength(20);
  expect(dias[0].data).toBe('2026-08-04');
  const aulas = Array.from({ length: 20 }, (_, k) => ({ id: `a${k}`, tema: '', destaque: '' }));
  expect(datasDasAulas(aulas, t).datas.at(-1)).toBe('2026-12-15');
  // Semana acadêmica em 13/10: sem aula; a sequência anda e falta uma data.
  const cal = { excecoes: [{ data: '2026-10-13', aula: false, motivo: 'Semana acadêmica' }], datas: {} };
  const r = datasDasAulas(aulas, t, cal);
  expect(r.datas[10]).toBe('2026-10-20');
  expect(r.faltam).toBe(1);
  // Aula extra num sábado resolve; e uma data trocada à mão vale no lugar.
  const cal2 = { excecoes: [...cal.excecoes, { data: '2026-10-17', aula: true }], datas: { a0: '2026-08-05' } };
  const r2 = datasDasAulas(aulas, t, cal2);
  expect(r2.faltam).toBe(0);
  expect(r2.datas[0]).toBe('2026-08-05');
  expect(r2.datas[10]).toBe('2026-10-17');
});

test('lê o plano de aula do Word da instituição (DPC I 2026.2)', async () => {
  const r = await lerPlanoAulaDocx(new Uint8Array(readFileSync(new URL('./exemplo-plano-aula.docx', import.meta.url))));
  const p = r.plano;
  expect(r.unidade).toBe('DIREITO PROCESSUAL CIVIL I');
  expect(p.cargaHoraria).toBe('60H');
  expect(p.professor).toBe('ANDRÉ DA FONSECA BRANDÃO');
  expect(r.periodo).toEqual({ inicio: '2026-08-03', fim: '2026-12-15' });
  expect(p.aulas).toHaveLength(20);
  expect(p.aulas[2].destaque).toBe('AVALIAÇÃO FORMATIVA A.1');
  expect(p.aulas[2].tema).toContain('Princípios');
  expect(p.aulas[9].grau).toBe('A');
  expect(p.aulas[18].grau).toBe('B');
  expect(p.aulas[19].grau).toBe('C');
  expect(p.graus.A.postagem).toContain('dez dias');
  expect(p.graus.A.linhas).toEqual([
    { instrumento: 'Avaliação Formativa', peso: '3', criterio: 'Avaliações discursivas com espelho de correção.' },
    { instrumento: 'Avaliação Final (Prova)', peso: '7', criterio: 'Prova objetiva com casos concretos.' },
  ]);
  expect(p.graus.C.linhas).toHaveLength(1);
  expect(p.recuperacao).toContain('Avaliações formativas para diagnosticar lacunas');
});
