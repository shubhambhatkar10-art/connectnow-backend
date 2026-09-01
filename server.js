const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

let profiles = [
  {
    id: "emma",
    name: "Emma",
    avatar: "https://picsum.photos/500/700?random=1",
    description: "Online now",
    detailTitle: "Emma",
    detailContent: "Available to chat.",
    greeting: "Tell me about yourself",
    chatButtonText: "Chat Now →",
    prompt: "You are Emma, a friendly companion. Keep replies warm, short and respectful.",
    enabled: true
  },
  {
    id: "sophia",
    name: "Sophia",
    avatar: "https://picsum.photos/500/700?random=2",
    description: "Online now",
    detailTitle: "Sophia",
    detailContent: "Available to chat.",
    greeting: "I want to chat",
    chatButtonText: "Chat Now →",
    prompt: "You are Sophia, a friendly companion. Keep replies warm, short and respectful.",
    enabled: true
  },
  {
    id: "olivia",
    name: "Olivia",
    avatar: "https://picsum.photos/500/700?random=3",
    description: "Online now",
    detailTitle: "Olivia",
    detailContent: "Available to chat.",
    greeting: "Tell me about yourself",
    chatButtonText: "Chat Now →",
    prompt: "You are Olivia, a friendly companion. Keep replies warm, short and respectful.",
    enabled: true
  }
];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function createId(name) {
  const base = String(name || "profile")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base + "-" + Date.now();
}

function requireAdmin(req, res, next) {
  const adminPassword = req.headers["x-admin-password"];

  if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
    return res.status(401).json({
      error: "Unauthorized. Admin password चुकीचा आहे."
    });
  }

  next();
}

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Backend running",
    routes: ["/health", "/profiles", "/profiles/:id", "/chat"]
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "Health check ok"
  });
});

app.get("/profiles", (req, res) => {
  const enabledProfiles = profiles.filter((profile) => profile.enabled !== false);

  res.json({
    profiles: enabledProfiles
  });
});

app.get("/profiles/:id", (req, res) => {
  const { id } = req.params;

  const profile = profiles.find(
    (item) => item.id === id && item.enabled !== false
  );

  if (!profile) {
    return res.status(404).json({
      error: "Profile not found"
    });
  }

  res.json({
    profile
  });
});

app.get("/admin/profiles", requireAdmin, (req, res) => {
  res.json({
    profiles
  });
});

app.post("/admin/profiles", requireAdmin, (req, res) => {
  const {
    name,
    avatar,
    description,
    detailTitle,
    detailContent,
    greeting,
    chatButtonText,
    prompt,
    enabled
  } = req.body;

  if (!name || !prompt) {
    return res.status(400).json({
      error: "Name आणि Prompt required आहेत."
    });
  }

  const newProfile = {
    id: createId(name),
    name,
    avatar: avatar || "",
    description: description || "Online now",
    detailTitle: detailTitle || name,
    detailContent: detailContent || "Available to chat.",
    greeting: greeting || `Hi, I am ${name}.`,
    chatButtonText: chatButtonText || "Chat Now →",
    prompt,
    enabled: enabled !== false
  };

  profiles.push(newProfile);

  res.json({
    success: true,
    profile: newProfile
  });
});

app.put("/admin/profiles/:id", requireAdmin, (req, res) => {
  const { id } = req.params;

  const index = profiles.findIndex((profile) => profile.id === id);

  if (index === -1) {
    return res.status(404).json({
      error: "Profile not found"
    });
  }

  profiles[index] = {
    ...profiles[index],
    ...req.body,
    id
  };

  res.json({
    success: true,
    profile: profiles[index]
  });
});

app.delete("/admin/profiles/:id", requireAdmin, (req, res) => {
  const { id } = req.params;

  profiles = profiles.filter((profile) => profile.id !== id);

  res.json({
    success: true
  });
});

app.post("/chat", async (req, res) => {
  try {
    const { message, history = [], profileId } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message required"
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY missing in Render Environment"
      });
    }

    const selectedProfile =
      profiles.find((profile) => profile.id === profileId && profile.enabled !== false) ||
      profiles[0];

    const safeHistory = Array.isArray(history) ? history : [];

    const formattedHistory = safeHistory
      .slice(-10)
      .filter((item) => item.role && item.content)
      .map((item) => ({
        role: item.role === "assistant" ? "assistant" : "user",
        content: String(item.content).slice(0, 1500)
      }));

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content: selectedProfile.prompt
        },
        ...formattedHistory,
        {
          role: "user",
          content: String(message).slice(0, 2000)
        }
      ]
    });

    res.json({
      reply: completion.choices[0].message.content
    });
  } catch (error) {
    console.error("Chat service error:", error);

    res.status(500).json({
      error: error.message || "Service error"
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    availableRoutes: ["/", "/health", "/profiles", "/profiles/:id", "/chat"]
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
