// Jogo "Consulta" na tela do professor: escolher os casos e conduzir a discussão.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { apresentador } from '../consulta/apresentador';
import { assuntosDosCasos, listarCasos } from '../consulta/banco';
import { rotuloAvancarConsulta } from '../consulta/rotulo';
import { OPCOES_TEMPO_CASO, type Caso } from '../consulta/tipos';
import { ConsultaTela } from './ConsultaTela';
import type { ControladorAula } from './controlador';

export function useConsulta() {
  const a = apresentador();
  return useSyncExternalStore(a.assinar, a.obter);
}

function semAcento(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function embaralhar<T>(l: T[]): T[] {
  const r = [...l];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

/** Parte da janela de Atividades: escolher os casos da consulta. */
export function EscolherConsulta({ aoFechar }: { aoFechar: () => void }) {
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [fonte, setFonte] = useState<'assunto' | 'escolher'>('assunto');
  const [assunto, setAssunto] = useState('*');
  const [quantos, setQuantos] = useState(3);
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [tempo, setTempo] = useState(0);
  useEffect(() => void listarCasos().then(setCasos), []);
  if (casos === null) return <p className="ajuda">Carregando…</p>;
  if (!casos.length)
    return (
      <>
        <p className="aviso">
          Nenhum caso ainda. Cadastre em <strong>Acervo › Casos</strong>.
        </p>
        <div className="modal-botoes">
          <button className="botao" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </>
    );
  const assuntos = assuntosDosCasos(casos);
  const doAssunto = assunto === '*' ? casos : casos.filter((c) => c.etiquetas.includes(assunto));
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const paraEscolher = casos.filter((c) => termos.every((t) => semAcento(`${c.nome} ${c.falas.map((f) => f.texto).join(' ')} ${c.etiquetas.join(' ')}`).includes(t)));
  const lista = fonte === 'assunto' ? doAssunto : escolhidos.map((id) => casos.find((c) => c.id === id)).filter((c): c is Caso => !!c);
  const vaoSer = fonte === 'assunto' ? Math.min(quantos, lista.length) : lista.length;

  const abrir = () => {
    const sel = fonte === 'assunto' ? embaralhar(lista).slice(0, quantos) : lista;
    if (!sel.length) return;
    const nome = `Consulta · ${sel.length} ${sel.length === 1 ? 'caso' : 'casos'}${fonte === 'assunto' ? ` · ${assunto === '*' ? 'todos os assuntos' : assunto}` : ''}`;
    apresentador().iniciar(nome, sel, tempo);
    aoFechar();
  };

  return (
    <>
      <div className="linha-opcoes" style={{ marginBottom: 10 }}>
        <button className={`botao pequeno${fonte === 'assunto' ? ' escuro' : ''}`} onClick={() => setFonte('assunto')}>
          Sortear por assunto
        </button>
        <button className={`botao pequeno${fonte === 'escolher' ? ' escuro' : ''}`} onClick={() => setFonte('escolher')}>
          Escolher os casos
        </button>
      </div>
      {fonte === 'assunto' ? (
        <div className="grade-2">
          <div className="campo">
            <label htmlFor="assunto-consulta">Assunto</label>
            <select id="assunto-consulta" className="seletor" value={assunto} onChange={(e) => setAssunto(e.target.value)}>
              <option value="*">Todos os assuntos ({casos.length})</option>
              {assuntos.map((a) => (
                <option key={a.assunto} value={a.assunto}>
                  {a.assunto} ({a.total})
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label>Quantos casos</label>
            <div className="linha-opcoes">
              {[1, 2, 3, 5].map((n) => (
                <button key={n} type="button" className={`botao pequeno${quantos === n ? ' escuro' : ''}`} onClick={() => setQuantos(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="campo">
          <label htmlFor="busca-consulta">Marque os casos, na ordem em que vão aparecer ({escolhidos.length} escolhidos)</label>
          <input id="busca-consulta" className="busca-mat" type="search" placeholder="Buscar por nome, texto ou assunto" value={busca} onChange={(e) => setBusca(e.target.value)} />
          <ul className="lista-ordem disponiveis" data-rolavel>
            {paraEscolher.map((c) => (
              <li key={c.id}>
                <label className="caixa-marcar" style={{ marginTop: 0, flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={escolhidos.includes(c.id)}
                    onChange={(e) => setEscolhidos(e.target.checked ? [...escolhidos, c.id] : escolhidos.filter((x) => x !== c.id))}
                  />
                  <span className="texto-questao">
                    <strong>{c.nome}</strong>: {c.falas[c.falas.length - 1]?.texto}
                    {c.etiquetas.length > 0 && <span className="ajuda"> · {c.etiquetas.join(', ')}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="campo tempos-jogo">
        <label htmlFor="tempo-consulta">Tempo de discussão</label>
        <select id="tempo-consulta" className="seletor" value={tempo} onChange={(e) => setTempo(Number(e.target.value))}>
          <option value={0}>O tempo sugerido de cada caso</option>
          {OPCOES_TEMPO_CASO.map((t) => (
            <option key={t} value={t}>
              {t} minutos para todos
            </option>
          ))}
        </select>
      </div>
      <p className="ajuda">
        {vaoSer ? `${vaoSer} ${vaoSer === 1 ? 'caso' : 'casos'}${fonte === 'assunto' ? ', sorteados' : ''}.` : 'Nenhum caso escolhido.'} Durante o tempo, você pode pausar ou dar mais 1 minuto.
      </p>
      <div className="modal-botoes">
        <button className="botao" onClick={aoFechar}>
          Cancelar
        </button>
        <button className="botao primario" onClick={abrir} disabled={!vaoSer}>
          Começar a consulta
        </button>
      </div>
    </>
  );
}

/** Painel central durante a consulta (no lugar do material). */
export function PainelConsulta({ ctl }: { ctl: ControladorAula }) {
  const { tela } = useConsulta();
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setMsg(null), [tela?.indice, tela?.fase]);
  if (!tela) return null;
  const a = apresentador();
  const rotulo = rotuloAvancarConsulta(tela);
  const projetarFundamento = () => {
    const r = ctl.adicionarDigitado(tela.caso.fundamento);
    if (r.ok) ctl.projetar('mouse');
    setMsg(r.ok ? null : r.mensagem);
  };
  return (
    <section className="painel-material painel-jogo" data-ui>
      <div className="painel-material-topo">
        <strong className="painel-material-nome">{tela.nome}</strong>
      </div>
      <div className="previa-jogo">
        <div className="jogo-quadro">
          <ConsultaTela tela={tela} />
        </div>
      </div>
      <div className="painel-jogo-acoes">
        {rotulo && (
          <button className="botao primario" onClick={() => a.avancar()}>
            {rotulo}
          </button>
        )}
        {tela.fase === 'caso' && (
          <>
            <button className="botao" onClick={() => a.alternarPausa()}>
              {tela.pausadoResta !== null ? 'Continuar o tempo' : 'Pausar'}
            </button>
            <button className="botao" onClick={() => a.maisUmMinuto()}>
              +1 minuto
            </button>
          </>
        )}
        {tela.fase === 'resposta' && tela.caso.fundamento && (
          <button className="botao" onClick={projetarFundamento} title="Projeta o dispositivo ao lado do caso">
            Projetar fundamento ({tela.caso.fundamento})
          </button>
        )}
        <span className="espaco" />
        <button className="botao" onClick={() => (tela.fase === 'fim' || confirm('Encerrar a consulta agora?')) && a.encerrar()}>
          Encerrar
        </button>
      </div>
      {msg && <p className="digitar-msg erro">{msg}</p>}
      {tela.fase === 'caso' && (
        <details className="consulta-cola">
          <summary>Ver a resposta (só na sua tela)</summary>
          <p>
            <strong>{tela.caso.quemResponde === 'juiz' ? 'Juiz' : 'Advogado'}:</strong> {tela.caso.resposta}
            {tela.caso.fundamento && <span className="ajuda"> · Fundamento: {tela.caso.fundamento}</span>}
          </p>
        </details>
      )}
      <p className="ajuda" style={{ margin: 0 }}>
        Clique esquerdo, Enter ou o passador avançam · a resposta aparece sozinha quando o tempo acaba.
      </p>
    </section>
  );
}
