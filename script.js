const CHAVE_REGISTROS = 'belleza.movimentacoes.v1';
const form = document.getElementById('form-financeiro');
const campoMes = document.getElementById('mes');
const filtroMes = document.getElementById('filtro-mes');
const mensagem = document.getElementById('mensagens');
const dinheiro = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});
let registros = [];
let idEmEdicao = null;
let armazenamentoDisponivel = true;

function mostrarMensagem(texto, tipo = 'sucesso') {
  mensagem.textContent = texto;
  mensagem.className = `mensagens mensagem mensagem-${tipo}`;
  mensagem.hidden = false;
  mensagem.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
}

function lerRegistrosSalvos() {
  const conteudo = localStorage.getItem(CHAVE_REGISTROS);
  if (!conteudo) return [];

  const dados = JSON.parse(conteudo);
  if (!Array.isArray(dados)) {
    throw new Error('Os dados salvos neste navegador estão em um formato inválido.');
  }
  return dados.map((registro) => ({
    ...registro,
    saldo: registro.receita - registro.despesas
  }));
}

function salvarRegistros(registrosAtualizados = registros) {
  if (!armazenamentoDisponivel) {
    throw new Error('O armazenamento do navegador está indisponível. Seus dados não foram salvos.');
  }

  try {
    localStorage.setItem(CHAVE_REGISTROS, JSON.stringify(registrosAtualizados));
  } catch (erro) {
    throw new Error('Não foi possível salvar neste navegador. Verifique o espaço disponível e as permissões.');
  }
}

function calcularMovimentacao(dados) {
  const mes = dados.mes.trim();
  if (!mes) throw new Error('Digite o mês antes de salvar.');

  const nomesQuantidade = ['produto1', 'produto2', 'produto3', 'funcionarios'];
  const quantidades = nomesQuantidade.map((nome) => {
    const texto = dados[nome].trim();
    const valor = texto === '' ? 0 : Number(texto);
    if (!Number.isSafeInteger(valor) || valor < 0) {
      throw new Error('Nas quantidades, digite números inteiros iguais ou maiores que zero.');
    }
    return valor;
  });

  const lerDespesa = (valor, nome) => {
    const numero = Number(valor.trim().replace(',', '.') || 0);
    if (!Number.isFinite(numero) || numero < 0) {
      throw new Error(`Confira o valor de ${nome}. Use um número igual ou maior que zero.`);
    }
    return numero;
  };

  const [produto1, produto2, produto3, funcionarios] = quantidades;
  const aluguel = lerDespesa(dados.aluguel, 'aluguel');
  const energia = lerDespesa(dados.energia, 'energia');
  const receita = produto1 * 20 + produto2 * 35 + produto3 * 25;
  const despesas = funcionarios * 700 + aluguel + energia;

  return {
    mes,
    produto1,
    produto2,
    produto3,
    funcionarios,
    aluguel,
    energia,
    receita,
    despesas,
    saldo: receita - despesas,
    vendas: produto1 + produto2 + produto3
  };
}

function adicionarCelula(linha, texto, classe = '') {
  const celula = document.createElement('td');
  celula.textContent = texto;
  if (classe) celula.className = classe;
  linha.appendChild(celula);
  return celula;
}

function renderizarHistorico(itens) {
  const conteudo = document.getElementById('historico-conteudo');
  conteudo.replaceChildren();

  if (!itens.length) {
    const vazio = document.createElement('p');
    vazio.className = 'historico-vazio';
    vazio.textContent = 'Ainda não há lançamentos salvos. Preencha os campos acima e clique em “Salvar lançamento” para começar.';
    conteudo.appendChild(vazio);
    return;
  }

  const grupos = new Map();
  itens.forEach((registro) => {
    if (!grupos.has(registro.mes)) grupos.set(registro.mes, []);
    grupos.get(registro.mes).push(registro);
  });

  grupos.forEach((lancamentos, mes) => {
    const grupo = document.createElement('section');
    grupo.className = 'grupo-historico';
    const titulo = document.createElement('h3');
    titulo.textContent = mes;
    grupo.appendChild(titulo);

    const contorno = document.createElement('div');
    contorno.className = 'tabela-contorno';
    const tabela = document.createElement('table');
    const cabecalho = document.createElement('thead');
    const linhaCabecalho = document.createElement('tr');

    ['Produtos vendidos', 'Receitas', 'Despesas', 'Saldo', 'Ações'].forEach((texto) => {
      const celula = document.createElement('th');
      celula.textContent = texto;
      linhaCabecalho.appendChild(celula);
    });
    cabecalho.appendChild(linhaCabecalho);

    const corpo = document.createElement('tbody');
    lancamentos.forEach((registro) => {
      const linha = document.createElement('tr');
      adicionarCelula(linha, String(registro.vendas));
      adicionarCelula(linha, dinheiro.format(registro.receita));
      adicionarCelula(linha, dinheiro.format(registro.despesas));
      adicionarCelula(linha, dinheiro.format(registro.saldo), 'valor-saldo');

      const acoes = document.createElement('td');
      acoes.className = 'acoes-registro';
      const editar = document.createElement('button');
      editar.type = 'button';
      editar.className = 'acao-link';
      editar.textContent = 'Editar lançamento';
      editar.addEventListener('click', () => iniciarEdicao(registro));

      const excluir = document.createElement('button');
      excluir.type = 'button';
      excluir.className = 'acao-link acao-excluir';
      excluir.textContent = 'Excluir lançamento';
      excluir.addEventListener('click', () => excluirLancamento(registro));

      acoes.append(editar, excluir);
      linha.appendChild(acoes);
      corpo.appendChild(linha);
    });

    tabela.append(cabecalho, corpo);
    contorno.appendChild(tabela);
    grupo.appendChild(contorno);
    conteudo.appendChild(grupo);
  });
}

