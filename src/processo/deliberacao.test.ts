import { describe, expect, it } from 'vitest';
import { processoEmBranco } from './banco';
import { comEventosDaDeliberacao, comPonto, deliberacaoAberta, mudarAberta, pedidoProximoAtoIA, pontoDaVotacao } from './deliberacao';
import { dadosParaPublicar } from './publicar';
import type { Evento } from './tipos';

const ev = (id: string, descricao: string): Evento => ({ id, data: '2027-03-10T10:00', descricao, usuario: 'ADVOGADO DO RÉU', documentos: [], liberacao: { modo: 'agora' } });

describe('deliberação da turma', () => {
  it('anota pontos sem repetir e fecha com os eventos colados', () => {
    let p = processoEmBranco('t');
    p = mudarAberta(p, (d) => ({ ...d, proximoAto: 'CONTESTAÇÃO' }));
    p = comPonto(p, 'A inicial não tem valor da causa');
    p = comPonto(p, 'A inicial não tem valor da causa');
    p = comPonto(p, pontoDaVotacao('Contestar ou fazer acordo?', ['Contestar', 'Acordo'], [10, 3]), 'votacao');
    expect(deliberacaoAberta(p)?.pontos.map((x) => x.texto)).toEqual(['A inicial não tem valor da causa', 'Votação "Contestar ou fazer acordo?" (13 votos) — Contestar: 10; Acordo: 3.']);
    expect(pedidoProximoAtoIA(p, deliberacaoAberta(p)!)).toContain('PRÓXIMO ATO: CONTESTAÇÃO');
    p = comEventosDaDeliberacao(p, [ev('e1', 'CONTESTAÇÃO')]);
    expect(deliberacaoAberta(p)).toBeUndefined();
    expect(p.deliberacoes?.[0].eventos).toEqual(['e1']);
    // A turma vê os pontos junto do ato que nasceu deles.
    const d = dadosParaPublicar(p);
    expect(d.eventos[0].deliberacao).toEqual(['A inicial não tem valor da causa', 'Votação "Contestar ou fazer acordo?" (13 votos) — Contestar: 10; Acordo: 3.']);
    // Próximo ponto abre uma deliberação nova.
    p = comPonto(p, 'Réplica: rebater a preliminar');
    expect(p.deliberacoes).toHaveLength(2);
  });
});
