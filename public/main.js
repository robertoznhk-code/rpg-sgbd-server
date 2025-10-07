let personagemHP = 100;
let monstroHP = 100;
const personagemID = 1;
const monstroID = 1;

const hpPersonagemBar = document.getElementById("hp-personagem");
const hpMonstroBar = document.getElementById("hp-monstro");
const hpPersonagemText = document.getElementById("hp-personagem-text");
const hpMonstroText = document.getElementById("hp-monstro-text");
const logsDiv = document.getElementById("logs");

const API_BASE = ""; // vazio = mesmo domínio (Render)

// Função principal para enviar ação
async function executarAcao(acao) {
  adicionarLog(`➡️ Você escolheu: ${acao}`);

  try {
    const resposta = await fetch(`${API_BASE}/acao`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personagem_id: personagemID,
        monstro_id: monstroID,
        acao: acao,
      }),
    });

    const data = await resposta.json();
    if (!data.sucesso) throw new Error(data.erro);

    const resultado = data.resultado[0];
    atualizarHP(resultado.hp_personagem, resultado.hp_monstro);
    adicionarLog(`🧙‍♂️ ${resultado.mensagem}`);
  } catch (err) {
    adicionarLog(`❌ Erro: ${err.message}`);
  }
}

// Atualiza visualmente as barras de HP
function atualizarHP(novoHPpersonagem, novoHPmonstro) {
  personagemHP = novoHPpersonagem;
  monstroHP = novoHPmonstro;

  hpPersonagemBar.style.width = `${personagemHP}%`;
  hpMonstroBar.style.width = `${monstroHP}%`;

  hpPersonagemText.textContent = `HP: ${personagemHP}`;
  hpMonstroText.textContent = `HP: ${monstroHP}`;

  if (personagemHP <= 0) adicionarLog("💀 Você foi derrotado!");
  if (monstroHP <= 0) adicionarLog("🏆 O monstro foi derrotado!");
}

// Adiciona mensagens ao log
function adicionarLog(texto) {
  const p = document.createElement("p");
  p.textContent = texto;
  p.classList.add("log-entry");
  logsDiv.prepend(p);
}
