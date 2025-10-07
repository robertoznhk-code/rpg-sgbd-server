import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o banco MySQL da Aiven
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
});

// Testar conexão
app.get("/testeConexao", async (req, res) => {
  try {
    const [result] = await pool.query("SELECT NOW() AS hora_atual");
    res.json({ sucesso: true, resultado: result[0] });
  } catch (error) {
    res.json({ sucesso: false, erro: error.message });
  }
});

// Exemplo de batalha
app.post("/batalhar", async (req, res) => {
  try {
    const { personagemId, monstroId } = req.body;
    const [rows] = await pool.query("CALL realizar_batalha(?, ?)", [
      personagemId,
      monstroId,
    ]);
    res.json({ sucesso: true, resultado: rows });
  } catch (error) {
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
