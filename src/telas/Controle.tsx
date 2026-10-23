// Página do celular: microfone + controle remoto da aula.
// O acervo, a detecção, o registro e a projeção ficam no computador; o celular
// manda o texto reconhecido e os comandos, e recebe a lista de alternativas.
import { useEffect, useRef, useState } from 'react';
import { Logo } from '../comum/Logo';
import {
  IcAnterior,
  IcMicrofone,
  IcMostrar,
  IcOcultar,
  IcPaginaInteira,
  IcPausa,
  IcPin,
  IcProxima,
  IcRecolher,
  IcSubstituir,
  IcVisualizacao,
} from '../comum/Icones';
import { ConexaoSala, type StatusConexao } from '../remoto/conexao';
import type { ComandoRemoto, EstadoRemoto, MsgDoCelular, MsgDoComputador } from '../remoto/protocolo';
import { Reconhecedor, obterConstrutor, type StatusVoz } from '../voz/reconhecedor';

type WakeLockSentinel = { release(): Promise<void> };

const TEXTO_VOZ: Record<StatusVoz, string> = {
  parado: 'Escuta desligada',
  iniciando: 'Iniciando o microfone…',
  ouvindo: 'Ouvindo',
  reiniciando: 'Reconectando a voz…',
  erro: 'A escuta parou',
  'sem-suporte': 'Este navegador não reconhece voz',
};

