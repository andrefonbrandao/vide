import { describe, expect, test } from 'vitest';
import { analisarColagem, dataDeEmail } from './colar';
import { lerEncaminhamentos, lerRespostaIA, pedidoRegistroIA } from './ia';
import { cronogramaModelo, diasEntre, etapaAtual, pendencias, rotuloDias, situacaoEtapa } from './prazos';
import type { Interacao } from './tipos';

describe('prazos', () => {
  test('dias corridos e rótulos', () => {
    expect(diasEntre('2026-11-20', '2026-11-30')).toBe(10);
    expect(diasEntre('2026-11-30', '2026-11-28')).toBe(-2);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
    expect(rotuloDias(7)).toBe('faltam 7 dias');
    expect(rotuloDias(1)).toBe('falta 1 dia');
    expect(rotuloDias(0)).toBe('vence hoje');
    expect(rotuloDias(-3)).toBe('venceu há 3 dias');
  });
  test('situação das etapas', () => {
    const e = { id: 'a', nome: 'Cap. 2', prazo: '2026-11-30', concluida_em: null };
    expect(situacaoEtapa(e, '2026-11-20')).toEqual({ tipo: 'futura', dias: 10 });
    expect(situacaoEtapa(e, '2026-11-25').tipo).toBe('proxima');
    expect(situacaoEtapa(e, '2026-12-02').tipo).toBe('atrasada');
    expect(situacaoEtapa({ ...e, concluida_em: '2026-11-29' }, '2026-12-02').tipo).toBe('concluida');
  });
  test('cronograma modelo termina na defesa', () => {
    const c = cronogramaModelo('TCC', '2026-08-01', '2026-12-10');
    expect(c.map((e) => e.nome)).toEqual(['Definição do tema', 'Entrega do pré-projeto (Grau A)', 'Entrega do Capítulo 1 (Grau B)', 'Revisão do Capítulo 1', 'Entrega do Capítulo 2 (Grau A)', 'Revisão do Capítulo 2', 'Trabalho completo', 'Revisão final', 'Depósito da versão impressa', 'Defesa']);
    expect(c[c.length - 1]).toMatchObject({ nome: 'Defesa', prazo: '2026-12-10' });
    expect(c.every((e, i) => i === 0 || e.prazo >= c[i - 1].prazo)).toBe(true);
    expect(etapaAtual({ etapas: [{ ...c[1] }, { ...c[0], concluida_em: '2026-08-20' }] })?.nome).toBe(c[1].nome);
    const sem = cronogramaModelo('Artigo', '2026-01-01');
    expect(sem[0].prazo).toBe('2026-01-31');
  });
  test('pendências de todas as interações', () => {
    const base = { usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null, trabalhoId: 't', canal: 'sessao' as const, resumo: '', texto: '' };
    const i1: Interacao = { ...base, id: '1', em: '2026-10-01T10:00', encaminhamentos: [{ id: 'a', tipo: 'comando', texto: 'Ler Didier', situacao: 'pendente' }, { id: 'b', tipo: 'sugestao', texto: 'x', situacao: 'cumprido' }] };
    const i2: Interacao = { ...base, id: '2', em: '2026-11-01T10:00', encaminhamentos: [{ id: 'c', tipo: 'sugestao', texto: 'Trocar o título', situacao: 'pendente' }] };
    expect(pendencias([i2, i1]).map((p) => p.enc.id)).toEqual(['a', 'c']);
  });
});

