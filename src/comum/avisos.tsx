// Avisos rápidos (no canto, somem sozinhos) e janelas de confirmação do próprio Vide,
// no lugar das caixas padrão do navegador.
import { useEffect, useRef, useState } from 'react';

interface Aviso {
  id: number;
  texto: string;
  tipo: 'ok' | 'erro';
}

interface PedidoConfirmacao {
  titulo: string;
  texto?: string;
  /** Texto do botão principal ("Apagar", "Desativar"…). */
  botao?: string;
  /** Ação destrutiva: o botão fica em destaque de alerta. */
  perigo?: boolean;
  responder: (ok: boolean) => void;
}

let proximo = 1;
const ouvintesAviso = new Set<(a: Aviso) => void>();
const ouvintesConfirmacao = new Set<(p: PedidoConfirmacao) => void>();

/** Mostra um aviso rápido no canto da tela ("Salvo", "Link copiado"). */
export function avisar(texto: string, tipo: Aviso['tipo'] = 'ok'): void {
  const a = { id: proximo++, texto, tipo };
  ouvintesAviso.forEach((f) => f(a));
}

/** Pergunta antes de uma ação (apagar, desativar…). Resolve true se a pessoa confirmar. */
export function confirmar(opcoes: Omit<PedidoConfirmacao, 'responder'>): Promise<boolean> {
  if (!ouvintesConfirmacao.size) return Promise.resolve(window.confirm(opcoes.texto ? `${opcoes.titulo}\n\n${opcoes.texto}` : opcoes.titulo));
  return new Promise((responder) => ouvintesConfirmacao.forEach((f) => f({ ...opcoes, responder })));
}

/** Camada que desenha os avisos e as confirmações (uma vez, na casca do app). */
export function CamadaAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const novoAviso = (a: Aviso) => {
      setAvisos((l) => [...l.slice(-2), a]);
      window.setTimeout(() => setAvisos((l) => l.filter((x) => x.id !== a.id)), a.tipo === 'erro' ? 6000 : 3200);
    };
    const novoPedido = (p: PedidoConfirmacao) => setPedido(p);
    ouvintesAviso.add(novoAviso);
    ouvintesConfirmacao.add(novoPedido);
    return () => {
      ouvintesAviso.delete(novoAviso);
      ouvintesConfirmacao.delete(novoPedido);
    };
  }, []);
  useEffect(() => {
    if (!pedido) return;
    botao.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') responder(false);
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const responder = (ok: boolean) => {
    pedido?.responder(ok);
    setPedido(null);
  };
  return (
    <>
      <div className="avisos-rapidos" role="status" aria-live="polite" data-ui>
        {avisos.map((a) => (
          <div key={a.id} className={`aviso-rapido ${a.tipo}`}>
            <span aria-hidden="true">{a.tipo === 'ok' ? '✓' : '!'}</span> {a.texto}
          </div>
        ))}
      </div>
      {pedido && (
        <div className="modal-fundo" data-ui onMouseDown={(e) => e.target === e.currentTarget && responder(false)}>
          <div className="modal confirmacao" role="alertdialog" aria-label={pedido.titulo}>
            <h2>{pedido.titulo}</h2>
            {pedido.texto && <p className="ajuda">{pedido.texto}</p>}
            <div className="modal-botoes">
              <button className="botao" onClick={() => responder(false)}>
                Cancelar
              </button>
              <button ref={botao} className={`botao ${pedido.perigo ? 'perigo' : 'primario'}`} onClick={() => responder(true)}>
                {pedido.botao ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
