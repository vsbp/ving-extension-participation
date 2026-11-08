
// ==========================================
// CONFIGURAÇÃO DO INDEXEDDB
// ==========================================

const NOME_BANCO = "VingParticipationDB";
const VERSAO_BANCO = 1;
const NOME_STORE = "arquivos";
const CHAVE_ARQUIVO = "relatorio-semanal";


// ==========================================
// 1. ABRIR BANCO DE DADOS
// ==========================================

function abrirBanco() {
    return new Promise((resolve, reject) => {
        const requisicao = indexedDB.open(
            NOME_BANCO,
            VERSAO_BANCO
        );

        requisicao.onupgradeneeded = () => {
            const banco = requisicao.result;

            if (!banco.objectStoreNames.contains(NOME_STORE)) {
                banco.createObjectStore(NOME_STORE);
            }
        };

        requisicao.onsuccess = () => {
            resolve(requisicao.result);
        };

        requisicao.onerror = () => {
            reject(requisicao.error);
        };
    });
}


// ==========================================
// 2. RECUPERAR REFERÊNCIA DO ARQUIVO
// ==========================================

async function recuperarReferenciaArquivo() {
    const banco = await abrirBanco();

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction(
            NOME_STORE,
            "readonly"
        );

        const store = transacao.objectStore(NOME_STORE);
        const requisicao = store.get(CHAVE_ARQUIVO);

        requisicao.onsuccess = () => {
            resolve(requisicao.result || null);
        };

        requisicao.onerror = () => {
            reject(requisicao.error);
        };

        transacao.oncomplete = () => banco.close();
    });
}


// ==========================================
// 3. SALVAR REFERÊNCIA DO ARQUIVO
// ==========================================

async function salvarReferenciaArquivo(handle) {
    const banco = await abrirBanco();

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction(
            NOME_STORE,
            "readwrite"
        );

        const store = transacao.objectStore(NOME_STORE);

        store.put(handle, CHAVE_ARQUIVO);

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
// 4. OBTER ARQUIVO PARA ATUALIZAÇÃO
// ==========================================

async function obterArquivoParaEscrita() {
    if (!window.showSaveFilePicker) {
        throw new Error(
            "Seu navegador não oferece suporte à seleção de arquivos."
        );
    }

    let handle = await recuperarReferenciaArquivo();

    // Primeira utilização: selecionar o arquivo.
    if (!handle) {
        handle = await window.showSaveFilePicker({
            suggestedName: "participacao-semanal.txt",
            types: [
                {
                    description: "Arquivo de texto",
                    accept: {
                        "text/plain": [".txt"]
                    }
                }
            ]
        });

        await salvarReferenciaArquivo(handle);
    }

    // Verificar permissão de escrita.
    let permissao = await handle.queryPermission({
        mode: "readwrite"
    });

    if (permissao !== "granted") {
        permissao = await handle.requestPermission({
            mode: "readwrite"
        });
    }

    if (permissao !== "granted") {
        throw new Error(
            "Permissão para atualizar o arquivo não concedida."
        );
    }

    return handle;
}


// ==========================================
// 5. ATUALIZAR ARQUIVO TXT
// ==========================================

async function atualizarArquivo(handle, conteudo) {
    const writable = await handle.createWritable();

    try {
        await writable.write(conteudo);
        await writable.close();

        console.log("TXT atualizado com sucesso!");
    } catch (erro) {
        try {
            await writable.abort();
        } catch (_) {
            // Evita substituir o erro original.
        }

        throw erro;
    }
}


// ==========================================
// 6. ATUALIZAR HORÁRIO NA INTERFACE
// ==========================================

function atualizarHorario() {
    const elementoAtualizacao = document.getElementById(
        "ultima-atualizacao"
    );

    if (!elementoAtualizacao) return;

    const agora = new Date();

    elementoAtualizacao.textContent =
        agora.toLocaleDateString("pt-BR") +
        " às " +
        agora.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit"
        });
}


// ==========================================
// 7. EVENTO DO BOTÃO
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const btnCopiar = document.getElementById("btn-copiar");

    if (!btnCopiar) return;

    btnCopiar.addEventListener("click", async () => {
        btnCopiar.disabled = true;

        try {
            // ----------------------------------
            // VALIDAR ABA ATUAL
            // ----------------------------------

            const [aba] = await chrome.tabs.query({
                active: true,
                currentWindow: true
            });

            if (
                !aba?.id ||
                !aba.url?.startsWith("https://ving.mobi/")
            ) {
                throw new Error(
                    "Abra uma página da Ving antes de coletar os dados."
                );
            }

            // ----------------------------------
            // OBTER REFERÊNCIA DO TXT
            // ----------------------------------

            const arquivo = await obterArquivoParaEscrita();

            // ----------------------------------
            // ATUALIZAR JOGADORES DO CLÃ
            // ----------------------------------

            await atualizarJogadoresAtivos(aba.id);

            console.log(
                "Jogadores ativos atualizados:",
                JOGADORES_ATIVOS
            );

            // ----------------------------------
            // COLETAR PARTICIPAÇÃO
            // ----------------------------------

            const { relatorio } = await coletarParticipacao(aba.id);

            if (!relatorio) {
                throw new Error(
                    "O relatório não foi gerado."
                );
            }

            // ----------------------------------
            // ATUALIZAR TXT
            // ----------------------------------

            await atualizarArquivo(arquivo, relatorio);

            // ----------------------------------
            // EXIBIR JOGADORES E RELATÓRIO NO CONSOLE
            // ----------------------------------

            await chrome.scripting.executeScript({
                target: {
                    tabId: aba.id
                },
                args: [relatorio, [...JOGADORES_ATIVOS]],

                func: (texto, jogadores) => {
                    console.clear();

                    console.log("RELATÓRIO DE PARTICIPAÇÃO:");
                    console.log(texto);
                }
            });

            // ----------------------------------
            // ATUALIZAR HORÁRIO
            // ----------------------------------

            atualizarHorario();

            console.log(
                "Participação semanal atualizada com sucesso!"
            );

        } catch (erro) {
            if (erro.name !== "AbortError") {
                console.error(
                    "Erro ao coletar participação:",
                    erro
                );
            }

        } finally {
            btnCopiar.disabled = false;
        }
    });
});
