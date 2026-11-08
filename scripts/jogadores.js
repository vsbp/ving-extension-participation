const JOGADORES_ATIVOS = [];

function normalizarNome(nome) {
    return nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}


// ==========================================
// 1. IDENTIFICAR O CLÃ DA CONTA LOGADA
// ==========================================

async function detectarClanId(tabId) {
    const [resultado] = await chrome.scripting.executeScript({
        target: { tabId },

        func: () => {
            const links = [
                ...document.querySelectorAll('a[href*="/clan?id="]')
            ];

            const linkDoClan = links.find((a) => {
                const url = new URL(
                    a.getAttribute("href"),
                    location.origin
                );

                return (
                    url.pathname === "/clan" &&
                    url.searchParams.has("id") &&
                    url.searchParams.get("online") === "1"
                );
            });

            if (!linkDoClan) {
                return null;
            }

            const url = new URL(
                linkDoClan.getAttribute("href"),
                location.origin
            );

            return url.searchParams.get("id");
        }
    });

    const clanId = resultado?.result;

    if (!clanId) {
        throw new Error(
            "Não foi possível identificar o clã da conta logada."
        );
    }

    console.log("Clã identificado:", clanId);

    return clanId;
}


// ==========================================
// 2. BUSCAR TODOS OS JOGADORES DO CLÃ
// ==========================================

async function atualizarJogadoresAtivos(tabId) {
    const clanId = await detectarClanId(tabId);

    const [resultado] = await chrome.scripting.executeScript({
        target: { tabId },
        args: [clanId],

        func: async (idClan) => {

            const jogadores = new Map();

            let ultimaPagina = 1;

            const MAX_PAGINAS = 100;

            async function buscarPagina(numeroPagina) {
                const url = new URL("/clan", location.origin);

                url.searchParams.set("id", idClan);
                url.searchParams.set("online", "0");
                url.searchParams.set("page", numeroPagina);

                const resposta = await fetch(url.href, {
                    credentials: "same-origin"
                });

                if (!resposta.ok) {
                    throw new Error(
                        `Erro ao carregar a página ${numeroPagina}: HTTP ${resposta.status}`
                    );
                }

                const html = await resposta.text();

                const documento = new DOMParser().parseFromString(
                    html,
                    "text/html"
                );

                // Jogadores da página atual
                const membros = [
                    ...documento.querySelectorAll("a.clan_member")
                ];

                if (numeroPagina === 1 && membros.length === 0) {
                    throw new Error(
                        "Nenhum jogador encontrado na primeira página do clã."
                    );
                }

                membros.forEach((membro) => {
                    const nome = membro.textContent.trim();

                    const href = membro.getAttribute("href") || "";

                    const urlJogador = new URL(href, location.origin);

                    const playerId = urlJogador.searchParams.get(
                        "player_id"
                    );

                    if (!nome) return;

                    // Usa o ID para evitar jogadores duplicados.
                    // Se não houver ID, utiliza o nome normalizado.
                    const chave = playerId || nome
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .trim()
                        .toLowerCase();

                    jogadores.set(chave, nome);
                });

                // Descobre se existem mais páginas.
                const linksPaginacao = [
                    ...documento.querySelectorAll(".pgn a.pag[href]")
                ];

                const paginasEncontradas = linksPaginacao
                    .map((link) => {
                        const linkUrl = new URL(
                            link.getAttribute("href"),
                            location.origin
                        );

                        return Number(
                            linkUrl.searchParams.get("page")
                        );
                    })
                    .filter((pagina) => {
                        return (
                            Number.isInteger(pagina) &&
                            pagina > numeroPagina
                        );
                    });

                if (paginasEncontradas.length > 0) {
                    ultimaPagina = Math.max(
                        ultimaPagina,
                        ...paginasEncontradas
                    );
                }

                return membros.length;
            }

            // Percorre todas as páginas encontradas.
            for (
                let pagina = 1;
                pagina <= ultimaPagina && pagina <= MAX_PAGINAS;
                pagina++
            ) {
                const quantidade = await buscarPagina(pagina);

            }

            if (ultimaPagina > MAX_PAGINAS) {
                throw new Error(
                    "O clã ultrapassou o limite de segurança de 100 páginas."
                );
            }

            return {
                clanId: idClan,
                nomes: [...jogadores.values()]
            };
        }
    });

    const dados = resultado?.result;

    if (!dados?.nomes?.length) {
        throw new Error(
            "A coleta não retornou nenhum jogador."
        );
    }

    // Atualiza a lista somente depois de concluir a coleta.
    JOGADORES_ATIVOS.splice(
        0,
        JOGADORES_ATIVOS.length,
        ...dados.nomes
    );

    console.log(
        `Clã ${dados.clanId}: ${JOGADORES_ATIVOS.length} jogadores carregados.`,
        JOGADORES_ATIVOS
    );

    return JOGADORES_ATIVOS;
}