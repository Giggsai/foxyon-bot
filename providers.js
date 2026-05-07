const axios = require("axios");

async function askGemini(messages) {
  const text = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      contents: [
        {
          parts: [
            {
              text,
            },
          ],
        },
      ],
    }
  );

  return (
    res.data.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Maaf, Gemini lagi kosong jawabannya."
  );
}

async function askGroq(messages) {
  const res = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.1-8b-instant",
      messages,
      temperature: 0.8,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return (
    res.data.choices?.[0]?.message?.content ||
    "Maaf, Groq lagi kosong jawabannya."
  );
}

async function askOpenRouter(messages) {
  const res = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "openrouter/free",
      messages,
      temperature: 0.7,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://telegram-bot.local",
        "X-Title": "Telegram Multi AI Bot",
      },
    }
  );

  return (
    res.data.choices?.[0]?.message?.content ||
    "Maaf, OpenRouter lagi kosong jawabannya."
  );
}

module.exports = {
  askGemini,
  askGroq,
  askOpenRouter,
};
