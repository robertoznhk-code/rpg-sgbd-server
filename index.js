import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// 🔧 Conexão MySQL
// =====================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: { rejectUnauthorized: false },
});

// =====================
// 🧙‍♂️ Criar Sessão Nova
// =====================
app.post("/nova-sessao", async (req, res) => {
  try {
    const sessionId = uuidv4();

    await pool.query(
      "INSERT INTO batalhas (session_id, hp_personagem, hp_monstro) VALUES (?, 100, 100)",
      [sessionId]
    );

    res.json({ sucesso: true, sessionId });
  } catch (erro) {
    console.error("Erro ao criar sessão:", erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// =====================
// ⚔️ Realizar Ação
// =====================
app.post("/acao", async (req, res) => {
  const { sessionId, acao } = req.body;
  if (!sessionId) return res.status(400).json({ sucesso: false, erro: "Sessão inválida." });

  try {
    // Ação do jogador
    const [resultadoJogador] = await pool.query(
      "CALL realizar_acao_por_sessao(?, ?)",
      [sessionId, acao]
    );

    // Ação aleatória do monstro
    const acoesPossiveis = ["atacar", "bloquear", "curar"];
    const acaoMonstro = acoesPossiveis[Math.floor(Math.random() * acoesPossiveis.length)];

    const [resultadoMonstro] = await pool.query(
      "CALL realizar_acao_por_sessao(?, ?)",
      [sessionId, acaoMonstro]
    );

    const jogador = resultadoJogador[0][0];
    const monstro = resultadoMonstro[0][0];

    res.json({
      sucesso: true,
      jogador: `Você usou **${acao}** — ${jogador.resultado || "ação executada"}`,
      monstro: `O monstro usou **${acaoMonstro}** — ${monstro.resultado || "ação executada"}`,
      hp_personagem: jogador.hp_personagem,
      hp_monstro: jogador.hp_monstro,
    });

  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});


// =====================
// 🌐 Rota Padrão
// =====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =====================
// 🚀 Iniciar Servidor
// =====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor RPG-SGBD rodando na porta ${PORT}`);
});
