import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
  process.env.GEMINI_MODEL ||
  "gemini-3.6-flash";

const SYSTEM_PROMPT = `
You are NA MUSAMMAN AI GLOBAL, a helpful multilingual AI assistant.

The application interface is English ONLY.

Answer in the same language used by the user:
- Hausa → simple natural Hausa.
- English → English.
- Mixed Hausa/English → understand and respond naturally.

You can understand and analyze uploaded images.

Be accurate, clear, respectful and concise.

You can help with:
- General questions
- Education and school work
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

// -----------------------------
// Status
// -----------------------------

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    app: "NA MUSAMMAN AI GLOBAL",
    configured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL
  });
});

// -----------------------------
// Gemini Chat
// -----------------------------

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(
      req.body?.message || ""
    ).trim();

    const image =
      req.body?.image || null;

    const history =
      Array.isArray(req.body?.history)
        ? req.body.history
        : [];

    if (!message && !image) {
      return res.status(400).json({
        error:
          "Please enter a message or upload an image."
      });
    }

    if (!GEMINI_API_KEY) {
      return res.status(503).json({
        error:
          "Gemini API key is not configured."
      });
    }

    const contents = [];

    // Previous conversation
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

    // Current message
    const parts = [];

    parts.push({
      text:
        SYSTEM_PROMPT +
        "\n\nUser message:\n" +
        (message || "Please analyze this image.")
    });

    // Image
    if (image) {
      const match = image.match(
        /^data:(image\/[^;]+);base64,(.+)$/
      );

      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2]
          }
        });
      }
    }

    contents.push({
      role: "user",
      parts
    });

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_MODEL
      )}:generateContent?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`;

    const response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json"
      },

      body: JSON.stringify({
        contents,

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }
      })
    });

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Gemini API error:",
        JSON.stringify(data)
      );

      return res.status(response.status).json({
        ok: false,
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

    const answer =
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || "")
        .join("")
        .trim();

    if (!answer) {
      console.error(
        "Gemini returned no text:",
        JSON.stringify(data)
      );

      return res.status(500).json({
        ok: false,
        error:
          "Gemini returned no answer."
      });
    }

    res.json({
      ok: true,
      answer
    });

  } catch (error) {
    console.error(
      "Gemini connection failed:",
      error?.message || error
    );

    res.status(500).json({
      ok: false,
      error:
        "AI connection error. Please try again."
    });
  }
});

// -----------------------------
// Frontend
// -----------------------------

app.use((_req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

// -----------------------------
// Start server
// -----------------------------

app.listen(PORT, () => {
  console.log(
    `NA MUSAMMAN AI GLOBAL running on port ${PORT}`
  );
});
