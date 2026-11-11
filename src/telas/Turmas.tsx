// Minhas turmas: disciplinas (o que se repete todo semestre, com a lei principal) e turmas
// (a disciplina num semestre, com os horários). Também o seletor do "modo da turma",
// o aviso na hora da aula e a faixa do filtro nas listas.
import { useEffect, useState } from 'react';
import { avisar, confirmar } from '../comum/avisos';
import { IcMais } from '../comum/Icones';
import { irPara } from '../comum/navegacao';
import { listarDiplomas } from '../dados/db';
import { abreviacaoDe } from '../dados/diplomas';
import type { Diploma } from '../dados/modelo';
import { entrarNaTurma, excluirDisciplina, excluirTurma, listarDisciplinas, listarTurmas, rotuloTurma, salvarDisciplina, salvarTurma } from '../turmas/banco';
import { definirTurmaAtiva, turmaAtiva } from '../turmas/filtro';
import { useTurmaAtiva } from './FaixaTurma';
import { aulaAgora, proximaAula, rotuloHorario } from '../turmas/horarios';
import { CORES, DIAS, type Disciplina, type Horario, type Turma } from '../turmas/tipos';
import { Figura } from './ConsultaTela';
import { Pagina } from './Pagina';

export function useTurmas(): { disciplinas: Disciplina[]; turmas: Turma[]; carregado: boolean } {
  const [d, setD] = useState<{ disciplinas: Disciplina[]; turmas: Turma[]; carregado: boolean }>({ disciplinas: [], turmas: [], carregado: false });
  useEffect(() => {
    const carregar = () => void Promise.all([listarDisciplinas(), listarTurmas()]).then(([disciplinas, turmas]) => setD({ disciplinas, turmas, carregado: true }));
    carregar();
    window.addEventListener('vide-turmas-mudou', carregar);
    return () => window.removeEventListener('vide-turmas-mudou', carregar);
  }, []);
  return d;
}

// ---------- Formulários ----------

