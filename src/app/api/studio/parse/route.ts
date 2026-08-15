import { requireExaminer, route } from "@/lib/auth-server";
import { extractText } from "@/lib/extract-text";
import { parseQuestions } from "@/lib/import-format";

export const dynamic = "force-dynamic";
/** Parsing is CPU work on a buffer; keep it off the edge runtime. */
export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Reads an uploaded paper and returns the questions found in it.
 *
 * The file is held in memory for the length of this request and then dropped —
 * nothing is written to disk or to the database here. What the browser gets
 * back is the parsed questions, which the examiner reviews before importing.
 */
export const POST = route(async (req) => {
  await requireExaminer(req);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Attach a PDF, Word or text file." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 8 MB.` },
      { status: 413 },
    );
  }

  let text: string;
  try {
    text = await extractText(await file.arrayBuffer(), file.name, file.type);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not read that file." },
      { status: 400 },
    );
  }

  if (!text.trim()) {
    return Response.json(
      { error: "No text found. A scanned PDF has to be run through OCR first." },
      { status: 400 },
    );
  }

  const { questions, problems } = parseQuestions(text);
  return Response.json({
    filename: file.name,
    characters: text.length,
    questions,
    problems,
  });
});
