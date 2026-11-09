// ==========================================
// CONFIGURAÇÃO DO TXT FORMATADO
// ==========================================

const CHAVE_ARQUIVO_FORMATADO = "relatorio-semanal-formatado";
const CHAVE_STORAGE_PARTICIPACAO = "participacaoSemanalVing";

let arquivoFormatadoSalvo = null;
let relatorioPendenteFormatado = null;


// ==========================================
// 1. MENSAGEM DE STATUS
// ==========================================

function atualizarStatusFormatado(mensagem, tipo = "") {
    const elemento = document.getElementById("status-mensagem");

    if (!elemento) return;

    elemento.textContent = mensagem;
    elemento.className = tipo;
}


// ==========================================
// 2. ABRIR INDEXEDDB
// ==========================================

function abrirBancoFormatado() {
    return new Promise((resolve, reject) => {
        const requisicao = indexedDB.open("VingParticipationDB", 1);

        requisicao.onupgradeneeded = () => {
            const banco = requisicao.result;

            if (!banco.objectStoreNames.contains("arquivos")) {
                banco.createObjectStore("arquivos");
            }
        };

        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);
    });
}


// ==========================================
// 3. RECUPERAR REFERÊNCIA DO TXT
// ==========================================

async function recuperarArquivoFormatado() {
    const banco = await abrirBancoFormatado();

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction("arquivos", "readonly");
        const requisicao = transacao
            .objectStore("arquivos")
            .get(CHAVE_ARQUIVO_FORMATADO);

        requisicao.onsuccess = () => resolve(requisicao.result || null);
        requisicao.onerror = () => reject(requisicao.error);

        transacao.oncomplete = () => banco.close();

        transacao.onerror = () => {
            banco.close();
            reject(transacao.error);
        };

        transacao.onabort = () => {
            banco.close();
            reject(transacao.error);
        };
    });
}


// ==========================================
// 4. SALVAR REFERÊNCIA DO TXT
// ==========================================

async function salvarArquivoFormatado(handle) {
    const banco = await abrirBancoFormatado();

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction("arquivos", "readwrite");

        transacao
            .objectStore("arquivos")
            .put(handle, CHAVE_ARQUIVO_FORMATADO);

        transacao.oncomplete = () => {
            banco.close();
            resolve();
        };

        transacao.onerror = () => {
            banco.close();
            reject(transacao.error);
        };

        transacao.onabort = () => {
            banco.close();
            reject(transacao.error);
        };
    });
}


// ==========================================
// 5. REMOVER REFERÊNCIA DO TXT
// ==========================================

async function removerArquivoFormatado() {
    const banco = await abrirBancoFormatado();

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction("arquivos", "readwrite");

        transacao
            .objectStore("arquivos")
            .delete(CHAVE_ARQUIVO_FORMATADO);

        transacao.oncomplete = () => {
            banco.close();
            resolve();
        };

        transacao.onerror = () => {
            banco.close();
            reject(transacao.error);
        };

        transacao.onabort = () => {
            banco.close();
            reject(transacao.error);
        };
    });
}


// ==========================================
// 6. SELECIONAR ARQUIVO
// ==========================================

function abrirSeletorFormatado() {
    if (!window.showSaveFilePicker) {
        throw new Error(
            "Seu navegador não oferece suporte à seleção de arquivos."
        );
    }

    return window.showSaveFilePicker({
        suggestedName: "participacao-formatada.txt",
        types: [
            {
                description: "Arquivo de texto",
                accept: {
                    "text/plain": [".txt"]
                }
            }
        ]
    });
}


// ==========================================
// 7. VALIDAR PERMISSÃO DO ARQUIVO EXISTENTE
// ==========================================

async function obterArquivoFormatado() {
    if (!arquivoFormatadoSalvo) {
        throw new Error("Nenhum arquivo formatado foi selecionado.");
    }

    const permissao = await arquivoFormatadoSalvo.requestPermission({
        mode: "readwrite"
    });

    if (permissao !== "granted") {
        arquivoFormatadoSalvo = null;

        try {
            await removerArquivoFormatado();
        } catch (erro) {
            console.warn(
                "Não foi possível remover a referência do arquivo:",
                erro
            );
        }

        throw new Error(
            "Permissão para atualizar o arquivo não concedida. Clique novamente para preparar e selecionar o TXT."
        );
    }

    return arquivoFormatadoSalvo;
}


// ==========================================
// 8. OBTER JOGADORES E ORDEM DOS EVENTOS
// ==========================================

