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

// =====================
// 🔧 CONEXÃO MYSQL
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
// 🌐 ROTAS DO SERVIDOR
// =====================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🔹 Listar personagens
app.get("/personagens", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM personagens;");
    res.json({ sucesso: true, personagens: rows });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔹 Nova sessão
app.post("/nova-sessao", async (req, res) => {
  try {
    const sessionId = uuidv4();
    await pool.query(
      "INSERT INTO sessoes (session_id, hp_personagem, hp_monstro) VALUES (?, 100, 100);",
      [sessionId]
    );
    res.json({ sucesso: true, sessionId });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔹 Ação (batalha)
app.post("/acao", async (req, res) => {
  const { sessionId, personagemId, acao } = req.body;

  if (!sessionId || !acao) {
    return res.status(400).json({ sucesso: false, erro: "Dados inválidos" });
  }

  try {
    const [[sessao]] = await pool.query(
      "SELECT * FROM sessoes WHERE session_id = ?",
      [sessionId]
    );
    if (!sessao)
      return res.json({ sucesso: false, erro: "Sessão não encontrada." });

    let hpPersonagem = sessao.hp_personagem;
    let hpMonstro = sessao.hp_monstro;
    let resultadoJogador = "";
    let resultadoMonstro = "";

    const danoMonstro = Math.floor(Math.random() * 20) + 10;

    if (acao === "atacar") {
      const dano = Math.floor(Math.random() * 20) + 5;
      hpMonstro -= dano;
      resultadoJogador = `Você atacou e causou ${dano} de dano!`;
    } else if (acao === "bloquear") {
      resultadoJogador = "Você se defendeu e reduziu o dano inimigo!";
      hpPersonagem -= Math.floor(danoMonstro / 3);
    } else if (acao === "curar") {
      const cura = Math.floor(Math.random() * 12) + 3;
      hpPersonagem = Math.min(100, hpPersonagem + cura);
      resultadoJogador = `Você se curou em ${cura} pontos!`;
    }

    // Ação aleatória do monstro
    const acaoMonstro = ["atacar", "bloquear"][Math.floor(Math.random() * 2)];
    if (acaoMonstro === "atacar") {
      hpPersonagem -= danoMonstro;
      resultadoMonstro = `O monstro atacou e causou ${danoMonstro} de dano!`;
    } else {
      resultadoMonstro = "O monstro bloqueou parte do dano!";
    }

    hpPersonagem = Math.max(0, hpPersonagem);
    hpMonstro = Math.max(0, hpMonstro);

    await pool.query(
      "UPDATE sessoes SET hp_personagem = ?, hp_monstro = ? WHERE session_id = ?",
      [hpPersonagem, hpMonstro, sessionId]
    );

    res.json({
      sucesso: true,
      jogador: resultadoJogador,
      monstro: resultadoMonstro,
      hp_personagem: hpPersonagem,
      hp_monstro: hpMonstro,
    });
  } catch (erro) {
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// =====================
// 🚀 INICIAR SERVIDOR
// =====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor RPG-SGBD rodando na porta ${PORT}`));
