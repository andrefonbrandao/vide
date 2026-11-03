import { describe, expect, it } from 'vitest';
import { agruparPorPasta, conteudoDaPasta, degrausDaPasta, filtrarMateriais, nomePasta, todasEtiquetas, todasPastas } from './organizacao';

const lista = [
  { id: '1', nome: 'Aula 03 - Sentença', pasta: 'Processo Civil II/Sentença', etiquetas: ['sentença', 'fundamentação'] },
  { id: '2', nome: 'Aula 10 - Apelação', pasta: 'Processo Civil II/Recursos', etiquetas: ['recursos'] },
  { id: '3', nome: 'Acórdão REsp 1.234', pasta: '', etiquetas: ['recursos', 'stj'] },
  { id: '4', nome: 'Aula 2 - Petição inicial', pasta: 'Processo Civil I', etiquetas: [] },
];

describe('organização dos materiais', () => {
  it('busca no nome, na pasta e nas etiquetas, sem acento', () => {
    expect(filtrarMateriais(lista, 'sentenca').map((m) => m.id)).toEqual(['1']);
    expect(filtrarMateriais(lista, 'recursos').map((m) => m.id)).toEqual(['2', '3']);
    expect(filtrarMateriais(lista, 'civil ii aula').map((m) => m.id)).toEqual(['1', '2']);
    expect(filtrarMateriais(lista, '', 'stj').map((m) => m.id)).toEqual(['3']);
  });

  it('agrupa por pasta com "Sem pasta" por último e ordena os nomes com números', () => {
    const g = agruparPorPasta(lista);
    expect(g.map((x) => x.pasta)).toEqual(['Processo Civil I', 'Processo Civil II/Recursos', 'Processo Civil II/Sentença', '']);
    expect(nomePasta(g[2].pasta)).toBe('Processo Civil II › Sentença');
    expect(nomePasta('')).toBe('Sem pasta');
  });

  it('lista pastas (com as mães) e etiquetas mais usadas', () => {
    expect(todasPastas(lista)).toEqual(['Processo Civil I', 'Processo Civil II', 'Processo Civil II/Recursos', 'Processo Civil II/Sentença']);
    expect(todasEtiquetas(lista)[0]).toEqual({ etiqueta: 'recursos', total: 2 });
  });
});


describe('navegar pelas pastas', () => {
  const test = it;
  const lista = [
    { id: '1', nome: 'Avulso.pdf', pasta: '' },
    { id: '2', nome: 'Aula 1.pdf', pasta: 'Processo Civil II' },
    { id: '3', nome: 'Sentença 2.pdf', pasta: 'Processo Civil II/Sentença' },
    { id: '4', nome: 'Sentença 10.pdf', pasta: 'Processo Civil II/Sentença' },
    { id: '5', nome: 'Apelação.pdf', pasta: 'Processo Civil II/Recursos/Apelação' },
    { id: '6', nome: 'Petição.pdf', pasta: 'Processo Civil I' },
  ];
  test('início', () => {
    const c = conteudoDaPasta(lista, '');
    expect(c.subpastas).toEqual([
      { pasta: 'Processo Civil I', nome: 'Processo Civil I', total: 1 },
      { pasta: 'Processo Civil II', nome: 'Processo Civil II', total: 4 },
    ]);
    expect(c.itens.map((m) => m.id)).toEqual(['1']);
  });
  test('pasta-mãe mostra subpastas e os próprios arquivos', () => {
    const c = conteudoDaPasta(lista, 'Processo Civil II');
    expect(c.subpastas.map((s) => [s.nome, s.total])).toEqual([['Recursos', 1], ['Sentença', 2]]);
    expect(c.itens.map((m) => m.id)).toEqual(['2']);
  });
  test('subpasta, em ordem numérica', () => {
    const c = conteudoDaPasta(lista, 'Processo Civil II/Sentença');
    expect(c.subpastas).toEqual([]);
    expect(c.itens.map((m) => m.nome)).toEqual(['Sentença 2.pdf', 'Sentença 10.pdf']);
  });
  test('não confunde pastas com o mesmo começo', () => {
    expect(conteudoDaPasta(lista, 'Processo Civil I').itens.map((m) => m.id)).toEqual(['6']);
    expect(conteudoDaPasta(lista, 'Processo Civil I').subpastas).toEqual([]);
  });
  test('degraus', () => {
    expect(degrausDaPasta('A/B/C').map((d) => d.pasta)).toEqual(['A', 'A/B', 'A/B/C']);
    expect(degrausDaPasta('')).toEqual([]);
  });
});
