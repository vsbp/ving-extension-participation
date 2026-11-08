
// ==========================================
// CONFIGURAÇÃO DO INDEXEDDB
// ==========================================

const NOME_BANCO = "VingParticipationDB";
const VERSAO_BANCO = 1;
const NOME_STORE = "arquivos";
const CHAVE_ARQUIVO = "relatorio-semanal";

let arquivoSalvo = null;


// ==========================================
// 1. EXIBIR MENSAGEM DE STATUS
// ==========================================

function atualizarStatus(mensagem, tipo = "") {
    const elemento = document.getElementById("status-mensagem");

    if (!elemento) {
        console.warn("Elemento de status não encontrado.");
        return;
    }

    elemento.textContent = mensagem;
    elemento.className = tipo;
}


// ==========================================
// 2. ABRIR BANCO DE DADOS
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

        requisicao.onsuccess = () => resolve(requisicao.result);
        requisicao.onerror = () => reject(requisicao.error);
    });
}


// ==========================================
// 3. RECUPERAR REFERÊNCIA DO ARQUIVO
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

        transacao.onerror = () => {
            banco.close();
            reject(transacao.error);
        };
    });
}


// ==========================================
// 4. SALVAR REFERÊNCIA DO ARQUIVO
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
// 5. REMOVER REFERÊNCIA DO ARQUIVO
// ==========================================

async function removerReferenciaArquivo() {
    const banco = await abrirBanco();

    return new Promise((resolve, reject) => {
        const transacao = banco.transaction(
            NOME_STORE,
            "readwrite"
        );

        const store = transacao.objectStore(NOME_STORE);

        store.delete(CHAVE_ARQUIVO);

        transacao.oncomplete = () => {
            banco.close();
            resolve();
        };

        transacao.onerror = () => {
            banco.close();
            reject(transacao.error);
        };
    });
}


// ==========================================
// 6. SELETOR DE ARQUIVO
// ==========================================

function abrirSeletorArquivo() {
    if (!window.showSaveFilePicker) {
        throw new Error(
            "Seu navegador não oferece suporte à seleção de arquivos."
        );
    }

    return window.showSaveFilePicker({
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
}


// ==========================================
// 7. OBTER ARQUIVO PARA ESCRITA
// ==========================================

async function obterArquivoParaEscrita() {
    const handle = arquivoSalvo;

    if (!handle) {
        throw new Error(
            "Nenhum arquivo foi selecionado."
        );
    }

    const permissao = await handle.requestPermission({
        mode: "readwrite"
    });

    if (permissao !== "granted") {
        arquivoSalvo = null;

        try {
            await removerReferenciaArquivo();
        } catch (erro) {
            console.warn(
                "Não foi possível remover a referência antiga:",
                erro
            );
        }

        throw new Error(
            "A permissão para escrever no arquivo não foi concedida. Selecione o arquivo novamente."
        );
    }

    return handle;
}


// ==========================================
// 8. ATUALIZAR ARQUIVO TXT
// ==========================================

async function atualizarArquivo(handle, conteudo) {
    let writable;

    try {
        writable = await handle.createWritable();

        await writable.write(conteudo);

        await writable.close();

        console.log("TXT atualizado com sucesso!");

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
// 9. ATUALIZAR HORÁRIO NA INTERFACE
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
// 10. INICIALIZAÇÃO DO POPUP
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    const btnCopiar = document.getElementById("btn-copiar");

    if (!btnCopiar) return;

    btnCopiar.disabled = true;

    try {
        arquivoSalvo = await recuperarReferenciaArquivo();

        console.log(
            arquivoSalvo
                ? "Referência do TXT recuperada."
                : "Nenhum TXT selecionado ainda."
        );

    } catch (erro) {
        console.error(
            "Erro ao recuperar referência do TXT:",
            erro
        );

        arquivoSalvo = null;

    } finally {
        btnCopiar.disabled = false;
    }


    // ==========================================
    // 11. EVENTO DO BOTÃO
    // ==========================================

    btnCopiar.addEventListener("click", async () => {
        btnCopiar.disabled = true;

        atualizarStatus("Iniciando atualização...", "");

        try {
            let arquivo = arquivoSalvo;

            // ----------------------------------
            // SELECIONAR ARQUIVO
            // ----------------------------------

            if (!arquivo) {
                const selecao = abrirSeletorArquivo();

                arquivo = await selecao;

                arquivoSalvo = arquivo;

                try {
                    await salvarReferenciaArquivo(arquivo);

                    console.log(
                        "Referência do arquivo salva."
                    );

                } catch (erro) {
                    console.warn(
                        "Não foi possível salvar a referência no IndexedDB:",
                        erro
                    );
                }

            } else {
                arquivo = await obterArquivoParaEscrita();
            }


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
            // ATUALIZAR JOGADORES DO CLÃ
            // ----------------------------------

            atualizarStatus("Carregando jogadores do clã...", "");

            await atualizarJogadoresAtivos(aba.id);

            console.log(
                "Jogadores ativos atualizados:",
                JOGADORES_ATIVOS
            );


            // ----------------------------------
            // COLETAR PARTICIPAÇÃO
            // ----------------------------------

            atualizarStatus("Coletando participação...", "");

            const { relatorio } = await coletarParticipacao(aba.id);

            if (!relatorio) {
                throw new Error(
                    "O relatório não foi gerado."
                );
            }


            // ----------------------------------
            // ATUALIZAR TXT
            // ----------------------------------

            atualizarStatus("Atualizando arquivo TXT...", "");

            await atualizarArquivo(arquivo, relatorio);

            atualizarHorario();

            atualizarStatus(
                "Relatório atualizado com sucesso!",
                "sucesso"
            );


            // ----------------------------------
            // EXIBIR RELATÓRIO NO CONSOLE DO VING
            // ----------------------------------

            try {
                await chrome.scripting.executeScript({
                    target: {
                        tabId: aba.id
                    },

                    args: [relatorio],

                    func: (texto) => {
                        console.clear();

                        console.log("RELATÓRIO DE PARTICIPAÇÃO:");
                        console.log(texto);
                    }
                });

            } catch (erro) {
                console.warn(
                    "TXT atualizado, mas não foi possível exibir o relatório no console:",
                    erro
                );
            }


            console.log(
                "Participação semanal atualizada com sucesso!"
            );

        } catch (erro) {
            if (erro.name !== "AbortError") {
                console.error(
                    "Erro ao coletar participação:",
                    erro
                );

                atualizarStatus(
                    erro.message || "Não foi possível atualizar o TXT.",
                    "erro"
                );
            } else {
                atualizarStatus("", "");
            }

        } finally {
            btnCopiar.disabled = false;
        }
    });
});
