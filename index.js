import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.static("public"));

// 🔐 Conexão segura com Aiven (certificado em cert/ca.pem)
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS || process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    ca: fs.readFileSync(path.resolve("cert/ca.pem")),
  },
  connectionLimit: 5,
});

// 🧩 Funções auxiliares
async function getPotionItemId() {
  const [rows] = await pool.query(
    "SELECT id FROM itens WHERE tipo='poção' OR nome LIKE '%Poção%' LIMIT 1"
  );
  return rows[0]?.id || null;
}

async function maybeBreakItem(personagemId) {
  if (Math.random() < 0.05) {
    const [[item]] = await pool.query(
      `SELECT i.item_id
         FROM inventario i
         JOIN itens t ON t.id = i.item_id
        WHERE i.personagem_id = ? AND i.quantidade > 0 AND t.tipo IN ('arma','armadura')
        ORDER BY i.item_id LIMIT 1`,
      [personagemId]
    );

    if (item?.item_id) {
      await pool.query(
        "UPDATE inventario SET quantidade = GREATEST(quantidade - 1, 0) WHERE personagem_id = ? AND item_id = ?",
        [personagemId, item.item_id]
      );
      return " 🔧 Um item se quebrou durante o combate!";
    }
  }
  return "";
}

function poucoOuPoucas(qtd, sing, plural) {
  return `${qtd} ${qtd === 1 ? sing : plural}`;
}

// ✅ Testa conexão
pool
  .getConnection()
  .then(() => console.log("✅ Conectado ao banco com sucesso."))
  .catch((err) => console.error("❌ Erro ao conectar no banco:", err.message));

