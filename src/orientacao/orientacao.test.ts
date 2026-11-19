import { describe, expect, test } from 'vitest';
import { analisarColagem, dataDeEmail } from './colar';
import { cronogramaModelo, diasEntre, etapaAtual, pendencias, rotuloDias, situacaoEtapa } from './prazos';
import type { Interacao } from './tipos';

describe('prazos', () => {
  test('dias corridos e rótulos', () => {
    expect(diasEntre('2026-11-20', '2026-11-30')).toBe(10);
    expect(diasEntre('2026-11-30', '2026-11-28')).toBe(-2);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
    expect(rotuloDias(7)).toBe('faltam 7 dias');
    expect(rotuloDias(1)).toBe('falta 1 dia');
    expect(rotuloDias(0)).toBe('vence hoje');
    expect(rotuloDias(-3)).toBe('venceu há 3 dias');
  });
  test('situação das etapas', () => {
    const e = { id: 'a', nome: 'Cap. 2', prazo: '2026-11-30', concluida_em: null };
    expect(situacaoEtapa(e, '2026-11-20')).toEqual({ tipo: 'futura', dias: 10 });
    expect(situacaoEtapa(e, '2026-11-25').tipo).toBe('proxima');
    expect(situacaoEtapa(e, '2026-12-02').tipo).toBe('atrasada');
    expect(situacaoEtapa({ ...e, concluida_em: '2026-11-29' }, '2026-12-02').tipo).toBe('concluida');
  });
  test('cronograma modelo termina na defesa', () => {
    const c = cronogramaModelo('TCC', '2026-08-01', '2026-12-10');
    expect(c[0].nome).toBe('Tema e problema de pesquisa');
    expect(c[c.length - 1]).toMatchObject({ nome: 'Defesa', prazo: '2026-12-10' });
    expect(c.every((e, i) => i === 0 || e.prazo >= c[i - 1].prazo)).toBe(true);
    expect(etapaAtual({ etapas: [{ ...c[1] }, { ...c[0], concluida_em: '2026-08-20' }] })?.nome).toBe(c[1].nome);
    const sem = cronogramaModelo('Artigo', '2026-01-01');
    expect(sem[0].prazo).toBe('2026-01-31');
  });
  test('pendências de todas as interações', () => {
    const base = { usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null, trabalhoId: 't', canal: 'sessao' as const, resumo: '', texto: '' };
    const i1: Interacao = { ...base, id: '1', em: '2026-10-01T10:00', encaminhamentos: [{ id: 'a', tipo: 'comando', texto: 'Ler Didier', situacao: 'pendente' }, { id: 'b', tipo: 'sugestao', texto: 'x', situacao: 'cumprido' }] };
    const i2: Interacao = { ...base, id: '2', em: '2026-11-01T10:00', encaminhamentos: [{ id: 'c', tipo: 'sugestao', texto: 'Trocar o título', situacao: 'pendente' }] };
    expect(pendencias([i2, i1]).map((p) => p.enc.id)).toEqual(['a', 'c']);
  });
});

describe('colar conversa', () => {
  test('WhatsApp Web', () => {
    const c = analisarColagem('[14:03, 12/11/2026] Ana Souza: Professor, mandei o capítulo 2\ncom as correções\n[14:10, 12/11/2026] André: Recebi, leio até sexta');
    expect(c.canal).toBe('whatsapp');
    expect(c.em).toBe('2026-11-12T14:03');
    expect(c.participantes).toEqual(['Ana Souza', 'André']);
    expect(c.mensagens[0].texto).toBe('Professor, mandei o capítulo 2\ncom as correções');
  });
  test('WhatsApp exportado (Android e iPhone)', () => {
    expect(analisarColagem('12/11/2026 09:05 - Ana: bom dia').em).toBe('2026-11-12T09:05');
    expect(analisarColagem('[12/11/26, 9:05:33] Ana: bom dia').em).toBe('2026-11-12T09:05');
  });
  test('e-mail copiado', () => {
    const c = analisarColagem('De: Ana Souza <ana@exemplo.com>\nData: 12 de nov. de 2026 14:03\nAssunto: Capítulo 2 revisado\nPara: André\n\nProfessor, segue o capítulo.');
    expect(c).toMatchObject({ canal: 'email', em: '2026-11-12T14:03', assunto: 'Capítulo 2 revisado', resumo: 'Capítulo 2 revisado' });
    expect(c.participantes).toContain('Ana Souza');
  });
  test('datas de e-mail', () => {
    expect(dataDeEmail('qua., 12 de novembro de 2026 às 14:03')).toBe('2026-11-12T14:03');
    expect(dataDeEmail('Nov 12, 2026, 2:03 PM')).toBe('2026-11-12T14:03');
    expect(dataDeEmail('12/11/2026')).toBe('2026-11-12T00:00');
  });
  test('texto qualquer', () => {
    expect(analisarColagem('Conversamos sobre o recorte do tema.')).toMatchObject({ canal: null, resumo: 'Conversamos sobre o recorte do tema.' });
  });
});
