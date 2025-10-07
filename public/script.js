let sessionId = null;

// 🧩 mapa de emojis por classe
const emojiClasses = {
  Guerreiro: "⚔️",
  Maga: "🪄",
  Arqueiro: "🏹",
  Cavaleiro: "🛡️",
  Paladino: "✨",
  Assassino: "🗡️",
  Druida: "🌿",
  Necromante: "💀",
  default: "❓",
};

// cria sessão
async function iniciarSessao() {
  const res = await fetch("/nova-sessao", { method: "POST" });
  const data = await res.json();
  if (data.sucesso) sessionId = data.sessionId;
  else alert("Falha ao criar sessão.");
}

// carrega personagens
async function carregarPersonagens() {
  try {
    const res = await fetch("/personagens");
    const data = await res.json();
    const lista = document.getElementById("lista-personagens");

    if (data.sucesso && data.personagens.length > 0) {
      lista.innerHTML = "";
      data.personagens.forEach((p) => {
        const classe = p.classe || "Sem Classe";
        const emoji = emojiClasses[classe] || emojiClasses.default;

        const div = document.createElement("div");
        div.className = "personagem";
        div.innerHTML = `${emoji} <strong>${p.nome}</strong> <small>(${classe})</small>`;
        div.onclick = () => selecionarPersonagem(p.id);
        lista.appendChild(div);
      });
    } else {
      lista.innerHTML = "<p>Nenhum personagem encontrado.</p>";
    }
  } catch (e) {
    console.error(e);
    document.getElementById("lista-personagens").innerHTML =
      "<p>Erro ao carregar personagens.</p>";
  }
}

// seleciona personagem
async function selecionarPersonagem(id) {
  if (!sessionId) await iniciarSessao();
  const res = await fetch("/selecionar-personagem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, personagemId: id }),
  });
  const data = await res.json();

  if (data.sucesso) {
    document.getElementById("selecao-personagem").style.display = "none";
    document.getElementById("batalha").style.display = "block";
    log("🧙‍♂️ Seu personagem está pronto para a batalha!");
  } else log("❌ Erro ao selecionar personagem: " + data.erro);
}

// executa ação
async function acao(tipo) {
  if (!sessionId) return;
  const res = await fetch("/acao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, acao: tipo }),
  });
  const data = await res.json();
  if (data.sucesso) {
    log(`🧙‍♂️ ${data.jogador}`);
    log(`👹 ${data.monstro}`);
    atualizarHP(data.hp_personagem, data.hp_monstro);
  } else log(`❌ Erro: ${data.erro}`);
}

// atualiza HP
function atualizarHP(hpPersonagem, hpMonstro) {
  const hp1 = document.querySelector("#hp-personagem .hp-fill");
  const hp2 = document.querySelector("#hp-monstro .hp-fill");
  hp1.style.width = `${hpPersonagem}%`;
  hp1.textContent = `${hpPersonagem} HP`;
  hp2.style.width = `${hpMonstro}%`;
  hp2.textContent = `${hpMonstro} HP`;
}

// log visual
function log(msg) {
  const logBox = document.getElementById("log");
  const line = document.createElement("div");
  line.textContent = msg;
  logBox.appendChild(line);
  logBox.scrollTop = logBox.scrollHeight;
}

window.onload = async () => {
  await iniciarSessao();
  await carregarPersonagens();
};
