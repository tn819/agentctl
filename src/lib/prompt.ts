/**
 * Prompts the user with a yes/no question.
 * - Writes the question to stderr (visible in TTY, ignorable in scripts)
 * - Reads a single line from stdin
 * - Returns true for "y"/"Y", false for anything else
 * - Returns defaultValue (false) on EOF (non-interactive / piped with no input)
 */
export async function promptBoolean(question: string, defaultValue = false): Promise<boolean> {
  process.stderr.write(`${question} [y/n] `);
  const line = await readLine();
  if (line === null) return defaultValue;
  return line.trim().toLowerCase() === "y";
}

async function readLine(): Promise<string | null> {
  return new Promise((resolve) => {
    let data = "";
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const newline = text.indexOf("\n");
      if (newline !== -1) {
        data += text.slice(0, newline);
        process.stdin.off("data", onData);
        process.stdin.off("end", onEnd);
        process.stdin.pause();
        resolve(data);
      } else {
        data += text;
      }
    };
    const onEnd = () => resolve(data.length > 0 ? data : null);
    process.stdin.resume();
    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
  });
}
