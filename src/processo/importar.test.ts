import { describe, expect, test } from 'vitest';
import { lerDataHora, lerProcessoTexto, MODELO_PROCESSO, pedidoProcessoIA, processoDoTexto, processoParaTexto } from './importar';
import type { Processo } from './tipos';

const base = (): Processo => ({
  id: 'p', usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null, titulo: 'Padrão',
  capa: { numero: '1234567-00.2027.8.99.0001', classe: 'Procedimento Comum Cível', assuntos: '', valorCausa: '', juizo: 'X', juiz: '', autuadoEm: '2027-01-01', situacao: 'Em andamento' },
  partes: [], eventos: [], publicacao: null,
});

describe('processo em texto', () => {
  test('datas', () => {
    expect(lerDataHora('02/03/2027 10:00')).toBe('2027-03-02T10:00');
    expect(lerDataHora('2/3/27')).toBe('2027-03-02T09:00');
    expect(lerDataHora('02/03/2027 às 14h30')).toBe('2027-03-02T14:30');
    expect(lerDataHora('ontem')).toBeNull();
  });

  test('lê o modelo inteiro', () => {
    const l = lerProcessoTexto(MODELO_PROCESSO);
    expect(l.avisos).toEqual([]);
    expect(l.titulo).toBe('Turma 2027/1 — ação de cobrança');
    expect(l.capa).toMatchObject({ classe: 'Procedimento Comum Cível', assuntos: 'Cobrança', valorCausa: 'R$ 3.500,00', juiz: 'Dra. Helena Prado', autuadoEm: '2027-03-02' });
    expect(l.partes.map((p) => [p.polo, p.nome, p.qualificacao, p.advogados])).toEqual([
      ['ativo', 'Rogéria Silva', 'Pessoa física', [{ nome: 'Carlos Mendes', oab: 'OAB/VD 12.345' }]],
      ['passivo', 'Loja Boa Compra Ltda.', 'Pessoa jurídica', [{ nome: 'Ana Duarte', oab: 'OAB/VD 23.456' }]],
    ]);
    expect(l.eventos.map((e) => [e.data, e.descricao, e.usuario, e.liberacao])).toEqual([
      ['2027-03-02T10:00', 'PETIÇÃO INICIAL', 'ADVOGADO DO AUTOR', { modo: 'agora' }],
      ['2027-03-05T14:00', 'DESPACHO', 'JUIZ', { modo: 'data', em: '2027-03-09T08:00' }],
      ['2027-03-20T09:00', 'CONTESTAÇÃO', 'ADVOGADO DO RÉU', { modo: 'segurar' }],
    ]);
    const inic = l.eventos[0].documentos[0];
    expect(inic).toMatchObject({ sigla: 'INIC1', titulo: 'Petição inicial', tipo: 'texto' });
    expect(inic.texto.startsWith('# PETIÇÃO INICIAL')).toBe(true);
    expect(inic.texto).toContain('## DOS PEDIDOS');
    expect(inic.texto.endsWith('R$ 3.500,00.')).toBe(true);
    expect(l.eventos[2].documentos.map((d) => [d.sigla, d.tipo])).toEqual([
      ['CONT1', 'texto'],
      ['PROC2', 'pdf'],
    ]);
    expect(l.pdfsPendentes).toBe(1);
  });

  test('só eventos (para acrescentar), siglas automáticas e avisos', () => {
    const l = lerProcessoTexto(`Evento: 10/04/2027 | RÉPLICA | ADVOGADO DO AUTOR | na data do evento
Documento: Réplica
O autor impugna a contestação.
Documento: Réplica complementar
Mais texto.
Evento: amanhã | SENTENÇA | JUIZ | quando der
texto solto`);
    expect(l.eventos[0].liberacao).toEqual({ modo: 'data', em: '2027-04-10T09:00' });
    expect(l.eventos[0].documentos.map((d) => d.sigla)).toEqual(['REPLICA1', 'REPLICA2']);
    expect(l.avisos.length).toBe(3);
    expect(l.eventos[1].liberacao).toEqual({ modo: 'segurar' });
  });

  test('ida e volta: processo -> texto -> processo', () => {
    const p = processoDoTexto(lerProcessoTexto(MODELO_PROCESSO), base());
    const t = processoParaTexto(p);
    const de_novo = processoDoTexto(lerProcessoTexto(t), base());
    expect(de_novo.capa).toEqual(p.capa);
    expect(de_novo.partes.map((x) => [x.polo, x.nome, x.qualificacao, x.advogados])).toEqual(p.partes.map((x) => [x.polo, x.nome, x.qualificacao, x.advogados]));
    expect(de_novo.eventos.map((e) => [e.data, e.descricao, e.liberacao, e.documentos.map((d) => [d.sigla, d.tipo, d.texto])])).toEqual(
      p.eventos.map((e) => [e.data, e.descricao, e.liberacao, e.documentos.map((d) => [d.sigla, d.tipo, d.texto])]),
    );
    expect(processoParaTexto(p, { soEventos: true }).startsWith('Evento:')).toBe(true);
  });

  test('pedido para a IA leva o modelo e as escolhas', () => {
    const t = pedidoProcessoIA({ tema: 'cobrança', ate: 'saneamento', eventos: 8, vicios: 'citação nula', inicio: '02/03/2027' });
    expect(t).toContain('até a decisão de saneamento');
    expect(t).toContain('citação nula');
    expect(t).toContain('Evento: 02/03/2027 10:00 | PETIÇÃO INICIAL');
  });
});

import { semSiglasRepetidas } from './siglas';
describe('siglas ao acrescentar eventos', () => {
  test('renumera só as repetidas', () => {
    const r = semSiglasRepetidas(['INIC1', 'DESPADEC1', 'CONT1'], [{ documentos: [{ sigla: 'DESPADEC1' }, { sigla: 'REPLICA1' }, { sigla: 'DESPADEC1' }] }]);
    expect(r[0].documentos.map((d) => d.sigla)).toEqual(['DESPADEC2', 'REPLICA1', 'DESPADEC3']);
  });
  test('número com o ano da autuação', () => {
    const p = processoDoTexto(lerProcessoTexto('Autuação: 02/03/2027'), base());
    expect(p.capa.numero).toMatch(/\.2027\.8\.99\.0001$/);
  });
});