function obterJogadoresFormatado(dados) {
    // Prioriza a lista global, mantendo a ordem original do clã.
    if (
        typeof JOGADORES_ATIVOS !== "undefined" &&
        Array.isArray(JOGADORES_ATIVOS) &&
        JOGADORES_ATIVOS.length > 0
    ) {
        return JOGADORES_ATIVOS;
    }

    // Alternativa: recupera os nomes diretamente dos resultados salvos.
    // A coleta grava os jogadores na ordem em que aparecem no clã.
    for (const codigo of obterOrdemEventosFormatado()) {
        const resultado = dados?.resultados?.[codigo];

        if (
            resultado &&
            typeof resultado === "object" &&
            !Array.isArray(resultado)
        ) {
            const jogadores = Object.keys(resultado);

            if (jogadores.length > 0) {
                console.warn(
                    "JOGADORES_ATIVOS não está disponível. Usando os nomes salvos nos resultados."
                );

                return jogadores;
            }
        }
    }

    throw new Error(
        "Não foi possível encontrar a lista de jogadores. Verifique se os resultados da participação foram coletados."
    );
}


function obterOrdemEventosFormatado() {
    if (
        typeof ORDEM_EVENTOS !== "undefined" &&
        Array.isArray(ORDEM_EVENTOS) &&
        ORDEM_EVENTOS.length > 0
    ) {
        return ORDEM_EVENTOS;
    }

    if (
        typeof EVENTOS_SEMANAIS !== "undefined" &&
        Array.isArray(EVENTOS_SEMANAIS) &&
        EVENTOS_SEMANAIS.length > 0
    ) {
        return EVENTOS_SEMANAIS.map(evento => evento.codigo);
    }

    throw new Error(
        "A ordem dos eventos não foi encontrada. Verifique o arquivo de configuração dos eventos."
    );
}


// ==========================================
// 9. MONTAR RELATÓRIO FORMATADO
// ==========================================

function montarRelatorioFormatado(dados) {
    if (
        !dados ||
        !dados.resultados ||
        typeof dados.resultados !== "object"
    ) {
        throw new Error(
            "Os resultados de participação não foram encontrados no armazenamento. Gere primeiro o relatório de participação."
        );
    }

    const jogadores = obterJogadoresFormatado(dados);
    const ordemEventos = obterOrdemEventosFormatado();

    const eventosComDados = ordemEventos.filter(codigo => {
        return (
            typeof codigo === "string" &&
            dados.resultados[codigo] &&
            typeof dados.resultados[codigo] === "object"
        );
    });

    if (eventosComDados.length === 0) {
        throw new Error(
            "Nenhum evento possui resultados salvos. Gere primeiro o relatório de participação."
        );
    }

    const linhas = [];
    let totalStatusEncontrados = 0;

    ordemEventos.forEach(codigo => {
        if (typeof codigo !== "string" || !codigo.trim()) {
            throw new Error("Foi encontrado um código de evento inválido.");
        }

        const resultadosEvento = dados.resultados[codigo];

        // Mantém o código do evento em letras minúsculas.
        linhas.push(codigo.toLowerCase());

        // Mantém a ordem original dos jogadores.
        jogadores.forEach(nome => {
            const status = resultadosEvento?.[nome] ?? "-";

            if (status === "S" || status === "N") {
                totalStatusEncontrados++;
            }

            linhas.push(status);
        });

        // Linha em branco entre os eventos.
        linhas.push("");
    });

    const relatorio = linhas.join("\n").trimEnd() + "\n";

    if (totalStatusEncontrados === 0) {
        throw new Error(
            "Os eventos foram encontrados, mas não há status S/N para os jogadores. Confira se a coleta de participação foi executada nesta semana."
        );
    }

    if (!relatorio.trim()) {
        throw new Error("O relatório formatado ficou vazio.");
    }

    console.log("========== DEBUG TXT FORMATADO ==========");
    console.log("Quantidade de jogadores:", jogadores.length);
    console.log("Eventos configurados:", ordemEventos);
    console.log("Eventos com resultados:", eventosComDados);
    console.log("Chaves salvas:", Object.keys(dados.resultados));
    console.log("Status S/N encontrados:", totalStatusEncontrados);
    console.log("Tamanho do relatório:", relatorio.length);
    console.log("Conteúdo gerado:", JSON.stringify(relatorio));
    console.log("=========================================");

    return relatorio;
}


// ==========================================
// 10. PREPARAR RELATÓRIO
// ==========================================

async function prepararRelatorioFormatado() {
    atualizarStatusFormatado(
        "Organizando os resultados dos eventos...",
        ""
    );

    // IMPORTANTE:
    // O TXT usa somente os dados que já estão no chrome.storage.local.
    // Não consulta a aba ativa, não verifica URL e não atualiza jogadores.
    const armazenamento = await chrome.storage.local.get(
        CHAVE_STORAGE_PARTICIPACAO
    );

    const dados = armazenamento[CHAVE_STORAGE_PARTICIPACAO];

    if (!dados?.resultados) {
        throw new Error(
            "Não existem resultados salvos. Gere primeiro o relatório de participação."
        );
    }

    const relatorio = montarRelatorioFormatado(dados);

    return { relatorio };
}


