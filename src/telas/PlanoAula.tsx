// Plano de aula da turma: a parte que se repete (temas, avaliações) fica na disciplina; as datas
// saem do calendário desta turma (dias de aula, sem feriados e dias marcados). Baixa em Word e PDF
// no modelo da instituição.
import { useEffect, useMemo, useRef, useState } from 'react';
import { avisar, confirmar } from '../comum/avisos';
import { novoId } from '../dados/modelo';
import { dataBR, datasDasAulas, diasDaTurma, lerPlanoAulaDocx, planoVazio, salvarCalendario, salvarPlanoAula } from '../turmas/planoAula';
import { DIAS, type AulaPlano, type CalendarioTurma, type Disciplina, type GrauPlano, type PlanoAula, type Turma } from '../turmas/tipos';

const CAL_VAZIO: CalendarioTurma = { excecoes: [], datas: {} };

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

/** As etiquetas azuis com o texto ("AULA 1"…), desenhadas no navegador sobre a imagem da instituição. */
async function etiquetas(textos: string[], aba: Uint8Array): Promise<Map<string, Uint8Array>> {
  const bmp = await createImageBitmap(new Blob([aba as BlobPart], { type: 'image/jpeg' }));
  const out = new Map<string, Uint8Array>();
  for (const t of textos) {
    const c = document.createElement('canvas');
    c.width = bmp.width * 2;
    c.height = bmp.height * 2;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    let tam = c.height * 0.42;
    ctx.font = `bold ${tam}px Calibri, Carlito, Arial, sans-serif`;
    const larg = ctx.measureText(t).width;
    if (larg > c.width * 0.58) tam *= (c.width * 0.58) / larg;
    ctx.font = `bold ${tam}px Calibri, Carlito, Arial, sans-serif`;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, c.width * 0.13, c.height * 0.47);
    const blob = await new Promise<Blob>((ok) => c.toBlob((b) => ok(b!), 'image/jpeg', 0.9));
    out.set(t, new Uint8Array(await blob.arrayBuffer()));
  }
  return out;
}

