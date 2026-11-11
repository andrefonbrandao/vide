// Botão do Google Drive no alto do Vide e a janela com a conta e a sincronização.
import { confirmar } from '../comum/avisos';
import { useState, useSyncExternalStore } from 'react';
import { servicoDrive, type EstadoDrive } from '../drive/servico';

function useDrive(): EstadoDrive {
  const s = servicoDrive();
  return useSyncExternalStore(s.assinar, s.obter);
}

function hora(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function BotaoDrive() {
  const d = useDrive();
  const [aberto, setAberto] = useState(false);
  const texto =
    d.status === 'desligado'
      ? 'Google Drive'
      : d.status === 'precisa-entrar'
        ? 'Drive: reconectar'
        : d.status === 'entrando'
          ? 'Drive: entrando…'
          : d.status === 'sincronizando'
            ? 'Drive: sincronizando…'
            : d.status === 'erro'
              ? 'Drive: erro'
              : `Drive ✓${d.ultima ? ` ${hora(d.ultima)}` : ''}`;
  const classe = d.status === 'ok' ? 'ok' : d.status === 'precisa-entrar' || d.status === 'erro' ? 'alerta' : '';
  return (
    <>
      <button
        className={`botao pequeno botao-drive ${classe}`}
        onClick={() => {
          // Reconectar direto no clique (o navegador só deixa abrir o login num clique).
          if (d.status === 'precisa-entrar') void servicoDrive().entrar();
          setAberto(true);
        }}
        title="Guardar e sincronizar o acervo no seu Google Drive"
      >
        <span className="luz" /> {texto}
        {d.pendente && d.status !== 'sincronizando' && d.status !== 'desligado' ? ' ·' : ''}
      </button>
      {aberto && <JanelaDrive aoFechar={() => setAberto(false)} />}
    </>
  );
}

function JanelaDrive({ aoFechar }: { aoFechar: () => void }) {
  const d = useDrive();
  const s = servicoDrive();
  const conectado = d.status === 'ok' || d.status === 'sincronizando' || d.status === 'erro';
  return (
    <div className="modal-fundo" data-ui onMouseDown={(ev) => ev.target === ev.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-label="Google Drive">
        <h2>Google Drive</h2>
        {d.status === 'desligado' ? (
          <>
            <p className="ajuda">
              Guarde o acervo (leis, materiais, questões e o registro das aulas) numa pasta <strong>Vide</strong> do seu Google Drive.
              Em qualquer computador, entre com a mesma conta e o Vide traz tudo. As mudanças sobem sozinhas.
            </p>
            <p className="ajuda">
              O Vide só consegue ver os arquivos que ele mesmo cria no seu Drive: o resto do Drive fica invisível para ele.
            </p>
            <div className="modal-botoes">
              <button className="botao primario" onClick={() => void s.entrar()}>
                Entrar com o Google
              </button>
              <button className="botao" onClick={aoFechar}>
                Agora não
              </button>
            </div>
          </>
        ) : (
          <>
            <p>
              Conta: <strong>{d.email || '—'}</strong>
            </p>
            <p className={`status ${d.status === 'ok' ? 'ok' : d.status === 'sincronizando' || d.status === 'entrando' ? 'pulsa' : 'alerta'}`}>
              <span className="luz" />{' '}
              {d.status === 'sincronizando'
                ? `Sincronizando… ${d.etapa}`
                : d.status === 'entrando'
                  ? 'Entrando…'
                  : d.status === 'precisa-entrar'
                    ? 'O login expirou (dura cerca de 1 hora). Clique em Reconectar; as mudanças deste computador ficam guardadas até lá.'
                    : d.status === 'erro'
                      ? `Erro: ${d.erro}`
                      : `Sincronizado${d.ultima ? ` às ${hora(d.ultima)}` : ''}.`}
            </p>
            {d.pendente && conectado && <p className="ajuda">Há mudanças deste computador esperando para subir.</p>}
            {d.resumo && <p className="ajuda">Última troca: {d.resumo}</p>}
            {d.erro && d.status !== 'erro' && <p className="digitar-msg erro">{d.erro}</p>}
            <div className="modal-botoes" style={{ flexWrap: 'wrap' }}>
              {d.status === 'precisa-entrar' ? (
                <button className="botao primario" onClick={() => void s.entrar()}>
                  Reconectar
                </button>
              ) : (
                <button className="botao primario" onClick={() => void s.sincronizar()} disabled={d.status === 'sincronizando'}>
                  Sincronizar agora
                </button>
              )}
              <button className="botao" onClick={aoFechar}>
                Fechar
              </button>
              <span className="espaco" />
              <button
                className="botao pequeno"
                onClick={() => void confirmar({ titulo: 'Desconectar o Google Drive?', texto: 'O acervo continua neste computador e no Drive.', botao: 'Desconectar' }).then((ok) => ok && void s.sair())}
              >
                Sair
              </button>
              <button
                className="botao pequeno"
                onClick={() =>
                  void confirmar({
                    titulo: 'Sair e apagar o Vide deste computador?',
                    texto: 'Leis, materiais, questões e registros saem deste computador. O que já está no Drive continua lá e volta quando você entrar de novo.',
                    botao: 'Sair e apagar',
                    perigo: true,
                  }).then((ok) => ok && void s.sairEApagar())
                }
              >
                Sair e apagar deste computador
              </button>
            </div>
          </>
        )}
        {d.status === 'desligado' && d.erro && <p className="digitar-msg erro">{d.erro}</p>}
      </div>
    </div>
  );
}