describe('colar conversa', () => {
  test('WhatsApp Web', () => {
    const c = analisarColagem('[14:03, 12/11/2026] Ana Souza: Professor, mandei o capítulo 2\ncom as correções\n[14:10, 12/11/2026] André: Recebi, leio até sexta');
    expect(c.canal).toBe('whatsapp');
    expect(c.em).toBe('2026-11-12T14:03');
    expect(c.participantes).toEqual(['Ana Souza', 'André']);
    expect(c.mensagens[0].texto).toBe('Professor, mandei o capítulo 2\ncom as correções');
  });
  test('WhatsApp exportado (Android e iPhone)', () => {
    expect(analisarColagem('12/11/2026 09:05 - Ana: bom dia').em).toBe('2026-11-12T09:05');
    expect(analisarColagem('[12/11/26, 9:05:33] Ana: bom dia').em).toBe('2026-11-12T09:05');
  });
  test('e-mail copiado', () => {
    const c = analisarColagem('De: Ana Souza <ana@exemplo.com>\nData: 12 de nov. de 2026 14:03\nAssunto: Capítulo 2 revisado\nPara: André\n\nProfessor, segue o capítulo.');
    expect(c).toMatchObject({ canal: 'email', em: '2026-11-12T14:03', assunto: 'Capítulo 2 revisado', resumo: 'Capítulo 2 revisado' });
    expect(c.participantes).toContain('Ana Souza');
  });
  test('datas de e-mail', () => {
    expect(dataDeEmail('qua., 12 de novembro de 2026 às 14:03')).toBe('2026-11-12T14:03');
    expect(dataDeEmail('Nov 12, 2026, 2:03 PM')).toBe('2026-11-12T14:03');
    expect(dataDeEmail('12/11/2026')).toBe('2026-11-12T00:00');
  });
  test('texto qualquer', () => {
    expect(analisarColagem('Conversamos sobre o recorte do tema.')).toMatchObject({ canal: null, resumo: 'Conversamos sobre o recorte do tema.' });
  });
});


describe('pedido e resposta da IA', () => {
  test('o pedido leva a transcrição, o cronograma e as pendências numeradas', () => {
    const base = { usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null };
    const trabalho = { ...base, id: 't', orientandoId: 'o', titulo: 'Precedentes', tipo: 'TCC' as const, inicio: '2026-08-01', situacao: 'andamento' as const, etapas: [{ id: 'e', nome: 'Capítulo 2', prazo: '2026-11-30', concluida_em: null }] };
    const antiga: Interacao = { ...base, id: 'a', trabalhoId: 't', canal: 'sessao', em: '2026-11-01T10:00', resumo: '', texto: '', encaminhamentos: [{ id: 'x', tipo: 'comando', texto: 'Ler Marinoni', situacao: 'pendente' }] };
    const atual: Interacao = { ...base, id: 'b', trabalhoId: 't', canal: 'sessao', em: '2026-11-19T14:00', modo: 'online', resumo: '', texto: '', encaminhamentos: [], transcricao: '[14:01] reescreva a introdução até sexta' };
    const p = pedidoRegistroIA({ trabalho, interacao: atual, anteriores: pendencias([antiga]), hoje: '2026-11-19' });
    expect(p).toContain('[14:01] reescreva a introdução até sexta');
    expect(p).toContain('Capítulo 2: prazo 30/11/2026 (faltam 11 dias)');
    expect(p).toContain('1. [comando] Ler Marinoni');
    expect(p).toContain('SESSÃO: 19/11/2026 14:00 (online)');
  });
  test('lê a resposta', () => {
    const r = lerRespostaIA(`**RESUMO:**
A sessão tratou do recorte do tema.
O capítulo 1 está descritivo.

## SUGESTÕES E COMANDOS:
- [comando] Reescrever a introdução com o problema de pesquisa | até 21/11/2026
- [sugestão] Ler o capítulo de Taruffo sobre precedentes.
- Comando: Enviar o sumário revisado (prazo: 28/11/2026)

PENDÊNCIAS ANTERIORES CUMPRIDAS:
- 1
- 3`);
    expect(r.resumo).toBe('A sessão tratou do recorte do tema.\nO capítulo 1 está descritivo.');
    expect(r.encaminhamentos).toEqual([
      { tipo: 'comando', texto: 'Reescrever a introdução com o problema de pesquisa', prazo: '2026-11-21' },
      { tipo: 'sugestao', texto: 'Ler o capítulo de Taruffo sobre precedentes', prazo: undefined },
      { tipo: 'comando', texto: 'Enviar o sumário revisado', prazo: '2026-11-28' },
    ]);
    expect(r.cumpridas).toEqual([1, 3]);
    expect(lerRespostaIA('RESUMO: curto\nPENDÊNCIAS ANTERIORES CUMPRIDAS: nenhuma').cumpridas).toEqual([]);
  });
});

