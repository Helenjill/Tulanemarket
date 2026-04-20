import OpenAI from "openai";

export const config = {
  runtime: "nodejs",
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageBase64 } = req.body ?? {};

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ error: "Missing imageBase64" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not set" });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Analyze this marketplace item photo and return ONLY valid JSON with these exact keys: title, description, category, condition, tags. " +
                "Rules: " +
                "title = short natural listing title. " +
                "description = 2 to 4 casual sentences. " +
                "category = choose exactly one from: Furniture, Clothing, Textbooks, Dorm Essentials, Electronics, Home Goods, Bikes / Transportation, Tickets / Extras, Free Stuff, Miscellaneous. " +
                "condition = choose exactly one from: Brand New, Like New, Good, Fair, Poor. " +
                "tags = array of 3 to 6 short lowercase tags. " +
                "Do not include markdown. Do not include any extra text.",
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${imageBase64}`,
            },
          ],
        },
      ],
    });

    const raw = response.output_text?.trim();

    if (!raw) {
      return res.status(500).json({ error: "No AI output returned" });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Failed to parse AI JSON:", raw);
      return res.status(500).json({ error: "AI returned invalid JSON" });
    }

    return res.status(200).json({
      result: {
        title: parsed.title || "",
        description: parsed.description || "",
        category: parsed.category || "",
        condition: parsed.condition || "",
        tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      },
    });
  } catch (error: any) {
    console.error("generate-listing error:", error);
    return res.status(500).json({
      error: error?.message || "Failed to generate listing details",
    });
  }
}
