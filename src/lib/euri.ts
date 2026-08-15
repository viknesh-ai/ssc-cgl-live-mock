/**
 * EURI chat-completions client (OpenAI-compatible) used for post-test answer
 * explanations. Explanations do not depend on which option a candidate picked,
 * so each one is generated once and cached in Postgres.
 */
import { serverEnv } from "@/lib/env";
import { HttpError } from "@/lib/auth-server";
import { OPTION_LETTERS } from "@/lib/exam";

type ChatMessage = { role: "system" | "user"; content: string };

const SYSTEM_PROMPT = [
  "You are a competitive-examination coach in India.",
  "Explain, for a candidate reviewing a mock test, why the given correct option is correct.",
  "Rules:",
  "- Be concrete. Show the actual working, rule, or fact, not general advice.",
  "- Keep it under 140 words.",
  "- Write plain text only: no markdown, no asterisks, no headings, no emoji.",
  "- Structure it as: one line stating the answer, then the reasoning steps, then one line",
  "  starting with 'Trap:' naming the mistake that makes candidates pick a wrong option.",
].join("\n");

export async function generateExplanation(question: {
  sectionName: string;
  text: string;
  options: string[];
  answerIndex: number;
}): Promise<{ content: string; model: string }> {
  const apiKey = serverEnv.euriApiKey;
  if (!apiKey) throw new HttpError(503, "AI review is not configured on this server.");

  const optionList = question.options
    .map((opt, i) => `${OPTION_LETTERS[i]}. ${opt}`)
    .join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `Section: ${question.sectionName}`,
        `Question: ${question.text}`,
        `Options:\n${optionList}`,
        `Correct option: ${OPTION_LETTERS[question.answerIndex]}. ${question.options[question.answerIndex]}`,
      ].join("\n\n"),
    },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let response: Response;
  try {
    response = await fetch(`${serverEnv.euriBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.euriModel,
        messages,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new HttpError(504, "The AI took too long to answer. Try again.");
    }
    throw new HttpError(502, "Could not reach the AI service.");
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[euri]", response.status, detail.slice(0, 500));
    throw new HttpError(502, `AI service returned ${response.status}.`);
  }

  const body = (await response.json()) as {
    model?: string;
    choices?: { message?: { content?: string } }[];
  };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new HttpError(502, "The AI returned an empty explanation.");

  return { content: tidy(content), model: body.model || serverEnv.euriModel };
}

/** Models sometimes ignore "no markdown"; strip the leftovers rather than render them. */
function tidy(text: string) {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(?=\S)/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
