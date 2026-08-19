import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

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

const SYSTEM_PROMPT = `
You are NA MUSAMMAN AI GLOBAL, a helpful multilingual AI assistant.

The application interface is English ONLY.

Answer in the same language used by the user:
- Hausa → simple Hausa
- English → English
- Mixed Hausa/English → natural mixed-language response.

You can analyze uploaded images.

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

Do not claim to have live news unless live browsing is connected.
`;

app.get("/api/status", (_req, res) => {
  res.json({
    ok: true,
    app: "NA MUSAMMAN AI GLOBAL",
    configured: Boolean(client),
    model: process.env.OPENAI_MODEL || "gpt-5-mini"
  });
});

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

    if (!client) {
      return res.status(503).json({
        error:
          "OpenAI API key is not configured."
      });
    }

    const previousMessages = history
      .slice(-12)
      .map((item) => ({
        role:
          item?.role === "assistant"
            ? "assistant"
            : "user",
        content: String(
          item?.content || ""
        )
      }));

    const userContent = [];

    if (message) {
      userContent.push({
        type: "input_text",
        text: message
      });
    }

    if (image) {
      userContent.push({
        type: "input_image",
        image_url: image
      });
    }

    const input = [
      {
        role: "developer",
        content: SYSTEM_PROMPT
      },

      ...previousMessages,

      {
        role: "user",
        content: userContent
      }
    ];

    const response =
      await client.responses.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-5-mini",
        input
      });

    res.json({
      ok: true,
      answer:
        response.output_text ||
        "No answer received."
    });

  } catch (error) {
    console.error(
      "AI request failed:",
      error?.message || error
    );

    res.status(500).json({
      ok: false,
      error:
        "AI connection error. Please try again."
    });
  }
});

app.get("*", (_req, res) => {
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
