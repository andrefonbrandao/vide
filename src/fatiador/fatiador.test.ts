import { describe, expect, it } from 'vitest';
import { fatiar, resolverDuplicidades, separarNotas } from './fatiador';
import { htmlParaLinhas, lerArquivo, textoParaLinhas } from './html';

// Trecho no mesmo formato do HTML do Planalto (redação antiga tachada).
const HTML = `<html><body>
<p>LEI Nº 13.105, DE 16 DE MARÇO DE 2015.</p>
<p>PARTE GERAL</p><p>LIVRO I</p><p>DAS NORMAS PROCESSUAIS CIVIS</p>
<p><a name="art11"></a>Art. 11. Todos os julgamentos
   dos órgãos do Poder Judiciário serão públicos.</p>
<p>Parágrafo único. Nos casos de segredo de justiça, pode ser autorizada a presença.</p>
<p><strike>Art. 12. Os juízes e os tribunais deverão obedecer à ordem cronológica.</strike></p>
<p>Art. 12. Os juízes e os tribunais atenderão, preferencialmente, à ordem cronológica.
 <a href="x">(Redação dada pela Lei nº 13.256, de 2016)</a> <a>(Vigência)</a></p>
<p><span style="text-decoration:line-through">§ 1º A lista antiga.</span></p>
<p>§ 1º A lista de processos aptos a julgamento.</p>
<p>§ 2º Estão excluídos da regra do <i>caput</i>:</p>
<p>I - as sentenças proferidas em audiência;</p>
<p>II - o julgamento de processos em bloco;</p>
<p>III-A &#150; os acórdãos novos;</p>
<p>Art. 1.015. Cabe agravo de instrumento contra as decisões interlocutórias que versarem sobre:</p>
<p>I - tutelas provisórias;</p>
<p>XIII - outros casos expressamente referidos em lei.</p>
<p>Parágrafo único. Também caberá agravo de instrumento.</p>
<p>Art. 1.071. A Lei de Registros Públicos passa a vigorar acrescida do seguinte art. 216-A:</p>
<p>“Art. 216-A. Sem prejuízo da via jurisdicional, é admitido o pedido:</p>
<p>I - ata notarial;</p>
<p>§ 1º O pedido será autuado.” (NR)</p>
<p>Art. 1.072. Revogam-se:</p>
<p>Brasília, 16 de março de 2015; 194º da Independência.</p>
</body></html>`;

describe('fatiador', () => {
  const { linhas, tachadosRemovidos } = htmlParaLinhas(HTML);
  const r = fatiar(linhas);
  const porNum = new Map(r.artigos.map((a) => [a.artigo, a]));

  it('descarta o texto tachado', () => {
    expect(tachadosRemovidos).toBe(2);
    expect(r.artigos.filter((a) => a.artigo === 12)).toHaveLength(1);
    expect(porNum.get(12)!.caput.texto).toContain('atenderão');
    expect(porNum.get(12)!.paragrafos[0].texto).toBe('A lista de processos aptos a julgamento.');
  });

  it('separa as notas do Planalto', () => {
    expect(porNum.get(12)!.caput.notas).toEqual(['(Redação dada pela Lei nº 13.256, de 2016)', '(Vigência)']);
    expect(porNum.get(12)!.caput.texto.endsWith('cronológica.')).toBe(true);
  });

  it('fatia parágrafos, incisos e romanos com sufixo', () => {
    const p2 = porNum.get(12)!.paragrafos[1];
    expect(p2.rotulo).toBe('§ 2º');
    expect(p2.texto).toBe('Estão excluídos da regra do caput:');
    expect(p2.filhos.map((f) => f.rotulo)).toEqual(['I', 'II', 'III-A']);
    expect(p2.filhos[2].numero).toBe('3-A');
  });

  it('artigo com milhar e parágrafo único', () => {
    const a = porNum.get(1015)!;
    expect(a.rotulo).toBe('Art. 1.015');
    expect(a.caput.filhos.map((f) => f.numero)).toEqual(['1', '13']);
    expect(a.paragrafos[0].numero).toBe('unico');
  });

  it('texto de outra lei entre aspas não vira artigo do CPC', () => {
    expect(porNum.has(216)).toBe(false);
    const a = porNum.get(1071)!;
    expect(a.caput.filhos.every((f) => f.tipo === 'item')).toBe(true);
    expect(a.caput.filhos).toHaveLength(3);
    expect(porNum.has(1072)).toBe(true);
  });

  it('guarda a localização', () => {
    expect(porNum.get(11)!.localizacao).toEqual(['PARTE GERAL', 'LIVRO I – DAS NORMAS PROCESSUAIS CIVIS']);
  });

  it('acusa duplicidade em texto simples (sem tachado)', () => {
    const txt = textoParaLinhas(`Art. 12. Versão antiga.\nArt. 12. Versão nova.\n§ 1º Um.\n§ 1º Outro.`);
    const r2 = fatiar(txt);
    expect(r2.duplicidades.map((d) => d.onde)).toEqual(['Art. 12', 'Art. 12, § 1º']);
    const final = resolverDuplicidades(r2.artigos);
    expect(final).toHaveLength(1);
    expect(final[0].caput.texto).toBe('Versão nova.');
    expect(final[0].paragrafos.map((p) => p.texto)).toEqual(['Outro.']);
    // escolhendo a primeira versão
    expect(resolverDuplicidades(r2.artigos, { '12': 0 })[0].caput.texto).toBe('Versão antiga.');
  });

  it('não trata "(revogado)" como nota', () => {
    expect(separarNotas('(revogado);').texto).toBe('(revogado);');
  });

  it('lê bytes Windows-1252', () => {
    const bytes = new Uint8Array([...new TextEncoder().encode('Art. 1'), 0xba, ...new TextEncoder().encode(' O processo civil ser'), 0xe1, 0x2e]);
    const r3 = lerArquivo('cpc.txt', bytes);
    expect(r3.linhas[0]).toBe('Art. 1º O processo civil será.');
  });
});
