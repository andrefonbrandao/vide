// Início: o painel de entrada do Vide. "Pronto para a aula?", continue de onde parou,
// atalhos para criar e os links publicados para a turma.
import { useTurmaAtiva } from './FaixaTurma';
import { useTurmas } from './Turmas';
import { rotuloTurma } from '../turmas/banco';
import { proximaAula } from '../turmas/horarios';
import { useEffect, useState, type ReactNode } from 'react';
import { IcAjustes, IcCasos, IcLei, IcLink, IcPasta, IcPerguntas, IcPlay, IcProcesso, IcQr, IcRegistro, IcSeta } from '../comum/Icones';
import { irPara, type Acao, type Rota } from '../comum/navegacao';
import { listarSessoes, type ResumoSessao } from '../comum/registro';
import { listarDiplomas } from '../dados/db';
import { abreviacaoDe, diplomaPrincipal } from '../dados/diplomas';
import type { Diploma, Material } from '../dados/modelo';
import { listarQuestionarios, listarQuestoes } from '../jogo/banco';
import type { Questionario } from '../jogo/tipos';
import { listarMateriais } from '../material/documento';
import { listarProcessos } from '../processo/banco';
import type { Processo } from '../processo/tipos';
import { listarLinksTreino } from '../treino/publicar';
import type { LinkTreino } from '../treino/tipos';
import { Figura } from './ConsultaTela';
import { liberadosDe } from './Processos';

interface Dados {
  leis: Diploma[];
  materiais: Material[];
  questoes: number;
  questionarios: Questionario[];
  processos: Processo[];
  treinos: LinkTreino[];
  sessoes: ResumoSessao[];
}

