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

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: { rejectUnauthorized: false },
});

// rota raiz
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// criar nova sessão
app.post("/nova-sessao", async (req, res) => {
  try {
    const sessionId = uuidv4();
    await pool.query(
      "INSERT INTO sessoes (session_id, hp_personagem, hp_monstro) VALUES (?, 100, 100)",
      [sessionId]
    );
    res.json({ sucesso: true, sessionId });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// listar personagens
app.get("/personagens", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM personagens;");
    res.json({ sucesso: true, personagens: rows });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// selecionar personagem para sessão
app.post("/selecionar-personagem", async (req, res) => {
  const { sessionId, personagemId } = req.body;
  try {
    await pool.query(
      "UPDATE sessoes SET personagem_id = ? WHERE session_id = ?",
      [personagemId, sessionId]
    );
    res.json({ sucesso: true, mensagem: "Personagem selecionado!" });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// realizar ação
app.post("/acao", async (req, res) => {
  const { sessionId, acao } = req.body;
  try {
    const [sessao] = await pool.query(
      "SELECT hp_personagem, hp_monstro FROM sessoes WHERE session_id = ?",
      [sessionId]
    );
    if (!sessao.length)
      return res.status(400).json({ sucesso: false, erro: "Sessão não encontrada" });

    let { hp_personagem, hp_monstro } = sessao[0];
    let logJogador = "";
    let logMonstro = "";

    const danoJogador = Math.floor(Math.random() * 20) + 5;
    const danoMonstro = Math.floor(Math.random() * 15) + 3;

    switch (acao) {
      case "atacar":
        hp_monstro -= danoJogador;
        logJogador = `Você atacou e causou ${danoJogador} de dano!`;
        break;
      case "bloquear":
        logJogador = "Você se defendeu e reduziu parte do dano!";
        break;
      case "curar":
        const cura = Math.floor(Math.random() * 10) + 5;
        hp_personagem = Math.min(hp_personagem + cura, 100);
        logJogador = `Você se curou em ${cura} pontos de vida!`;
        break;
    }

    if (hp_monstro > 0) {
      const acaoMonstro = ["atacar", "bloquear", "curar"][Math.floor(Math.random() * 3)];
      if (acaoMonstro === "atacar") {
        hp_personagem -= danoMonstro;
        logMonstro = `O monstro atacou e causou ${danoMonstro} de dano!`;
      } else if (acaoMonstro === "bloquear") {
        logMonstro = "O monstro bloqueou seu ataque!";
      } else {
        const curaMonstro = Math.floor(Math.random() * 8) + 3;
        hp_monstro = Math.min(hp_monstro + curaMonstro, 100);
        logMonstro = `O monstro se curou em ${curaMonstro} pontos de vida!`;
      }
    }

    hp_personagem = Math.max(0, hp_personagem);
    hp_monstro = Math.max(0, hp_monstro);

    await pool.query(
      "UPDATE sessoes SET hp_personagem = ?, hp_monstro = ? WHERE session_id = ?",
      [hp_personagem, hp_monstro, sessionId]
    );

    res.json({
      sucesso: true,
      jogador: logJogador,
      monstro: logMonstro,
      hp_personagem,
      hp_monstro,
    });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🔥 Servidor rodando na porta ${PORT}`));