// ==========================================
// 11. ESCREVER TXT
// ==========================================

async function escreverArquivoFormatado(handle, conteudo) {
    if (
        typeof conteudo !== "string" ||
        !conteudo.trim()
    ) {
        throw new Error(
            "O conteúdo está vazio. O arquivo anterior foi preservado."
        );
    }

    let writable;

    try {
        writable = await handle.createWritable();

        await writable.write(conteudo);

        await writable.close();

        console.log("TXT formatado atualizado com sucesso!");
    } catch (erro) {
        if (writable) {
            try {
                await writable.abort();
            } catch (_) {
                // Preserva o erro original.
            }
        }

        throw erro;
    }
}


// ==========================================
// 12. FINALIZAR GERAÇÃO
// ==========================================

async function finalizarRelatorioFormatado(handle, relatorio) {
    atualizarStatusFormatado(
        "Atualizando arquivo TXT...",
        ""
    );

    await escreverArquivoFormatado(handle, relatorio);

    if (typeof atualizarHorario === "function") {
        atualizarHorario();
    }

    relatorioPendenteFormatado = null;

    atualizarStatusFormatado(
        "Relatório formatado atualizado com sucesso!",
        "sucesso"
    );

    console.log(
        "Participação formatada atualizada com sucesso!"
    );
}


// ==========================================
// 13. INICIALIZAÇÃO DO BOTÃO
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    const btnFormatado = document.getElementById("btn-formatado");

    if (!btnFormatado) {
        console.error(
            "Botão btn-formatado não encontrado no HTML."
        );

        return;
    }

    btnFormatado.disabled = true;

    try {
        arquivoFormatadoSalvo = await recuperarArquivoFormatado();

        console.log(
            arquivoFormatadoSalvo
                ? "Referência do TXT formatado recuperada."
                : "Nenhum TXT formatado selecionado."
        );
    } catch (erro) {
        console.error(
            "Erro ao recuperar o TXT formatado:",
            erro
        );

        arquivoFormatadoSalvo = null;
    } finally {
        btnFormatado.disabled = false;
    }


    // ==========================================
    // 14. EVENTO DO BOTÃO
    // ==========================================

    btnFormatado.addEventListener("click", async () => {
        btnFormatado.disabled = true;

        try {
            // Segundo clique: abre o seletor usando o relatório já preparado.
            if (
                !arquivoFormatadoSalvo &&
                relatorioPendenteFormatado
            ) {
                atualizarStatusFormatado(
                    "Selecione onde salvar o TXT...",
                    ""
                );

                // A abertura do seletor acontece diretamente no clique do usuário.
                const arquivo = await abrirSeletorFormatado();

                arquivoFormatadoSalvo = arquivo;

                await salvarArquivoFormatado(arquivo);

                await finalizarRelatorioFormatado(
                    arquivo,
                    relatorioPendenteFormatado
                );

                return;
            }

            // Se já existe um arquivo vinculado, valida a permissão no clique.
            let arquivo = null;

            if (arquivoFormatadoSalvo) {
                arquivo = await obterArquivoFormatado();
            }

            atualizarStatusFormatado(
                "Preparando relatório formatado...",
                ""
            );

            const { relatorio } = await prepararRelatorioFormatado();

            if (!relatorio || !relatorio.trim()) {
                throw new Error(
                    "O relatório foi gerado vazio. O arquivo não será atualizado."
                );
            }

            // Arquivo já selecionado: atualiza diretamente.
            if (arquivo) {
                await finalizarRelatorioFormatado(
                    arquivo,
                    relatorio
                );

                return;
            }

            // Primeiro clique: prepara os dados.
            // Segundo clique: abre o seletor e grava o TXT.
            relatorioPendenteFormatado = relatorio;

            atualizarStatusFormatado(
                "Relatório pronto! Clique novamente em 'TXT formatado' para escolher onde salvar.",
                "sucesso"
            );

            console.log(
                "Relatório preparado. Aguardando o segundo clique para selecionar o arquivo."
            );

        } catch (erro) {
            console.error(
                "Erro ao gerar TXT formatado:",
                erro
            );

            if (erro.name === "AbortError") {
                atualizarStatusFormatado("", "");
            } else {
                atualizarStatusFormatado(
                    erro.message ||
                    "Não foi possível gerar o TXT formatado.",
                    "erro"
                );
            }

        } finally {
            btnFormatado.disabled = false;
        }
    });
});