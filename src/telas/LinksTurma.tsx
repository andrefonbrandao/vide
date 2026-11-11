// Links da turma: todos os links publicados num lugar só (treinos em casa de
// questões, forca e casos, e os processos da turma), com o QR e o botão de desativar.
import { useEffect, useState } from 'react';
import { avisar, confirmar } from '../comum/avisos';
import { IcCasos, IcLink, IcPerguntas, IcProcesso, IcQr } from '../comum/Icones';
import { irPara } from '../comum/navegacao';
import { listarProcessos, salvarProcesso } from '../processo/banco';
import { desativarProcesso } from '../processo/publicar';
import { urlDoProcesso, type Processo } from '../processo/tipos';
import { desativarLinkTreino, listarLinksTreino } from '../treino/publicar';
import { urlDoTreino, type LinkTreino } from '../treino/tipos';
import { Pagina } from './Pagina';
import { LinkEQr } from './CompartilharTreino';
import { Figura } from './ConsultaTela';

interface Entrada {
  id: string;
  tipo: string;
  icone: React.ReactNode;
  titulo: string;
  detalhe: string;
  url: string;
  quando: string;
  abrir?: () => void;
  desativar: () => Promise<void>;
}

function dia(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function LinksTurma() {
  const [entradas, setEntradas] = useState<Entrada[] | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  useEffect(() => {
    const carregar = async () => {
      const [treinos, processos] = await Promise.all([listarLinksTreino(), listarProcessos()]);
      const deTreino = (l: LinkTreino): Entrada => ({
        id: l.id,
        tipo: l.jogo === 'consulta' ? 'Casos' : l.jogo === 'forca' ? 'Forca' : 'Questões',
        icone: l.jogo === 'consulta' ? <IcCasos /> : <IcPerguntas />,
        titulo: l.titulo,
        detalhe: `${l.modo === 'sorteio' ? `sorteia ${l.quantas} de ${l.total}` : `${l.total} fixos`} · ${l.origem}`,
        url: urlDoTreino(l.codigo),
        quando: l.criado_em,
        desativar: () => desativarLinkTreino(l),
      });
      const deProcesso = (p: Processo): Entrada => ({
        id: p.id,
        tipo: 'Processo',
        icone: <IcProcesso />,
        titulo: p.titulo,
        detalhe: `${p.capa.numero} · ${p.eventos.length} ${p.eventos.length === 1 ? 'evento' : 'eventos'}`,
        url: urlDoProcesso(p.publicacao!.codigo),
        quando: p.publicacao!.publicadoEm,
        abrir: () => {
          try {
            sessionStorage.setItem('vide.processoAberto', p.id);
          } catch {
            /* ignore */
          }
          irPara('processos');
        },
        desativar: async () => {
          await desativarProcesso(p.publicacao!);
          await salvarProcesso({ ...p, publicacao: null });
        },
      });
      const lista = [...treinos.map(deTreino), ...processos.filter((p) => p.publicacao).map(deProcesso)];
      setEntradas(lista.sort((a, b) => b.quando.localeCompare(a.quando)));
    };
    void carregar();
    const r = () => void carregar();
    window.addEventListener('vide-questoes-mudou', r);
    window.addEventListener('vide-processos-mudou', r);
    return () => {
      window.removeEventListener('vide-questoes-mudou', r);
      window.removeEventListener('vide-processos-mudou', r);
    };
  }, []);

  return (
    <Pagina caminho="Atividades" titulo="Links da turma" filtravel descricao="Tudo o que está publicado para os alunos: treinos em casa e processos, com link e QR code.">
      {entradas === null ? (
        <p className="ajuda">Carregando…</p>
      ) : !entradas.length ? (
        <div className="vazio-guia">
          <Figura id="h5" expressao="feliz" className="vazio-guia-figura" />
          <div>
            <h2>Nenhum link publicado</h2>
            <p className="ajuda">Crie um treino em casa (questões, forca ou casos) ou publique um processo da turma.</p>
            <div className="linha-opcoes">
              <button className="botao escuro" onClick={() => irPara('questoes', 'novo-treino')}>
                Novo treino em casa
              </button>
              <button className="botao" onClick={() => irPara('processos')}>
                Processos
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ul className="lista-links">
          {entradas.map((e) => (
            <li key={e.id} className="cartao">
              <div className="lista-links-linha">
                <span className="lista-links-ic">{e.icone}</span>
                <div className="lista-links-texto">
                  <span className="rotulo-tipo">{e.tipo}</span>
                  <strong>{e.titulo}</strong>
                  <span className="ajuda" style={{ margin: 0 }}>
                    {e.detalhe} · desde {dia(e.quando)}
                  </span>
                </div>
                <button className={`botao pequeno com-icone${aberto === e.id ? ' escuro' : ''}`} onClick={() => setAberto(aberto === e.id ? null : e.id)}>
                  <IcQr tamanho={16} /> Link e QR
                </button>
                {e.abrir && (
                  <button className="botao pequeno" onClick={e.abrir}>
                    Abrir
                  </button>
                )}
                <button
                  className="botao pequeno"
                  onClick={async () => {
                    if (!(await confirmar({ titulo: `Desativar "${e.titulo}"?`, texto: 'Quem abrir o link verá que ele foi desativado.', botao: 'Desativar', perigo: true }))) return;
                    try {
                      await e.desativar();
                      avisar('Link desativado');
                    } catch (err) {
                      avisar((err as Error).message, 'erro');
                    }
                  }}
                >
                  Desativar
                </button>
              </div>
              {aberto === e.id && <LinkEQr url={e.url} titulo={e.titulo} ajuda="Mande o link (ou o QR) para a turma." />}
            </li>
          ))}
        </ul>
      )}
      <p className="ajuda">
        <IcLink tamanho={14} /> Os alunos não precisam de cadastro; nada deles é guardado.
      </p>
    </Pagina>
  );
}
