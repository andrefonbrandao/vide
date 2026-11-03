// Publica um grupo de questões num link de treino (Cloudflare) e guarda o link localmente.
import { resolver } from '../comum/legislacao';
import { carregarIndice } from '../dados/db';
import { db } from '../dados/db';
import { diplomaPrincipal, todosDiplomas } from '../dados/diplomas';
import { agoraISO, novoId } from '../dados/modelo';
import type { Questao } from '../jogo/tipos';
import { gerarToken } from '../jogo/protocolo';
import type { Referencia } from '../voz/detector';
import { lerDigitado } from '../voz/digitado';
import type { DadosTreino, LinkTreino, QuestaoTreino } from './tipos';

/** Leva junto o texto do artigo do fundamento (tirado do acervo deste computador). */
export async function prepararQuestoes(questoes: Questao[]): Promise<QuestaoTreino[]> {
  const indice = await carregarIndice();
  return questoes.map((q) => {
    const { tipo, enunciado, alternativas, correta, tempo, explicacao, fundamento, dicas, aceitas } = q;
    let artigo: QuestaoTreino['artigo'] = null;
    if (fundamento.trim()) {
      const lido = lerDigitado(fundamento, todosDiplomas(), diplomaPrincipal());
      if (lido.ok) {
        const ref: Referencia = { ...lido.ref, explicito: true, contexto: false, inicio: 0, fim: 0, trecho: fundamento };
        const res = resolver(ref, indice, 'treino');
        if (res) artigo = { titulo: res.titulo, blocos: res.projetavel.blocos.map((b) => ({ rotulo: b.rotulo, texto: b.texto, nivel: b.nivel, destaque: b.destaque })) };
      }
    }
    return { tipo, enunciado, alternativas, correta, tempo, explicacao, fundamento, dicas, aceitas, artigo };
  });
}

export async function criarLinkTreino(opcoes: {
  titulo: string;
  questoes: Questao[];
  modo: DadosTreino['modo'];
  quantas: number;
  mostrar: DadosTreino['mostrar'];
  origem: string;
}): Promise<LinkTreino> {
  const chave = gerarToken();
  const dados: DadosTreino = {
    formato: 'vide-treino@1',
    titulo: opcoes.titulo.trim() || 'Treino',
    criado_em: agoraISO(),
    modo: opcoes.modo,
    quantas: opcoes.modo === 'sorteio' ? Math.max(1, Math.min(opcoes.quantas, opcoes.questoes.length)) : opcoes.questoes.length,
    mostrar: opcoes.mostrar,
    questoes: await prepararQuestoes(opcoes.questoes),
  };
  const r = await fetch('/api/treino', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Vide-Chave': chave },
    body: JSON.stringify(dados),
  });
  if (!r.ok) throw new Error(r.status === 413 ? 'Grupo de questões grande demais para um link.' : `Não foi possível criar o link (${r.status}). Confira a internet.`);
  const { id } = (await r.json()) as { id: string };
  const agora = agoraISO();
  const link: LinkTreino = {
    id: novoId(),
    usuario_id: null,
    criado_em: agora,
    atualizado_em: agora,
    excluido_em: null,
    codigo: id,
    chave,
    titulo: dados.titulo,
    modo: dados.modo,
    quantas: dados.quantas,
    mostrar: dados.mostrar,
    total: dados.questoes.length,
    origem: opcoes.origem,
  };
  await db.treinos.put(link);
  window.dispatchEvent(new Event('vide-questoes-mudou'));
  return link;
}

export async function listarLinksTreino(): Promise<LinkTreino[]> {
  const todos = await db.treinos.toArray();
  return todos.filter((l) => !l.excluido_em).sort((a, b) => b.criado_em.localeCompare(a.criado_em));
}

/** Tira o link do ar (apaga a cópia no Cloudflare) e o marca como desativado aqui. */
export async function desativarLinkTreino(link: LinkTreino): Promise<void> {
  const r = await fetch(`/api/treino/${link.codigo}`, { method: 'DELETE', headers: { 'X-Vide-Chave': link.chave } });
  if (!r.ok && r.status !== 404) throw new Error(`Não foi possível desativar (${r.status}). Confira a internet.`);
  const agora = agoraISO();
  await db.treinos.put({ ...link, excluido_em: agora, atualizado_em: agora });
  window.dispatchEvent(new Event('vide-questoes-mudou'));
}
