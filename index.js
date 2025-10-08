// index.js
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
// 🔐 CONEXÃO MYSQL (Aiven/Render compatível)
// =====================
function buildSSL() {
  // Preferível: variável de ambiente com o conteúdo do CA (Render)
  if (process.env.DB_CA_CERT && process.env.DB_CA_CERT.trim().length > 0) {
    return { ca: process.env.DB_CA_CERT };
  }
  // Fallback: não rejeita (apenas para DEV/local quando não há CA)
  return { rejectUnauthorized: false };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS || process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  ssl: buildSSL(),
  connectionLimit: 5,
});

async function testDB() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log("✅ Conectado ao banco com sucesso.");
  } catch (err) {
    console.error("❌ Falha ao conectar no banco:", err.message);
  }
}
testDB();

// =====================
// 🗺️ ESTADO VOLÁTIL (posições por sessão)
// =====================
/**
 * Armazena a posição do jogador por sessão:
 * Map<sessionId, { x:number(0..4), y:number(0..4) }>
 */
const posicoes = new Map();

// =====================
// 🌐 ENDPOINTS
// =====================

// Health-check simples para logs e monitoramento
app.get("/health", async (_req, res) => {
  try {
    const [[row]] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: row?.ok === 1 ? "up" : "unknown" });
  } catch (e) {
    res.status(500).json({ ok: false, db: "down", erro: e.message });
  }
});

// Página inicial (serve /public/index.html)
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🔹 Nova sessão
app.post("/nova-sessao", async (_req, res) => {
  try {
    const sessionId = uuidv4();
    await pool.query(
      "INSERT INTO sessoes (session_id, hp_personagem, hp_monstro) VALUES (?, 100, 100);",
      [sessionId]
    );
    // posição inicial no mapa (0,0)
    posicoes.set(sessionId, { x: 0, y: 0 });
    console.log(`🆕 Sessão criada: ${sessionId}`);
    res.json({ sucesso: true, sessionId });
  } catch (erro) {
    console.error("❌ /nova-sessao:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔹 Explorar direção (mantém posição em memória por sessão)
app.get("/explorar", async (req, res) => {
  try {
    const { session_id, direcao } = req.query;
    if (!session_id) {
      return res.json({ sucesso: false, erro: "session_id ausente" });
    }
    // Confere se sessão existe no banco (opcional mas útil)
    const [[sess]] = await pool.query(
      "SELECT session_id FROM sessoes WHERE session_id = ? LIMIT 1",
      [session_id]
    );
    if (!sess) {
      return res.json({ sucesso: false, erro: "Sessão não encontrada." });
    }

    const p = posicoes.get(session_id) || { x: 0, y: 0 };
    if (direcao === "up") p.y = Math.max(0, p.y - 1);
    if (direcao === "down") p.y = Math.min(4, p.y + 1);
    if (direcao === "left") p.x = Math.max(0, p.x - 1);
    if (direcao === "right") p.x = Math.min(4, p.x + 1);
    posicoes.set(session_id, p);

    const descricoes = [
      "Nada encontrado.",
      "Você ouviu um sussurro distante...",
      "O vento trouxe um cheiro de perigo.",
      "Você encontrou pegadas antigas.",
      "O solo aqui parece ter sido revirado recentemente.",
    ];
    const descricao = descricoes[Math.floor(Math.random() * descricoes.length)];

    res.json({
      sucesso: true,
      pos_x: p.x,
      pos_y: p.y,
      descricao,
    });
  } catch (erro) {
    console.error("❌ /explorar:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔹 Ação de batalha simples (usa tabela `sessoes`)
app.post("/acao", async (req, res) => {
  const { sessionId, acao } = req.body;

  if (!sessionId || !acao) {
    return res.status(400).json({ sucesso: false, erro: "Dados inválidos." });
  }

  try {
    const [[sessao]] = await pool.query(
      "SELECT * FROM sessoes WHERE session_id = ? LIMIT 1",
      [sessionId]
    );
    if (!sessao) return res.json({ sucesso: false, erro: "Sessão não encontrada." });

    let hpPersonagem = Number(sessao.hp_personagem) || 100;
    let hpMonstro = Number(sessao.hp_monstro) || 100;
    let resultadoJogador = "";
    let resultadoMonstro = "";

    const danoMonstro = Math.floor(Math.random() * 20) + 10;

    if (acao === "atacar") {
      const dano = Math.floor(Math.random() * 20) + 5;
      hpMonstro = Math.max(0, hpMonstro - dano);
      resultadoJogador = `Você atacou e causou ${dano} de dano!`;
    } else if (acao === "bloquear") {
      resultadoJogador = "Você se defendeu e reduziu o dano inimigo!";
      hpPersonagem = Math.max(0, hpPersonagem - Math.floor(danoMonstro / 3));
    } else if (acao === "curar") {
      // Cura total (full heal): recupera o que falta até 100
      const cura = 100 - hpPersonagem;
      hpPersonagem = 100;
      resultadoJogador =
        cura > 0
          ? `Você usou uma poção e recuperou ${cura} de HP (cura total).`
          : "Seu HP já estava cheio — poção desperdiçada!";
    } else {
      return res.json({ sucesso: false, erro: "Ação inválida." });
    }

    // Ação aleatória do monstro (se ele ainda estiver vivo)
    if (hpMonstro > 0) {
      const acaoMonstro = Math.random() < 0.65 ? "atacar" : "bloquear";
      if (acaoMonstro === "atacar") {
        hpPersonagem = Math.max(0, hpPersonagem - danoMonstro);
        resultadoMonstro = `O monstro atacou e causou ${danoMonstro} de dano!`;
      } else {
        resultadoMonstro = "O monstro bloqueou parte do dano!";
      }
    } else {
      resultadoMonstro = "O monstro foi derrotado! 🏆";
    }

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
    console.error("❌ /acao:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// =====================
// 🚀 INICIAR SERVIDOR
// =====================
const PORT = Number(process.env.PORT) || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor RPG-SGBD rodando em http://localhost:${PORT}`);
});
