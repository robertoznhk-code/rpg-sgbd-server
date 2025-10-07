let sessionId = null;

async function iniciarSessao() {
  const res = await fetch("/nova-sessao", { method: "POST" });
  const data = await res.json();
  if (data.sucesso) sessionId = data.sessionId;
}

async function carregarPersonagens() {
  const res = await fetch("/personagens");
  const data = await res.json();
  if (data.sucesso) {
    const lista = document.getElementById("lista-personagens");
    lista.innerHTML = "";
    data.personagens.forEach(p => {
      const div = document.createElement("div");
      div.className = "personagem";
      div.textContent = `${p.nome} (${p.classe})`;
      div.onclick = () => selecionarPersonagem(p.id);
      lista.appendChild(div);
    });
  }
}

async function selecionarPersonagem(id) {
  const res = await fetch("/selecionar-personagem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, personagemId: id })
  });
  const data = await res.json();
  if (data.sucesso) {
    document.getElementById("selecao-personagem").style.display = "none";
    document.getElementById("batalha").style.display = "block";
    log("🧙‍♂️ Seu personagem está pronto para a batalha!");
  }
}

async function acao(tipo) {
  if (!sessionId) return;
  const res = await fetch("/acao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, acao: tipo })
  });
  const data = await res.json();
  if (data.sucesso) {
    log(`🧙‍♂️ ${data.jogador}`);
    log(`👹 ${data.monstro}`);
    atualizarHP(data.hp_personagem, data.hp_monstro);
  } else log(`❌ Erro: ${data.erro}`);
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

window.onload = async () => {
  await iniciarSessao();
  await carregarPersonagens();
};
