import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // ✅ garante script.js acessível

// =============================
// 🔧 Configuração do MySQL
// =============================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: { rejectUnauthorized: false },
});

// =============================
// ✅ Rota principal
// =============================
app.get("/", (req, res) => {
  res.send("✅ Servidor RPG-SGBD ativo e servindo frontend.");
});

// =============================
// 🧙 Criar nova sessão
// =============================
app.post("/nova-sessao", async (req, res) => {
  const sessionId = uuidv4();
  try {
    await pool.query(
      "INSERT INTO sessoes (session_id, hp_personagem, hp_monstro) VALUES (?, 100, 100);",
      [sessionId]
    );
    console.log(`🆕 Nova sessão criada: ${sessionId}`);
    res.json({ sucesso: true, sessionId });
  } catch (erro) {
    console.error("❌ Erro ao criar sessão:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// =============================
// 🧩 Listar personagens
// =============================
app.get("/personagens", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, nome, classe, ataque_base, defesa_base, hp_base, hp FROM personagens;"
    );
    res.json({ sucesso: true, personagens: rows });
  } catch (erro) {
    console.error("❌ Erro ao listar personagens:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// =============================
// ⚔️ Lógica de batalha
// =============================
app.post("/acao", async (req, res) => {
  const { sessionId, personagemId, acao } = req.body;
  if (!sessionId || !personagemId)
    return res.status(400).json({ sucesso: false, erro: "Sessão ou personagem ausente." });

  try {
    const [[sessao]] = await pool.query(
      "SELECT * FROM sessoes WHERE session_id = ? LIMIT 1;",
      [sessionId]
    );

    if (!sessao)
      return res.status(404).json({ sucesso: false, erro: "Sessão não encontrada." });

    let { hp_personagem, hp_monstro } = sessao;
    const danoMonstro = Math.floor(Math.random() * 18) + 7; // 💀 monstro causa mais dano

    let resultadoJogador = "";
    let resultadoMonstro = "";

    // =============================
    // 🎯 Jogador realiza a ação
    // =============================
    switch (acao) {
      case "atacar":
        const dano = Math.floor(Math.random() * 15) + 5;
        hp_monstro -= dano;
        resultadoJogador = `Você atacou e causou ${dano} de dano!`;
        break;

      case "bloquear":
        const reducao = Math.floor(Math.random() * 8) + 3;
        hp_personagem -= Math.max(danoMonstro - reducao, 0);
        resultadoJogador = `Você bloqueou ${reducao} de dano!`;
        break;

      case "curar":
        const cura = Math.floor(Math.random() * 12) + 5;
        hp_personagem = Math.min(hp_personagem + cura, 100);
        resultadoJogador = `Você se curou em ${cura} pontos!`;
        break;
    }

    // =============================
    // 👹 Ação do monstro
    // =============================
    if (hp_monstro > 0 && acao !== "bloquear") {
      hp_personagem -= danoMonstro;
      resultadoMonstro = `O monstro atacou e causou ${danoMonstro} de dano!`;
    } else if (hp_monstro <= 0) {
      resultadoMonstro = "O monstro foi derrotado!";
    } else {
      resultadoMonstro = "O monstro aguardou sua ação.";
    }

    // =============================
    // 💀 Condição de fim de jogo
    // =============================
    if (hp_personagem <= 0) {
      resultadoJogador = "💀 Você foi derrotado!";
    } else if (hp_monstro <= 0) {
      resultadoJogador = "🏆 Você venceu a batalha!";
    }

    // =============================
    // 💾 Atualizar estado da sessão
    // =============================
    await pool.query(
      "UPDATE sessoes SET hp_personagem = ?, hp_monstro = ? WHERE session_id = ?;",
      [Math.max(hp_personagem, 0), Math.max(hp_monstro, 0), sessionId]
    );

    // =============================
    // 🖥️ Logs no console
    // =============================
    console.log("📜 Log de Ação ----------------------");
    console.log(`🎮 Sessão: ${sessionId}`);
    console.log(`🧙 Ação do jogador: ${acao}`);
    console.log(`➡️ Resultado do jogador: ${resultadoJogador}`);
    console.log(`👹 Resultado do monstro: ${resultadoMonstro}`);
    console.log(`❤️ HP do Jogador: ${hp_personagem}`);
    console.log(`💀 HP do Monstro: ${hp_monstro}`);
    console.log("------------------------------------\n");

    // =============================
    // 🧾 Resposta para o front-end
    // =============================
    res.json({
      sucesso: true,
      jogador: resultadoJogador,
      monstro: resultadoMonstro,
      hp_personagem: Math.max(hp_personagem, 0),
      hp_monstro: Math.max(hp_monstro, 0),
    });
  } catch (erro) {
    console.error("❌ Erro na ação:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// =============================
// 🚀 Inicialização do Servidor
// =============================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`🟢 Servidor RPG-SGBD rodando na porta ${PORT}`)
);