describe('sugestões e comandos colados em bloco', () => {
  test('marcados pela IA', () => {
    const r = lerEncaminhamentos(`Aqui estão as tarefas:
- [comando] Reescrever a introdução | até 21/11/2026
- [sugestão] Ler Taruffo.
- Comando: Enviar o sumário (prazo: 28/11/2026)
- Sugestão – Trocar o título`);
    expect(r.itens).toEqual([
      { tipo: 'comando', texto: 'Reescrever a introdução', prazo: '2026-11-21' },
      { tipo: 'sugestao', texto: 'Ler Taruffo', prazo: undefined },
      { tipo: 'comando', texto: 'Enviar o sumário', prazo: '2026-11-28' },
      { tipo: 'sugestao', texto: 'Trocar o título', prazo: undefined },
    ]);
  });
  test('por seções "Comandos" e "Sugestões"', () => {
    const r = lerEncaminhamentos(`## COMANDOS:
1. Revisar as citações
2. Mandar o capítulo 2 até 05/12/2026

**Sugestões:**
- Ler Marinoni
- Ver o REsp 1.234`);
    expect(r.itens.map((x) => [x.tipo, x.texto])).toEqual([
      ['comando', 'Revisar as citações'],
      ['comando', 'Mandar o capítulo 2 até 05/12/2026'],
      ['sugestao', 'Ler Marinoni'],
      ['sugestao', 'Ver o REsp 1.234'],
    ]);
  });
  test('sem marcação vale o tipo escolhido; resumo e cumpridas ficam de fora', () => {
    expect(lerEncaminhamentos('Reler o projeto\nMarcar nova reunião', 'comando').itens.map((x) => x.tipo)).toEqual(['comando', 'comando']);
    const r = lerEncaminhamentos('RESUMO:\nFoi bom.\n\nSUGESTÕES E COMANDOS:\n- [comando] Fazer X\n\nPENDÊNCIAS ANTERIORES CUMPRIDAS:\n- 1');
    expect(r).toEqual({ comResumo: true, itens: [{ tipo: 'comando', texto: 'Fazer X', prazo: undefined }] });
  });
});

describe('pendências vencidas (alerta)', () => {
  test('só as pendentes com prazo passado, de trabalhos em andamento', async () => {
    const { pendenciasVencidas } = await import('./alertas');
    const base = { usuario_id: null, criado_em: '', atualizado_em: '', excluido_em: null, canal: 'sessao' as const, em: '2026-11-01T10:00', resumo: '', texto: '' };
    const i1: Interacao = { ...base, id: '1', trabalhoId: 'a', encaminhamentos: [
      { id: 'x', tipo: 'comando', texto: 'vencida', situacao: 'pendente', prazo: '2026-11-19' },
      { id: 'y', tipo: 'comando', texto: 'vence hoje', situacao: 'pendente', prazo: '2026-11-20' },
      { id: 'z', tipo: 'comando', texto: 'já cumprida', situacao: 'cumprido', prazo: '2026-11-01' },
      { id: 'w', tipo: 'sugestao', texto: 'sem prazo', situacao: 'pendente' },
    ] };
    const i2: Interacao = { ...base, id: '2', trabalhoId: 'b', encaminhamentos: [{ id: 'k', tipo: 'comando', texto: 'de trabalho concluído', situacao: 'pendente', prazo: '2026-10-01' }] };
    const trabalhos = [{ id: 'a', situacao: 'andamento' as const, excluido_em: null }, { id: 'b', situacao: 'concluido' as const, excluido_em: null }];
    expect(pendenciasVencidas([i1, i2], trabalhos, '2026-11-20').map((p) => p.texto)).toEqual(['vencida']);
  });
});
