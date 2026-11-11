import { describe, expect, it } from 'vitest';
import { faseAtual, faseSugerida } from './fases';
import { glossarioCompleto, marcarTermos } from './glossario';
import { diasUteisAte, lerPrazo, prazoParaTexto, vencimento } from './prazos';

describe('fases do procedimento', () => {
  it('sugere a fase pela descrição', () => {
    expect(faseSugerida('PETIÇÃO INICIAL')).toBe('inicial');
    expect(faseSugerida('JUNTADA DE AVISO DE RECEBIMENTO')).toBe('citacao');
    expect(faseSugerida('CONTESTAÇÃO')).toBe('resposta');
    expect(faseSugerida('DECISÃO DE SANEAMENTO E ORGANIZAÇÃO')).toBe('saneamento');
    expect(faseSugerida('LAUDO PERICIAL')).toBe('instrucao');
    expect(faseSugerida('SENTENÇA')).toBe('sentenca');
    expect(faseSugerida('APELAÇÃO')).toBe('recurso');
    expect(faseSugerida('DESPACHO')).toBeNull();
  });
  it('a fase atual vem do último evento com fase; a escolha do professor vale', () => {
    expect(faseAtual([{ descricao: 'PETIÇÃO INICIAL' }, { descricao: 'DESPACHO' }])).toBe('inicial');
    expect(faseAtual([{ descricao: 'PETIÇÃO INICIAL' }, { descricao: 'DESPACHO', fase: 'citacao' }])).toBe('citacao');
    expect(faseAtual([])).toBeNull();
  });
});

describe('prazos', () => {
  it('dias úteis: exclui o começo, pula sábado e domingo', () => {
    // 05/03/2027 é sexta: 15 dias úteis -> 26/03/2027 (sexta)
    expect(vencimento('2027-03-05', 15, 'uteis')).toBe('2027-03-26');
    // 01/03/2027 segunda: 5 dias úteis -> 08/03 (segunda)
    expect(vencimento('2027-03-01', 5, 'uteis')).toBe('2027-03-08');
  });
  it('dias corridos: começa no primeiro dia útil e não termina no fim de semana', () => {
    // sexta 05/03 -> começa segunda 08/03; 5 dias -> 12/03 (sexta)
    expect(vencimento('2027-03-05', 5, 'corridos')).toBe('2027-03-12');
    // segunda 01/03 -> 02/03 + 4 = 06/03 (sábado) -> 08/03
    expect(vencimento('2027-03-01', 5, 'corridos')).toBe('2027-03-08');
  });
  it('conta os dias úteis que faltam', () => {
    expect(diasUteisAte('2027-03-05', '2027-03-08')).toBe(1);
    expect(diasUteisAte('2027-03-08', '2027-03-08')).toBe(0);
    expect(diasUteisAte('2027-03-09', '2027-03-08')).toBeLessThan(0);
  });
  it('lê e escreve o prazo em texto', () => {
    expect(lerPrazo('15 dias úteis para o réu contestar')).toEqual({ dias: 15, tipo: 'uteis', para: 'o réu contestar' });
    expect(lerPrazo('5 dias corridos para pagar (quando vence?)')).toEqual({ dias: 5, tipo: 'corridos', para: 'pagar', desafio: true });
    expect(prazoParaTexto({ dias: 15, tipo: 'uteis', para: 'o réu contestar' })).toBe('15 dias úteis para o réu contestar');
    expect(lerPrazo('quinze dias')).toBeNull();
  });
});

describe('glossário', () => {
  it('marca os termos sem ligar para maiúsculas e acentos, o mais longo primeiro', () => {
    const p = marcarTermos('CONCLUSOS PARA DECISÃO', glossarioCompleto());
    expect(p).toHaveLength(1);
    expect(p[0].termo?.termo).toBe('conclusos para decisão');
    const q = marcarTermos('Juntada de AVISO DE RECEBIMENTO (citação)', glossarioCompleto());
    expect(q.filter((x) => x.termo).map((x) => x.texto)).toEqual(['Juntada', 'AVISO DE RECEBIMENTO', 'citação']);
    expect(q.map((x) => x.texto).join('')).toBe('Juntada de AVISO DE RECEBIMENTO (citação)');
  });
  it('não marca pedaço de palavra', () => {
    expect(marcarTermos('Vistoria', glossarioCompleto()).some((x) => x.termo)).toBe(false);
  });
  it('o termo do professor vale por cima do padrão', () => {
    const g = glossarioCompleto([{ termo: 'Juntada', explicacao: 'minha' }, { termo: 'Comarca de Vide', explicacao: 'cidade fictícia' }]);
    expect(marcarTermos('juntada', g)[0].termo?.explicacao).toBe('minha');
    expect(marcarTermos('na Comarca de Vide', g)[1].termo?.termo).toBe('Comarca de Vide');
  });
});

import { lerProcessoTexto, MODELO_PROCESSO, processoParaTexto } from './importar';
describe('fase e prazo no texto do processo', () => {
  it('lê e devolve "Fase:" e "Prazo:"', () => {
    const l = lerProcessoTexto(MODELO_PROCESSO);
    expect(l.avisos).toEqual([]);
    const d = l.eventos[1];
    expect(d.fase).toBe('citacao');
    expect(d.prazo).toEqual({ dias: 15, tipo: 'uteis', para: 'o réu contestar' });
    const txt = processoParaTexto({ id: 'x', titulo: 't', capa: { numero: '', classe: '', assuntos: '', valorCausa: '', juizo: '', juiz: '', autuadoEm: '2027-03-02', situacao: '' }, partes: [], eventos: l.eventos, atualizado_em: '', criado_em: '' } as never, { soEventos: true });
    expect(txt).toContain('Fase: Citação\nPrazo: 15 dias úteis para o réu contestar');
  });
});
