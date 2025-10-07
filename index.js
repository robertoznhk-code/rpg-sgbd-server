import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configuração do banco Aiven via variáveis de ambiente (.env)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  }
});

// 🔹 Rota padrão (para teste no navegador)
app.get("/", (req, res) => {
  res.send("Servidor RPG-SGBD funcionando!");
});

// 🔹 Teste de conexão com o banco
app.get("/testeConexao", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT NOW() AS hora_atual");
    res.json({ sucesso: true, resultado: rows[0] });
  } catch (erro) {
    console.error("Erro ao conectar ao banco:", erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