export function PlanoAulaJanela({ disciplina, turma, aoFechar }: { disciplina: Disciplina; turma: Turma; aoFechar: () => void }) {
  const [plano, setPlano] = useState<PlanoAula>(() => disciplina.planoAula ?? planoVazio());
  const [cal, setCal] = useState<CalendarioTurma>(() => ({ ...CAL_VAZIO, ...turma.calendario }));
  const [periodo, setPeriodo] = useState({ inicio: turma.inicio ?? '', fim: turma.fim ?? '' });
  const [ocupado, setOcupado] = useState('');
  const [novaExc, setNovaExc] = useState({ data: '', motivo: '', aula: false });
  const tPlano = useRef<number | null>(null);
  const tCal = useRef<number | null>(null);
  const discRef = useRef(disciplina);
  const turmaRef = useRef(turma);

  // Guarda sozinho, um instante depois de cada mudança.
  const mudarPlano = (p: PlanoAula) => {
    setPlano(p);
    if (tPlano.current) window.clearTimeout(tPlano.current);
    tPlano.current = window.setTimeout(() => void salvarPlanoAula(discRef.current, p).then((d) => (discRef.current = d)), 600);
  };
  const mudarCal = (c: CalendarioTurma, per = periodo) => {
    setCal(c);
    setPeriodo(per);
    if (tCal.current) window.clearTimeout(tCal.current);
    tCal.current = window.setTimeout(() => void salvarCalendario(turmaRef.current, c, { inicio: per.inicio || undefined, fim: per.fim || undefined }).then((t) => (turmaRef.current = t)), 600);
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

  const t = { inicio: periodo.inicio, fim: periodo.fim, horarios: turma.horarios };
  const dias = useMemo(() => diasDaTurma(t, cal), [periodo.inicio, periodo.fim, turma.horarios, cal]); // eslint-disable-line react-hooks/exhaustive-deps
  const { datas, faltam, sobram } = datasDasAulas(plano.aulas, t, cal);
  const pulados = dias.filter((d) => !d.aula || d.motivo);
  const unidade = disciplina.nome.toUpperCase();

  const mudarAula = (k: number, p: Partial<AulaPlano>) => mudarPlano({ ...plano, aulas: plano.aulas.map((a, i) => (i === k ? { ...a, ...p } : a)) });
  const mover = (k: number, d: -1 | 1) => {
    const l = [...plano.aulas];
    [l[k], l[k + d]] = [l[k + d], l[k]];
    mudarPlano({ ...plano, aulas: l });
  };
  const mudarGrau = (g: 'A' | 'B' | 'C', p: Partial<GrauPlano>) => mudarPlano({ ...plano, graus: { ...plano.graus, [g]: { ...plano.graus[g], ...p } } });

  const entrada = async () => {
    const [cabecalho, aba] = await Promise.all([buscar('/plano-aula/cabecalho.png'), buscar('/plano-aula/aba.jpg')]);
    return { unidade, plano, datas, periodo, cabecalho, aba };
  };
  const baixar = async (ext: 'docx' | 'pdf') => {
    if (!periodo.inicio || !periodo.fim) return avisar('Preencha o início e o fim do semestre.', 'erro');
    setOcupado(ext);
    try {
      const e = await entrada();
      const { nomeArquivoPlanoAula } = await import('../turmas/planoAulaDocx');
      const nome = nomeArquivoPlanoAula(disciplina.sigla || disciplina.nome, turma.periodo, ext);
      if (ext === 'docx') {
        const { gerarPlanoAulaDocx } = await import('../turmas/planoAulaDocx');
        const etq = e.aba ? await etiquetas([...plano.aulas.map((_, k) => `AULA ${k + 1}`), 'GRAU A', 'GRAU B', 'GRAU C'], e.aba) : undefined;
        await baixarArquivo(await gerarPlanoAulaDocx({ ...e, etiquetas: etq }), nome);
      } else {
        const { gerarPlanoAulaPdf } = await import('../turmas/planoAulaPdf');
        await baixarArquivo(await gerarPlanoAulaPdf(e), nome);
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
      const r = await lerPlanoAulaDocx(new Uint8Array(await arq.arrayBuffer()));
      if (
        !(await confirmar({
          titulo: 'Usar este plano de aula?',
          texto: `${r.plano.aulas.length} aulas, avaliações e estratégias de "${r.unidade || arq.name}". Substitui as aulas e as avaliações desta disciplina (as datas continuam sendo calculadas pelo calendário desta turma).`,
          botao: 'Usar',
        }))
      )
        return;
      mudarPlano({ ...r.plano, professor: r.plano.professor || plano.professor });
      if (r.periodo && !periodo.inicio) mudarCal(cal, r.periodo);
      avisar('Plano importado. Confira as datas.');
    } catch (err) {
      avisar((err as Error).message, 'erro');
    }
  };

  return (
    <div className="ori-foco pa" role="dialog" aria-label="Plano de aula">
      <header className="ori-foco-topo">
        <div className="ori-foco-titulo">
          Plano de aula <span>· {disciplina.nome} · {turma.periodo}</span>
        </div>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="botao pequeno" title="Lê um plano de aula em Word no modelo da instituição (AULA 1, AULA 2…)">
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
          As aulas, os temas e as avaliações valem para todas as turmas de {disciplina.sigla || disciplina.nome}; as datas e o calendário são desta turma ({turma.periodo}). Tudo é salvo sozinho.
        </p>
        <section className="cartao pa-secao">
          <h3>Cabeçalho</h3>
          <div className="pa-grade">
            <div className="campo">
              <label>Unidade curricular</label>
              <input value={unidade} disabled title="O nome da disciplina (edite em Turmas)" />
            </div>
            <div className="campo">
              <label htmlFor="pa-ch">Carga horária</label>
              <input id="pa-ch" value={plano.cargaHoraria} onChange={(e) => mudarPlano({ ...plano, cargaHoraria: e.target.value })} placeholder="60H" />
            </div>
            <div className="campo">
              <label htmlFor="pa-prof">Professor</label>
              <input id="pa-prof" value={plano.professor} onChange={(e) => mudarPlano({ ...plano, professor: e.target.value })} />
            </div>
            <div className="campo">
              <label>Período de realização</label>
              <span className="linha-opcoes" style={{ flexWrap: 'nowrap' }}>
                <input type="date" aria-label="Início" value={periodo.inicio} onChange={(e) => mudarCal(cal, { ...periodo, inicio: e.target.value })} />
                <span>a</span>
                <input type="date" aria-label="Fim" value={periodo.fim} onChange={(e) => mudarCal(cal, { ...periodo, fim: e.target.value })} />
              </span>
            </div>
          </div>
        </section>

        <section className="cartao pa-secao">
          <h3>Calendário da turma</h3>
          <p className="ajuda" style={{ marginTop: 0 }}>
            Dias de aula: <strong>{turma.horarios.length ? [...new Set(turma.horarios.map((h) => DIAS[h.dia]))].join(', ') : 'nenhum (preencha os horários da turma em Turmas › editar)'}</strong>. Os feriados nacionais saem sozinhos.
          </p>
          <p className={`pa-resumo${faltam || sobram.length ? ' alerta' : ''}`}>
            {plano.aulas.length} aulas · {dias.filter((d) => d.aula).length} dias de aula no período
            {faltam ? ` · faltam ${faltam} ${faltam === 1 ? 'data' : 'datas'} (acrescente uma aula extra ou tire uma aula)` : ''}
            {sobram.length ? ` · sobram ${sobram.length} ${sobram.length === 1 ? 'dia' : 'dias'} (${sobram.map(dataBR).join(', ')})` : ''}
          </p>
          {pulados.length > 0 && (
            <ul className="pa-dias">
              {pulados.map((d) => {
                const exc = cal.excecoes.find((x) => x.data === d.data);
                return (
                  <li key={d.data}>
                    <span className={d.aula ? 'pa-tem' : 'pa-sem'}>{d.aula ? 'com aula' : 'sem aula'}</span> {dataBR(d.data)} ({DIAS[new Date(`${d.data}T12:00`).getDay()]}) — {d.motivo}
                    {exc ? (
                      <button type="button" className="ori-link" onClick={() => mudarCal({ ...cal, excecoes: cal.excecoes.filter((x) => x.data !== d.data) })}>
                        desfazer
                      </button>
                    ) : (
                      <button type="button" className="ori-link" onClick={() => mudarCal({ ...cal, excecoes: [...cal.excecoes, { data: d.data, aula: true }] })}>
                        dar aula mesmo assim
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className="linha-opcoes pa-nova-exc">
            <input type="date" aria-label="Data" value={novaExc.data} onChange={(e) => setNovaExc({ ...novaExc, data: e.target.value })} />
            <select className="seletor" value={novaExc.aula ? 'sim' : 'nao'} onChange={(e) => setNovaExc({ ...novaExc, aula: e.target.value === 'sim' })}>
              <option value="nao">sem aula</option>
              <option value="sim">aula extra</option>
            </select>
            <input placeholder="Motivo (ex.: Semana acadêmica)" value={novaExc.motivo} onChange={(e) => setNovaExc({ ...novaExc, motivo: e.target.value })} />
            <button
              type="button"
              className="botao pequeno"
              disabled={!novaExc.data}
              onClick={() => {
                mudarCal({ ...cal, excecoes: [...cal.excecoes.filter((x) => x.data !== novaExc.data), { data: novaExc.data, aula: novaExc.aula, motivo: novaExc.motivo.trim() || undefined }] });
                setNovaExc({ data: '', motivo: '', aula: false });
              }}
            >
              Marcar
            </button>
          </div>
        </section>

        <section className="cartao pa-secao">
          <h3>Aulas</h3>
          <ol className="pa-aulas">
            {plano.aulas.map((a, k) => (
              <li key={a.id} className="pa-aula">
                <div className="pa-aula-cab">
                  <strong>AULA {k + 1}</strong>
                  <input
                    type="date"
                    aria-label={`Data da aula ${k + 1}`}
                    className={cal.datas[a.id] ? 'pa-data-mao' : ''}
                    value={datas[k] ?? ''}
                    title={cal.datas[a.id] ? 'Data escolhida à mão' : 'Data calculada pelo calendário'}
                    onChange={(e) => mudarCal({ ...cal, datas: { ...cal.datas, [a.id]: e.target.value } })}
                  />
                  {cal.datas[a.id] && (
                    <button
                      type="button"
                      className="ori-link"
                      onClick={() => {
                        const { [a.id]: _x, ...resto } = cal.datas;
                        mudarCal({ ...cal, datas: resto });
                      }}
                    >
                      data automática
                    </button>
                  )}
                  <span className="espaco" />
                  <select className="seletor" aria-label="Quadro do Grau depois desta aula" value={a.grau ?? ''} onChange={(e) => mudarAula(k, { grau: (e.target.value || undefined) as AulaPlano['grau'] })}>
                    <option value="">—</option>
                    <option value="A">fecha o Grau A</option>
                    <option value="B">fecha o Grau B</option>
                    <option value="C">fecha o Grau C</option>
                  </select>
                  <button type="button" className="botao pequeno" disabled={k === 0} onClick={() => mover(k, -1)} aria-label="Subir">
                    ↑
                  </button>
                  <button type="button" className="botao pequeno" disabled={k === plano.aulas.length - 1} onClick={() => mover(k, 1)} aria-label="Descer">
                    ↓
                  </button>
                  <button type="button" className="botao pequeno" disabled={plano.aulas.length <= 1} onClick={() => mudarPlano({ ...plano, aulas: plano.aulas.filter((_, i) => i !== k) })}>
                    Remover
                  </button>
                </div>
                <input className="pa-destaque" placeholder="Destaque (ex.: AVALIAÇÃO FORMATIVA A.1)" value={a.destaque} onChange={(e) => mudarAula(k, { destaque: e.target.value })} />
                <textarea rows={2} placeholder="Tema da aula" value={a.tema} onChange={(e) => mudarAula(k, { tema: e.target.value })} />
              </li>
            ))}
          </ol>
          <button type="button" className="botao" onClick={() => mudarPlano({ ...plano, aulas: [...plano.aulas, { id: novoId(), tema: '', destaque: '' }] })}>
            + Adicionar aula
          </button>
        </section>

        <section className="cartao pa-secao">
          <h3>Graus e estratégias de avaliação</h3>
          {(['A', 'B', 'C'] as const).map((g) => {
            const gr = plano.graus[g];
            return (
              <div key={g} className="pa-grau">
                <h4>Grau {g}</h4>
                <div className="pa-grade">
                  <div className="campo">
                    <label>{g === 'C' ? 'Data de aplicação da avaliação' : 'Datas de aplicação da avaliação'}</label>
                    <input value={gr.aplicacao} onChange={(e) => mudarGrau(g, { aplicacao: e.target.value })} placeholder="Conforme informado nas aulas respectivas" />
                  </div>
                  <div className="campo">
                    <label>Data para a postagem das notas</label>
                    <input value={gr.postagem} onChange={(e) => mudarGrau(g, { postagem: e.target.value })} placeholder="até 48h após a realização da última atividade." />
                  </div>
                  <div className="campo">
                    <label>Pontos</label>
                    <input value={gr.pontos} onChange={(e) => mudarGrau(g, { pontos: e.target.value })} />
                  </div>
                </div>
                <table className="pa-tabela">
                  <thead>
                    <tr>
                      <th>Instrumento avaliativo</th>
                      <th>Peso</th>
                      <th>Critérios</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {gr.linhas.map((l, k) => (
                      <tr key={k}>
                        {(['instrumento', 'peso', 'criterio'] as const).map((c) => (
                          <td key={c}>
                            <input value={l[c]} aria-label={c} onChange={(e) => mudarGrau(g, { linhas: gr.linhas.map((x, i) => (i === k ? { ...x, [c]: e.target.value } : x)) })} />
                          </td>
                        ))}
                        <td>
                          <button type="button" className="ori-link" onClick={() => mudarGrau(g, { linhas: gr.linhas.filter((_, i) => i !== k) })}>
                            tirar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button type="button" className="ori-link" onClick={() => mudarGrau(g, { linhas: [...gr.linhas, { instrumento: '', peso: '', criterio: '' }] })}>
                  + instrumento
                </button>
              </div>
            );
          })}
          <div className="campo" style={{ marginTop: 12 }}>
            <label htmlFor="pa-rec">Estratégias de recuperação de aprendizagem</label>
            <textarea id="pa-rec" rows={2} value={plano.recuperacao} onChange={(e) => mudarPlano({ ...plano, recuperacao: e.target.value })} />
          </div>
        </section>
      </div>
    </div>
  );
}
