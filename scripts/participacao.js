
function formatarData(dataISO) {
    const [ano, mes, dia] = dataISO.split("-");
    return `${dia}/${mes}/${ano}`;
}

function formatarDataHistorico(data) {
    const meses = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro"
    ];

    return `${data.getDate()} ${meses[data.getMonth()]} ${data.getFullYear()}`;
}

function obterEventosDisponiveis(hoje = new Date()) {
    const domingo = new Date(hoje);
    domingo.setHours(0, 0, 0, 0);
    domingo.setDate(domingo.getDate() - domingo.getDay());

    return EVENTOS_SEMANAIS.filter((evento) => {
        const dataEvento = new Date(domingo);
        dataEvento.setDate(domingo.getDate() + evento.dia);

        const [hora, minuto] = evento.horario.split(":").map(Number);
        dataEvento.setHours(hora, minuto, 0, 0);

        return dataEvento <= hoje;
    }).map((evento) => {
        const dataEvento = new Date(domingo);
        dataEvento.setDate(domingo.getDate() + evento.dia);

        const [hora, minuto] = evento.horario.split(":").map(Number);
        dataEvento.setHours(hora, minuto, 0, 0);

        const ano = dataEvento.getFullYear();
        const mes = String(dataEvento.getMonth() + 1).padStart(2, "0");
        const dia = String(dataEvento.getDate()).padStart(2, "0");

        return {
            ...evento,
            dataEsperada: formatarDataHistorico(dataEvento),
            dataEsperadaISO: `${ano}-${mes}-${dia}`
        };
    });
}


// ==========================================
// MONTAR RELATÓRIO
// ==========================================

function montarRelatorio(dados, semana) {
    const cabecalho = [
        "Nome",
        ...ORDEM_EVENTOS,
        "Participações",
        "%"
    ];

    // Monta todas as linhas dos jogadores.
    const linhas = JOGADORES_ATIVOS.map((nome) => {
        const participacoes = ORDEM_EVENTOS.map((codigo) => {
            const resultado = dados.resultados[codigo];

            if (!resultado) return "-";

            return resultado[nome] ?? "-";
        });

        const confirmadas = participacoes.filter(
            (valor) => valor === "S" || valor === "N"
        );

        const total = participacoes.filter(
            (valor) => valor === "S"
        ).length;

        const percentual = confirmadas.length
            ? `${Math.round((total / confirmadas.length) * 100)}%`
            : "-";

        return [
            nome,
            ...participacoes,
            `${total}/${confirmadas.length}`,
            percentual
        ];
    });

    // ==========================================
    // ORDENAR POR PARTICIPAÇÕES
    // Maior quantidade primeiro.
    // ==========================================

    linhas.sort((a, b) => {
        const participacoesA = parseInt(
            a[a.length - 2].split("/")[0],
            10
        ) || 0;

        const participacoesB = parseInt(
            b[b.length - 2].split("/")[0],
            10
        ) || 0;

        return participacoesB - participacoesA;
    });

    // ==========================================
    // FORMATAR COLUNAS
    // ==========================================

    const larguras = cabecalho.map((titulo, indice) =>
        Math.max(
            titulo.length,
            ...linhas.map((linha) => String(linha[indice]).length)
        )
    );

    const formatarLinha = (linha) =>
        linha
            .map((valor, indice) =>
                String(valor).padEnd(larguras[indice])
            )
            .join("  ");

    return [
        "PARTICIPAÇÃO SEMANAL",
        `Período: ${formatarData(semana.inicio)} até ${formatarData(semana.fim)}`,
        "",
        [cabecalho, ...linhas].map(formatarLinha).join("\n")
    ].join("\n");
}


// ==========================================
// COLETAR PARTICIPAÇÃO
// ==========================================

