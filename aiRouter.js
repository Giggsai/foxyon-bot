function detectIntent(text) {
  const lower = text.toLowerCase();

  const codingKeywords = [
    "code",
    "kode",
    "coding",
    "program",
    "javascript",
    "node",
    "python",
    "html",
    "css",
    "react",
    "error",
    "bug",
    "debug",
    "function",
    "database",
    "api",
    "bot",
    "github",
  ];

  const studyKeywords = [
    "jelasin",
    "materi",
    "tugas",
    "sekolah",
    "kuliah",
    "rumus",
    "matematika",
    "fisika",
    "kimia",
    "biologi",
    "sejarah",
    "ringkas",
    "rangkuman",
    "contoh soal",
    "belajar",
  ];

  const isCoding = codingKeywords.some((word) => lower.includes(word));
  const isStudy = studyKeywords.some((word) => lower.includes(word));

  if (isCoding) return "coding";
  if (isStudy) return "study";

  return "chat";
}

function chooseProvider(intent) {
  if (intent === "coding") return "openrouter";
  if (intent === "study") return "gemini";

  return "groq";
}

module.exports = {
  detectIntent,
  chooseProvider,
};