function FormDisciplina({ existente, aoFechar, total = 0 }: { existente?: Disciplina; aoFechar: () => void; total?: number }) {
  const [nome, setNome] = useState(existente?.nome ?? '');
  const [sigla, setSigla] = useState(existente?.sigla ?? '');
  const [cor, setCor] = useState(existente?.cor ?? CORES[total % CORES.length]);
  const [lei, setLei] = useState(existente?.leiPrincipal ?? '');
  const [leis, setLeis] = useState<Diploma[] | null>(null);
  useEffect(() => void listarDiplomas().then(setLeis), []);
  const pode = nome.trim() && lei;
  return (
    <form
      className="cartao form-turma"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!pode) return;
        await salvarDisciplina({ nome: nome.trim(), sigla: sigla.trim() || nome.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 5), cor, leiPrincipal: lei }, existente);
        avisar(existente ? 'Disciplina atualizada' : 'Disciplina criada');
        aoFechar();
      }}
    >
      <h3>{existente ? 'Editar disciplina' : 'Nova disciplina'}</h3>
      <div className="grade-2">
        <div className="campo">
          <label htmlFor="disc-nome">Nome</label>
          <input id="disc-nome" autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex.: Direito Processual Civil I" />
        </div>
        <div className="campo">
          <label htmlFor="disc-sigla">Sigla (curta, para os selos)</label>
          <input id="disc-sigla" value={sigla} maxLength={8} onChange={(e) => setSigla(e.target.value)} placeholder="ex.: PC1" />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="disc-lei">Lei principal (obrigatória)</label>
        {leis === null ? (
          <p className="ajuda">Carregando…</p>
        ) : !leis.length ? (
          <p className="aviso">
            Nenhuma lei importada ainda.{' '}
            <button type="button" className="botao pequeno" onClick={() => irPara('leis', 'nova-lei')}>
              Importar uma lei
            </button>
          </p>
        ) : (
          <select id="disc-lei" className="seletor" value={lei} onChange={(e) => setLei(e.target.value)}>
            <option value="">Escolha a lei principal…</option>
            {leis.map((d) => (
              <option key={d.sigla} value={d.sigla}>
                {abreviacaoDe(d.sigla)}
              </option>
            ))}
          </select>
        )}
        <span className="ajuda" style={{ margin: 0 }}>
          É a lei que vale na aula quando você cita um artigo sem dizer a lei ("artigo 70"). No modo da turma, ela é escolhida sozinha.
        </span>
      </div>
      <div className="campo">
        <label>Cor</label>
        <div className="linha-opcoes">
          {CORES.map((c) => (
            <button key={c} type="button" className={`cor-bolinha${cor === c ? ' atual' : ''}`} style={{ background: c }} onClick={() => setCor(c)} aria-label={`Cor ${c}`} />
          ))}
        </div>
      </div>
      <div className="modal-botoes">
        <button className="botao primario" disabled={!pode}>
          {existente ? 'Salvar' : 'Criar disciplina'}
        </button>
        <button type="button" className="botao" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function semestreAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}.${d.getMonth() < 6 ? 1 : 2}`;
}

function FormTurma({ disciplina, existente, aoFechar }: { disciplina: Disciplina; existente?: Turma; aoFechar: () => void }) {
  const [periodo, setPeriodo] = useState(existente?.periodo ?? semestreAtual());
  const [horarios, setHorarios] = useState<Horario[]>(existente?.horarios ?? [{ dia: 2, inicio: '19:00', fim: '20:40' }]);
  const [inicio, setInicio] = useState(existente?.inicio ?? '');
  const [fim, setFim] = useState(existente?.fim ?? '');
  const mudarH = (i: number, h: Partial<Horario>) => setHorarios(horarios.map((x, j) => (j === i ? { ...x, ...h } : x)));
  return (
    <form
      className="cartao form-turma"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!periodo.trim()) return;
        const t = await salvarTurma({ disciplinaId: disciplina.id, periodo: periodo.trim(), horarios: horarios.filter((h) => h.inicio && h.fim), inicio: inicio || undefined, fim: fim || undefined, arquivada: existente?.arquivada }, existente);
        avisar(existente ? 'Turma atualizada' : 'Turma criada');
        if (turmaAtiva()?.turmaId === t.id) entrarNaTurma(disciplina, t);
        aoFechar();
      }}
    >
      <h3>
        {existente ? 'Editar turma' : 'Nova turma'} de {disciplina.nome}
      </h3>
      <div className="grade-3">
        <div className="campo">
          <label htmlFor="turma-periodo">Período</label>
          <input id="turma-periodo" autoFocus value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="ex.: 2026.2" />
        </div>
        <div className="campo">
          <label htmlFor="turma-inicio">Começo do semestre (opcional)</label>
          <input id="turma-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="turma-fim">Fim do semestre (opcional)</label>
          <input id="turma-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
      </div>
      <div className="campo">
        <label>Dias e horários das aulas</label>
        {horarios.map((h, i) => (
          <div key={i} className="linha-opcoes">
            <select className="seletor" aria-label="Dia da semana" value={h.dia} onChange={(e) => mudarH(i, { dia: Number(e.target.value) })}>
              {DIAS.map((d, k) => (
                <option key={k} value={k}>
                  {d}
                </option>
              ))}
            </select>
            <input type="time" aria-label="Começa" value={h.inicio} onChange={(e) => mudarH(i, { inicio: e.target.value })} />
            <span>às</span>
            <input type="time" aria-label="Termina" value={h.fim} onChange={(e) => mudarH(i, { fim: e.target.value })} />
            <button type="button" className="botao pequeno" onClick={() => setHorarios(horarios.filter((_, j) => j !== i))}>
              Tirar
            </button>
          </div>
        ))}
        <button type="button" className="botao pequeno com-icone" onClick={() => setHorarios([...horarios, { dia: (horarios[horarios.length - 1]?.dia ?? 1) + 2 > 6 ? 1 : (horarios[horarios.length - 1]?.dia ?? 1) + 2, inicio: horarios[0]?.inicio ?? '19:00', fim: horarios[0]?.fim ?? '20:40' }])}>
          <IcMais tamanho={14} /> Outro horário
        </button>
        <span className="ajuda" style={{ margin: 0 }}>
          Quando você abrir o Vide no horário de uma aula (de 15 minutos antes até o fim), ele sugere entrar no modo desta turma.
        </span>
      </div>
      <div className="modal-botoes">
        <button className="botao primario" disabled={!periodo.trim()}>
          {existente ? 'Salvar' : 'Criar turma'}
        </button>
        <button type="button" className="botao" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ---------- Página ----------

export function MinhasTurmas() {
  const { disciplinas, turmas, carregado } = useTurmas();
  const { ativa } = useTurmaAtiva();
  const [editando, setEditando] = useState<{ tipo: 'disciplina'; d?: Disciplina } | { tipo: 'turma'; d: Disciplina; t?: Turma } | null>(null);
  const [verArquivadas, setVerArquivadas] = useState(false);
  const prox = proximaAula(turmas, new Date());
  return (
    <Pagina
      caminho="Turma"
      titulo="Minhas turmas"
      descricao="Disciplinas (com a lei principal e o conteúdo que se repete todo semestre) e turmas (a disciplina num semestre, com os horários)."
      acoes={
        <button className="botao escuro com-icone" onClick={() => setEditando({ tipo: 'disciplina' })}>
          <IcMais /> Nova disciplina
        </button>
      }
    >
      {editando?.tipo === 'disciplina' && <FormDisciplina existente={editando.d} total={disciplinas.length} aoFechar={() => setEditando(null)} />}
      {editando?.tipo === 'turma' && <FormTurma disciplina={editando.d} existente={editando.t} aoFechar={() => setEditando(null)} />}
      {prox && (
        <p className="turmas-proxima">
          Próxima aula: <strong>{rotuloTurma(disciplinas.find((d) => d.id === prox.turma.disciplinaId), prox.turma)}</strong>,{' '}
          {prox.comeca.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} às {prox.horario.inicio}
        </p>
      )}
      {carregado && !disciplinas.length && !editando ? (
        <div className="vazio-guia">
          <Figura id="juiz-h" expressao="feliz" className="vazio-guia-figura" />
          <div>
            <h2>Nenhuma disciplina ainda</h2>
            <p className="ajuda">Cadastre a disciplina (ex.: Direito Processual Civil I, com o CPC como lei principal) e depois a turma do semestre, com os dias e horários das aulas.</p>
            <button className="botao escuro" onClick={() => setEditando({ tipo: 'disciplina' })}>
              Nova disciplina
            </button>
          </div>
        </div>
      ) : (
        <div className="lista-disciplinas">
          {disciplinas.map((d) => {
            const dela = turmas.filter((t) => t.disciplinaId === d.id && (verArquivadas || !t.arquivada));
            return (
              <section key={d.id} className="cartao disciplina" style={{ ['--cor' as string]: d.cor }}>
                <div className="disciplina-cab">
                  <span className="selo-disciplina">{d.sigla}</span>
                  <div className="disciplina-titulo">
                    <h2>{d.nome}</h2>
                    <span className="ajuda" style={{ margin: 0 }}>
                      Lei principal: {abreviacaoDe(d.leiPrincipal)}
                    </span>
                  </div>
                  <button className="link-discreto" onClick={() => setEditando({ tipo: 'disciplina', d })}>
                    editar
                  </button>
                  <button
                    className="link-discreto"
                    onClick={async () => {
                      if (!(await confirmar({ titulo: `Apagar a disciplina "${d.nome}"?`, texto: 'As turmas dela também saem. Os materiais, questões e casos continuam no Vide (ficam sem disciplina).', botao: 'Apagar', perigo: true }))) return;
                      await excluirDisciplina(d);
                      avisar('Disciplina apagada');
                    }}
                  >
                    apagar
                  </button>
                </div>
                <ul className="lista-turmas">
                  {dela.map((t) => {
                    const ehAtiva = ativa?.turmaId === t.id;
                    return (
                      <li key={t.id} className={`turma${ehAtiva ? ' ativa' : ''}${t.arquivada ? ' arquivada' : ''}`}>
                        <div className="turma-texto">
                          <strong>{t.periodo}</strong>
                          <span className="ajuda" style={{ margin: 0 }}>
                            {t.horarios.length ? t.horarios.map(rotuloHorario).join(' · ') : 'sem horários'}
                            {t.arquivada ? ' · arquivada' : ''}
                          </span>
                        </div>
                        {ehAtiva ? (
                          <button className="botao pequeno" onClick={() => definirTurmaAtiva(null)}>
                            Sair do modo da turma
                          </button>
                        ) : (
                          !t.arquivada && (
                            <button className="botao pequeno escuro" onClick={() => (entrarNaTurma(d, t), avisar(`Modo da turma: ${rotuloTurma(d, t)}`))}>
                              Entrar no modo da turma
                            </button>
                          )
                        )}
                        <button className="link-discreto" onClick={() => setEditando({ tipo: 'turma', d, t })}>
                          editar
                        </button>
                        <button className="link-discreto" onClick={() => void salvarTurma({ ...t, arquivada: !t.arquivada }, t).then(() => t.arquivada || (ativa?.turmaId === t.id && definirTurmaAtiva(null)))}>
                          {t.arquivada ? 'desarquivar' : 'arquivar'}
                        </button>
                        <button
                          className="link-discreto"
                          onClick={async () => {
                            if (!(await confirmar({ titulo: `Apagar a turma ${t.periodo}?`, texto: 'O processo, os links e os resultados dela continuam no Vide (ficam sem turma).', botao: 'Apagar', perigo: true }))) return;
                            await excluirTurma(t);
                          }}
                        >
                          apagar
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button className="botao pequeno com-icone" onClick={() => setEditando({ tipo: 'turma', d })}>
                  <IcMais tamanho={14} /> Nova turma
                </button>
              </section>
            );
          })}
          {turmas.some((t) => t.arquivada) && (
            <button className="link-discreto" onClick={() => setVerArquivadas(!verArquivadas)}>
              {verArquivadas ? 'esconder as turmas arquivadas' : 'mostrar as turmas arquivadas'}
            </button>
          )}
        </div>
      )}
    </Pagina>
  );
}

// ---------- Seletor (barra lateral) ----------

export function SeletorTurma({ recolhido = false }: { recolhido?: boolean }) {
  const { disciplinas, turmas } = useTurmas();
  const { ativa } = useTurmaAtiva();
  const ativas = turmas.filter((t) => !t.arquivada);
  if (!disciplinas.length) return null;
  if (recolhido)
    return (
      <button className="seletor-turma-mini" title={ativa ? `Modo da turma: ${ativa.rotulo}` : 'Todas as turmas'} onClick={() => irPara('turmas')} style={{ ['--cor' as string]: ativa?.cor ?? 'var(--linha)' }}>
        {ativa ? ativa.rotulo.split(' · ')[0] : '·'}
      </button>
    );
  return (
    <div className="seletor-turma" style={{ ['--cor' as string]: ativa?.cor ?? 'var(--linha)' }}>
      <label htmlFor="seletor-turma">Turma</label>
      <select
        id="seletor-turma"
        value={ativa?.turmaId ?? ''}
        onChange={(e) => {
          const t = ativas.find((x) => x.id === e.target.value);
          const d = t && disciplinas.find((x) => x.id === t.disciplinaId);
          if (t && d) entrarNaTurma(d, t);
          else definirTurmaAtiva(null);
        }}
      >
        <option value="">Todas as turmas</option>
        {disciplinas.map((d) => {
          const dela = ativas.filter((t) => t.disciplinaId === d.id);
          return dela.length ? (
            <optgroup key={d.id} label={d.nome}>
              {dela.map((t) => (
                <option key={t.id} value={t.id}>
                  {rotuloTurma(d, t)}
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
    </div>
  );
}

// ---------- Aviso na hora da aula ----------

export function AvisoAula() {
  const { disciplinas, turmas } = useTurmas();
  const { ativa } = useTurmaAtiva();
  const [agora, setAgora] = useState(() => new Date());
  const [dispensados, setDispensados] = useState<string[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vide.avisoAulaDispensado') ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  const aula = aulaAgora(turmas, agora);
  if (!aula || ativa?.turmaId === aula.turma.id) return null;
  const d = disciplinas.find((x) => x.id === aula.turma.disciplinaId);
  if (!d) return null;
  const chave = `${aula.turma.id}:${aula.comeca.toDateString()}:${aula.horario.inicio}`;
  if (dispensados.includes(chave)) return null;
  const dispensar = () => {
    const l = [...dispensados, chave];
    setDispensados(l);
    try {
      sessionStorage.setItem('vide.avisoAulaDispensado', JSON.stringify(l));
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="aviso-aula" role="status" style={{ ['--cor' as string]: d.cor }} data-ui>
      <span className="selo-disciplina">{d.sigla}</span>
      <span>
        Aula de <strong>{d.nome}</strong> ({aula.turma.periodo}) às {aula.horario.inicio}. Entrar no modo da turma?
      </span>
      <button className="botao pequeno escuro" onClick={() => entrarNaTurma(d, aula.turma)}>
        Entrar
      </button>
      <button className="botao pequeno" onClick={dispensar}>
        Agora não
      </button>
    </div>
  );
}

