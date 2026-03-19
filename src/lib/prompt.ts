/**
 * Prompts the user with a yes/no question.
 * - Writes the question to stderr (visible in TTY, ignorable in scripts)
 * - Reads a single line from stdin
 * - Returns true for "y"/"Y", false for anything else
 * - Returns defaultValue (false) on EOF (non-interactive / piped with no input)
 */
type LineReader = () => Promise<string | null>;
type Writer = (s: string) => void;

export async function promptBoolean(question: string, defaultValue = false, _readLine: LineReader = readLine, _write: Writer = (s) => process.stderr.write(s)): Promise<boolean> {
  _write(`${question} [y/n] `);
  const line = await _readLine();
  if (line === null) return defaultValue;
  return line.trim().toLowerCase() === "y";
}

/**
 * Read a single line from a readable stream.
 * Exported for testing with mock streams.
 */
export function readLineFromStream(stream: NodeJS.ReadableStream): Promise<string | null> {
  return new Promise((resolve) => {
    let data = "";
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const newline = text.indexOf("\n");
      if (newline === -1) {
        data += text;
      } else {
        data += text.slice(0, newline);
        stream.off("data", onData);
        stream.off("end", onEnd);
        resolve(data);
      }
    };
    const onEnd = () => resolve(data.length > 0 ? data : null);
    stream.on("data", onData);
    stream.on("end", onEnd);
  });
}

function readLine(): Promise<string | null> {
  process.stdin.resume(); // NOSONAR — intentional stdin read for interactive prompt
  return readLineFromStream(process.stdin);
}
