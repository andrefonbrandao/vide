// @vitest-environment node
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { BancoVide } from '../dados/db';
import type { Diploma, Item, Material } from '../dados/modelo';
import type { Questao } from '../jogo/tipos';
import { ArmazemMemoria } from './remoto';
import { mesclar, sincronizar } from './sincronia';

let n = 0;
const iso = (s: number) => new Date(Date.UTC(2026, 10, 1, 12, 0, s)).toISOString();
const base = (id: string, t = 0) => ({ id, usuario_id: null, criado_em: iso(t), atualizado_em: iso(t), excluido_em: null as string | null });

const questao = (id: string, enunciado: string, t = 0): Questao => ({
  ...base(id, t), tipo: 'vf', enunciado, alternativas: ['Verdadeiro', 'Falso'], correta: 0, tempo: 30, explicacao: '', fundamento: '', pasta: '', etiquetas: [],
});
const material = (id: string, nome: string, t = 0): Material => ({
  ...base(id, t), nome, tipo: 'pdf', mime: 'application/pdf', tamanho: 5, paginas: 1, arquivo: new Blob(['%PDF-'], { type: 'application/pdf' }), pasta: 'Aulas', etiquetas: [],
});
const diploma = (id: string, sigla: string, t = 0): Diploma => ({
  ...base(id, t), sigla, nome: sigla.toUpperCase(), apelidos: [], origem_url: null, versao_em: iso(t), total_artigos: 1, abreviacao: sigla.toUpperCase(),
});
const item = (sigla: string, art: number, t = 0): Item =>
  ({ ...base(`${sigla}-${art}-${t}`, t), tipo: 'legislacao', chave: `${sigla}:art:${art}`, titulo: `art. ${art}`, rotulo: null, gatilhos: [], etiquetas: [], conteudo: { artigo: art } as never, origem: { arquivo: null, url: null, importado_em: iso(t) } }) as Item;

let pc1: BancoVide;
let pc2: BancoVide;
let drive: ArmazemMemoria;
beforeEach(async () => {
  n++;
  pc1 = new BancoVide(`pc1-${n}`);
  pc2 = new BancoVide(`pc2-${n}`);
  drive = new ArmazemMemoria();
});

describe('mesclar', () => {
  test('vale a alteração mais recente', () => {
    const r = mesclar([{ id: 'a', atualizado_em: '2' }, { id: 'b', atualizado_em: '5' }], [{ id: 'a', atualizado_em: '3' }, { id: 'b', atualizado_em: '4' }, { id: 'c', atualizado_em: '1' }]);
    expect(r.paraLocal.map((x) => x.id)).toEqual(['a', 'c']);
    expect(r.remotoDesatualizado).toBe(true);
    expect(r.resultado.find((x) => x.id === 'b')?.atualizado_em).toBe('5');
  });
});

