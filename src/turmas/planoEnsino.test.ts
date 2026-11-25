// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { horarioTexto, lerPlanoEnsinoDocx, localEData, pedacosNegrito } from './planoEnsino';

describe('plano de ensino', () => {
  it('lê o plano de ensino no modelo da instituição', async () => {
    const { plano, unidade, periodo } = await lerPlanoEnsinoDocx(new Uint8Array(readFileSync('src/turmas/exemplo-plano-ensino.docx')));
    expect(unidade).toBe('Direito Processual Civil II');
    expect(periodo).toBe('2026.2');
    expect(plano.cargaHoraria).toBe('60');
    expect(plano.professor).toBe('André da Fonseca Brandão');
    expect(plano.coordenador).toBe('Fernanda Pimentel da Silva');
    expect(plano.ementa).toMatch(/^Na disciplina de Direito Processual Civil II/);
    expect(plano.competencias).toHaveLength(3);
    expect(plano.habilidades).toHaveLength(3);
    expect(plano.conteudo.map((u) => u.titulo)).toEqual(['Etapa postulatória', 'Etapa Instrutória', 'Etapa Decisória', 'Coisa Julgada', 'Tutela Jurisdicional Provisória']);
    expect(plano.conteudo[1].itens[0]).toBe('Teoria Geral da Prova;');
    // "3.4 – …;3.5 – …" estavam juntos num parágrafo só.
    expect(plano.conteudo[2].itens.slice(3)).toEqual(['A sistemática dos precedentes judiciais;', 'Sentença ilíquida e liquidação da sentença.']);
    expect(plano.estrategias).toMatch(/^O processo de avaliação tem caráter diagnóstico/);
    expect(plano.graus.A.descricao).toMatch(/^3 Pontos – Pontuação/);
    expect(plano.graus.C).toEqual({ descricao: 'Pontuação conforme desempenho em questionário específico.', peso: '10 pontos' });
    expect(plano.recuperacao.descricao).toMatch(/^Ao longo do semestre/);
    expect(plano.recuperacao.estrategias).toMatch(/^Serão realizadas avaliações/);
    expect(plano.bibliografiaBasica).toHaveLength(2);
    expect(plano.bibliografiaComplementar).toHaveLength(3);
    // O título em negrito fica marcado; os endereços partidos em vários parágrafos voltam a ser um só.
    expect(plano.bibliografiaComplementar[1]).toContain('**Precedentes, Jurisprudência e Súmulas no Novo CPC.**');
    expect(plano.bibliografiaComplementar[1]).toContain('https://www.academia.edu/15354370/Precedentes_Jurisprud%C3%AAncia_e_S%C3%BAmulas_no_Novo_CPC');
    expect(plano.bibliografiaComplementar[2]).toMatch(/CABRAL%2C%20Antonio%20do%20Passo%20-%20As%20.*CPC\.\.pdf$/);
    expect(plano.bibliografiaBasica[1]).toContain('_ato2015-2018/2015/lei/l13105.htm');
    expect(plano.cidade).toBe('Caxias do Sul');
  });

  it('horário, local e data, negrito', () => {
    expect(horarioTexto({ horarios: [{ dia: 2, inicio: '19:00', fim: '22:00' }, { dia: 4, inicio: '19:00', fim: '22:00' }] })).toBe('19:00 às 22:00');
    expect(localEData('Caxias do Sul', '2026-07-30')).toBe('Caxias do Sul, 30 de Julho de 2026.');
    expect(pedacosNegrito('A. **Título.** Editora')).toEqual([
      { t: 'A. ', b: false },
      { t: 'Título.', b: true },
      { t: ' Editora', b: false },
    ]);
  });
});