// 🧭 Explorar direção
app.post("/explorar", async (req, res) => {
  const { personagemId, direcao } = req.body;
  try {
    const [[pers]] = await pool.query(
      "SELECT pos_x, pos_y FROM personagens WHERE id = ?",
      [personagemId]
    );
    let { pos_x, pos_y } = pers || { pos_x: 0, pos_y: 0 };

    if (direcao === 1) pos_y = Math.max(0, pos_y - 1);
    else if (direcao === 2) pos_y = Math.min(4, pos_y + 1);
    else if (direcao === 3) pos_x = Math.min(4, pos_x + 1);
    else if (direcao === 4) pos_x = Math.max(0, pos_x - 1);

    await pool.query("UPDATE personagens SET pos_x=?, pos_y=? WHERE id=?", [
      pos_x,
      pos_y,
      personagemId,
    ]);

    const rand = Math.random();
    let tipo_evento = "nada";
    let resultado = "Nada encontrado.";

    if (rand < 0.3) tipo_evento = "item";
    else if (rand < 0.55) tipo_evento = "monstro";

    if (tipo_evento === "item") {
      const itemSorteado = Math.floor(Math.random() * 5) + 1;
      await pool.query(
        `INSERT INTO inventario (personagem_id, item_id, quantidade)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE quantidade = quantidade + 1`,
        [personagemId, itemSorteado]
      );
      resultado = `🎁 Você encontrou um item misterioso (ID ${itemSorteado})!`;
    } else if (tipo_evento === "monstro") {
      const sessionId = Math.random().toString(36).substring(2, 10);
      await pool.query(
        `INSERT INTO batalhas (session_id, personagem_id, monstro_id, hp_personagem, hp_monstro)
         VALUES (?, ?, 1, 100, 100)`,
        [sessionId, personagemId]
      );
      return res.json({
        tipo_evento,
        resultado: "👹 Um monstro apareceu!",
        session_id: sessionId,
        pos_x,
        pos_y,
      });
    }

    res.json({ tipo_evento, resultado, pos_x, pos_y });
  } catch (err) {
    console.error("❌ Erro em /explorar:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ❤️ HP e status
app.get("/personagem/hp/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [[row]] = await pool.query(
      "SELECT hp, pos_x, pos_y, nivel, ataque_base FROM personagens WHERE id=? LIMIT 1",
      [id]
    );
    res.json(
      row || { hp: 100, pos_x: 0, pos_y: 0, nivel: 1, ataque_base: 10 }
    );
  } catch (err) {
    console.error("❌ Erro em /personagem/hp:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// 🎒 Inventário
app.get("/inventario/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT i.item_id, t.nome, t.tipo, i.quantidade
         FROM inventario i
         JOIN itens t ON t.id = i.item_id
        WHERE i.personagem_id = ?`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Erro em /inventario:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// ⚔️ Batalha — turno
app.post("/batalha/turno", async (req, res) => {
  const { sessionId, acao } = req.body;
  try {
    const [[btl]] = await pool.query(
      "SELECT id, personagem_id, hp_personagem, hp_monstro FROM batalhas WHERE session_id=? LIMIT 1",
      [sessionId]
    );
    if (!btl) return res.json({ erro: "Batalha não encontrada." });

    const [[stats]] = await pool.query(
      "SELECT nivel, ataque_base FROM personagens WHERE id=? LIMIT 1",
      [btl.personagem_id]
    );
    const nivel = stats?.nivel ?? 1;
    const atkBase = stats?.ataque_base ?? 10;

    let { hp_personagem: hpP, hp_monstro: hpM } = btl;
    let danoP = Math.floor(Math.random() * 15) + atkBase;
    let danoM = Math.floor(Math.random() * 18) + 8;
    let evento = "";

    if (acao === "atacar") {
      hpM = Math.max(hpM - danoP, 0);
      evento = `⚔️ Você atacou (nível ${nivel}, ATK ${atkBase}) e causou ${danoP} de dano.`;
      hpP = Math.max(hpP - danoM, 0);
      evento += ` O monstro revidou com ${danoM} de dano!`;
    } else if (acao === "bloquear") {
      danoM = Math.floor(danoM / 2);
      hpP = Math.max(hpP - danoM, 0);
      evento = `🛡️ Você bloqueou o ataque e recebeu apenas ${danoM} de dano.`;
    } else if (acao === "curar") {
      const potionId = await getPotionItemId();
      if (!potionId) evento = "Nenhuma poção registrada no sistema.";
      else {
        const [[inv]] = await pool.query(
          "SELECT quantidade FROM inventario WHERE personagem_id=? AND item_id=? LIMIT 1",
          [btl.personagem_id, potionId]
        );
        if (inv?.quantidade > 0) {
          const cura = 100 - hpP; // cura total
          hpP = 100;
          await pool.query(
            "UPDATE inventario SET quantidade = GREATEST(quantidade - 1, 0) WHERE personagem_id=? AND item_id=?",
            [btl.personagem_id, potionId]
          );
          evento =
            cura > 0
              ? `💊 Você usou uma poção e recuperou ${cura} de HP (cura total).`
              : "💊 Seu HP já estava cheio — poção desperdiçada!";
        } else evento = "Você não possui poções.";
      }
    } else return res.json({ erro: "Ação inválida." });

    if (acao !== "curar") evento += await maybeBreakItem(btl.personagem_id);

    const venceu = hpM <= 0;
    const perdeu = hpP <= 0;

    if (venceu) {
      const premioPocoes = Math.floor(Math.random() * 2) + 1;
      await pool.query(
        "UPDATE personagens SET nivel=nivel+1, ataque_base=ataque_base+2, hp=LEAST(hp+20,100) WHERE id=?",
        [btl.personagem_id]
      );
      const potionId = await getPotionItemId();
      if (potionId) {
        await pool.query(
          `INSERT INTO inventario (personagem_id,item_id,quantidade)
           VALUES (?,?,?)
           ON DUPLICATE KEY UPDATE quantidade=quantidade+VALUES(quantidade)`,
          [btl.personagem_id, potionId, premioPocoes]
        );
      }
      const [[lvl]] = await pool.query(
        "SELECT nivel, ataque_base FROM personagens WHERE id=?",
        [btl.personagem_id]
      );
      evento += ` 🏆 Você venceu! Subiu para o nível ${lvl.nivel} (ATK ${lvl.ataque_base}) e ganhou ${poucoOuPoucas(premioPocoes, "poção", "poções")}!`;
    } else if (perdeu) evento += " 💀 Você foi derrotado...";

    await pool.query(
      "UPDATE batalhas SET hp_personagem=?, hp_monstro=?, ultima_acao=NOW() WHERE session_id=?",
      [hpP, hpM, sessionId]
    );
    await pool.query(
      "UPDATE personagens SET hp=? WHERE id=(SELECT personagem_id FROM batalhas WHERE session_id=?)",
      [hpP, sessionId]
    );

    res.json({ hp_personagem: hpP, hp_monstro: hpM, evento, acabou: venceu || perdeu });
  } catch (err) {
    console.error("❌ Erro em /batalha/turno:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// 🔄 Reset completo
app.post("/personagem/reset/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE personagens
       SET hp=100, pos_x=0, pos_y=0, nivel=1, ataque_base=10
       WHERE id=?`,
      [id]
    );
    await pool.query("DELETE FROM inventario WHERE personagem_id=?", [id]);
    await pool.query("DELETE FROM batalhas WHERE personagem_id=?", [id]);
    console.log(`🔄 Personagem ${id} resetado.`);
    res.json({ ok: true, msg: "Personagem reiniciado." });
  } catch (err) {
    console.error("❌ Erro em /personagem/reset:", err.message);
    res.status(500).json({ erro: err.message });
  }
});

// 🚀 Servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor RPG-SGBD rodando em http://localhost:${PORT}`);
});
