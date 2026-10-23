// Janela de pareamento: QR code para abrir o controle no celular.
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { urlDoControle } from '../remoto/protocolo';
import type { ControladorAula, EstadoAula } from './controlador';

export function PareamentoCelular({ e, ctl, aoFechar }: { e: EstadoAula; ctl: ControladorAula; aoFechar: () => void }) {
  const r = e.remoto;
  const url = r.codigo ? urlDoControle(r.codigo) : '';
  const svg = useMemo(() => {
    if (!url) return '';
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [url]);

  return (
    <div className="modal-fundo" data-ui onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-label="Conectar celular">
        <h2>Celular como microfone e controle</h2>
        {!r.codigo ? (
          <>
            <p className="ajuda">
              O celular passa a ouvir a sua voz e a controlar a projeção (alternativas, recolher, páginas). O acervo e a projeção
              continuam neste computador. Os dois precisam de internet.
            </p>
            <button className="botao primario" onClick={() => ctl.conectarCelular()}>
              Gerar QR code
            </button>
          </>
        ) : (
          <div className="pareamento">
            <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
            <div>
              <ol className="lista-simples">
                <li>Abra a <strong>câmera do iPhone</strong> e aponte para o código.</li>
                <li>Toque no aviso que aparece para abrir no <strong>Safari</strong>.</li>
                <li>No celular, toque em <strong>Iniciar escuta</strong> e permita o microfone.</li>
              </ol>
              <p className="ajuda">
                Ou digite no celular: <span className="mono">{url.replace(/^https?:\/\//, '')}</span>
              </p>
              <p className={`status ${r.celularPresente ? 'ok' : r.conexao === 'conectada' ? '' : 'alerta pulsa'}`}>
                <span className="luz" />
                {r.conexao !== 'conectada'
                  ? 'Conectando ao serviço…'
                  : r.celularPresente
                    ? r.vozCelular
                      ? `Celular conectado · microfone: ${r.vozCelular}`
                      : 'Celular conectado'
                    : 'Aguardando o celular…'}
              </p>
              <p className="ajuda">
                Dica: no iPhone, ative o Ditado (Ajustes › Geral › Teclado › Ativar Ditado) e deixe a tela acesa durante a aula.
              </p>
            </div>
          </div>
        )}
        <div className="modal-botoes">
          {r.codigo && (
            <button
              className="botao"
              onClick={() => {
                if (confirm('Desconectar o celular? Para usar de novo, será preciso ler um QR code novo.')) ctl.desconectarCelular();
              }}
            >
              Desconectar celular
            </button>
          )}
          <span className="espaco" />
          <button className="botao escuro" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
