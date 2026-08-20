import "dotenv/config";
import express from "express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

const MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-2.5-flash";

const SYSTEM_PROMPT = `
You are NA MUSAMMAN AI GLOBAL, a helpful multilingual AI assistant.

The application interface is English ONLY.

Answer in the same language used by the user:
- Hausa → simple Hausa
- English → English
- Mixed Hausa/English → natural mixed-language response.

You can understand and analyze uploaded images.

Be accurate, clear, respectful and concise.

Help with:
- General questions
- Education
- Chemistry
- Translation
- Summaries
- News writing
- Social media content
- Image understanding
- Ideas and explanations

Do not claim to have live news unless live browsing is actually connected.
`;

app.use(
  express.json({
    limit: "15mb"
  })
);

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// Status
app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    app: "NA MUSAMMAN AI GLOBAL",
    configured: Boolean(genAI),
    model: MODEL
  });
});

// AI Chat
app.post("/api/chat", async (req, res) => {
  try {
    const message = String(
      req.body?.message || ""
    ).trim();

    const image = req.body?.image || null;

    const history = Array.isArray(
      req.body?.history
    )
      ? req.body.history
      : [];

    if (!message && !image) {
      return res.status(400).json({
        error:
          "Please enter a message or upload an image."
      });
    }

    if (!genAI) {
      return res.status(503).json({
        error:
          "Gemini API key is not configured."
      });
    }

    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT
    });

    const contents = [];

    for (
      const item of history.slice(-10)
    ) {
      if (!item?.content) continue;

      contents.push({
        role:
          item.role === "assistant"
            ? "model"
            : "user",
        parts: [
          {
            text: String(
              item.content
            )
          }
        ]
      });
    }

    const currentParts = [];

    if (message) {
      currentParts.push({
        text: message
      });
    }

    if (image) {
      const match =
        image.match(
          /^data:(image\/[^;]+);base64,(.+)$/
        );

      if (match) {
        currentParts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2]
          }
        });
      }
    }

    contents.push({
      role: "user",
      parts: currentParts
    });

    const result =
      await model.generateContent({
        contents
      });

    const answer =
      result.response.text();

    res.json({
      ok: true,
      answer
    });

  } catch (error) {
    console.error(
      "Gemini request failed:",
      error?.message || error
    );

    res.status(500).json({
      ok: false,
      error:
        "AI connection error. Please try again."
    });
  }
});

// Frontend
app.use((_req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

app.listen(PORT, () => {
  console.log(
    `NA MUSAMMAN AI GLOBAL running on port ${PORT}`
  );
});