/** -1 se a < b, 0 se iguais, 1 se a > b ("0.9.0" < "0.10.0"). */
function compararVersao(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function Controle({ codigo }: { codigo: string }) {
  const [conexao, setConexao] = useState<StatusConexao>('conectando');
  const [computador, setComputador] = useState(false);
  const [estado, setEstado] = useState<EstadoRemoto | null>(null);
  const [voz, setVoz] = useState<StatusVoz>('parado');
  const [vozDetalhe, setVozDetalhe] = useState('');
  const [parcial, setParcial] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);
  const [digitado, setDigitado] = useState('');
  const [respDigitado, setRespDigitado] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const campoDigitado = useRef<HTMLInputElement>(null);
  const esperaDigitado = useRef<number | null>(null);
  const salaRef = useRef<ConexaoSala<MsgDoComputador, MsgDoCelular> | null>(null);
  const reconRef = useRef<Reconhecedor | null>(null);
  const travaTela = useRef<WakeLockSentinel | null>(null);
  const suporte = !!obterConstrutor();

  const enviar = (m: MsgDoCelular) => salaRef.current?.enviar(m);

  // Conexão com a sala do computador.
  useEffect(() => {
    document.title = 'Vide — controle';
    const sala = new ConexaoSala<MsgDoComputador, MsgDoCelular>(
      codigo,
      'celular',
      (m) => {
        if (m.t === 'estado') {
          setEstado(m);
          // Celular com versão mais antiga que o computador: recarrega sozinho (uma vez a cada minuto, no máximo).
          if (m.versao && compararVersao(__VERSAO__, m.versao) < 0) {
            try {
              const ultima = Number(sessionStorage.getItem('vide.recarga') ?? 0);
              if (Date.now() - ultima > 60_000) {
                sessionStorage.setItem('vide.recarga', String(Date.now()));
                location.reload();
              }
            } catch {
              /* ignore */
            }
          }
        }
        else if (m.t === 'presenca') setComputador(m.computador > 0);
        else if (m.t === 'resposta-digitado') {
          if (esperaDigitado.current) window.clearTimeout(esperaDigitado.current);
          esperaDigitado.current = null;
          setRespDigitado({ ok: m.ok, mensagem: m.mensagem });
          if (m.ok) {
            setDigitado('');
            campoDigitado.current?.blur(); // fecha o teclado
          }
        }
        else if (m.t === 'parar-escuta') {
          reconRef.current?.parar();
          setAviso('O microfone do computador foi ligado; a escuta do celular parou.');
        }
      },
      (s) => {
        setConexao(s);
        if (s === 'conectada') sala.enviar({ t: 'ola-celular' });
      },
    );
    salaRef.current = sala;
    return () => sala.fechar();
  }, [codigo]);

  // Reconhecimento de voz no celular: manda o texto para o computador.
  useEffect(() => {
    const rec = new Reconhecedor({
      onParcial: (texto, chave) => {
        setParcial(texto);
        if (texto) enviar({ t: 'voz', tipo: 'parcial', texto, chave });
      },
      onFinal: (texto, chave, confianca) => {
        setParcial('');
        enviar({ t: 'voz', tipo: 'final', texto, chave, confianca });
      },
      onStatus: (s, d) => {
        setVoz(s);
        setVozDetalhe(d ?? '');
        enviar({ t: 'voz-status', status: s, detalhe: d });
      },
      onDiagnostico: (texto, dados) => enviar({ t: 'diag', texto, dados }),
    });
    reconRef.current = rec;
    return () => rec.parar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Tela acesa enquanto escuta (o iPhone para a escuta se a tela apagar).
  useEffect(() => {
    const ativo = voz === 'ouvindo' || voz === 'iniciando' || voz === 'reiniciando';
    const nav = navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinel> } };
    const pedir = async () => {
      if (!ativo || travaTela.current || !nav.wakeLock) return;
      try {
        travaTela.current = await nav.wakeLock.request('screen');
      } catch {
        /* sem permissão: segue sem */
      }
    };
    if (ativo) void pedir();
    else if (travaTela.current) {
      void travaTela.current.release().catch(() => {});
      travaTela.current = null;
    }
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') {
        travaTela.current = null;
        void pedir();
      }
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [voz]);

  const cmd = (c: ComandoRemoto) => {
    if (!enviar(c)) setAviso('Sem conexão com o computador. Tentando reconectar…');
    if (navigator.vibrate) navigator.vibrate(15);
  };

  const computadorAntigo = !!estado && compararVersao(estado.versao ?? '0', __VERSAO__) < 0;
  const escutando = voz === 'ouvindo' || voz === 'iniciando' || voz === 'reiniciando';
  const parouSozinho = voz === 'erro';
  const ditadoDesligado = /bloquead|not-allowed|service/i.test(vozDetalhe);

  return (
    <div className="controle">
      <header className="controle-topo">
        <Logo altura={26} />
        <span className={`chip ${conexao === 'conectada' && computador ? 'ok' : 'alerta'}`}>
          {conexao !== 'conectada' ? 'Conectando…' : computador ? 'Computador conectado' : 'Computador fora da sala'}
        </span>
      </header>

      {!suporte && (
        <div className="aviso">Este navegador não reconhece voz. No iPhone, use o Safari atualizado.</div>
      )}
      {computadorAntigo && (
        <div className="aviso">
          O Vide do computador está numa versão antiga. <strong>Recarregue a página no computador</strong> (tecla F5) para todos os
          botões funcionarem.
        </div>
      )}
      {aviso && (
        <div className="aviso" onClick={() => setAviso(null)}>
          {aviso}
        </div>
      )}

      <section className="controle-voz">
        {!escutando ? (
          <button className="botao-grande primario" onClick={() => { setAviso(null); reconRef.current?.iniciar(); }} disabled={!suporte}>
            <IcMicrofone tamanho={28} /> {parouSozinho ? 'Toque para retomar a escuta' : 'Iniciar escuta'}
          </button>
        ) : (
          <button className="botao-grande" onClick={() => reconRef.current?.parar()}>
            <IcPausa tamanho={28} /> Pausar escuta
          </button>
        )}
        <p className={`controle-status ${escutando ? 'ok' : ''}`}>
          <span className="luz" /> {TEXTO_VOZ[voz]}
          {vozDetalhe && voz !== 'ouvindo' ? ` — ${vozDetalhe}` : ''}
        </p>
        {ditadoDesligado && (
          <p className="ajuda">
            No iPhone: <strong>Ajustes › Geral › Teclado › Ativar Ditado</strong>. Depois, permita o microfone para este site (ícone
            "aA" na barra do Safari › Ajustes do Site › Microfone).
          </p>
        )}
        <p className="controle-fala">{parcial || estado?.ultimaFala || 'O que você falar aparece aqui.'}</p>
      </section>

      <section className="controle-projetor">
        <div className="controle-no-ar">
          <span className="ajuda">No projetor</span>
          <strong>
            {estado?.projetadoTitulo ??
              (estado?.material && !estado.telaPreta ? `${estado.material.nome} · p. ${estado.material.pagina}` : 'tela preta')}
          </strong>
        </div>
        <button className="botao-grande destaque" onClick={() => cmd({ t: 'cmd', acao: 'recolher' })} disabled={!estado?.projetadoId}>
          <IcRecolher tamanho={26} /> Recolher
        </button>
      </section>

      <section className="controle-alternativas">
        <form
          className="digitar-artigo controle-digitar"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!digitado.trim()) return;
            setRespDigitado({ ok: true, mensagem: 'Enviando…' });
            cmd({ t: 'cmd', acao: 'digitar', texto: digitado });
            // O computador sempre responde; se não responder, provavelmente está com o Vide antigo aberto.
            if (esperaDigitado.current) window.clearTimeout(esperaDigitado.current);
            esperaDigitado.current = window.setTimeout(() => {
              esperaDigitado.current = null;
              setRespDigitado({
                ok: false,
                mensagem: computadorAntigo
                  ? 'O Vide do computador está desatualizado. Recarregue a página no computador (tecla F5) e tente de novo.'
                  : 'O computador não respondeu. Confira se o Vide está aberto no computador e recarregue a página lá (F5).',
              });
            }, 4_000);
          }}
        >
          <input
            ref={campoDigitado}
            type="text"
            enterKeyHint="send"
            value={digitado}
            placeholder="Digitar artigo: 485 VI · 5 CF"
            aria-label="Digitar artigo para projetar"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(ev) => {
              setDigitado(ev.target.value);
              setRespDigitado(null);
            }}
          />
          <button type="submit" className="botao" disabled={!digitado.trim()}>
            Projetar
          </button>
          {respDigitado && <span className={`digitar-msg${respDigitado.ok ? '' : ' erro'}`}>{respDigitado.mensagem}</span>}
        </form>

        <h2>Alternativas</h2>
        {!estado?.alternativas.length && <p className="ajuda">Aparecem aqui quando você citar um dispositivo de lei. Toque para projetar.</p>}
        <ul>
          {estado?.alternativas.map((a) => (
            <li key={a.id}>
              <button
                className={`alternativa${a.id === estado.projetadoId ? ' no-ar' : ''}`}
                onClick={() => cmd({ t: 'cmd', acao: 'projetar', id: a.id })}
              >
                <span className="alternativa-titulo">{a.titulo}</span>
                <span className="alternativa-texto">{a.texto}</span>
                {a.id === estado.projetadoId && <span className="alternativa-selo">no projetor</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {estado?.material && (
        <section className="controle-material">
          <div className="controle-material-cab">
            <strong>{estado.material.nome}</strong>
            <span>
              página {estado.material.pagina} de {estado.material.paginas}
            </span>
          </div>
          <div className="controle-paginas">
            <button className="botao-grande" onClick={() => cmd({ t: 'cmd', acao: 'pagina', delta: -1 })} aria-label="Voltar">
              <IcAnterior tamanho={30} />
            </button>
            <button className="botao-grande" onClick={() => cmd({ t: 'cmd', acao: 'pagina', delta: 1 })} aria-label="Avançar">
              <IcProxima tamanho={30} />
            </button>
          </div>
          <div className="controle-material-botoes">
            {estado.material.zoom && (
              <button className="botao com-icone" onClick={() => cmd({ t: 'cmd', acao: 'paginaInteira' })}>
                <IcPaginaInteira tamanho={18} /> Página inteira
              </button>
            )}
            <button className="botao com-icone" onClick={() => cmd({ t: 'cmd', acao: 'ocultar' })}>
              {estado.telaPreta ? <IcMostrar tamanho={18} /> : <IcOcultar tamanho={18} />} {estado.telaPreta ? 'Mostrar' : 'Ocultar'}
            </button>
            <button
              className="botao com-icone"
              onClick={() => cmd({ t: 'cmd', acao: 'layout', valor: estado.layout === 'lateral' ? 'cheia' : 'lateral' })}
            >
              {estado.layout === 'lateral' ? <IcVisualizacao tamanho={18} /> : <IcSubstituir tamanho={18} />}
              {estado.layout === 'lateral' ? 'Ao lado da norma' : 'Substituir pela norma'}
            </button>
          </div>
        </section>
      )}

      <section className="controle-rodape">
        <button className="botao com-icone" onClick={() => cmd({ t: 'cmd', acao: 'marcar' })}>
          <IcPin tamanho={18} /> Registrar momento
        </button>
        <span className="ajuda">sala {codigo}</span>
      </section>
    </div>
  );
}