function renderizarDashboard(mesPreferido = filtroMes.value) {
  const registrosOrdenados = [...registros].sort(
    (a, b) => b.criadoEm.localeCompare(a.criadoEm) || b.id - a.id
  );
  const meses = [...new Set(registrosOrdenados.map((registro) => registro.mes))];
  const mes = meses.includes(mesPreferido) ? mesPreferido : (meses[0] || '');
  const registrosDoMes = registros.filter((registro) => registro.mes === mes);
  const totais = registrosDoMes.reduce(
    (soma, registro) => ({
      receita: soma.receita + registro.receita,
      despesas: soma.despesas + registro.despesas,
      saldo: soma.saldo + registro.saldo,
      vendas: soma.vendas + registro.vendas
    }),
    { receita: 0, despesas: 0, saldo: 0, vendas: 0 }
  );
  const valorMaximo = Math.max(totais.receita, totais.despesas, 1);

  document.getElementById('total-receitas').textContent = dinheiro.format(totais.receita);
  document.getElementById('total-despesas').textContent = dinheiro.format(totais.despesas);
  document.getElementById('total-saldo').textContent = dinheiro.format(totais.saldo);
  document.getElementById('total-vendas').textContent = totais.vendas.toLocaleString('pt-BR');
  document.getElementById('grafico-receitas').textContent = dinheiro.format(totais.receita);
  document.getElementById('grafico-despesas').textContent = dinheiro.format(totais.despesas);
  document.getElementById('barra-receitas').style.width = `${Math.round(totais.receita / valorMaximo * 100)}%`;
  document.getElementById('barra-despesas').style.width = `${Math.round(totais.despesas / valorMaximo * 100)}%`;

  filtroMes.replaceChildren();
  if (!meses.length) {
    const opcao = document.createElement('option');
    opcao.value = '';
    opcao.textContent = 'Nenhum mês salvo';
    filtroMes.appendChild(opcao);
    filtroMes.disabled = true;
  } else {
    meses.forEach((mesDisponivel) => {
      const opcao = document.createElement('option');
      opcao.value = mesDisponivel;
      opcao.textContent = mesDisponivel;
      opcao.selected = mesDisponivel === mes;
      filtroMes.appendChild(opcao);
    });
    filtroMes.disabled = false;
  }

  renderizarHistorico(registrosOrdenados);
}

function atualizarPrevia() {
  try {
    const dados = calcularMovimentacao({
      mes: campoMes.value.trim() || '—',
      produto1: document.getElementById('produto1').value,
      produto2: document.getElementById('produto2').value,
      produto3: document.getElementById('produto3').value,
      funcionarios: document.getElementById('quantidade_funcionarios').value,
      aluguel: document.getElementById('despesas2').value,
      energia: document.getElementById('despesas3').value
    });
    document.getElementById('receita-total').textContent = dinheiro.format(dados.receita);
    document.getElementById('despesas-total').textContent = dinheiro.format(dados.despesas);
    document.getElementById('saldo-final').textContent = dinheiro.format(dados.saldo);
  } catch (erro) {
    document.getElementById('receita-total').textContent = '—';
    document.getElementById('despesas-total').textContent = '—';
    document.getElementById('saldo-final').textContent = '—';
  }
  document.getElementById('saldo-mes').textContent = campoMes.value.trim() || '—';
}

