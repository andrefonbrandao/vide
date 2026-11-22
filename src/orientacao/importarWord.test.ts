// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { lerDocx } from './lerDocx';
import { importarFinal, importarPre } from './importarWord';
import { TEXTO_VAZIO } from './preProjetoPdf';
import { FINAL_VAZIO, novaParte } from './trabalhoFinalEstrutura';
import { textoDaFigura } from './marcacao';

const abrir = (n: string) => new Uint8Array(readFileSync(new URL(`./exemplos/${n}`, import.meta.url)));

for (const [arquivo, estilos] of [['com-estilos.docx', true], ['so-negrito.docx', false]] as const) {
  test(`Word (${arquivo}): distribui pelo trabalho final`, async () => {
    const d = await lerDocx(abrir(arquivo));
    expect(d.temEstilos).toBe(estilos);
    const r = importarFinal(d.elementos, { ...FINAL_VAZIO, titulo: 'Meu título' }, d.temEstilos);
    const t = r.texto;
    expect(t.titulo).toBe('Meu título');
    expect(t.introducao).toBe('O sistema de **precedentes** adota o _stare decisis_ como base.\nSegundo parágrafo da introdução.');
    expect(t.objetivoGeral).toBe('Analisar a aplicação dos precedentes no TJRS.');
    expect(t.objetivosEspecificos).toBe('Identificar as teses\nVerificar a fundamentação');
    expect(t.justificativa).toBe('O tema é relevante.');
    expect(t.capitulos.map((c) => c.titulo)).toEqual(['O SISTEMA DE PRECEDENTES', 'ANÁLISE DAS DECISÕES']);
    const cap = t.capitulos[0].texto;
    expect(cap).toContain('## Origem histórica');
    expect(cap).toContain('> Citação longa');
    expect(cap).toContain('::: Tabela – Decisões por ano\nAno | Decisões\n2023 | 120\n2024 | 150\nFonte: TJRS (2025).\n:::');
    expect(cap).toMatch(/::: Figura – Fachada do tribunal\nimagem: @rId\d+\nlargura: 100\nFonte: acervo do autor.\n:::/);
    expect(cap).not.toContain('Fonte: acervo do autor.\nFonte');
    expect(t.consideracoes).toBe('Conclusão do trabalho.');
    expect(t.referencias.split('\n')).toEqual(['MARINONI, Luiz Guilherme. **Precedentes obrigatórios**. São Paulo: RT, 2019.', 'DIDIER JR., Fredie. Curso. Salvador: JusPodivm, 2020.']);
    expect(t.apendices.map((a) => a.titulo)).toEqual(['ROTEIRO DA ENTREVISTA']);
    expect(r.ignorados).toContain('SUMÁRIO');
    expect(r.imagens).toHaveLength(1);
    expect(d.imagens.get(r.imagens[0])?.ext).toBe('png');
    if (!estilos) expect(r.avisos.join(' ')).toContain('negrito');
  });
}

test('Word: distribui pelo pré-projeto (outros títulos entram na fundamentação)', async () => {
  const d = await lerDocx(abrir('com-estilos.docx'));
  const r = importarPre(d.elementos, { ...TEXTO_VAZIO, titulo: 'T' }, d.temEstilos);
  expect(r.texto.titulo).toBe('T');
  expect(r.texto.objetivoGeral).toBe('Analisar a aplicação dos precedentes no TJRS.');
  expect(r.texto.justificativa).toBe('O tema é relevante.');
  expect(r.texto.fundamentacao).toContain('## O SISTEMA DE PRECEDENTES');
  expect(r.texto.referencias.split('\n')).toHaveLength(2);
});

test('ida e volta: o Word gerado pelo Vide volta para os mesmos campos (com notas de rodapé)', async () => {
  const { gerarPreProjetoDocx } = await import('./preProjetoDocx');
  const final = {
    ...FINAL_VAZIO,
    titulo: 'Precedentes',
    introducao: 'Intro com nota.[[Ver MARINONI, 2019.]]\nOutro parágrafo.',
    objetivoGeral: 'Analisar.',
    objetivosEspecificos: 'Identificar\nVerificar',
    justificativa: 'Relevante.',
    capitulos: [novaParte('Teoria', `Texto **forte**.\n## Origem\n> Citação longa.\n${textoDaFigura({ tipo: 'grafico', titulo: 'Evolução', fonte: 'o autor.', imagem: 'x1', largura: 50 })}`)],
    consideracoes: 'Fim.',
    referencias: 'A, a.\nB, b.',
  };
  const cfg = { ativo: true, instituicao: 'Ftec' as const, curso: 'Direito', cidade: 'C', ano: '2026', orientador: 'X', coorientador: '', natureza: '', resumo: false, aprovacao: false, formato: 'final' as const };
  const blob = await gerarPreProjetoDocx({ nome: 'A', config: cfg, texto: { ...TEXTO_VAZIO, final }, etapas: [] });
  const d = await lerDocx(new Uint8Array(await blob.arrayBuffer()));
  const t = importarFinal(d.elementos, FINAL_VAZIO, d.temEstilos).texto;
  expect(t.introducao).toBe('Intro com nota.[[Ver MARINONI, 2019.]]\nOutro parágrafo.');
  expect(t.objetivosEspecificos).toBe('Identificar.\nVerificar.');
  expect(t.capitulos.map((c) => c.titulo)).toEqual(['TEORIA']);
  expect(t.capitulos[0].texto).toContain('Texto **forte**.\n## Origem\n> Citação longa.');
  expect(t.consideracoes).toBe('Fim.');
  expect(t.referencias).toBe('A, a.\nB, b.');
});
