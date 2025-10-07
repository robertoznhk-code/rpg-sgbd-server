import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

// ================================
// 🔧 CONFIGURAÇÃO BASE
// ================================
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ================================
// 📁 DIRETÓRIO PÚBLICO (FRONTEND)
// ================================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

// ================================
// 🧠 CONFIGURAÇÃO DO BANCO MYSQL
// ================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: { rejectUnauthorized: false }, // Necessário para conexões Aiven
});

// ================================
// 🧭 ROTA RAIZ
// ================================
app.get("/", (_, res) => {
  res.send("✅ Servidor RPG-SGBD funcionando com Render e Aiven!");
});

// ================================
// 🔍 TESTE DE CONEXÃO
// ================================
app.get("/testeConexao", async (_, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS hora_atual;");
    res.json({ sucesso: true, resultado: rows[0] });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// ================================
// 📚 LISTAR BANCOS DISPONÍVEIS
// ================================
app.get("/dbs", async (_, res) => {
  try {
    const [rows] = await pool.query("SHOW DATABASES;");
    res.json({ sucesso: true, databases: rows });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// ================================
// ⚔️ INICIAR BATALHA (MYSQL PROC)
// ================================
app.get("/batalha", async (_, res) => {
  try {
    const [rows] = await pool.query("CALL iniciar_batalha();");
    res.json({ sucesso: true, resultado: rows[0] });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// ================================
// 🧙‍♂️ EXECUTAR AÇÃO (MYSQL PROC)
// ================================
app.post("/acao", async (req, res) => {
  const { personagem_id, monstro_id, acao } = req.body;

  if (!personagem_id || !monstro_id || !acao) {
    return res.status(400).json({ sucesso: false, erro: "Parâmetros ausentes." });
  }

  try {
    const [rows] = await pool.query("CALL realizar_acao(?, ?, ?);", [
      personagem_id,
      monstro_id,
      acao,
    ]);
    res.json({ sucesso: true, resultado: rows[0] });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// ================================
// 🚫 ROTA 404 PADRÃO
// ================================
app.use((req, res) => {
  res.status(404).send("❌ Rota não encontrada. Tente / ou /batalha");
});

// ================================
// 🚀 INICIAR SERVIDOR
// ================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor RPG-SGBD rodando na porta ${PORT}`);
});