describe('dois computadores e o Drive', () => {
  test('questões: criar, editar no outro, apagar', async () => {
    await pc1.questoes.add(questao('q1', 'Primeira'));
    await sincronizar(pc1, drive);
    await sincronizar(pc2, drive);
    expect((await pc2.questoes.get('q1'))?.enunciado).toBe('Primeira');
    await pc2.questoes.put({ ...(await pc2.questoes.get('q1'))!, enunciado: 'Editada', atualizado_em: iso(10) });
    await sincronizar(pc2, drive);
    await sincronizar(pc1, drive);
    expect((await pc1.questoes.get('q1'))?.enunciado).toBe('Editada');
    await pc1.questoes.put({ ...(await pc1.questoes.get('q1'))!, excluido_em: iso(20), atualizado_em: iso(20) });
    await sincronizar(pc1, drive);
    await sincronizar(pc2, drive);
    expect((await pc2.questoes.get('q1'))?.excluido_em).toBe(iso(20));
  });

  test('sem mudanças, a segunda sincronização não envia nada', async () => {
    await pc1.questoes.add(questao('q1', 'X'));
    await sincronizar(pc1, drive);
    const antes = { ...drive.contagem };
    const r = await sincronizar(pc1, drive);
    expect(r.enviados).toEqual([]);
    expect(drive.contagem.criar).toBe(antes.criar);
    expect(drive.contagem.atualizar).toBe(antes.atualizar);
  });

  test('materiais: arquivo vai e volta; mudar a pasta não reenvia o PDF; apagar leva à lixeira', async () => {
    await pc1.materiais.add(material('m1', 'Slides'));
    const r1 = await sincronizar(pc1, drive);
    expect(r1.enviados).toContain('material "Slides"');
    await sincronizar(pc2, drive);
    const m2 = await pc2.materiais.get('m1');
    expect(m2?.arquivo.size).toBe(5);
    expect(await m2!.arquivo.text()).toBe('%PDF-');
    await pc2.materiais.put({ ...m2!, pasta: 'Outra', atualizado_em: iso(30) });
    const criadosAntes = drive.contagem.criar;
    await sincronizar(pc2, drive);
    expect(drive.contagem.criar).toBe(criadosAntes);
    await sincronizar(pc1, drive);
    expect((await pc1.materiais.get('m1'))?.pasta).toBe('Outra');
    await pc1.materiais.put({ ...(await pc1.materiais.get('m1'))!, arquivo: new Blob([]), excluido_em: iso(40), atualizado_em: iso(40) });
    await sincronizar(pc1, drive);
    expect((await drive.listar()).some((a) => a.props.vide === 'material')).toBe(false);
    await sincronizar(pc2, drive);
    expect((await pc2.materiais.get('m1'))?.excluido_em).toBe(iso(40));
  });

  test('leis: importação chega ao outro computador e substitui a anterior', async () => {
    await pc2.diplomas.add(diploma('d-velho', 'cpc', 0));
    await pc2.itens.bulkAdd([item('cpc', 1, 0)]);
    await pc1.diplomas.add(diploma('d-novo', 'cpc', 50));
    await pc1.itens.bulkAdd([item('cpc', 1, 50), item('cpc', 2, 50)]);
    await sincronizar(pc1, drive);
    await sincronizar(pc2, drive);
    const ativos = (await pc2.itens.toArray()).filter((i) => !i.excluido_em);
    expect(ativos.map((i) => i.id).sort()).toEqual(['cpc-1-50', 'cpc-2-50']);
    expect((await pc2.diplomas.get('d-velho'))?.excluido_em).toBeTruthy();
    // e o pc1 não recebe a versão antiga de volta
    await sincronizar(pc1, drive);
    expect((await pc1.diplomas.get('d-novo'))?.excluido_em).toBeNull();
    expect((await pc1.itens.toArray()).filter((i) => !i.excluido_em)).toHaveLength(2);
  });

  test('registro das aulas: transcrição vai para o outro; apagar apaga lá também', async () => {
    await pc1.registro.bulkAdd([
      { sessao_id: 's1', em: iso(1), tipo: 'fala', texto: 'bom dia' },
      { sessao_id: 's1', em: iso(2), tipo: 'fala', texto: 'artigo 485' },
    ]);
    await sincronizar(pc1, drive);
    await sincronizar(pc2, drive);
    expect((await pc2.registro.where('sessao_id').equals('s1').sortBy('seq')).map((e) => e.texto)).toEqual(['bom dia', 'artigo 485']);
    // a aula continua no pc1
    await pc1.registro.add({ sessao_id: 's1', em: iso(3), tipo: 'fala', texto: 'fim' });
    await sincronizar(pc1, drive);
    await sincronizar(pc2, drive);
    expect(await pc2.registro.where('sessao_id').equals('s1').count()).toBe(3);
    // apagada no pc2
    await pc2.registro.where('sessao_id').equals('s1').delete();
    await pc2.apagados.put({ chave: 'sessao:s1', em: iso(9) });
    await sincronizar(pc2, drive);
    await sincronizar(pc1, drive);
    expect(await pc1.registro.where('sessao_id').equals('s1').count()).toBe(0);
    expect((await drive.listar()).some((a) => a.props.vide === 'aula')).toBe(false);
  });
});
