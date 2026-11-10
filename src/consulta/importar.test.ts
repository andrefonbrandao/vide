import { describe, expect, test } from 'vitest';
import { casoParaTexto, lerCasos, MODELO_CASO } from './importar';

describe('importar casos', () => {
  test('lê o modelo', () => {
    const { casos, avisos } = lerCasos(MODELO_CASO);
    expect(avisos).toEqual([]);
    expect(casos).toHaveLength(1);
    const c = casos[0];
    expect(c.nome).toBe('Rogéria');
    expect(c.pessoa).toEqual({ genero: 'mulher', idade: 'idoso' });
    expect(c.falas.map((f) => f.expressao)).toEqual(['neutro', 'medo', 'duvida']);
    expect(c.quemResponde).toBe('juiz');
    expect(c.fundamento).toBe('252');
    expect(c.tempo).toBe(5);
    expect(c.assuntos).toEqual(['citação']);
  });

  test('vários casos, linhas quebradas, padrões e avisos', () => {
    const txt = `Caso: João
Fala: Fui citado ontem.
Fala (preocupado): Quanto tempo tenho
para responder?
Resposta: Em regra, 15 dias úteis
para contestar.

Caso: Ana
Fala (feliz): Ganhei a causa!

texto solto`;
    const { casos, avisos } = lerCasos(txt);
    expect(casos).toHaveLength(1);
    expect(casos[0].falas[1]).toEqual({ expressao: 'medo', texto: 'Quanto tempo tenho para responder?' });
    expect(casos[0].resposta).toBe('Em regra, 15 dias úteis para contestar.');
    expect(casos[0].quemResponde).toBe('advogado');
    expect(casos[0].pessoa).toEqual({});
    expect(avisos[0]).toContain('Ana');
  });

  test('volta ao texto e lê de novo igual', () => {
    const c = { ...lerCasos(MODELO_CASO).casos[0], etiquetas: ['citação'] };
    const de_novo = lerCasos(casoParaTexto(c)).casos[0];
    expect(de_novo.falas).toEqual(c.falas);
    expect(de_novo.pessoa).toEqual(c.pessoa);
    expect(de_novo.resposta).toBe(c.resposta);
  });
});
