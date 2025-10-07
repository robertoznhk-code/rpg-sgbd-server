// public/script.js
let sessionId = null;
let personagemSelecionado = null;

// ===== util de log (UI + console) =====
function log(msg) {
  const logBox = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = msg;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
  console.log(msg); // 👈 também no console
}

function setButtonsDisabled(disabled) {
  document.querySelectorAll("#botoes button").forEach((b) => (b.disabled = disabled));
}

// ===== sessão =====
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

// ===== personagens =====
async function carregarPersonagens() {
  const container = document.getElementById("personagem-selecao");
  container.innerHTML = "<p>Carregando...</p>";
  try {
    const res = await fetch(window.location.origin + "/personagens");
    const data = await res.json();

    if (!data.sucesso || !data.personagens.length) {
      container.innerHTML = "<p>Nenhum personagem encontrado.</p>";
      log("ℹ️ /personagens retornou lista vazia.");
      return;
    }

    log(`✅ Carregado(s) ${data.personagens.length} personagem(ns).`);
    container.innerHTML = "";

    const emojis = ["🗡️", "🏹", "🛡️", "⚔️", "🔥", "💫", "🌿"];
    data.personagens.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.textContent = `${emojis[i % emojis.length]} ${p.nome} (${p.classe || "Aventureiro"})`;
      btn.className = "personagem-card";
      btn.onclick = () => selecionarPersonagem(p);
      container.appendChild(btn);
    });
  } catch (erro) {
    container.innerHTML = "<p>❌ Erro ao carregar personagens.</p>";
    log("❌ Erro ao carregar personagens: " + erro.message);
  }
}

async function selecionarPersonagem(personagem) {
  personagemSelecionado = personagem;
  document.getElementById("nome-personagem").textContent = personagem.nome;
  document.getElementById("personagem-selecao").style.display = "none";
  log(`🎯 Você escolheu: ${personagem.nome} (${personagem.classe || "Aventureiro"})`);

  await iniciarSessao();
  // Reseta barras no início
  atualizarHP(100, 100);
}

// ===== batalha =====
async function acao(tipo) {
  if (!sessionId) {
    log("⚠️ Sessão não iniciada. Criando...");
    await iniciarSessao();
    if (!sessionId) return;
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
      log(`❤️ HP Jogador: ${data.hp_personagem} | 💀 HP Monstro: ${data.hp_monstro}`);

      atualizarHP(data.hp_personagem, data.hp_monstro);
      verificarFim(data.hp_personagem, data.hp_monstro);
    } else {
      log(`❌ Erro: ${data.erro}`);
    }
  } catch (erro) {
    log(`❌ Falha na ação: ${erro.message}`);
  }
}

// ===== UI: HP + fim de jogo =====
function atualizarHP(hpPersonagem, hpMonstro) {
  const hp1 = document.querySelector("#hp-personagem .hp-fill");
  const hp2 = document.querySelector("#hp-monstro .hp-fill");
  hp1.style.width = `${Math.max(0, hpPersonagem)}%`;
  hp2.style.width = `${Math.max(0, hpMonstro)}%`;
  hp1.textContent = `${Math.max(0, hpPersonagem)} HP`;
  hp2.textContent = `${Math.max(0, hpMonstro)} HP`;
}

function verificarFim(hpPersonagem, hpMonstro) {
  if (hpPersonagem <= 0) {
    log("💀 Você foi derrotado! Fim da batalha.");
    encerrarBatalha();
  } else if (hpMonstro <= 0) {
    log("🏆 Você venceu a batalha! Fim da batalha.");
    encerrarBatalha();
  }
}

function encerrarBatalha() {
  setButtonsDisabled(true);
  const reiniciar = document.createElement("button");
  reiniciar.textContent = "🔄 Reiniciar Batalha";
  reiniciar.style.marginTop = "20px";
  reiniciar.onclick = () => location.reload();
  document.getElementById("botoes").appendChild(reiniciar);
}

// ===== init =====
window.onload = carregarPersonagens;
