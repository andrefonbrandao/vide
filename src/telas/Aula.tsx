// Tela do apresentador (modo aula).
// Controles: roda = percorre candidatos (ou rola o texto projetado);
// clique esquerdo = projeta; clique direito = recolhe; clique na roda = alterna a roda.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { controlador, type EstadoAula } from './controlador';
import type { StatusVoz } from '../voz/reconhecedor';
import { obterConstrutor } from '../voz/reconhecedor';

const TEXTO_STATUS: Record<StatusVoz, string> = {
  parado: 'Escuta desligada',
  iniciando: 'Iniciando o microfone…',
  ouvindo: 'Ouvindo',
  reiniciando: 'Reconectando a voz…',
  erro: 'Problema na voz',
  'sem-suporte': 'Navegador sem reconhecimento de voz',
};

function classeStatus(s: StatusVoz): string {
  if (s === 'ouvindo') return 'status ok';
  if (s === 'parado') return 'status';
  if (s === 'iniciando' || s === 'reiniciando') return 'status alerta pulsa';
  return 'status alerta';
}

function idade(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min`;
}

/** Está dentro de um botão ou da barra (cliques ali não projetam)? */
function ehInterface(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && !!alvo.closest('[data-ui], button, input, textarea, a, select');
}

export function Aula({ ativa }: { ativa: boolean }) {
  const ctl = controlador();
  const e: EstadoAula = useSyncExternalStore(ctl.assinar, ctl.obter);
  const [, setRelogio] = useState(0);
  const transcricaoRef = useRef<HTMLDivElement>(null);
  const [textoTeste, setTextoTeste] = useState('');
  const suporte = !!obterConstrutor();

  // Atualiza a "idade" dos candidatos a cada segundo.
  useEffect(() => {
    const t = window.setInterval(() => setRelogio((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Mantém a transcrição rolada até o fim.
  useEffect(() => {
    const el = transcricaoRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [e.finais.length, e.parcial]);

  // Mouse e teclado (só quando a aba Aula está visível).
  useEffect(() => {
    if (!ativa) return;
    let acumulado = 0;
    let ultimoPasso = 0;
    const roda = (ev: WheelEvent) => {
      if (ehInterface(ev.target) && (ev.target as Element).closest('textarea')) return;
      ev.preventDefault();
      // Um "dente" da roda = um passo. Touchpads mandam muitos eventos pequenos.
      acumulado += ev.deltaY;
      const agora = Date.now();
      if (Math.abs(acumulado) < 40 || agora - ultimoPasso < 90) return;
      const passo = acumulado > 0 ? 1 : -1;
      acumulado = 0;
      ultimoPasso = agora;
      const est = ctl.obter();
      if (est.modoRoda === 'rolar') ctl.rolar(passo);
      else ctl.mover(passo);
    };
    const botao = (ev: MouseEvent) => {
      if (ev.button === 1) {
        // Clique na roda: bloqueia a rolagem automática do Windows/Chrome.
        ev.preventDefault();
        ctl.alternarModo();
      } else if (ev.button === 2) {
        ev.preventDefault();
        ctl.recolher('mouse');
      } else if (ev.button === 0) {
        if (ehInterface(ev.target)) return;
        ctl.projetar('mouse');
      }
    };
    const semMenu = (ev: MouseEvent) => ev.preventDefault();
    const auxclick = (ev: MouseEvent) => {
      if (ev.button === 1) ev.preventDefault();
    };
    const tecla = (ev: KeyboardEvent) => {
      if (ehInterface(ev.target) && (ev.target as Element).matches('input, textarea')) return;
      const est = ctl.obter();
      const k = ev.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === 'ArrowUp' || k === 'PageUp') {
        ev.preventDefault();
        const passo = k === 'ArrowDown' || k === 'PageDown' ? 1 : -1;
        if (est.modoRoda === 'rolar') ctl.rolar(passo);
        else ctl.mover(passo);
      } else if (k === 'Enter' || k === ' ') {
        ev.preventDefault();
        ctl.projetar('teclado');
      } else if (k === 'b' || k === 'B' || k === 'Delete' || k === 'Backspace') {
        ev.preventDefault();
        ctl.recolher('teclado');
      } else if (k === 'r' || k === 'R') {
        ctl.alternarModo();
      } else if (k === 'm' || k === 'M') {
        ctl.marcar();
      } else if (k === '+' || k === '=') {
        ctl.aumentarFonte();
      } else if (k === '-') {
        ctl.diminuirFonte();
      }
    };
    window.addEventListener('wheel', roda, { passive: false });
    window.addEventListener('mousedown', botao);
    window.addEventListener('auxclick', auxclick);
    window.addEventListener('contextmenu', semMenu);
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('wheel', roda);
      window.removeEventListener('mousedown', botao);
      window.removeEventListener('auxclick', auxclick);
      window.removeEventListener('contextmenu', semMenu);
      window.removeEventListener('keydown', tecla);
    };
  }, [ativa, ctl]);

  const telaCheia = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  const agora = Date.now();

  return (
    <div className="aula">
      <div className="aula-esq">
        <div data-ui style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {!e.escutando ? (
            <button className="botao primario" onClick={() => ctl.iniciar()} disabled={!suporte}>
              {e.saiu ? 'Retomar a aula' : 'Iniciar escuta'}
            </button>
          ) : (
            <>
              <button className="botao" onClick={() => ctl.pausar()}>Pausar escuta</button>
              <button className="botao escuro" onClick={() => ctl.sair()} title="Pausa a escuta e libera o projetor">Sair</button>
            </>
          )}
          <button className="botao" onClick={() => void ctl.abrirProjecao()}>
            {e.projecao.conectada ? 'Projeção aberta ✓' : 'Abrir projeção'}
          </button>
          <button className="botao" onClick={telaCheia}>Tela cheia</button>
          <button className="botao" onClick={() => ctl.marcar()} title="Anota no registro que algo deu errado aqui (tecla M)">
            Marcar momento
          </button>
          <button
            className="botao"
            title="Limpa a tela e começa uma nova sessão no registro (a anterior fica guardada)"
            onClick={() => {
              if (confirm('Começar uma nova sessão? A tela será limpa; o registro da sessão anterior continua guardado.')) {
                void ctl.novaSessao();
              }
            }}
          >
            Nova sessão
          </button>
          <span className="espaco" />
          <span className={classeStatus(e.status)} title={e.statusDetalhe}>
            <span className="luz" />
            {TEXTO_STATUS[e.status]}
            {e.statusDetalhe && e.status !== 'ouvindo' ? ` — ${e.statusDetalhe}` : ''}
          </span>
        </div>

        {!suporte && (
          <div className="aviso" data-ui>Este navegador não tem reconhecimento de voz. Abra o Vide no Chrome ou no Edge.</div>
        )}
        {e.totalAcervo === 0 && (
          <div className="aviso" data-ui>O acervo está vazio. Vá na aba <strong>Acervo</strong> e importe o CPC antes da aula.</div>
        )}
        {e.aviso && (
          <div className="aviso" data-ui onClick={() => ctl.fecharAviso()}>{e.aviso}</div>
        )}


        {e.candidatos.length === 0 ? (
          <div className="vazio">
            Os candidatos aparecem aqui quando você citar um dispositivo do CPC, por exemplo:
            <br />
            <em>"artigo 70"</em>, <em>"inciso sexto do 485"</em>, <em>"parágrafo primeiro do artigo 300"</em>.
            <br />
            Roda do mouse escolhe · clique esquerdo projeta · clique direito recolhe · clique na roda alterna a roda.
          </div>
        ) : (
          <ol className="candidatos">
            {e.candidatos.map((c) => (
              <li
                key={c.id}
                className={`candidato${c.id === e.selecionadoId ? ' selecionado' : ''}${c.id === e.projetado?.id ? ' no-ar' : ''}`}
              >
                <span className="ponto" aria-hidden="true" />
                <span className="ident">{c.titulo}</span>
                <span className="meta">
                  {idade(agora - c.criadoEm)}
                  {c.contexto ? ' · pelo contexto' : ''}
                </span>
                <span className="trecho">{c.texto}</span>
                {c.aviso && <span className="alerta">⚠ {c.aviso}</span>}
              </li>
            ))}
          </ol>
        )}

        <div className="no-projetor">
          <span className={`status ${e.projetado ? 'ok' : ''}`}>
            <span className="luz" />
          </span>
          {e.projetado ? (
            <span>
              No projetor: <span className="titulo">{e.projetado.titulo}</span>
              {e.escala !== 1 && <span className="ajuda"> · fonte {Math.round(e.escala * 100)}%</span>}
              {e.modoRoda === 'rolar' && (
                <span className="ajuda">
                  {' '}· a roda está rolando o texto{e.projecao.rolavel ? ` (${Math.round(e.projecao.fracao * 100)}%)` : ' (já cabe inteiro na tela)'}
                </span>
              )}
            </span>
          ) : (
            <span>Projetor em tela neutra (preta)</span>
          )}
          <span className="espaco" />
          {!e.projecao.conectada && <span className="ajuda" style={{ margin: 0 }}>janela de projeção fechada</span>}
          {e.projecao.conectada && !e.projecao.telaCheia && (
            <span className="ajuda" style={{ margin: 0 }}>projeção aberta, mas fora da tela cheia</span>
          )}
        </div>
      </div>

      <aside className="aula-dir">
        <div className="secao-dir">
          <h3>Transcrição bruta (ao vivo)</h3>
          <p className="sessao-info">
            Sessão iniciada às{' '}
            <strong>{new Date(e.sessaoInicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
            {new Date(e.sessaoInicio).toDateString() !== new Date().toDateString() &&
              ` de ${new Date(e.sessaoInicio).toLocaleDateString('pt-BR')}`}
          </p>
        </div>
        <div className="transcricao" ref={transcricaoRef}>
          {e.finais.length === 0 && !e.parcial && (
            <p className="ajuda">O que o reconhecedor entender aparece aqui: em preto o texto definitivo, em cinza o provisório.</p>
          )}
          {e.finais.map((f) => (
            <p key={f.id} className="final">
              <span className="hora">{new Date(f.em).toLocaleTimeString('pt-BR', { hour12: false })}</span>
              {f.texto}
            </p>
          ))}
          {e.parcial && <p className="parcial">{e.parcial}</p>}
        </div>
        <div className="secao-dir" style={{ borderTop: '1px solid var(--linha)' }}>
          <h3>Referências detectadas</h3>
          {e.detectados.length === 0 ? (
            <p className="ajuda" style={{ margin: 0 }}>Nenhuma ainda.</p>
          ) : (
            <ul className="detectados">
              {[...e.detectados].reverse().map((d) => (
                <li key={d.id}>
                  <span className="hora mono">{new Date(d.em).toLocaleTimeString('pt-BR', { hour12: false })}</span>{' '}
                  <strong>{d.titulo}</strong> — {d.situacao}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="secao-dir" data-ui>
          <h3>Testar sem microfone</h3>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              if (textoTeste.trim()) ctl.simularFala(textoTeste.trim());
              setTextoTeste('');
            }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              className="mono"
              style={{ flex: 1, border: '2px solid var(--linha)', borderRadius: 10, padding: '6px 10px', background: '#fff' }}
              placeholder='digite uma frase, ex.: "inciso sexto do 485"'
              value={textoTeste}
              onChange={(ev) => setTextoTeste(ev.target.value)}
              aria-label="Frase de teste"
            />
            <button className="botao pequeno" type="submit">Enviar</button>
          </form>
        </div>
      </aside>
    </div>
  );
}
