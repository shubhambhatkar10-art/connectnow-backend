import express from "express";
import OpenAI from "openai";

const app = express();

const port = process.env.PORT || 3000;

const allowedOrigins = [
  "https://loanlyway.com",
  "https://www.loanlyway.com"
];

app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "missing-key"
});

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Backend running"
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    ok: true,
    message: "Backend running",
    hasApiKey: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        reply: "API key missing aahe."
      });
    }

    const { message, profileName, history } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        reply: "Please type a valid message."
      });
    }

    const safeProfileName = String(profileName || "AI Companion").slice(0, 60);

    const safeHistory = Array.isArray(history)
      ? history.slice(-10).map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: String(item.content || "").slice(0, 500)
        }))
      : [];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are ${safeProfileName}, a friendly AI companion in a website chat widget.
Always say you are AI, not a real person.
Keep replies short and friendly.
Do not ask private data.
Reply in user's language when possible.
          `
        },
        ...safeHistory,
        {
          role: "user",
          content: message.slice(0, 1000)
        }
      ],
      temperature: 0.8,
      max_tokens: 220
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "Sorry, reply generate zala nahi.";

    return res.json({ reply });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      reply: "OpenAI API error aahe. API key/billing check करा."
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
