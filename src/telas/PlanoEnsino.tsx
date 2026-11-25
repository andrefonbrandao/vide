// Plano de ensino da turma: a parte que se repete (ementa, competências, conteúdo, avaliação,
// bibliografia) fica na disciplina; o horário, o semestre e a data vêm desta turma. Baixa em Word e
// PDF no modelo da instituição.
import { useEffect, useRef, useState } from 'react';
import { avisar, confirmar } from '../comum/avisos';
import { iso } from '../turmas/planoAula';
import { horarioTexto, lerPlanoEnsinoDocx, planoEnsinoVazio, salvarDataPlanoEnsino, salvarPlanoEnsino } from '../turmas/planoEnsino';
import type { Disciplina, PlanoEnsino, Turma, UnidadeConteudo } from '../turmas/tipos';

async function baixarArquivo(blob: Blob, nome: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
const buscar = (url: string) => fetch(url).then(async (r) => (r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined)).catch(() => undefined);

const trocar = <T,>(l: T[], k: number, d: -1 | 1) => {
  const n = [...l];
  [n[k], n[k + d]] = [n[k + d], n[k]];
  return n;
};

/** Uma lista de textos (competências, habilidades, obras): cada um com subir, descer e tirar. */
function Lista({ itens, mudar, rotulo, linhas = 2, dica }: { itens: string[]; mudar: (l: string[]) => void; rotulo: string; linhas?: number; dica?: string }) {
  return (
    <div className="pe-lista">
      {itens.map((t, k) => (
        <div key={k} className="pe-item">
          <textarea rows={linhas} aria-label={`${rotulo} ${k + 1}`} value={t} placeholder={dica} onChange={(e) => mudar(itens.map((x, i) => (i === k ? e.target.value : x)))} />
          <span className="pe-item-botoes">
            <button type="button" className="botao pequeno" disabled={k === 0} onClick={() => mudar(trocar(itens, k, -1))} aria-label="Subir">
              ↑
            </button>
            <button type="button" className="botao pequeno" disabled={k === itens.length - 1} onClick={() => mudar(trocar(itens, k, 1))} aria-label="Descer">
              ↓
            </button>
            <button type="button" className="ori-link" disabled={itens.length <= 1} onClick={() => mudar(itens.filter((_, i) => i !== k))}>
              tirar
            </button>
          </span>
        </div>
      ))}
      <button type="button" className="ori-link" onClick={() => mudar([...itens, ''])}>
        + {rotulo.toLowerCase()}
      </button>
    </div>
  );
}

function planoInicial(d: Disciplina): PlanoEnsino {
  if (d.planoEnsino) return d.planoEnsino;
  // Primeira vez: aproveita o professor e a carga horária do plano de aula.
  const p = planoEnsinoVazio(d.planoAula?.professor ?? '');
  p.cargaHoraria = (d.planoAula?.cargaHoraria ?? '').replace(/\s*h(oras)?\s*$/i, '');
  return p;
}

export function PlanoEnsinoJanela({ disciplina, turma, aoFechar }: { disciplina: Disciplina; turma: Turma; aoFechar: () => void }) {
  const [plano, setPlano] = useState<PlanoEnsino>(() => planoInicial(disciplina));
  const [data, setData] = useState(() => turma.dataPlanoEnsino ?? iso(new Date()));
  const [ocupado, setOcupado] = useState('');
  const tPlano = useRef<number | null>(null);
  const discRef = useRef(disciplina);
  const turmaRef = useRef(turma);

  // Guarda sozinho, um instante depois de cada mudança.
  const mudar = (p: PlanoEnsino) => {
    setPlano(p);
    if (tPlano.current) window.clearTimeout(tPlano.current);
    tPlano.current = window.setTimeout(() => void salvarPlanoEnsino(discRef.current, p).then((d) => (discRef.current = d)), 600);
  };
  const mudarData = (d: string) => {
    setData(d);
    void salvarDataPlanoEnsino(turmaRef.current, d).then((t) => (turmaRef.current = t));
  };
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.modal-fundo') && aoFechar();
    window.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = antes;
    };
  }, [aoFechar]);

  const horario = horarioTexto(turma);
  const mudarUnidade = (k: number, u: Partial<UnidadeConteudo>) => mudar({ ...plano, conteudo: plano.conteudo.map((x, i) => (i === k ? { ...x, ...u } : x)) });
  const mudarGrau = (g: 'A' | 'B' | 'C', c: Partial<PlanoEnsino['graus']['A']>) => mudar({ ...plano, graus: { ...plano.graus, [g]: { ...plano.graus[g], ...c } } });

  const baixar = async (ext: 'docx' | 'pdf') => {
    setOcupado(ext);
    try {
      const cabecalho = await buscar('/plano-aula/cabecalho-ensino.png');
      const e = { unidade: disciplina.nome, plano, horario, periodo: turma.periodo, data: data || iso(new Date()), cabecalho };
      const { nomeArquivoPlanoEnsino, gerarPlanoEnsinoDocx } = await import('../turmas/planoEnsinoDocx');
      const nome = nomeArquivoPlanoEnsino(disciplina.sigla || disciplina.nome, turma.periodo, ext);
      if (ext === 'docx') await baixarArquivo(await gerarPlanoEnsinoDocx(e), nome);
      else {
        const { gerarPlanoEnsinoPdf } = await import('../turmas/planoEnsinoPdf');
        await baixarArquivo(await gerarPlanoEnsinoPdf(e), nome);
      }
    } catch (err) {
      avisar(`Não foi possível montar o arquivo: ${(err as Error).message}`, 'erro');
    } finally {
      setOcupado('');
    }
  };
  const importar = async (arq: File | undefined) => {
    if (!arq) return;
    try {
      const r = await lerPlanoEnsinoDocx(new Uint8Array(await arq.arrayBuffer()));
      const p = r.plano;
      if (
        !(await confirmar({
          titulo: 'Usar este plano de ensino?',
          texto: `"${r.unidade || arq.name}": ${p.competencias.filter(Boolean).length} competências, ${p.habilidades.filter(Boolean).length} habilidades, ${p.conteudo.length} unidades de conteúdo e ${p.bibliografiaBasica.filter(Boolean).length + p.bibliografiaComplementar.filter(Boolean).length} obras. Substitui o plano de ensino desta disciplina.`,
          botao: 'Usar',
        }))
      )
        return;
      mudar({ ...p, professor: p.professor || plano.professor, cargaHoraria: p.cargaHoraria || plano.cargaHoraria });
      avisar('Plano de ensino importado. Confira e baixe quando quiser.');
    } catch (err) {
      avisar((err as Error).message, 'erro');
    }
  };

  return (
    <div className="ori-foco pa" role="dialog" aria-label="Plano de ensino">
      <header className="ori-foco-topo">
        <div className="ori-foco-titulo">
          Plano de ensino <span>· {disciplina.nome} · {turma.periodo}</span>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="botao pequeno" title="Lê um plano de ensino em Word no modelo da instituição">
            Importar do Word
            <input type="file" accept=".docx" hidden onChange={(e) => (void importar(e.target.files?.[0]), (e.target.value = ''))} />
          </label>
          <button type="button" className="botao pequeno" disabled={!!ocupado} onClick={() => void baixar('pdf')}>
            {ocupado === 'pdf' ? 'Montando…' : 'Baixar PDF'}
          </button>
          <button type="button" className="botao pequeno escuro" disabled={!!ocupado} onClick={() => void baixar('docx')}>
            {ocupado === 'docx' ? 'Montando…' : 'Baixar Word'}
          </button>
          <button type="button" className="botao pequeno" onClick={aoFechar}>
            Fechar
          </button>
        </span>
      </header>
      <div className="pa-corpo">
        <p className="ajuda pa-nota">
          O plano de ensino vale para todas as turmas de {disciplina.sigla || disciplina.nome}; o horário, o semestre e a data são desta turma ({turma.periodo}). Tudo é salvo sozinho.
        </p>
        <section className="cartao pa-secao">
          <h3>Unidade curricular</h3>
          <div className="pa-grade">
            <div className="campo">
              <label>Unidade curricular</label>
              <input value={disciplina.nome} disabled title="O nome da disciplina (edite em Turmas)" />
            </div>
            <div className="campo">
              <label>Horário</label>
              <input value={horario || '—'} disabled title="Vem dos horários da turma (Turmas › editar)" />
            </div>
            <div className="campo">
              <label>Ano/Semestre</label>
              <input value={turma.periodo} disabled title="O semestre da turma (Turmas › editar)" />
            </div>
            <div className="campo">
              <label htmlFor="pe-ch">Carga horária (h)</label>
              <input id="pe-ch" value={plano.cargaHoraria} onChange={(e) => mudar({ ...plano, cargaHoraria: e.target.value })} placeholder="60" />
            </div>
            <div className="campo">
              <label htmlFor="pe-prof">Professor(a)</label>
              <input id="pe-prof" value={plano.professor} onChange={(e) => mudar({ ...plano, professor: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="pe-coord">Coordenador(a)</label>
              <input id="pe-coord" value={plano.coordenador} onChange={(e) => mudar({ ...plano, coordenador: e.target.value })} />
            </div>
          </div>
        </section>

        <section className="cartao pa-secao">
          <h3>Ementa</h3>
          <textarea rows={4} aria-label="Ementa" value={plano.ementa} onChange={(e) => mudar({ ...plano, ementa: e.target.value })} />
        </section>

        <section className="cartao pa-secao">
          <h3>Competências</h3>
          <Lista rotulo="Competência" itens={plano.competencias} mudar={(l) => mudar({ ...plano, competencias: l })} />
          <h3 style={{ marginTop: 18 }}>Habilidades</h3>
          <Lista rotulo="Habilidade" itens={plano.habilidades} mudar={(l) => mudar({ ...plano, habilidades: l })} />
        </section>

        <section className="cartao pa-secao">
          <h3>Conteúdo programático</h3>
          <p className="ajuda" style={{ marginTop: 0 }}>
            A numeração (1., 1.1, 1.2…) sai sozinha no arquivo.
          </p>
          <ol className="pe-unidades">
            {plano.conteudo.map((u, k) => (
              <li key={k} className="pa-aula">
                <div className="pa-aula-cab">
                  <strong>{k + 1}.</strong>
                  <input className="pe-titulo" aria-label={`Unidade ${k + 1}`} placeholder="Nome da unidade (ex.: Etapa postulatória)" value={u.titulo} onChange={(e) => mudarUnidade(k, { titulo: e.target.value })} />
                  <button type="button" className="botao pequeno" disabled={k === 0} onClick={() => mudar({ ...plano, conteudo: trocar(plano.conteudo, k, -1) })} aria-label="Subir unidade">
                    ↑
                  </button>
                  <button type="button" className="botao pequeno" disabled={k === plano.conteudo.length - 1} onClick={() => mudar({ ...plano, conteudo: trocar(plano.conteudo, k, 1) })} aria-label="Descer unidade">
                    ↓
                  </button>
                  <button type="button" className="botao pequeno" disabled={plano.conteudo.length <= 1} onClick={() => mudar({ ...plano, conteudo: plano.conteudo.filter((_, i) => i !== k) })}>
                    Remover
                  </button>
                </div>
                <Lista rotulo="Item" linhas={1} itens={u.itens} mudar={(l) => mudarUnidade(k, { itens: l })} />
              </li>
            ))}
          </ol>
          <button type="button" className="botao" onClick={() => mudar({ ...plano, conteudo: [...plano.conteudo, { titulo: '', itens: [''] }] })}>
            + Adicionar unidade
          </button>
        </section>

        <section className="cartao pa-secao">
          <h3>Estratégias de avaliação</h3>
          <textarea rows={3} aria-label="Estratégias de avaliação" value={plano.estrategias} onChange={(e) => mudar({ ...plano, estrategias: e.target.value })} />
          <table className="pa-tabela" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ width: 70 }} />
                <th>Instrumento avaliativo</th>
                <th style={{ width: 130 }}>Peso</th>
              </tr>
            </thead>
            <tbody>
              {(['A', 'B', 'C'] as const).map((g) => (
                <tr key={g}>
                  <td>
                    <strong>Grau {g}</strong>
                  </td>
                  <td>
                    <textarea rows={3} aria-label={`Instrumento avaliativo do Grau ${g}`} value={plano.graus[g].descricao} onChange={(e) => mudarGrau(g, { descricao: e.target.value })} />
                  </td>
                  <td>
                    <input aria-label={`Peso do Grau ${g}`} value={plano.graus[g].peso} onChange={(e) => mudarGrau(g, { peso: e.target.value })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ajuda">As regras de aprovação da instituição (médias, Grau C, frequência de 75%) entram sozinhas no arquivo, logo abaixo deste quadro.</p>
        </section>

        <section className="cartao pa-secao">
          <h3>Ações para a melhoria da aprendizagem</h3>
          <div className="pa-grade">
            <div className="campo">
              <label htmlFor="pe-rd">Descrição</label>
              <textarea id="pe-rd" rows={3} value={plano.recuperacao.descricao} onChange={(e) => mudar({ ...plano, recuperacao: { ...plano.recuperacao, descricao: e.target.value } })} />
            </div>
            <div className="campo">
              <label htmlFor="pe-re">Estratégias / atividades propostas</label>
              <textarea id="pe-re" rows={3} value={plano.recuperacao.estrategias} onChange={(e) => mudar({ ...plano, recuperacao: { ...plano.recuperacao, estrategias: e.target.value } })} />
            </div>
          </div>
        </section>

        <section className="cartao pa-secao">
          <h3>Bibliografia básica</h3>
          <p className="ajuda" style={{ marginTop: 0 }}>
            Uma obra por quadro. O que ficar entre ** sai em <strong>negrito</strong> (ex.: SOBRENOME, Nome. **Título.** Editora, 2026).
          </p>
          <Lista rotulo="Obra" itens={plano.bibliografiaBasica} mudar={(l) => mudar({ ...plano, bibliografiaBasica: l })} />
          <h3 style={{ marginTop: 18 }}>Bibliografia complementar</h3>
          <Lista rotulo="Obra" itens={plano.bibliografiaComplementar} mudar={(l) => mudar({ ...plano, bibliografiaComplementar: l })} />
        </section>

        <section className="cartao pa-secao">
          <h3>Local e data</h3>
          <div className="pa-grade">
            <div className="campo">
              <label htmlFor="pe-cid">Cidade</label>
              <input id="pe-cid" value={plano.cidade} onChange={(e) => mudar({ ...plano, cidade: e.target.value })} />
            </div>
            <div className="campo">
              <label htmlFor="pe-data">Data (desta turma)</label>
              <input id="pe-data" type="date" value={data} onChange={(e) => mudarData(e.target.value)} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
