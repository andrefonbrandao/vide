import { describe, expect, it } from 'vitest';
import { agruparPorPasta, filtrarMateriais, nomePasta, todasEtiquetas, todasPastas } from './organizacao';

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