function quandoFoi(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const dias = Math.floor((new Date(hoje.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86_400_000);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString('pt-BR');
}


function abrirProcesso(id: string) {
  try {
    sessionStorage.setItem('vide.processoAberto', id);
  } catch {
    /* ignore */
  }
  irPara('processos');
}

function Cartao({ tipo, icone, titulo, children, onClick }: { tipo: string; icone: ReactNode; titulo: string; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="cartao-continuar" onClick={onClick}>
      <span className="rotulo-tipo">
        {icone} {tipo}
      </span>
      <strong>{titulo}</strong>
      {children}
    </button>
  );
}

function LinhaAtalho({ icone, titulo, desc, rota, acao }: { icone: ReactNode; titulo: string; desc: string; rota: Rota; acao?: Acao }) {
  return (
    <button type="button" className="linha-atalho" onClick={() => irPara(rota, acao)}>
      <span className="linha-atalho-ic">{icone}</span>
      <span className="linha-atalho-texto">
        <strong>{titulo}</strong>
        <span>{desc}</span>
      </span>
      <IcSeta tamanho={16} />
    </button>
  );
}

export function Inicio() {
  const [d, setD] = useState<Dados | null>(null);
  const { disciplinas, turmas } = useTurmas();
  const { ativa } = useTurmaAtiva();
  useEffect(() => {
    void Promise.all([listarDiplomas(), listarMateriais(), listarQuestoes(), listarQuestionarios(), listarProcessos(), listarLinksTreino(), listarSessoes()]).then(
      ([leis, materiais, questoes, questionarios, processos, treinos, sessoes]) =>
        setD({ leis, materiais, questoes: questoes.length, questionarios, processos, treinos, sessoes }),
    );
  }, []);
  if (!d) return <div className="pagina" />;

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const processo = d.processos[0];
  const publicados = d.processos.filter((p) => p.publicacao);
  const aguardando = publicados.map((p) => ({ p, faltam: p.eventos.length - liberadosDe(p) })).filter((x) => x.faltam > 0)[0];
  const ultimaSessao = d.sessoes.find((s) => (s.contagem.fala ?? 0) + (s.contagem.projetado ?? 0) > 0);
  const novo = !d.leis.length && !d.materiais.length && !d.questoes && !d.processos.length;
  const links = [
    ...publicados.map((p) => ({ id: p.id, titulo: p.titulo, desc: `processo · publicado ${quandoFoi(p.publicacao!.publicadoEm)}`, quando: p.publicacao!.publicadoEm })),
    ...d.treinos.map((l) => ({ id: l.id, titulo: l.titulo, desc: `${l.jogo === 'consulta' ? 'casos' : l.jogo === 'forca' ? 'forca' : 'questões'} · criado ${quandoFoi(l.criado_em)}`, quando: l.criado_em })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));

  const resumo = [
    d.leis.length ? `Lei principal: ${abreviacaoDe(diplomaPrincipal())}` : 'Nenhuma lei importada ainda',
    `${d.materiais.length} ${d.materiais.length === 1 ? 'material' : 'materiais'}`,
    aguardando ? `processo "${aguardando.p.titulo}" com ${aguardando.faltam} ${aguardando.faltam === 1 ? 'evento' : 'eventos'} por liberar` : null,
    (() => {
      const lista = ativa ? turmas.filter((t) => t.id === ativa.turmaId) : turmas;
      const p = proximaAula(lista, new Date());
      if (!p) return null;
      const disc = disciplinas.find((x) => x.id === p.turma.disciplinaId);
      const hojeMesmo = p.comeca.toDateString() === new Date().toDateString();
      return `próxima aula${ativa ? '' : ` (${rotuloTurma(disc, p.turma)})`}: ${hojeMesmo ? 'hoje' : p.comeca.toLocaleDateString('pt-BR', { weekday: 'long' })} às ${p.horario.inicio}`;
    })(),
  ].filter(Boolean);

  return (
    <div className="pagina inicio">
      <section className="inicio-hero">
        <div className="inicio-hero-texto">
          <span className="inicio-data">{hoje}</span>
          <h1>{ativa ? `Pronto para a aula de ${ativa.rotulo}?` : 'Pronto para a aula?'}</h1>
          <p>{resumo.join(' · ')}</p>
          <div className="linha-opcoes">
            <button className="botao primario com-icone" onClick={() => irPara('aula')}>
              <IcPlay tamanho={18} /> Começar aula
            </button>
            <button className="botao fantasma-claro" onClick={() => irPara('links')}>
              Links da turma
            </button>
          </div>
        </div>
        <Figura id="juiz-m" expressao="feliz" className="inicio-hero-figura" />
      </section>

      {novo ? (
        <section className="inicio-secao">
          <h2>Primeiros passos</h2>
          <div className="inicio-grade-2 inicio-passos">
            <LinhaAtalho icone={<IcLei />} titulo="Importar uma lei" desc="CPC, CF, CC… a partir do site do Planalto" rota="leis" acao="nova-lei" />
            <LinhaAtalho icone={<IcPasta />} titulo="Adicionar seus slides" desc="PDFs para projetar ao lado dos artigos" rota="materiais" acao="novo-material" />
            <LinhaAtalho icone={<IcPerguntas />} titulo="Criar questões" desc="para o jogo em sala e o treino em casa" rota="questoes" acao="novas-questoes" />
            <LinhaAtalho icone={<IcAjustes />} titulo="Conectar o Google Drive" desc="para guardar e usar em outros computadores" rota="ajustes" />
          </div>
        </section>
      ) : (
        <section className="inicio-secao">
          <h2>Continue de onde parou</h2>
          <div className="inicio-cartoes">
            {processo && (
              <Cartao tipo="Processo" icone={<IcProcesso tamanho={14} />} titulo={processo.titulo} onClick={() => abrirProcesso(processo.id)}>
                <span className="ajuda">
                  {liberadosDe(processo)} de {processo.eventos.length} eventos liberados
                </span>
                <span className="barra-progresso">
                  <i style={{ width: `${processo.eventos.length ? (liberadosDe(processo) / processo.eventos.length) * 100 : 0}%` }} />
                </span>
                <span className={`selo ${processo.publicacao ? 'verde' : ''}`}>{processo.publicacao ? 'Publicado' : 'Não publicado'}</span>
              </Cartao>
            )}
            {d.questionarios[0] && (
              <Cartao tipo="Questionário" icone={<IcPerguntas tamanho={14} />} titulo={d.questionarios[0].nome} onClick={() => irPara('questoes')}>
                <span className="ajuda">
                  {d.questionarios[0].questoes.length} questões · editado {quandoFoi(d.questionarios[0].atualizado_em)}
                </span>
                <span className="selo">Jogar na aula</span>
              </Cartao>
            )}
            {d.treinos[0] && (
              <Cartao tipo="Treino em casa" icone={<IcLink tamanho={14} />} titulo={d.treinos[0].titulo} onClick={() => irPara('links')}>
                <span className="ajuda">criado {quandoFoi(d.treinos[0].criado_em)}</span>
                <span className="selo laranja">
                  {d.treinos.length} {d.treinos.length === 1 ? 'link ativo' : 'links ativos'}
                </span>
              </Cartao>
            )}
            {ultimaSessao && (
              <Cartao tipo="Última aula" icone={<IcRegistro tamanho={14} />} titulo={`${new Date(ultimaSessao.inicio).toLocaleDateString('pt-BR')} · ${new Date(ultimaSessao.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`} onClick={() => irPara('registro')}>
                <span className="ajuda">{ultimaSessao.contagem.projetado ?? 0} projeções registradas</span>
                <span className="selo">Copiar pacote para o Claude</span>
              </Cartao>
            )}
          </div>
        </section>
      )}

      <div className="inicio-grade-2">
        <section className="cartao inicio-bloco">
          <h2>Criar rápido</h2>
          <LinhaAtalho icone={<IcPerguntas />} titulo="Questões" desc="escrever, colar ou pedir à IA" rota="questoes" acao="novas-questoes" />
          <LinhaAtalho icone={<IcCasos />} titulo="Caso para a Consulta" desc="um personagem conta o problema" rota="casos" acao="novo-caso" />
          <LinhaAtalho icone={<IcProcesso />} titulo="Processo da turma" desc="em branco ou colado em texto" rota="processos" acao="novo-processo" />
        </section>
        <section className="cartao inicio-bloco">
          <div className="inicio-bloco-cab">
            <h2>Links ativos para a turma</h2>
            <button className="link-discreto" onClick={() => irPara('links')}>
              gerenciar
            </button>
          </div>
          {links.length ? (
            links.slice(0, 3).map((l) => (
              <button key={l.id} type="button" className="linha-atalho" onClick={() => irPara('links')}>
                <span className="linha-atalho-ic">
                  <IcQr />
                </span>
                <span className="linha-atalho-texto">
                  <strong>{l.titulo}</strong>
                  <span>{l.desc}</span>
                </span>
                <IcSeta tamanho={16} />
              </button>
            ))
          ) : (
            <p className="ajuda">Nenhum link publicado ainda. Treinos em casa e processos publicados aparecem aqui.</p>
          )}
        </section>
      </div>
    </div>
  );
}
