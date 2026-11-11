// Busca geral (Ctrl K): artigos das leis, materiais, questões, questionários, casos e processos.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { chaveItemArtigo } from '../comum/legislacao';
import { IcBusca, IcCasos, IcLei, IcPasta, IcPerguntas, IcProcesso } from '../comum/Icones';
import { irPara } from '../comum/navegacao';
import { listarCasos } from '../consulta/banco';
import type { Caso } from '../consulta/tipos';
import { carregarIndice } from '../dados/db';
import { diplomaPrincipal, todosDiplomas } from '../dados/diplomas';
import type { Item, Material } from '../dados/modelo';
import { listarQuestionarios, listarQuestoes } from '../jogo/banco';
import type { Questao, Questionario } from '../jogo/tipos';
import { listarMateriais } from '../material/documento';
import { listarProcessos } from '../processo/banco';
import type { Processo } from '../processo/tipos';
import { lerDigitado } from '../voz/digitado';

interface Fonte {
  itens: Map<string, Item>;
  materiais: Material[];
  questoes: Questao[];
  questionarios: Questionario[];
  casos: Caso[];
  processos: Processo[];
}

interface Resultado {
  grupo: 'Leis' | 'Materiais' | 'Questões' | 'Casos' | 'Processos';
  titulo: string;
  detalhe: string;
  dica?: string;
  ir: () => void;
}

const ICONES: Record<Resultado['grupo'], ReactNode> = {
  Leis: <IcLei tamanho={14} />,
  Materiais: <IcPasta tamanho={14} />,
  Questões: <IcPerguntas tamanho={14} />,
  Casos: <IcCasos tamanho={14} />,
  Processos: <IcProcesso tamanho={14} />,
};

function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function guardar(chave: string, valor: string) {
  try {
    sessionStorage.setItem(chave, valor);
  } catch {
    /* ignore */
  }
}

/** Leva um artigo para as alternativas da aula (não projeta sozinho). */
function levarParaAula(digitado: string) {
  irPara('aula');
  window.setTimeout(() => window.dispatchEvent(new CustomEvent('vide-levar-artigo', { detail: digitado })), 50);
}

function buscar(f: Fonte, q: string): Resultado[] {
  const t = q.trim();
  if (!t) return [];
  const termos = norm(t).split(/\s+/).filter(Boolean);
  const tem = (texto: string) => {
    const n = norm(texto);
    return termos.every((x) => n.includes(x));
  };
  const saida: Resultado[] = [];
  const resumo = (i: Item) => i.conteudo.caput.texto.slice(0, 110) + (i.conteudo.caput.texto.length > 110 ? '…' : '');
  // Artigo digitado ("489", "5 CF", "art 1015").
  const lido = lerDigitado(t.replace(/^art(igo)?\.?\s*/i, ''), todosDiplomas(), diplomaPrincipal());
  const vistos = new Set<string>();
  if (lido.ok) {
    const it = f.itens.get(chaveItemArtigo(lido.ref.diploma, lido.ref.art, lido.ref.sufixo ?? ''));
    if (it) {
      vistos.add(it.chave);
      saida.push({ grupo: 'Leis', titulo: it.titulo, detalhe: resumo(it), dica: 'levar para a aula', ir: () => levarParaAula(t.replace(/^art(igo)?\.?\s*/i, '')) });
    }
  }
  // Palavras no texto dos artigos.
  if (!/^\d/.test(t) && termos.join('').length >= 3) {
    let n = 0;
    for (const it of f.itens.values()) {
      if (n >= 5) break;
      if (it.tipo !== 'legislacao' || !it.chave.includes(':art:') || vistos.has(it.chave)) continue;
      if (tem(`${it.titulo} ${it.conteudo.caput.texto}`)) {
        n++;
        const dig = it.titulo.replace(/^art\.?\s*/i, '');
        saida.push({ grupo: 'Leis', titulo: it.titulo, detalhe: resumo(it), dica: 'levar para a aula', ir: () => levarParaAula(dig) });
      }
    }
  }
  for (const m of f.materiais) {
    if (tem(`${m.nome} ${m.pasta ?? ''} ${(m.etiquetas ?? []).join(' ')}`))
      saida.push({ grupo: 'Materiais', titulo: m.nome, detalhe: `${m.tipo === 'pdf' ? 'PDF' : 'imagem'}${m.paginas > 1 ? ` · ${m.paginas} páginas` : ''}${m.pasta ? ` · ${m.pasta}` : ''}`, ir: () => irPara('materiais') });
  }
  for (const qz of f.questionarios) {
    if (tem(qz.nome)) saida.push({ grupo: 'Questões', titulo: qz.nome, detalhe: `questionário · ${qz.questoes.length} questões`, ir: () => (guardar('vide.secaoQuestoes', 'questionarios'), irPara('questoes')) });
  }
  for (const q of f.questoes) {
    if (tem(`${q.enunciado} ${q.etiquetas.join(' ')}`))
      saida.push({
        grupo: 'Questões',
        titulo: q.tipo === 'conceito' ? `Conceito: ${q.enunciado}` : q.enunciado,
        detalhe: q.tipo === 'conceito' ? 'Adivinhe o conceito' : q.tipo === 'vf' ? 'verdadeiro ou falso' : 'múltipla escolha',
        ir: () => (guardar('vide.secaoQuestoes', 'banco'), irPara('questoes')),
      });
  }
  for (const c of f.casos) {
    if (tem(`${c.nome} ${c.falas.map((x) => x.texto).join(' ')} ${c.etiquetas.join(' ')}`))
      saida.push({ grupo: 'Casos', titulo: `${c.nome}: “${c.falas[c.falas.length - 1]?.texto ?? ''}”`, detalhe: 'caso', ir: () => (guardar('vide.secaoCasos', 'lista'), irPara('casos')) });
  }
  for (const p of f.processos) {
    const abrir = () => (guardar('vide.processoAberto', p.id), irPara('processos'));
    if (tem(`${p.titulo} ${p.capa.numero} ${p.partes.map((x) => x.nome).join(' ')}`)) saida.push({ grupo: 'Processos', titulo: p.titulo, detalhe: p.capa.numero, ir: abrir });
    else {
      const i = p.eventos.findIndex((e) => tem(`${e.descricao} ${e.documentos.map((d) => `${d.sigla} ${d.titulo}`).join(' ')}`));
      if (i >= 0) saida.push({ grupo: 'Processos', titulo: `${p.titulo} · evento ${i + 1}: ${p.eventos[i].descricao}`, detalhe: p.capa.numero, ir: abrir });
    }
  }
  // No máximo 6 por grupo, na ordem dos grupos.
  const ordem: Resultado['grupo'][] = ['Leis', 'Materiais', 'Questões', 'Casos', 'Processos'];
  return ordem.flatMap((g) => saida.filter((r) => r.grupo === g).slice(0, 6));
}

