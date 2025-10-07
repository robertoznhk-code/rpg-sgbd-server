let sessionId = null;

async function iniciarSessao() {
  const res = await fetch("/nova-sessao", { method: "POST" });
  const data = await res.json();
  if (data.sucesso) {
    sessionId = data.sessionId;
    log(`🧙‍♂️ Sessão iniciada: ${sessionId}`);
  } else {
    log("Erro ao iniciar sessão.");
  }
}

async function acao(tipo) {
  if (!sessionId) return log("Sessão não iniciada.");
  log(`➡️ Você escolheu: ${tipo}`);

  const res = await fetch("/acao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, acao: tipo }),
  });

  const data = await res.json();
  if (data.sucesso) {
    log(`🧙‍♂️ ${data.resultado}`);
    atualizarHP(data.hp_personagem, data.hp_monstro);
  } else {
    log(`❌ Erro: ${data.erro}`);
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

function log(msg) {
  const logBox = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = msg;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

window.onload = iniciarSessao;
