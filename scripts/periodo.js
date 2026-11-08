function dataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function obterSemana(data = new Date()) {
  const inicio = new Date(data);
  inicio.setHours(12, 0, 0, 0);
  inicio.setDate(inicio.getDate() - inicio.getDay());

  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 6);

  return {
    inicio: dataLocal(inicio),
    fim: dataLocal(fim)
  };
}