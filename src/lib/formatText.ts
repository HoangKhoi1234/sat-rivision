// Utility to format SAT passages/questions for display with preserved and helpful line breaks
// - Normalizes newlines (\r\n/\r -> \n)
// - Converts literal "\n" sequences from DB to real newlines
// - Ensures "Text 1" and "Text 2" markers appear on their own lines
// - After the header "While researching a topic, a student has taken the following notes:",
//   breaks subsequent sentences onto new lines
// - Escapes HTML and converts newlines to <br/>

export function formatSatText(raw: string): string {
  let text = (raw ?? "").toString();

  // Normalize newlines and convert literal \n sequences
  text = text.replace(/\r\n?|\r/g, "\n").replace(/\\n/g, "\n");

  // Ensure "Text 1" and "Text 2" markers are on their own lines
  // Add a newline after "Text 1" if it's followed by content on same line
  text = text.replace(/(^|\n)\s*Text\s*1\s*:?(\s*)(?=\S)/gi, (_m, p1) => `${p1}Text 1\n`);
  // Ensure a newline before and after "Text 2"
  text = text.replace(/\s*(?:\n)?\s*Text\s*2\s*:?(\s*)/gi, (_m) => `\nText 2\n`);

  // Handle the notes header: split subsequent sentences onto new lines
  const header = "While researching a topic, a student has taken the following notes:";
  const lower = text.toLowerCase();
  const idx = lower.indexOf(header.toLowerCase());
  if (idx !== -1) {
    const start = idx + header.length;
    const before = text.slice(0, start).replace(/[ \t]+$/, "");
    const after = text.slice(start).trim();

    // Collapse whitespace to single spaces for cleaner sentence splitting
    const normalized = after.replace(/[\t ]+/g, " ").replace(/\n+/g, " ");
    // Insert a newline after sentence-ending punctuation followed by a capital, quote, or digit
    const processed = normalized.replace(/([.!?])\s+(?=[A-Z0-9“\"])/g, "$1\n");

    text = `${before}\n${processed}`;
  }

  // Escape HTML
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Convert newlines to <br/>
  return escaped.replace(/\n/g, "<br/>");
}

// Lightweight inline formatter for questions/answers: no forced line breaks
export function formatSatInline(raw: string): string {
  const text = (raw ?? "").toString();
  // Normalize newlines and convert literal \n to spaces, then collapse spaces
  const normalized = text.replace(/\r\n?|\r/g, "\n").replace(/\\n/g, " ").replace(/\n/g, " ");
  const collapsed = normalized.replace(/[ \t]+/g, " ").trim();
  return collapsed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}