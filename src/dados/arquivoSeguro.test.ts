// @vitest-environment node
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterAll, describe, expect, test } from 'vitest';
import { BancoVide } from './db';
import { forcarSemBlob, prepararArquivo } from './arquivoSeguro';
import type { Material } from './modelo';

const material = (id: string, arquivo: Blob): Material =>
  ({ id, usuario_id: null, criado_em: '2026-11-20', atualizado_em: '2026-11-20', excluido_em: null, nome: id, tipo: 'pdf', mime: 'application/pdf', tamanho: arquivo.size, paginas: 1, arquivo, pasta: '', etiquetas: [] }) as Material;

describe('arquivo no banco quando o navegador recusa Blob (Safari em aba privada)', () => {
  afterAll(() => forcarSemBlob(false));

  test('guarda em bytes, lê de volta como arquivo e regrava sem perder nada', async () => {
    forcarSemBlob(true);
    const banco = new BancoVide('teste-sem-blob');
    const original = new Blob(['%PDF conteúdo'], { type: 'application/pdf' });
    await banco.materiais.put(material('m1', await prepararArquivo(original)));
    await banco.materiais.put(material('m2', new Blob([])));

    // No banco, ficou em bytes (sem Blob nenhum).
    const cru = new Dexie('teste-sem-blob');
    await cru.open();
    const bruto = (await cru.table('materiais').get('m1')) as { arquivo: { __videArquivo: number } };
    expect(bruto.arquivo.__videArquivo).toBe(1);
    expect(((await cru.table('materiais').get('m2')) as { arquivo: { __videArquivo: number } }).arquivo.__videArquivo).toBe(1);
    cru.close();

    // Ao ler, volta a ser um arquivo normal.
    const lido = (await banco.materiais.get('m1'))!;
    expect(lido.arquivo).toBeInstanceOf(Blob);
    expect(lido.arquivo.type).toBe('application/pdf');
    expect(await lido.arquivo.text()).toBe('%PDF conteúdo');

    // Regravar o que foi lido (ex.: mudar a pasta) continua funcionando.
    await banco.materiais.put({ ...lido, pasta: 'Aulas' });
    await banco.materiais.update('m1', { nome: 'novo' });
    const de_novo = (await banco.materiais.get('m1'))!;
    expect(de_novo.pasta).toBe('Aulas');
    expect(de_novo.nome).toBe('novo');
    expect(await de_novo.arquivo.text()).toBe('%PDF conteúdo');
    banco.close();
  });
});
