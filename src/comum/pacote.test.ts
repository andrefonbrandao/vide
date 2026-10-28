import { describe, expect, test } from 'vitest';
import type { EventoRegistro, Item } from '../dados/modelo';
import { artigoDaChave, montarPacote } from './pacote';

const d = (tipo: string, numero: string, rotulo: string, texto: string, filhos: any[] = []) => ({ tipo, numero, rotulo, texto, notas: [], filhos });
const item485 = {
  chave: 'cpc:art:485',
  conteudo: {
    formato: 'legislacao/artigo@1', diploma: 'cpc', artigo: 485, sufixo: '', rotulo: 'Art. 485', localizacao: [],
    caput: d('caput', '', '', 'O juiz não resolverá o mérito quando:', [
      d('inciso', '1', 'I', 'indeferir a petição inicial;'),
      d('inciso', '6', 'VI', 'verificar ausência de legitimidade ou de interesse processual;'),
    ]),
    paragrafos: [d('paragrafo', '1', '§ 1º', 'Nas hipóteses descritas nos incisos II e III...')],
  },
} as unknown as Item;
const indice = new Map([['cpc:art:485', item485]]);

let s = 0;
const ev = (min: number, tipo: EventoRegistro['tipo'], texto: string, dados?: Record<string, unknown>): EventoRegistro => ({
  seq: s++, sessao_id: 'x', em: new Date(2026, 9, 21, 14, min, 0).toISOString(), tipo, texto, dados,
});

describe('pacote da aula', () => {
  test('chave do artigo', () => {
    expect(artigoDaChave('cpc:485:i6')).toEqual({ diploma: 'cpc', chaveItem: 'cpc:art:485' });
    expect(artigoDaChave('cf:103-A')).toEqual({ diploma: 'cf', chaveItem: 'cf:art:103-A' });
    expect(artigoDaChave('lixo')).toBeNull();
  });

  const eventos = [
    ev(0, 'sessao', 'início'),
    ev(0, 'fala', 'hoje vamos falar de sentença terminativa'),
    ev(0, 'fala', 'vejam o artigo 485'),
    ev(1, 'detectado', 'art. 485 CPC', { chave: 'cpc:485' }),
    ev(1, 'detectado', 'art. 300 CPC', { chave: 'cpc:300' }), // só oferecido, não projetado
    ev(1, 'projetado', 'art. 485, VI CPC', { chave: 'cpc:485:i6' }),
    ev(5, 'fala', 'a legitimidade é condição da ação'),
    ev(6, 'fala', 'teste digitado', { trecho: 'sim:3' }),
    ev(7, 'projetado', 'art. 485, VI CPC', { chave: 'cpc:485:i6' }),
    ev(8, 'voz', 'voz caiu; reiniciando'),
  ];
  const txt = montarPacote(eventos, indice, (s) => s.toUpperCase());

  test('transcrição com parágrafos e marcas de projeção', () => {
    expect(txt).toMatch(/\[14:00\] hoje vamos falar de sentença terminativa vejam o artigo 485/);
    expect(txt).toMatch(/\[14:01 — projetado: art. 485, VI CPC\]/);
    expect(txt).toMatch(/\[14:05\] a legitimidade é condição da ação/);
  });

  test('só o que foi projetado, com texto integral', () => {
    expect(txt).toContain('— Art. 485 · CPC');
    expect(txt).toContain('Art. 485. O juiz');
    expect(txt).toContain('Projetado: art. 485, VI CPC (às 14:01, 14:07)');
    expect(txt).toContain('  VI – verificar ausência de legitimidade');
    expect(txt).toContain('§ 1º Nas hipóteses');
    expect(txt).not.toContain('300');
  });

  test('sem testes, registros técnicos nem instruções', () => {
    expect(txt).not.toContain('teste digitado');
    expect(txt).not.toContain('voz caiu');
    expect(txt).not.toMatch(/DETECTADO|resuma|elabore/i);
  });

  test('sessão vazia', () => {
    const vazio = montarPacote([], indice, (s) => s);
    expect(vazio).toContain('(nenhuma fala registrada nesta sessão)');
    expect(vazio).toContain('(nenhum dispositivo foi projetado nesta sessão)');
  });
});
