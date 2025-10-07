import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// =====================
// 🔧 CONFIGURAÇÃO MYSQL
// =====================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: {
    rejectUnauthorized: false // necessário para o Aiven
  },
});

// =====================
// 🧠 ROTA PADRÃO
// =====================
app.get("/", (req, res) => {
  res.send("✅ Servidor RPG-SGBD funcionando no Render!");
});

// =====================
// 🧩 TESTE DE CONEXÃO
// =====================
app.get("/testeConexao", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS hora_atual");
    res.json({ sucesso: true, resultado: rows[0] });
  } catch (erro) {
    console.error("Erro na conexão:", erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// =====================
// ⚔️ TESTE DE BATALHA (exemplo futuro)
// =====================
app.get("/batalha", async (req, res) => {
  try {
    // Exemplo: simulação de ataque com dano aleatório
    const dano = Math.floor(Math.random() * 20) + 5;
    res.json({ resultado: `Você causou ${dano} de dano!` });
  } catch (erro) {
    res.status(500).json({ erro: erro.message });
  }
});

// =====================
// 🚀 INICIAR SERVIDOR
// =====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor RPG-SGBD rodando na porta ${PORT}`);
});
