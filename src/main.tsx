import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './estilos.css';
import { Logo } from './comum/Logo';
import { Acervo } from './telas/Acervo';
import { Aula } from './telas/Aula';
import { Projecao } from './telas/Projecao';
import { Registro } from './telas/Registro';

type Aba = 'aula' | 'acervo' | 'registro';

function App() {
  const [aba, setAba] = useState<Aba>('aula');
  return (
    <div className="app">
      <header className="barra" data-ui>
        <Logo altura={30} />
        <nav className="abas" aria-label="Seções">
          {(['aula', 'acervo', 'registro'] as Aba[]).map((a) => (
            <button key={a} className="aba" aria-current={aba === a ? 'page' : undefined} onClick={() => setAba(a)}>
              {a === 'aula' ? 'Aula' : a === 'acervo' ? 'Acervo' : 'Registro'}
            </button>
          ))}
        </nav>
        <span className="espaco" />
        <span className="ajuda" style={{ margin: 0, fontSize: 13 }}>protótipo de teste · v0.3</span>
      </header>
      <main className="conteudo">
        {/* A aula continua montada (e ouvindo) mesmo em outra aba. */}
        <div style={{ display: aba === 'aula' ? 'block' : 'none', height: '100%' }}>
          <Aula ativa={aba === 'aula'} />
        </div>
        {aba === 'acervo' && <Acervo />}
        {aba === 'registro' && <Registro />}
      </main>
    </div>
  );
}

const ehProjecao = new URLSearchParams(location.search).get('tela') === 'projecao';

createRoot(document.getElementById('root')!).render(
  <StrictMode>{ehProjecao ? <Projecao /> : <App />}</StrictMode>,
);