export function Busca({ aoFechar }: { aoFechar: () => void }) {
  const [q, setQ] = useState('');
  const [fonte, setFonte] = useState<Fonte | null>(null);
  const [sel, setSel] = useState(0);
  const lista = useRef<HTMLDivElement>(null);
  useEffect(() => {
    void Promise.all([carregarIndice(), listarMateriais(), listarQuestoes(), listarQuestionarios(), listarCasos(), listarProcessos()]).then(
      ([itens, materiais, questoes, questionarios, casos, processos]) => setFonte({ itens, materiais, questoes, questionarios, casos, processos }),
    );
  }, []);
  const resultados = useMemo(() => (fonte ? buscar(fonte, q) : []), [fonte, q]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);
  const escolher = (r: Resultado | undefined) => {
    if (!r) return;
    aoFechar();
    r.ir();
  };
  let grupoAnterior = '';
  return (
    <div className="modal-fundo busca-fundo" data-ui onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="busca-janela" role="dialog" aria-label="Buscar">
        <div className="busca-campo">
          <IcBusca tamanho={20} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar artigo (ex.: 489, 5 CF), material, questão, caso, processo…"
            aria-label="Buscar"
            onKeyDown={(e) => {
              if (e.key === 'Escape') aoFechar();
              else if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(resultados.length - 1, s + 1)));
              else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
              else if (e.key === 'Enter') (e.preventDefault(), escolher(resultados[sel]));
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="busca-resultados" ref={lista}>
          {!q.trim() ? (
            <p className="ajuda busca-vazia">Digite um artigo ("489", "5 CF", "1015") ou palavras ("sentença", "citação").</p>
          ) : !fonte ? (
            <p className="ajuda busca-vazia">Carregando…</p>
          ) : !resultados.length ? (
            <p className="ajuda busca-vazia">Nada encontrado para "{q.trim()}".</p>
          ) : (
            resultados.map((r, i) => {
              const cab = r.grupo !== grupoAnterior;
              grupoAnterior = r.grupo;
              return (
                <div key={i}>
                  {cab && (
                    <div className="rotulo-tipo busca-grupo">
                      {ICONES[r.grupo]} {r.grupo}
                    </div>
                  )}
                  <button type="button" data-i={i} className={`busca-item${i === sel ? ' sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => escolher(r)}>
                    <span className="busca-item-texto">
                      <strong>{r.titulo}</strong>
                      <span>{r.detalhe}</span>
                    </span>
                    {r.dica && i === sel && <span className="busca-dica">{r.dica} ↵</span>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
