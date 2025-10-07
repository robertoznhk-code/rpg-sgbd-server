import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));


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
  password: process.env.DB_PASSWORD,
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

app.get("/dbs", async (req, res) => {
  try {
    const [rows] = await pool.query("SHOW DATABASES;");
    res.json({ sucesso: true, databases: rows });
  } catch (erro) {
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

app.use(express.json());

app.post("/acao", async (req, res) => {
  const { acao } = req.body;
  let mensagem = "";
  let dano = Math.floor(Math.random() * 15) + 5; // dano aleatório entre 5 e 20

  switch (acao) {
    case "atacar":
      mensagem = `Você atacou e causou ${dano} de dano!`;
      break;
    case "bloquear":
      mensagem = `Você bloqueou o ataque inimigo e reduziu o dano em ${Math.floor(Math.random() * 10)}!`;
      break;
    case "curar":
      mensagem = `Você se curou em ${Math.floor(Math.random() * 12) + 3} pontos de vida!`;
      break;
    default:
      mensagem = "Ação desconhecida.";
  }

  // Simulação do ataque do monstro
  const respostaInimigo = Math.random() < 0.7
    ? `O monstro contra-atacou e causou ${Math.floor(Math.random() * 10) + 3} de dano!`
    : `O monstro errou o ataque!`;

  res.json({
    sucesso: true,
    jogador: mensagem,
    inimigo: respostaInimigo,
  });
});


// =====================
// 🚀 INICIAR SERVIDOR
// =====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor RPG-SGBD rodando na porta ${PORT}`);
});
