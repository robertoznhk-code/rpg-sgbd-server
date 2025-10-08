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
  if (process.env.DB_CA_CERT && process.env.DB_CA_CERT.trim().length > 0) {
    return { ca: process.env.DB_CA_CERT };
  }
  return { rejectUnauthorized: false }; // fallback DEV
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
// 🗺️ ESTADO VOLÁTIL POR SESSÃO
// =====================
const posicoes = new Map();           // Map<sessionId, { x, y }>
const batalha = new Map();            // Map<sessionId, { emBatalha:boolean }>
const inventarios = new Map();        // Map<sessionId, Map<item, qtd>>

function getInv(sessionId) {
  if (!inventarios.has(sessionId)) inventarios.set(sessionId, new Map());
  return inventarios.get(sessionId);
}
function addItem(sessionId, nome, qtd = 1) {
  const inv = getInv(sessionId);
  inv.set(nome, (inv.get(nome) || 0) + qtd);
}
function consumeItem(sessionId, nome, qtd = 1) {
  const inv = getInv(sessionId);
  const atual = inv.get(nome) || 0;
  if (atual <= 0) return false;
  inv.set(nome, Math.max(0, atual - qtd));
  return true;
}

// =====================
// 🌐 ENDPOINTS
// =====================
app.get("/health", async (_req, res) => {
  try {
    const [[row]] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: row?.ok === 1 ? "up" : "unknown" });
  } catch (e) {
    res.status(500).json({ ok: false, db: "down", erro: e.message });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🔹 Nova sessão
app.post("/nova-sessao", async (_req, res) => {
  try {
    const sessionId = uuidv4();
    await pool.query(
      "INSERT INTO sessoes (session_id, hp_personagem, hp_monstro) VALUES (?, 100, 0);",
      // hp_monstro inicia 0 (sem monstro)
      [sessionId]
    );
    posicoes.set(sessionId, { x: 0, y: 0 });
    batalha.set(sessionId, { emBatalha: false });
    inventarios.set(sessionId, new Map([["Poção de Cura", 1]]));
    console.log(`🆕 Sessão criada: ${sessionId}`);
    res.json({ sucesso: true, sessionId });
  } catch (erro) {
    console.error("❌ /nova-sessao:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔹 Status atual (HPs + batalha + pos)
//    -> quando NÃO estiver em batalha: hp_monstro = null (para o front exibir "*sem monstro*")
app.get("/status", async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.json({ sucesso: false, erro: "session_id ausente" });

  try {
    const [[sess]] = await pool.query(
      "SELECT hp_personagem, hp_monstro FROM sessoes WHERE session_id = ? LIMIT 1",
      [session_id]
    );
    if (!sess) return res.json({ sucesso: false, erro: "Sessão não encontrada." });

    const pos = posicoes.get(session_id) || { x: 0, y: 0 };
    const bat = batalha.get(session_id) || { emBatalha: false };

    res.json({
      sucesso: true,
      hp_personagem: Number(sess.hp_personagem),
      hp_monstro: bat.emBatalha ? Number(sess.hp_monstro) : null, // <<< aqui!
      em_batalha: bat.emBatalha,
      pos_x: pos.x,
      pos_y: pos.y,
    });
  } catch (erro) {
    console.error("❌ /status:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔹 Inventário
app.get("/inventario", (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.json({ sucesso: false, erro: "session_id ausente" });
  const inv = Array.from(getInv(session_id).entries()).map(([nome, qtd]) => ({ nome, quantidade: qtd }));
  res.json({ sucesso: true, itens: inv });
});

// 🔹 Explorar (spawn de monstro e loot simples)
//    -> se estiver em batalha, BLOQUEIA movimentação
app.get("/explorar", async (req, res) => {
  try {
    const { session_id, direcao } = req.query;
    if (!session_id) {
      return res.json({ sucesso: false, erro: "session_id ausente" });
    }
    const [[sess]] = await pool.query(
      "SELECT session_id FROM sessoes WHERE session_id = ? LIMIT 1",
      [session_id]
    );
    if (!sess) return res.json({ sucesso: false, erro: "Sessão não encontrada." });

    const bat = batalha.get(session_id) || { emBatalha: false };
    if (bat.emBatalha) {
      return res.json({
        sucesso: false,
        erro: "Você está em batalha e não pode se mover!",
        em_batalha: true,
      });
    }

    // mover
    const p = posicoes.get(session_id) || { x: 0, y: 0 };
    if (direcao === "up") p.y = Math.max(0, p.y - 1);
    if (direcao === "down") p.y = Math.min(4, p.y + 1);
    if (direcao === "left") p.x = Math.max(0, p.x - 1);
    if (direcao === "right") p.x = Math.min(4, p.x + 1);
    posicoes.set(session_id, p);

    let descricao = "Nada encontrado.";
    let monstro = false;
    let loot = null;

    // 35% monstro, 25% loot
    const r = Math.random();
    if (r < 0.35) {
      monstro = true;
      batalha.set(session_id, { emBatalha: true });
      await pool.query(
        "UPDATE sessoes SET hp_monstro = 100 WHERE session_id = ?",
        [session_id]
      );
      descricao = "👹 Um monstro apareceu! Você não pode fugir.";
    } else if (r < 0.60) {
      addItem(session_id, "Poção de Cura", 1);
      loot = { item: "Poção de Cura", quantidade: 1 };
      descricao = "🎁 Você encontrou uma Poção de Cura!";
    } else {
      descricao = "🍂 A área parece tranquila…";
    }

    res.json({
      sucesso: true,
      pos_x: p.x,
      pos_y: p.y,
      descricao,
      monstro,
      loot,
      em_batalha: batalha.get(session_id)?.emBatalha || false,
    });
  } catch (erro) {
    console.error("❌ /explorar:", erro.message);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

// 🔹 Ações de batalha
//    -> ao vencer: emBatalha = false e hp_monstro volta a 0
//    -> ao morrer: reseta sessão e emBatalha = false
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

    const bat = batalha.get(sessionId) || { emBatalha: false };
    let hpPersonagem = Number(sessao.hp_personagem) || 100;
    let hpMonstro = Number(sessao.hp_monstro) || 0;
    let resultadoJogador = "";
    let resultadoMonstro = "";

    if (!bat.emBatalha && acao !== "curar") {
      // só permitir atacar/bloquear se houver monstro
      return res.json({ sucesso: false, erro: "Nenhum monstro para lutar no momento." });
    }

    const danoMonstro = Math.floor(Math.random() * 20) + 10;

    if (acao === "atacar") {
      const dano = Math.floor(Math.random() * 20) + 5;
      hpMonstro = Math.max(0, hpMonstro - dano);
      resultadoJogador = `Você atacou e causou ${dano} de dano!`;
    } else if (acao === "bloquear") {
      resultadoJogador = "Você se defendeu e reduziu o dano inimigo!";
      hpPersonagem = Math.max(0, hpPersonagem - Math.floor(danoMonstro / 3));
    } else if (acao === "curar") {
      const ok = consumeItem(sessionId, "Poção de Cura", 1);
      if (!ok) {
        resultadoJogador = "Você tentou usar uma poção, mas não possui nenhuma.";
      } else {
        const cura = 100 - hpPersonagem;
        hpPersonagem = 100;
        resultadoJogador =
          cura > 0
            ? `Você usou uma poção e recuperou ${cura} de HP (cura total).`
            : "Seu HP já estava cheio — poção desperdiçada!";
      }
    } else {
      return res.json({ sucesso: false, erro: "Ação inválida." });
    }

    // Ação do monstro (se vivo e se está em batalha)
    if (bat.emBatalha && hpMonstro > 0 && acao !== "bloquear") {
      const monstroAtaca = Math.random() < 0.65;
      if (monstroAtaca) {
        hpPersonagem = Math.max(0, hpPersonagem - danoMonstro);
        resultadoMonstro = `O monstro atacou e causou ${danoMonstro} de dano!`;
      } else {
        resultadoMonstro = "O monstro bloqueou parte do dano!";
      }
    } else if (hpMonstro <= 0 && bat.emBatalha) {
      resultadoMonstro = "O monstro foi derrotado! 🏆";
    }

    // Vitória/derrota
    if (hpMonstro <= 0 && bat.emBatalha) {
      batalha.set(sessionId, { emBatalha: false });
      await pool.query("UPDATE sessoes SET hp_monstro = 0 WHERE session_id = ?", [sessionId]);
      const drop = Math.floor(Math.random() * 2) + 1;
      addItem(sessionId, "Poção de Cura", drop);
      resultadoJogador += ` Você venceu a batalha e ganhou ${drop} poç${drop === 1 ? "ão" : "ões"}!`;
    }
    if (hpPersonagem <= 0) {
      batalha.set(sessionId, { emBatalha: false });
      hpPersonagem = 100;
      hpMonstro = 0;
      posicoes.set(sessionId, { x: 0, y: 0 });
      inventarios.set(sessionId, new Map([["Poção de Cura", 1]]));
      resultadoJogador += " 💀 Você foi derrotado e retorna ao início.";
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
      hp_monstro: batalha.get(sessionId)?.emBatalha ? hpMonstro : null, // <<< null fora de batalha
      em_batalha: batalha.get(sessionId)?.emBatalha || false,
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
