// "Combinado de orientação": as regras que o orientando lê no começo (do PDF "Orientação de TCC"
// do professor: responsabilidades e fontes de pesquisa). Conteúdo fixo; para mudar, mude aqui.

export type Quem = 'aluno' | 'orientador' | 'ambos';

export const RESPONSABILIDADES: { tarefa: string; quem: Quem }[] = [
  { tarefa: 'Definir o tema e a sua delimitação', quem: 'ambos' },
  { tarefa: 'Pesquisar as fontes bibliográficas', quem: 'aluno' },
  { tarefa: 'Estudar o assunto e dominá-lo', quem: 'aluno' },
  { tarefa: 'Redigir e formatar o trabalho, incluindo o texto e o material de apoio para a apresentação, conforme o manual', quem: 'aluno' },
  { tarefa: 'Controlar o calendário estabelecido e os prazos de entrega', quem: 'aluno' },
  { tarefa: 'Agendar os encontros periódicos de orientação', quem: 'ambos' },
  { tarefa: 'Revisar o texto e sugerir alterações de conteúdo, redação e forma', quem: 'orientador' },
  { tarefa: 'Fornecer insights sobre a melhor metodologia e as fontes para obter o conhecimento buscado', quem: 'orientador' },
  { tarefa: 'Definir os integrantes da banca', quem: 'orientador' },
];

export const FONTES: { tipo: 'sim' | 'cautela' | 'nao'; titulo: string; porque: string; itens: string[] }[] = [
  {
    tipo: 'sim',
    titulo: 'Use como fonte',
    porque: 'Têm autoria identificada e passam por revisão ou controle: são a base do trabalho.',
    itens: ['Livros', 'Revistas científicas', 'Anais de congresso acadêmico', 'Precedentes judiciais'],
  },
  {
    tipo: 'cautela',
    titulo: 'Use com cautela',
    porque: 'Podem ajudar, mas confira quem é o autor e se há base científica. Sempre que possível, cite a obra original de que tratam.',
    itens: ['Artigos em sites da internet', 'Vídeos de palestras (YouTube)'],
  },
  {
    tipo: 'nao',
    titulo: 'Não use como fonte',
    porque: 'Servem para ter ideias e descobrir obras, mas não são fonte do trabalho: encontre e cite a obra original. A inteligência artificial ajuda a pesquisar, entender e revisar, mas não pode ser citada.',
    itens: ['Inteligência artificial', 'Matérias de imprensa', 'Redes sociais'],
  },
];

export const ROTULO_QUEM: Record<Quem, string> = { aluno: 'Você', orientador: 'Orientador', ambos: 'Os dois' };
