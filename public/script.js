let sessionId = null;

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

async function acao(tipo) {
  if (!sessionId) {
    log("⚠️ Sessão não iniciada. Criando uma nova...");
    await iniciarSessao();
    return;
  }

  log(`➡️ Você escolheu: ${tipo}`);

  try {
    const res = await fetch("/acao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, acao: tipo }),
    });

    const data = await res.json();

    if (data.sucesso) {
      // Exibir ações
      log(`🧙‍♂️ ${data.jogador}`);
      log(`👹 ${data.inimigo}`);

      // Atualizar HPs
      atualizarHP(data.hp_personagem, data.hp_monstro);

      // Verificar fim de batalha
      verificarFim(data.hp_personagem, data.hp_monstro);
    } else {
      log(`❌ Erro: ${data.erro}`);
    }
  } catch (e) {
    log(`⚠️ Erro de conexão: ${e.message}`);
  }
}

function atualizarHP(hpPersonagem, hpMonstro) {
  const hp1 = document.querySelector("#hp-personagem .hp-fill");
  const hp2 = document.querySelector("#hp-monstro .hp-fill");

  hp1.style.width = `${hpPersonagem}%`;
  hp1.textContent = `${hpPersonagem} HP`;

  hp2.style.width = `${hpMonstro}%`;
  hp2.textContent = `${hpMonstro} HP`;
}

function verificarFim(hpPersonagem, hpMonstro) {
  if (hpPersonagem <= 0) {
    log("💀 Você foi derrotado!");
    desativarBotoes();
  } else if (hpMonstro <= 0) {
    log("🏆 Você venceu a batalha!");
    desativarBotoes();
  }
}

function desativarBotoes() {
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  const reiniciar = document.createElement("button");
  reiniciar.textContent = "🔄 Reiniciar Batalha";
  reiniciar.onclick = () => location.reload();
  document.body.appendChild(reiniciar);
}

function log(msg) {
  const logBox = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = msg;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

window.onload = iniciarSessao;
