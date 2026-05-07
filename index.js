require("dotenv").config();

const { Telegraf } = require("telegraf");
const axios = require("axios");
const fs = require("fs");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const DB_FILE = "db.json";
const activeUsers = new Set();

function now() {
  return new Date().toISOString();
}

function loadDB() {
  const defaultDB = {
    users: {},
    messages: [],
    summaries: {},
    banned: [],
    maintenance: false,
    stats: {
      totalMessages: 0,
      startedAt: now(),
    },
  };

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
    return defaultDB;
  }

  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

    db.users ||= {};
    db.messages ||= [];
    db.summaries ||= {};
    db.banned ||= [];
    db.maintenance ||= false;
    db.stats ||= {
      totalMessages: db.messages.length || 0,
      startedAt: now(),
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  } catch {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDB, null, 2));
    return defaultDB;
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function isBanned(userId) {
  const db = loadDB();
  return db.banned.includes(String(userId));
}

function saveMessage(userId, role, content) {
  const db = loadDB();

  db.messages.push({
    userId: String(userId),
    role,
    content,
    time: now(),
  });

  db.stats.totalMessages = (db.stats.totalMessages || 0) + 1;

  const userMsgs = db.messages.filter((m) => m.userId === String(userId));

  if (userMsgs.length > 50) {
    const removeCount = userMsgs.length - 50;
    let removed = 0;

    db.messages = db.messages.filter((m) => {
      if (m.userId === String(userId) && removed < removeCount) {
        removed++;
        return false;
      }
      return true;
    });
  }

  saveDB(db);
}

function getHistory(userId) {
  const db = loadDB();

  return db.messages
    .filter((m) => m.userId === String(userId))
    .slice(-14)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

function detectMode(text) {
  const t = text.toLowerCase().trim();

  if (t === "p") return "ping";

  if (/ganti topik|reset topik|hapus konteks|lupain dulu/.test(t)) {
    return "reset";
  }

  if (
    /code|kode|coding|error|bug|fix|debug|function|node|express|html|css|python|javascript|api|database|script/.test(
      t
    )
  ) {
    return "coding";
  }

  if (
    /jelasin|materi|tugas|kuliah|sekolah|rumus|belajar|ringkas|rangkuman|contoh soal/.test(
      t
    )
  ) {
    return "study";
  }

  if (/apa|kenapa|gimana|bagaimana|\?/.test(t)) return "question";

  return "chat";
}

function detectCodeLang(text) {
  const t = text.toLowerCase();

  if (t.includes("python") || t.includes("def ") || t.includes("print(")) {
    return "python";
  }

  if (t.includes("<html") || t.includes("</div>") || t.includes("<body")) {
    return "html";
  }

  if (t.includes("css") || (t.includes("{") && t.includes(":") && t.includes(";"))) {
    return "css";
  }

  if (t.includes("{") && t.includes("}") && t.includes(":") && t.includes('"')) {
    return "json";
  }

  return "javascript";
}

function formatCode(text, userText = "") {
  if (!text) return "";

  if (text.includes("```")) return text;

  const combined = `${userText}\n${text}`;

  const looksLikeCode =
    combined.includes("const ") ||
    combined.includes("let ") ||
    combined.includes("var ") ||
    combined.includes("function ") ||
    combined.includes("require(") ||
    combined.includes("import ") ||
    combined.includes("app.") ||
    combined.includes("def ") ||
    combined.includes("print(") ||
    combined.includes("<html") ||
    combined.includes("</") ||
    combined.includes("console.log");

  if (looksLikeCode) {
    const lang = detectCodeLang(combined);
    return "```" + lang + "\n" + text + "\n```";
  }

  return text;
}

async function safeReply(ctx, text, userText = "") {
  const reply = formatCode(text, userText);

  try {
    await ctx.reply(reply, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  } catch {
    await ctx.reply(text || "jawaban kosong", {
      disable_web_page_preview: true,
    });
  }
}

function buildSystem(mode) {
  return `
lu chatbot santai.

gaya:
- pake gue lu
- ngobrol kayak temen
- bahasa normal, gak kaku
- jangan pake kata kamu

mode sekarang: ${mode}

aturan:
- jangan bilang lu ai
- jawab jelas
- jangan ngarang fakta
- kalau gak yakin, bilang gak yakin

kalau user minta coding:
- wajib kasih kode dalam Markdown code block
- kasih penjelasan singkat
- jangan taruh kode tanpa code block

format:
\`\`\`javascript
kode disini
\`\`\`

kalau Python:
\`\`\`python
kode disini
\`\`\`

kalau HTML:
\`\`\`html
kode disini
\`\`\`
`;
}

async function askAI(messages) {
  try {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.75,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      }
    );

    return res.data.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.log("Groq error:", err.response?.data || err.message);
    return "lagi error, coba lagi bentar";
  }
}

function resetUserMemory(userId) {
  const db = loadDB();
  db.messages = db.messages.filter((m) => m.userId !== String(userId));
  saveDB(db);
}

async function processMessage(ctx, text) {
  const userId = ctx.from.id;
  const mode = detectMode(text);

  if (isBanned(userId)) {
    return ctx.reply("lu dibatasi aksesnya");
  }

  if (mode === "ping") {
    const responses = [
      "p p terus, maksudnya apa",
      "p doang, lanjut kek",
      "p lagi, ngomong yang jelas dikit",
      "lu ngetik p doang, gue ngerti apa",
    ];

    return ctx.reply(responses[Math.floor(Math.random() * responses.length)]);
  }

  if (mode === "reset") {
    resetUserMemory(userId);
    return ctx.reply("oke, konteks lama gue reset");
  }

  if (activeUsers.has(userId)) {
    return ctx.reply("tunggu, lagi gue proses yang tadi");
  }

  activeUsers.add(userId);

  try {
    await ctx.sendChatAction("typing");

    saveMessage(userId, "user", text);

    const history = getHistory(userId);

    const messages = [
      {
        role: "system",
        content: buildSystem(mode),
      },
      ...history,
    ];

    const reply = await askAI(messages);

    saveMessage(userId, "assistant", reply);

    await safeReply(ctx, reply, text);
  } catch (err) {
    console.log("Bot error:", err.message);
    await ctx.reply("error, ulang lagi");
  } finally {
    activeUsers.delete(userId);
  }
}

bot.start((ctx) => {
  ctx.reply("gas, kirim aja");
});

bot.on("text", async (ctx) => {
  await processMessage(ctx, ctx.message.text);
});

bot.on("photo", async (ctx) => {
  const caption = ctx.message.caption || "tanpa caption";
  await processMessage(ctx, "user ngirim gambar. caption: " + caption);
});

bot.on("document", async (ctx) => {
  const name = ctx.message.document.file_name || "file";
  const caption = ctx.message.caption || "";
  await processMessage(ctx, `user ngirim file: ${name}. caption: ${caption}`);
});

bot.launch();

console.log("bot jalan aman");
