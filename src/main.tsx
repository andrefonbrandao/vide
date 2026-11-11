import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import './estilos.css';
import { Casca } from './telas/Casca';
import { Projecao } from './telas/Projecao';
import { Controle } from './telas/Controle';
import { Jogar } from './telas/Jogar';
import { Treino } from './telas/Treino';
import { PaginaProcesso } from './telas/ProcessoAluno';

const parametros = new URLSearchParams(location.search);
const tela = parametros.get('tela');
const sala = (parametros.get('sala') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// Página dos alunos no jogo de perguntas: /j ou /j/123456.
const rotaJogo = /^\/j(?:\/(\d{6}))?\/?$/.exec(location.pathname);
// Treino em casa: /t/<código>.
const rotaTreino = /^\/t\/([A-Za-z0-9]{10,24})\/?$/.exec(location.pathname);
// Processo fictício (visão da turma): /p/<código>.
const rotaProcesso = /^\/p\/([A-Za-z0-9]{10,24})\/?$/.exec(location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {rotaProcesso ? (
      <PaginaProcesso codigo={rotaProcesso[1]} />
    ) : rotaTreino ? (
      <Treino codigo={rotaTreino[1]} />
    ) : rotaJogo ? (
      <Jogar codigoInicial={rotaJogo[1] ?? ''} />
    ) : tela === 'projecao' ? (
      <Projecao />
    ) : tela === 'controle' && sala ? (
      <Controle codigo={sala} />
    ) : (
      <Casca />
    )}
  </StrictMode>,
);
