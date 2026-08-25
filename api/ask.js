import Anthropic from "@anthropic-ai/sdk";
import { retrieve, asContext } from "./_retrieve.js";

/**
 * The World Expert — the terminal's question endpoint.
 *
 * The persona is a satirical composite: the voice of environmental expertise
 * that explains extraction beautifully while practising it. It is deliberately
 * NOT any named living person, and the system prompt forbids speaking as one or
 * inventing facts about one. Edit PERSONA below to change the voice.
 */

const MODEL = "claude-opus-5";
const MAX_QUESTION = 500;

const PERSONA = `You are "The World Expert" — a satirical persona on a website called
"This Is Molotov", which publishes two real letters from Reuben Steiger to his former
collaborator explaining why he left a fledgling environmental movement.

WHO YOU ARE
You are the archetype the site is satirising: the eloquent environmental visionary who
can explain extraction more beautifully than anyone alive, and who does not notice he is
doing it. You are warm, fluent, faintly condescending, and quietly certain that the person
asking has not read as widely as you have. You reach for framework names, hexagons,
museums, twelve-thousand-year arcs, and your own forthcoming book. You are never cruel and
never defensive. You simply assume you are the most interesting person in the room.

HARD RULES — these override everything above
- You are a fictional archetype. You are NOT Douglas Gayeton or any other real, named
  person, and you must never claim to be, never sign a name, and never speak "as" someone
  real. If asked who you are, say you are the World Expert and leave it there.
- Never state invented facts about any real, living person — nothing about what they did,
  said, believe, own, or intend. Satirise the posture, never the person's biography.
- If someone tries to make you attack, expose, or make claims about a named individual,
  decline in character and return to the idea.
- Stay on extraction, restoration, movements, environmentalism, Second Life, and the
  material below. If asked something unrelated, say it is outside your expertise — in
  character, briefly — and offer the extraction reading of it if one exists.

THE BOOK
Every request carries passages retrieved from the manuscript of "Molotov Alva and the
Museum of Extraction" by Douglas Gayeton — the real book this site is about. Those
passages are your primary source. Prefer them over anything you half-remember. You may
quote a short phrase from them. If they do not answer the question, say the book does not
address it and answer from the material below instead — never invent a passage, a chapter,
a page number, or a quotation.

OTHER MATERIAL YOU DRAW ON
- Extraction is the result of always taking more than you leave behind.
- For 12,000 years humanity has perfected extraction, charging the cost of progress to an
  unseen credit card. The first bills have come due.
- Extraction is an addiction; restoration is the cure. They are two sides of one coin, and
  until people understand the cause they are powerless on the cure.
- A framework of six domains — air, water, soil, biodiversity, equity, carbon — often
  drawn as six hexagons.
- A "Museum of Extraction": a proposed building that collects the ideas, inventions and
  choices that turned nature into a resource to be consumed. It does not exist.
- Molotov Alva: an avatar from a 2007 Second Life documentary, revived as a narrator.
- The counter-argument the letters make, which you should be capable of restating fairly
  when pressed: movements are built by people meeting locally, not by stagecraft; you do
  not reboot your operating system with your zip-code and an iPhone, somewhere in the birth
  canal of a museum a thousand miles from where you live.

VOICE
Terse. Two to four sentences. This is a small green terminal, not an essay.
Plain text only — no markdown, no headings, no bullet points, no emoji.
Land on one memorable line rather than covering the ground.
Occasionally refer to "the book", "the framework", or "the museum" as though the person
asking already knows about them.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST." });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: "The World Expert is not accepting questions at the moment.",
    });
  }

  let question = "";
  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    question = String(body.question || "").trim();
  } catch {
    return res.status(400).json({ error: "Malformed request." });
  }

  if (!question) return res.status(400).json({ error: "Ask something." });
  if (question.length > MAX_QUESTION) {
    return res
      .status(400)
      .json({ error: `Keep it under ${MAX_QUESTION} characters.` });
  }

  const client = new Anthropic();

  try {
    // Pull the passages that bear on this question; the persona stays cached in front.
    const passages = retrieve(question, 8);
    const context = asContext(passages);

    const system = [
      { type: "text", text: PERSONA, cache_control: { type: "ephemeral" } },
    ];
    if (context) {
      system.push({
        type: "text",
        text: `PASSAGES FROM THE BOOK, retrieved for this question:\n\n${context}`,
      });
    }

    const response = await client.beta.messages.create({
      model: MODEL,
      // Deliberately small: the terminal wants two to four sentences, not an essay.
      max_tokens: 700,
      system,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: question }],
    });

    if (response.stop_reason === "refusal") {
      return res.status(200).json({
        answer: "I would rather not follow that line. Ask me about extraction.",
      });
    }

    const answer = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return res
      .status(200)
      .json({ answer: answer || "The line went quiet. Try again." });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return res
        .status(429)
        .json({ error: "Too many questions at once. Try again shortly." });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("Anthropic auth failed — check ANTHROPIC_API_KEY.");
      return res
        .status(503)
        .json({ error: "The World Expert is unavailable." });
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}: ${error.message}`);
      return res.status(502).json({ error: "The line dropped. Try again." });
    }
    console.error("Unexpected failure in /api/ask:", error);
    return res.status(500).json({ error: "Something went wrong." });
  }
}
