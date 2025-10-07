let sessionId = null;
let personagemSelecionado = null;

async function iniciarSessao() {
  const res = await fetch("/nova-sessao", { method: "POST" });
  const data = await res.json();
  if (data.sucesso && data.sessionId) {
    sessionId = data.sessionId;
    log(`🧙‍♂️ Sessão iniciada: ${sessionId}`);
    carregarPersonagens();
  } else {
    log("❌ Falha ao criar sessão.");
  }
}

async function carregarPersonagens() {
  try {
    const res = await fetch("/personagens");
    const data = await res.json();
    const select = document.getElementById("personagem-select");
    select.innerHTML = "";

    if (data.sucesso && data.personagens.length > 0) {
      data.personagens.forEach((p) => {
        const emoji =
          p.nome === "Arus"
            ? "⚔️"
            : p.nome === "Lyria"
            ? "🔮"
            : p.nome === "Kael"
            ? "🏹"
            : p.nome === "Vex"
            ? "🗡️"
            : p.nome === "Uther"
            ? "🛡️"
            : p.nome === "Legolas"
            ? "🏹"
            : "🐉";
        const option = document.createElement("option");
        option.value = p.id;
        option.textContent = `${emoji} ${p.nome} (${p.classe || "Aventureiro"})`;
        select.appendChild(option);
      });

      select.addEventListener("change", (e) => {
        personagemSelecionado = e.target.value;
        log(`🎯 Personagem selecionado: ${e.target.options[e.target.selectedIndex].text}`);
      });

      personagemSelecionado = data.personagens[0].id;
      log(`🎯 Personagem padrão: ${data.personagens[0].nome}`);
    } else {
      select.innerHTML = "<option>Nenhum personagem encontrado</option>";
    }
  } catch (e) {
    log("❌ Erro ao carregar personagens: " + e.message);
  }
}

async function acao(tipo) {
  if (!sessionId) {
    log("⚠️ Sessão não iniciada. Criando...");
    await iniciarSessao();
    return;
  }

  if (!personagemSelecionado) {
    log("⚠️ Selecione um personagem primeiro!");
    return;
  }

  log(`➡️ Você escolheu: ${tipo}`);

  const res = await fetch("/acao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, personagemId: personagemSelecionado, acao: tipo }),
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
}

function atualizarHP(hpPersonagem, hpMonstro) {
  const hp1 = document.querySelector("#hp-personagem .hp-fill");
  const hp2 = document.querySelector("#hp-monstro .hp-fill");
  hp1.style.width = `${hpPersonagem}%`;
  hp2.style.width = `${hpMonstro}%`;
  hp1.textContent = `${hpPersonagem} HP`;
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
  reiniciar.className = "reiniciar-btn";
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
