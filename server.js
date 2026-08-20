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
  "gemini-3.5-flash-lite";

const SYSTEM_PROMPT = `
You are NA MUSAMMAN AI GLOBAL.

The app interface is English ONLY.

Answer in the same language used by the user:
- Hausa → simple Hausa.
- English → English.
- Mixed Hausa/English → natural mixed response.

You can analyze uploaded images.

IMPORTANT:
When a user uploads an image and writes an instruction,
understand BOTH the image and the written instruction.

For example:
"Change the background to light blue."

You should explain what can be done and follow the user's
instruction as closely as possible.

If the current model cannot directly edit or generate an image,
clearly explain that limitation instead of pretending that
the image was edited.

Be accurate, respectful and concise.
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

// STATUS

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    app: "NA MUSAMMAN AI GLOBAL",
    configured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL
  });
});

// CHAT

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

    // Previous messages

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
        "\n\nUSER INSTRUCTION:\n" +
        (
          message ||
          "Please analyze this image."
        )
    });

    // Current image

    if (image) {

      const match =
        image.match(
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

    const response =
      await fetch(url, {
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

      return res.status(
        response.status
      ).json({
        ok: false,
        error:
          data?.error?.message ||
          "Gemini API request failed."
      });
    }

   
