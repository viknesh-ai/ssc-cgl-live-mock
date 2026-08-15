/**
 * Reading an uploaded file into plain text.
 *
 * Server-only: it loads a PDF and a Word reader on demand. The buffer handed in
 * lives for the length of one request and is never written to disk.
 */
/** Extracts plain text from a PDF, a Word document, or a text file. */
export async function extractText(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const name = filename.toLowerCase();

  if (name.endsWith(".pdf") || mimeType === "application/pdf") {
    const { extractText: extractPdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  }

  if (name.endsWith(".docx") || mimeType.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return value;
  }

  if (name.endsWith(".txt") || name.endsWith(".md") || mimeType.startsWith("text/")) {
    return new TextDecoder().decode(buffer);
  }

  if (name.endsWith(".doc")) {
    throw new Error("Old .doc files are not supported — save as .docx or PDF and try again.");
  }

  throw new Error("Unsupported file. Upload a PDF, a .docx Word file, or a plain text file.");
}