function iniciarEdicao(registro) {
  idEmEdicao = registro.id;
  campoMes.value = registro.mes;
  document.getElementById('produto1').value = registro.produto1;
  document.getElementById('produto2').value = registro.produto2;
  document.getElementById('produto3').value = registro.produto3;
  document.getElementById('quantidade_funcionarios').value = registro.funcionarios;
  document.getElementById('despesas2').value = registro.aluguel;
  document.getElementById('despesas3').value = registro.energia;
  document.getElementById('modo-formulario').textContent = 'EDIÇÃO';
  document.getElementById('titulo-formulario').textContent = 'Editar lançamento';
  document.getElementById('botao-salvar').textContent = 'Salvar alterações';
  document.getElementById('botao-cancelar').hidden = false;
  document.getElementById('botao-limpar').hidden = true;
  atualizarPrevia();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelarEdicao() {
  idEmEdicao = null;
  form.reset();
  document.getElementById('modo-formulario').textContent = 'NOVA MOVIMENTAÇÃO';
  document.getElementById('titulo-formulario').textContent = 'Registrar receitas e despesas';
  document.getElementById('botao-salvar').textContent = 'Salvar lançamento';
  document.getElementById('botao-cancelar').hidden = true;
  document.getElementById('botao-limpar').hidden = false;
  atualizarPrevia();
}

function excluirLancamento(registro) {
  if (!confirm(`Tem certeza de que deseja excluir o lançamento de ${registro.mes}?`)) return;

  try {
    const registrosAtualizados = registros.filter((item) => item.id !== registro.id);
    salvarRegistros(registrosAtualizados);
    registros = registrosAtualizados;
    renderizarDashboard();
    mostrarMensagem('Lançamento excluído. Os totais do mês foram atualizados.');
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
}

form.addEventListener('input', atualizarPrevia);
filtroMes.addEventListener('change', () => renderizarDashboard(filtroMes.value));
document.getElementById('botao-cancelar').addEventListener('click', cancelarEdicao);
form.addEventListener('reset', () => setTimeout(atualizarPrevia));

form.addEventListener('submit', (evento) => {
  evento.preventDefault();
  try {
    const dados = calcularMovimentacao({
      mes: campoMes.value,
      produto1: document.getElementById('produto1').value,
      produto2: document.getElementById('produto2').value,
      produto3: document.getElementById('produto3').value,
      funcionarios: document.getElementById('quantidade_funcionarios').value,
      aluguel: document.getElementById('despesas2').value,
      energia: document.getElementById('despesas3').value
    });

    let registrosAtualizados;
    if (idEmEdicao === null) {
      const proximoId = registros.reduce((maior, item) => Math.max(maior, item.id), 0) + 1;
      registrosAtualizados = [...registros, { ...dados, id: proximoId, criadoEm: new Date().toISOString() }];
    } else {
      const indice = registros.findIndex((item) => item.id === idEmEdicao);
      if (indice < 0) throw new Error('Esse lançamento não foi encontrado. Atualize a página e tente novamente.');
      registrosAtualizados = registros.map((item) =>
        item.id === idEmEdicao ? { ...item, ...dados } : item
      );
    }

    salvarRegistros(registrosAtualizados);
    registros = registrosAtualizados;
    const mesSalvo = dados.mes;
    const estavaEditando = idEmEdicao !== null;
    cancelarEdicao();
    renderizarDashboard(mesSalvo);
    mostrarMensagem(
      estavaEditando
        ? 'Lançamento atualizado. Os totais do mês foram recalculados.'
        : 'Lançamento salvo. Os totais do mês já foram atualizados.'
    );
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
});

campoMes.addEventListener('input', () => {
  document.getElementById('saldo-mes').textContent = campoMes.value.trim() || '—';
});

try {
  registros = lerRegistrosSalvos();
  renderizarDashboard();
  atualizarPrevia();
} catch (erro) {
  armazenamentoDisponivel = false;
  form.querySelectorAll('input, button').forEach((campo) => {
    campo.disabled = true;
  });
  mostrarMensagem(
    `${erro.message} Os lançamentos não podem ser carregados ou salvos neste navegador.`,
    'erro'
  );
  renderizarHistorico([]);
}

window.addEventListener('storage', (evento) => {
  if (evento.key !== CHAVE_REGISTROS) return;
  try {
    registros = lerRegistrosSalvos();
    renderizarDashboard();
    mostrarMensagem('Os lançamentos foram atualizados em outra aba.');
  } catch (erro) {
    mostrarMensagem(erro.message, 'erro');
  }
});
