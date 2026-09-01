const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const PROFILES_FILE = path.join(__dirname, "profiles.json");

function ensureProfilesFile() {
  if (!fs.existsSync(PROFILES_FILE)) {
    const defaultProfiles = [
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
        enabled: true,
        createdAt: new Date().toISOString()
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
        enabled: true,
        createdAt: new Date().toISOString()
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
        enabled: true,
        createdAt: new Date().toISOString()
      }
    ];

    fs.writeFileSync(PROFILES_FILE, JSON.stringify(defaultProfiles, null, 2));
  }
}

function readProfiles() {
  try {
    ensureProfilesFile();
    const data = fs.readFileSync(PROFILES_FILE, "utf8");
    return JSON.parse(data || "[]");
  } catch (error) {
    console.error("Read profiles error:", error);
    return [];
  }
}

function writeProfiles(profiles) {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error("Write profiles error:", error);
  }
}

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
  res.json({
    status: "ok",
    message: "Backend running"
  });
});

app.get("/profiles", (req, res) => {
  const profiles = readProfiles().filter((profile) => profile.enabled !== false);

  res.json({
    profiles
  });
});

app.get("/profiles/:id", (req, res) => {
  const { id } = req.params;
  const profiles = readProfiles().filter((profile) => profile.enabled !== false);
  const profile = profiles.find((item) => item.id === id);

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
  const profiles = readProfiles();

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

  const profiles = readProfiles();

  const newProfile = {
    id: createId(name),
    name,
    avatar: avatar || "",
    description: description || "",
    detailTitle: detailTitle || name,
    detailContent: detailContent || description || "Available to chat.",
    greeting: greeting || `Hi, I am ${name}.`,
    chatButtonText: chatButtonText || "Chat Now →",
    prompt,
    enabled: enabled !== false,
    createdAt: new Date().toISOString()
  };

  profiles.push(newProfile);
  writeProfiles(profiles);

  res.json({
    success: true,
    profile: newProfile
  });
});

app.put("/admin/profiles/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const profiles = readProfiles();

  const index = profiles.findIndex((profile) => profile.id === id);

  if (index === -1) {
    return res.status(404).json({
      error: "Profile not found"
    });
  }

  const updatedProfile = {
    ...profiles[index],
    ...req.body,
    id,
    updatedAt: new Date().toISOString()
  };

  profiles[index] = updatedProfile;
  writeProfiles(profiles);

  res.json({
    success: true,
    profile: updatedProfile
  });
});

app.delete("/admin/profiles/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const profiles = readProfiles();

  const filteredProfiles = profiles.filter((profile) => profile.id !== id);

  writeProfiles(filteredProfiles);

  res.json({
    success: true
  });
});

app.post("/chat", async (req, res) => {
  try {
    const {
      message,
      history = [],
      profileId
    } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message required"
      });
    }

    const profiles = readProfiles().filter((profile) => profile.enabled !== false);

    const selectedProfile =
      profiles.find((profile) => profile.id === profileId) ||
      profiles[0] ||
      {
        name: "Emma",
        prompt: "You are Emma, a friendly companion. Reply warmly and shortly."
      };

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
          content: message
        }
      ]
    });

    res.json({
      reply: completion.choices[0].message.content
    });
  } catch (error) {
    console.error("Chat service error:", error);

    res.status(500).json({
      error: "Service error. API key/billing/backend check करा."
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
