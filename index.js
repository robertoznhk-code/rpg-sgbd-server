import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: { rejectUnauthorized: false },
});

// 🆕 Criação de sessão automática
app.get("/nova-sessao", async (req, res) => {
  try {
    const sessionId = uuidv4();
    await pool.query(
      "INSERT INTO batalhas (session_id, personagem_id, monstro_id, hp_personagem, hp_monstro) VALUES (?, 1, 1, 100, 100)",
      [sessionId]
    );
    res.json({ sucesso: true, sessionId });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// ⚔️ Executa ação da batalha
app.post("/acao", async (req, res) => {
  const { acao, sessionId } = req.body;

  try {
    const [resultado] = await pool.query("CALL realizar_acao_por_sessao(?, ?)", [
      sessionId,
      acao,
    ]);
    res.json({ sucesso: true, resultado: resultado[0][0].resultado });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔍 Teste de conexão
app.get("/testeConexao", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS hora_atual");
    res.json({ sucesso: true, resultado: rows[0] });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () =>
  console.log(`Servidor RPG-SGBD rodando na porta ${PORT}`)
);
