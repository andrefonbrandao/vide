import { describe, expect, it } from 'vitest';
import { achados, chavesDoVicio, mapaVicios, unidades, viciosPerdidos } from './vicios';

const PECA = `# PETIÇÃO INICIAL

**ROGÉRIA SILVA**, brasileira, vem propor _ação de cobrança_.

## DOS PEDIDOS
- a citação da ré por **edital**;
- a condenação da ré a devolver R$ 3.500,00.

Dá-se à causa o valor de R$ 100,00.`;

describe('caça aos vícios', () => {
  it('divide a peça em partes que o aluno toca', () => {
    expect(unidades(PECA).map((u) => u.chave)).toEqual(['0', '1', '2', '3.0', '3.1', '4']);
  });
  it('acha o vício pelo trecho selecionado no editor (com marcações e acentos)', () => {
    const us = unidades(PECA);
    expect(chavesDoVicio(us, { id: 'a', trecho: 'citação da ré por **edital**', explicacao: '' })).toEqual(['3.0']);
    expect(chavesDoVicio(us, { id: 'b', trecho: 'valor de R$ 100,00', explicacao: '' })).toEqual(['4']);
    expect(chavesDoVicio(us, { id: 'c', trecho: 'não existe', explicacao: '' })).toEqual([]);
  });
  it('trecho que atravessa duas partes marca as duas', () => {
    const us = unidades(PECA);
    expect(chavesDoVicio(us, { id: 'd', trecho: '- a citação da ré por **edital**;\n- a condenação da ré a devolver R$ 3.500,00.', explicacao: '' })).toEqual(['3.0', '3.1']);
  });
  it('conta os achados e avisa vícios perdidos', () => {
    const vs = [
      { id: 'a', trecho: 'por edital', explicacao: 'citação por edital sem tentar a pessoal (art. 256)' },
      { id: 'b', trecho: 'R$ 100,00', explicacao: 'valor da causa errado (art. 292)' },
    ];
    expect(mapaVicios(PECA, vs).size).toBe(2);
    expect([...achados(PECA, vs, ['3.0', '1'])]).toEqual(['a']);
    expect(viciosPerdidos(PECA.replace('R$ 100,00', 'R$ 3.500,00'), vs).map((v) => v.id)).toEqual(['b']);
  });
});

import { lerProcessoTexto, processoParaTexto } from './importar';
describe('vícios no processo em texto', () => {
  it('lê "Vício:" dentro do documento e devolve no texto', () => {
    const l = lerProcessoTexto('Evento: 02/03/2027 10:00 | PETIÇÃO INICIAL | ADVOGADO DO AUTOR | segurado\nDocumento: INIC1 | Petição inicial\nPede a citação por edital.\nVício: citação por edital | sem tentar a citação pessoal (art. 256)');
    expect(l.avisos).toEqual([]);
    const d = l.eventos[0].documentos[0];
    expect(d.texto).toBe('Pede a citação por edital.');
    expect(d.vicios?.[0]).toMatchObject({ trecho: 'citação por edital', explicacao: 'sem tentar a citação pessoal (art. 256)' });
    const txt = processoParaTexto({ eventos: l.eventos } as never, { soEventos: true });
    expect(txt).toContain('Vício: citação por edital | sem tentar a citação pessoal (art. 256)');
  });
});
