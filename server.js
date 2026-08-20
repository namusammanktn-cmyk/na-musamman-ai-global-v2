import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Use a current Gemini model.
// You can override this from Render Environment Variables.
const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash";

const GEMINI_IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "";


// ======================================
// MIDDLEWARE
// ======================================

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


// ======================================
// SYSTEM PROMPT
// ======================================

const SYSTEM_PROMPT = `
You are NA MUSAMMAN AI GLOBAL.

The interface is English ONLY.

Answer the user in the same language they use.

If the user writes Hausa, answer in simple Hausa.
If the user writes English, answer in English.
If the user mixes Hausa and English, understand the
meaning and respond naturally.

Support:
Hausa, English, Arabic, French, Yoruba, Igbo
and other languages.

You can help with:
- General questions
- Education
- Chemistry
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
- Poster instructions
- Image editing instructions
- Documents

When an image is provided, carefully analyze it
and follow the user's instruction.

Be accurate, clear, respectful and concise.

Do not pretend to have live news or live internet
access unless a live browsing tool is actually connected.
`;


// ======================================
// STATUS
// ======================================

app.get("/api/status", (_req, res) => {

  res.json({
    ok: true,
    app: "NA MUSAMMAN AI GLOBAL",
    provider: "Google Gemini",
    configured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
    imageModel:
      GEMINI_IMAGE_MODEL || null
  });

});


// ======================================
// MODELS
// ======================================

app.get("/api/models", async (_req, res) => {

  try {

    if (!GEMINI_API_KEY) {

      return res.status(503).json({
        ok: false,
        error:
          "Gemini API key is not configured."
      });

    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        method: "GET",

        headers: {
          "x-goog-api-key":
            GEMINI_API_KEY
        }
      }
    );

    const data =
      await response.json();

    if (!response.ok) {

      console.error(
        "Gemini models error:",
        JSON.stringify(data)
      );

      return res.status(
        response.status
      ).json({
        ok: false,
        error:
          data?.error?.message ||
          "Could not retrieve Gemini models."
      });

    }

    const models =
      (data.models || []).map(
        (model) => ({
          name: model.name,
          displayName:
            model.displayName,
          description:
            model.description,
          supportedGenerationMethods:
            model.supportedGenerationMethods
        })
      );

    res.json({
      ok: true,
      models
    });

  } catch (error) {

    console.error(
      "Models connection failed:",
      error?.message || error
    );

    res.status(500).json({
      ok: false,
      error:
        "Could not retrieve Gemini models."
    });

  }

});


// ======================================
// CHAT
// ======================================

app.post("/api/chat", async (req, res) => {

  try {

    const message =
      String(
        req.body?.message || ""
      ).trim();

    const image =
      req.body?.image || null;

    const history =
      Array.isArray(
        req.body?.history
      )
        ? req.body.history
        : [];


    // ----------------------------------
    // Validate request
    // ----------------------------------

    if (!message && !image) {

      return res.status(400).json({
        ok: false,
        error:
          "Please enter a message or upload an image."
      });

    }


    // ----------------------------------
    // Check API key
    // ----------------------------------

    if (!GEMINI_API_KEY) {

      return res.status(503).json({
        ok: false,
        error:
          "Gemini API key is not configured."
      });

    }


    // ==================================
    // CONVERSATION HISTORY
    // ==================================

    const contents = [];

    for (
      const item of history.slice(-10)
    ) {

      if (
        !item ||
        !item.content
      ) {
        continue;
      }

      const role =
        item.role === "assistant"
          ? "model"
          : "user";

      contents.push({

        role,

        parts: [
          {
            text:
              String(item.content)
          }
        ]

      });

    }


    // ==================================
    // CURRENT USER MESSAGE
    // ==================================

    const parts = [];


    parts.push({

      text:
        message ||
        "Please analyze this image."

    });


    // ==================================
    // IMAGE
    // ==================================

    if (image) {

      const match =
        image.match(
          /^data:(image\/[^;]+);base64,(.+)$/
        );


      if (!match) {

        return res.status(400).json({

          ok: false,

          error:
            "Invalid image format."

        });

      }


      parts.push({

        inline_data: {

          mime_type:
            match[1],

          data:
            match[2]

        }

      });

    }


    contents.push({

      role: "user",

      parts

    });


    // ==================================
    // GEMINI REQUEST
    // ==================================

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_MODEL
      )}:generateContent`;


    const response =
      await fetch(
        url,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-goog-api-key":
              GEMINI_API_KEY

          },

          body:
            JSON.stringify({

              systemInstruction: {

                parts: [
                  {
                    text:
                      SYSTEM_PROMPT
                  }
                ]

              },

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


    // ==================================
    // GEMINI ERROR
    // ==================================

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


    // ==================================
    // EXTRACT ANSWER
    // ==================================

    const answer =
      data?.candidates?.[0]
        ?.content?.parts
        ?.map(
          (part) =>
            part.text || ""
        )
        .join("")
        .trim();


    if (!answer) {

      console.error(
        "Gemini returned:",
        JSON.stringify(data)
      );

      return res.status(500).json({

        ok: false,

        error:
          "Gemini returned no answer."

      });

    }


    // ==================================
    // SUCCESS
    // ==================================

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


// ======================================
// IMAGE GENERATION / EDITING
// ======================================

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

        ok: false,

        error:
          "Please describe what you want."

      });

    }


    if (!GEMINI_API_KEY) {

      return res.status(503).json({

        ok: false,

        error:
          "Gemini API key is not configured."

      });

    }


    if (!GEMINI_IMAGE_MODEL) {

      return res.status(503).json({

        ok: false,

        error:
          "GEMINI_IMAGE_MODEL is not configured."

      });

    }


    const parts = [];


    // ----------------------------------
    // Poster
    // ----------------------------------

    if (mode === "poster") {

      parts.push({

        text:
          `Create a professional poster.

User request:

${prompt}

Make the design clean, modern,
professional and suitable for social media.

Follow the requested language,
text, layout, colors and style.`

      });

    }

    // ----------------------------------
    // Image editing
    // ----------------------------------

    else {

      parts.push({

        text:
          `Edit the uploaded image according
to this instruction:

${prompt}

Preserve important details unless
the user explicitly asks for them
to be changed.`

      });

    }


    // ----------------------------------
    // Uploaded image
    // ----------------------------------

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


    const imageUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        GEMINI_IMAGE_MODEL
      )}:generateContent`;


    const response =
      await fetch(
        imageUrl,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "x-goog-api-key":
              GEMINI_API_KEY

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
      data?.candidates?.[0]
        ?.content?.parts || [];


    const imagePart =
      outputParts.find(
        (part) =>
          part.inlineData ||
          part.inline_data
      );


    if (!imagePart) {

      const text =
        outputParts
          .map(
            (part) =>
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


    res.json({

      ok: true,

      image:
        `data:${mimeType};base64,${imageData.data}`

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


// ======================================
// FRONTEND FALLBACK
// ======================================

app.use((_req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );

});


// ======================================
// START SERVER
// ======================================

app.listen(PORT, () => {

  console.log(
    `NA MUSAMMAN AI GLOBAL running on port ${PORT}`
  );

});