async function coletarParticipacao(abaId) {
    const hoje = new Date();
    const semana = obterSemana(hoje);
    const chave = "participacaoSemanalVing";

    let dados = (await chrome.storage.local.get(chave))[chave];

    if (
        !dados ||
        !dados.semana ||
        dados.semana.inicio !== semana.inicio
    ) {
        dados = {
            semana,
            resultados: {}
        };
    }

    const eventosParaConsultar = obterEventosDisponiveis(hoje);

    const [resposta] = await chrome.scripting.executeScript({
        target: { tabId: abaId },
        args: [eventosParaConsultar, JOGADORES_ATIVOS],

        func: async (eventos, jogadoresAtivos) => {
            const normalizar = (nome) =>
                nome
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .trim()
                    .toLowerCase();

            const normalizarTexto = (texto) =>
                texto
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/\s+/g, " ")
                    .trim();

            const resultados = {};

            for (const evento of eventos) {
                const url = evento.url;

                if (!url) continue;

                try {
                    const resposta = await fetch(url, {
                        credentials: "include"
                    });

                    if (!resposta.ok) continue;

                    const html = await resposta.text();

                    const documento = new DOMParser().parseFromString(
                        html,
                        "text/html"
                    );

                    const textoPagina = normalizarTexto(
                        documento.body?.innerText ?? ""
                    );

                    // GC1 e GC2 não possuem data no histórico.
                    const eventosSemData = ["GC1", "GC2"];

                    if (!eventosSemData.includes(evento.codigo)) {
                        const [ano, mes, dia] =
                            evento.dataEsperadaISO.split("-");

                        const formatosData = [
                            evento.dataEsperada,
                            `${dia}/${mes}/${ano}`,
                            `${dia}-${mes}-${ano}`,
                            `${dia}.${mes}.${ano}`,
                            evento.dataEsperadaISO,
                            `${dia}/${mes}/${ano.slice(-2)}`
                        ].map(normalizarTexto);

                        const encontrouData = formatosData.some(
                            (data) => textoPagina.includes(data)
                        );

                        if (!encontrouData) continue;
                    }

                    const historico = new Map();

                    documento.querySelectorAll("table tr").forEach((linha) => {
                        const celulas = linha.querySelectorAll("td");

                        if (celulas.length < 2) return;

                        const nome =
                            celulas[0].querySelector("a")?.textContent.trim() ||
                            celulas[0].textContent.trim();

                        const textoPontuacao =
                            celulas[1].textContent.trim();

                        if (!nome) return;

                        // IT1 e IT2: a presença do nome confirma
                        // participação, mesmo com zero cristais.
                        if (["IT1", "IT2"].includes(evento.codigo)) {
                            const pontuacao = Number(
                                textoPontuacao.replace(/\D/g, "")
                            );

                            historico.set(normalizar(nome), pontuacao);
                            return;
                        }

                        // Demais eventos: mantém a regra original
                        // de pontuação maior que zero.
                        if (!/\d/.test(textoPontuacao)) return;

                        const pontuacao = Number(
                            textoPontuacao.replace(/\D/g, "")
                        );

                        historico.set(normalizar(nome), pontuacao);
                    });

                    if (!historico.size) continue;

                    resultados[evento.codigo] = Object.fromEntries(
                        jogadoresAtivos.map((nome) => {
                            const nomeNormalizado = normalizar(nome);
                            const participou = historico.has(nomeNormalizado);

                            if (["IT1", "IT2"].includes(evento.codigo)) {
                                return [
                                    nome,
                                    participou ? "S" : "N"
                                ];
                            }

                            const pontuacao = historico.get(nomeNormalizado);

                            return [
                                nome,
                                pontuacao !== undefined && pontuacao > 0
                                    ? "S"
                                    : "N"
                            ];
                        })
                    );

                } catch (erro) {
                    console.error(
                        `Erro ao consultar ${evento.codigo}:`,
                        erro
                    );
                }
            }

            return resultados;
        }
    });

    // Mantém os dados anteriores se um evento não retornar
    // resultados nesta execução.
    Object.assign(dados.resultados, resposta?.result ?? {});

    await chrome.storage.local.set({
        [chave]: dados
    });

    return {
        dados,
        semana,
        relatorio: montarRelatorio(dados, semana)
    };
}
