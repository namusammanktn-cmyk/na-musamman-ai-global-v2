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

const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "";


// ========================================
// APP SETTINGS
// ========================================

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


// ========================================
// SYSTEM PROMPT
// ========================================

const SYSTEM_PROMPT = `
You are NA MUSAMMAN AI GLOBAL.

You are a helpful multilingual AI assistant.

The application interface is English ONLY.

IMPORTANT LANGUAGE RULE:
Answer in the same language used by the user.

If the user writes Hausa:
Answer in simple natural Hausa.

If the user writes English:
Answer in English.

If the user writes Arabic:
Answer in Arabic.

If the user writes French:
Answer in French.

If the user writes Yoruba:
Answer in Yoruba.

If the user writes Igbo:
Answer in Igbo.

If the user uses another language:
Answer in that language when possible.

If the user mixes languages:
Understand the mixed language naturally.

You can help with:

- General questions
- Education
- Chemistry
- School work
- Translation
- Summaries
- News reports
- Press releases
- Social media content
- Captions
- Letters
- Speeches
- Ideas
- Image understanding
- Poster ideas
- Image editing instructions
- Document analysis

You can analyze uploaded images.

IMPORTANT:
If the user uploads an image together with a written instruction,
understand BOTH the image and the instruction.

Do not pretend that an image has been edited if the current
image model cannot actually generate an edited image.

Be accurate, clear, respectful and concise.
`;


// ========================================
// STATUS
// ========================================

app.get("/api/status", (_req, res) => {

  res.json({
    ok: true,
    app: "NA MUSAMMAN AI GLOBAL",
    configured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
    imageModel:
      GEMINI_IMAGE_MODEL || null
  });

});


// ========================================
// GEMINI CHAT
// ========================================

app.post("/api/chat", async (req, res) => {

  try {

    const message =
      String(
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

      if (!item?.content)
        continue;


      contents.push({

        role:
          item.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text:
              String(
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
        "\n\nUSER MESSAGE:\n" +
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

            mime_type:
              match[1],

            data:
              match[2]

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
      await fetch(
        url,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              contents,

              generationConfig: {

                temperature: 0.7,

                maxOutputTokens:
                  2048

              }

            })

        }
      );


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


    const answer =
      data
        ?.candidates?.[0]
        ?.content?.parts
        ?.map(
          part =>
            part.text || ""
        )
        .join("")
        .trim();


    if (!answer) {

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


// ========================================
// AI IMAGE / POSTER
// ========================================

app.post("/api/image", async (req, res) => {

  try {

    const prompt =
      String(
        req.body?.prompt || ""
      ).trim();

    const image =
      req.body?.image || null;

    const mode =
      req.body?.mode || "edit";


    if (!prompt) {

      return res.status(400).json({

        error:
          "Please describe what you want."

      });

    }


    if (!GEMINI_API_KEY) {

      return res.status(503).json({

        error:
          "Gemini API key is not configured."

      });

    }


    if (!GEMINI_IMAGE_MODEL) {

      return res.status(503).json({

        error:
          "GEMINI_IMAGE_MODEL is not configured yet."

      });

    }


    const parts = [];


    // Poster instruction

    if (mode === "poster") {

      parts.push({

        text:
          `Create a professional poster.

User request:

${prompt}

Make the design clean, modern,
professional and suitable for social media.

Follow the user's requested language,
text, layout, colors and style.`

      });

    }

    // Image editing instruction

    else {

      parts.push({

        text:
          `Edit the uploaded image according
to the user's instruction.

User instruction:

${prompt}

Preserve the person's identity and
important details unless the user
explicitly asks for them to change.`

      });

    }


    // Add uploaded image

    if (image) {

      const match =
        image.match(
          /^data:(image\/[^;]+);base64,(.+)$/
        );


      if (match) {

        parts.push({

          inline_data: {

            mime_type:
              match[1],

            data:
              match[2]

          }

        });

      }

    }


    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_IMAGE_MODEL
      )}:generateContent?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`;


    const response =
      await fetch(
        url,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json"

          },

          body:
            JSON.stringify({

              contents: [

                {

                  role: "user",

                  parts

                }

              ],

              generationConfig: {

                responseModalities: [
                  "TEXT",
                  "IMAGE"
                ]

              }

            })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      console.error(
        "Gemini image error:",
        JSON.stringify(data)
      );


      return res.status(
        response.status
      ).json({

        ok: false,

        error:
          data?.error?.message ||
          "Image generation failed."

      });

    }


    const outputParts =
      data
        ?.candidates?.[0]
        ?.content?.parts || [];


    // Find generated image

    const imagePart =
      outputParts.find(
        part =>
          part.inlineData ||
          part.inline_data
      );


    if (!imagePart) {

      const text =
        outputParts
          .map(
            part =>
              part.text || ""
          )
          .join("")
          .trim();


      return res.json({

        ok: true,

        message:
          text ||
          "The image model did not return an image."

      });

    }


    const imageData =
      imagePart.inlineData ||
      imagePart.inline_data;


    const mimeType =
      imageData.mimeType ||
      imageData.mime_type ||
      "image/png";


    const base64 =
      imageData.data;


    res.json({

      ok: true,

      image:
        `data:${mimeType};base64,${base64}`

    });


  } catch (error) {

    console.error(
      "Image generation failed:",
      error?.message || error
    );


    res.status(500).json({

      ok: false,

      error:
        "Image generation failed. Please try again."

    });

  }

});


// ========================================
// FRONTEND
// ========================================

app.use(
  (_req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );

  }
);


// ========================================
// START SERVER
// ========================================

app.listen(
  PORT,
  () => {

    console.log(
      `NA MUSAMMAN AI GLOBAL running on port ${PORT}`
    );

  }
);
