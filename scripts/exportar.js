//  EXPORTAÇÃO (desativada por enquanto)
//  A lógica está pronta, mas comentada para não baixar um .txt a cada clique
//  enquanto você testa pelo console. Para ativar:
//    1) descomente este arquivo
//    2) em popup.js, descomente a chamada exportarRelatorio(...) dentro do clique


function baixarTXT(relatorio, semana) {
  const blob = new Blob([relatorio], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = `participacao_${semana.inicio}.txt`;
  link.click();

  URL.revokeObjectURL(link.href);
}

function montarTSV(dados) {
  const cabecalho = ["Nome", ...ORDEM_EVENTOS, "Participações", "%"];

  const linhas = JOGADORES_ATIVOS.map((nome) => {
    const participacoes = ORDEM_EVENTOS.map(
      (codigo) => dados.resultados[codigo]?.[nome] ?? "-"
    );
    const confirmadas = participacoes.filter((v) => v === "S" || v === "N");
    const total = participacoes.filter((v) => v === "S").length;
    const percentual = confirmadas.length
      ? `${Math.round((total / confirmadas.length) * 100)}%`
      : "-";

    return [nome, ...participacoes, `${total}/${confirmadas.length}`, percentual];
  });

  return [cabecalho, ...linhas].map((l) => l.join("\t")).join("\n");
}

async function copiarParaAreaDeTransferencia(dados) {
  await navigator.clipboard.writeText(montarTSV(dados));
}

async function exportarRelatorio({ relatorio, dados, semana }) {
  baixarTXT(relatorio, semana);
  await copiarParaAreaDeTransferencia(dados);
}
