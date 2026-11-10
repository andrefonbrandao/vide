// O jogo "Consulta" no projetor (e na prévia da tela do professor): o personagem conta
// o caso em balões, a turma discute e, no fim, o advogado ou o juiz responde.
import { useEffect, useMemo, useState } from 'react';
import type { TelaConsulta } from '../consulta/apresentador';
import { desenharPersonagem, ELENCO, type Expressao, type Personagem } from '../consulta/personagens';
import type { Fala } from '../consulta/tipos';
import { Cabe } from './JogoTela';

export function nomeDoPapel(p: Personagem | undefined): string {
  if (!p) return '';
  if (p.papel === 'juiz') return p.pessoa === 'mulher' ? 'Juíza' : 'Juiz';
  if (p.papel === 'advogado') return p.pessoa === 'mulher' ? 'Advogada' : 'Advogado';
  return '';
}

/** O desenho do personagem (SVG feito pelo próprio app, sem texto vindo de fora). */
export function Figura({ id, expressao, className }: { id: string; expressao: Expressao; className?: string }) {
  const p = ELENCO.find((x) => x.id === id) ?? ELENCO[0];
  const svg = useMemo(() => desenharPersonagem(p, expressao), [p, expressao]);
  return <div className={`figura${className ? ` ${className}` : ''}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function Relogio({ prazo, pausadoResta }: { prazo: number; pausadoResta: number | null }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (pausadoResta !== null) return;
    const t = window.setInterval(() => setAgora(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [pausadoResta]);
  const resta = Math.max(0, pausadoResta ?? prazo - agora);
  const s = Math.ceil(resta / 1000);
  return (
    <span className={`consulta-relogio${pausadoResta !== null ? ' pausado' : ''}${s <= 30 ? ' fim-perto' : ''}`}>
      {pausadoResta !== null && <small>pausado</small>}
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}
    </span>
  );
}

/** Os balões do caso: as falas (as antigas mais apagadas) e, na resposta, a fala de quem responde. */
export function Baloes({
  falas,
  visiveis,
  resposta,
  fundamento,
  chave,
}: {
  falas: Fala[];
  visiveis: number;
  resposta?: string | null;
  fundamento?: string;
  chave: string;
}) {
  const mostradas = falas.slice(0, visiveis);
  return (
    <Cabe chave={chave} className="cabe-bloco consulta-pilha">
      {mostradas.map((f, i) => {
        const ultima = i === mostradas.length - 1;
        const pergunta = i === falas.length - 1;
        return (
          <p key={i} className={`balao${!ultima || resposta ? ' antigo' : ''}${pergunta && !resposta ? ' pergunta' : ''}`}>
            {f.texto}
          </p>
        );
      })}
      {resposta && <p className="balao resposta">{resposta}</p>}
      {resposta && fundamento && <span className="consulta-fundamento">Fundamento: {fundamento}</span>}
    </Cabe>
  );
}

export function ConsultaTela({ tela }: { tela: TelaConsulta }) {
  const { caso } = tela;
  if (tela.fase === 'fim') {
    return (
      <div className="jogo-tela jogo-fim">
        <p className="jogo-rotulo">Fim da consulta</p>
        <p className="jogo-codigo">{tela.total}</p>
        <p className="jogo-rotulo">{tela.total === 1 ? 'caso discutido' : 'casos discutidos'}</p>
      </div>
    );
  }
  const resposta = tela.fase === 'resposta';
  const expressao = caso.falas[Math.max(0, tela.falasVisiveis - 1)]?.expressao ?? 'neutro';
  const respondente = ELENCO.find((p) => p.id === tela.respondente);
  return (
    <div className={`jogo-tela consulta-tela${resposta ? ' na-resposta' : ''}`}>
      <div className="jogo-topo">
        <span className="jogo-rotulo">
          Consulta · caso {tela.indice + 1} de {tela.total} · {resposta ? 'resposta' : 'discutam em grupo'}
        </span>
        <span className="espaco" />
        {!resposta && <Relogio prazo={tela.prazo} pausadoResta={tela.pausadoResta} />}
      </div>
      <div className="consulta-palco">
        <div className="consulta-pessoa">
          <Figura id={tela.consulente} expressao={expressao} />
          <span className="consulta-nome">{caso.nome}</span>
        </div>
        <div className="consulta-baloes">
          <Baloes
            falas={caso.falas}
            visiveis={tela.falasVisiveis}
            resposta={resposta ? caso.resposta : null}
            fundamento={caso.fundamento}
            chave={`${tela.indice}:${tela.falasVisiveis}:${tela.fase}`}
          />
        </div>
        {resposta && (
          <div className="consulta-respondente">
            <Figura id={tela.respondente} expressao="neutro" />
            <span className="consulta-nome">{nomeDoPapel(respondente)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
