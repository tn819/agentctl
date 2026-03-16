/**
 * Prompts the user with a yes/no question.
 * - Writes the question to stderr (visible in TTY, ignorable in scripts)
 * - Reads a single line from stdin
 * - Returns true for "y"/"Y", false for anything else
 * - Returns defaultValue (false) on EOF (non-interactive / piped with no input)
 */
type LineReader = () => Promise<string | null>;

export async function promptBoolean(question: string, defaultValue = false, _readLine: LineReader = readLine): Promise<boolean> {
  process.stderr.write(`${question} [y/n] `);
  const line = await _readLine();
  if (line === null) return defaultValue;
  return line.trim().toLowerCase() === "y";
}

async function readLine(): Promise<string | null> {
  return new Promise((resolve) => {
    let data = "";
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const newline = text.indexOf("\n");
      if (newline === -1) {
        data += text;
      } else {
        data += text.slice(0, newline);
        process.stdin.off("data", onData);
        process.stdin.off("end", onEnd);
        process.stdin.pause();
        resolve(data);
      }
    };
    const onEnd = () => resolve(data.length > 0 ? data : null);
    process.stdin.resume();
    process.stdin.on("data", onData); // NOSONAR — intentional stdin read for interactive prompt
    process.stdin.on("end", onEnd);
  });
}
