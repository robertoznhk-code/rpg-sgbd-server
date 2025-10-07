let sessionId = null;
let personagemSelecionado = null;

// 🧩 Função para iniciar sessão
async function iniciarSessao() {
  try {
    const res = await fetch("/nova-sessao", { method: "POST" });
    const data = await res.json();

    if (data.sucesso && data.sessionId) {
      sessionId = data.sessionId;
      log(`🧙‍♂️ Sessão iniciada: ${sessionId}`);
    } else {
      log("❌ Falha ao criar sessão.");
    }
  } catch (e) {
    log("❌ Erro ao iniciar sessão: " + e.message);
  }
}

// 🧙‍♂️ Carregar personagens
async function carregarPersonagens() {
  const container = document.getElementById("personagem-selecao");
  container.innerHTML = "<p>Carregando...</p>";

  try {
    const res = await fetch("/personagens");
    const data = await res.json();

    if (!data.sucesso || !data.personagens.length) {
      container.innerHTML = "<p>Nenhum personagem encontrado.</p>";
      return;
    }

    container.innerHTML = "";

    const emojis = ["🗡️", "🏹", "🛡️", "⚔️", "🔥", "💫", "🌿"];

    data.personagens.forEach((p, i) => {
      const card = document.createElement("button");
      card.textContent = `${emojis[i % emojis.length]} ${p.nome} (${p.classe || "Aventureiro"})`;
      card.className = "personagem-card";
      card.onclick = () => selecionarPersonagem(p);
      container.appendChild(card);
    });
  } catch (erro) {
    container.innerHTML = "<p>❌ Erro ao carregar personagens.</p>";
    console.error("Erro ao carregar personagens:", erro);
  }
}

// 🧭 Selecionar personagem
async function selecionarPersonagem(personagem) {
  personagemSelecionado = personagem;
  document.getElementById("nome-personagem").textContent = personagem.nome;

  // Esconde o menu de seleção
  const container = document.getElementById("personagem-selecao");
  container.style.display = "none";

  log(`🧙‍♂️ Você escolheu ${personagem.nome} (${personagem.classe || "Aventureiro"})!`);

  // Inicia a sessão automaticamente
  await iniciarSessao();
}

// ⚔️ Executar ação (atacar / bloquear / curar)
async function acao(tipo) {
  if (!sessionId) {
    log("⚠️ Sessão não iniciada. Criando uma nova...");
    await iniciarSessao();
    return;
  }

  if (!personagemSelecionado) {
    log("⚠️ Selecione um personagem antes de jogar!");
    return;
  }

  log(`➡️ Você escolheu: ${tipo}`);

  try {
    const res = await fetch("/acao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        personagemId: personagemSelecionado.id,
        acao: tipo,
      }),
    });

    const data = await res.json();

    if (data.sucesso) {
      log(`🧙‍♂️ ${data.jogador}`);
      log(`👹 ${data.monstro}`);
      atualizarHP(data.hp_personagem, data.hp_monstro);
      verificarFim(data.hp_personagem, data.hp_monstro);
    } else {
      log(`❌ Erro: ${data.erro}`);
    }
  } catch (erro) {
    log(`❌ Falha na ação: ${erro.message}`);
  }
}

// ❤️ Atualiza as barras de HP
function atualizarHP(hpPersonagem, hpMonstro) {
  const hp1 = document.querySelector("#hp-personagem .hp-fill");
  const hp2 = document.querySelector("#hp-monstro .hp-fill");

  hp1.style.width = `${hpPersonagem}%`;
  hp1.textContent = `${hpPersonagem} HP`;
  hp2.style.width = `${hpMonstro}%`;
  hp2.textContent = `${hpMonstro} HP`;
}

// 💀 Fim de jogo
function verificarFim(hpPersonagem, hpMonstro) {
  if (hpPersonagem <= 0) {
    log("💀 Você foi derrotado!");
    desativarBotoes();
  } else if (hpMonstro <= 0) {
    log("🏆 Você venceu a batalha!");
    desativarBotoes();
  }
}

// 🚫 Desativa botões após o fim da batalha
function desativarBotoes() {
  document.querySelectorAll("#botoes button").forEach((b) => (b.disabled = true));
  const reiniciar = document.createElement("button");
  reiniciar.textContent = "🔄 Reiniciar Batalha";
  reiniciar.onclick = () => location.reload();
  reiniciar.style.marginTop = "20px";
  document.getElementById("botoes").appendChild(reiniciar);
}

// 🪶 Adiciona logs na tela
function log(msg) {
  const logBox = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = msg;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

// 🚀 Inicializa
window.onload = carregarPersonagens;
