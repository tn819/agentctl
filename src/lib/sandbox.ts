export interface SandboxCreateOpts {
  image?:   string;
  repo?:    string;
  name?:    string;
  labels?:  Record<string, string>;
  cpus?:    number;
  memory?:  string;
  network?: "none" | "bridge";
}

export interface SandboxHandle {
  id:       string;
  provider: string;
}

export interface ExecResult {
  stdout:   string;
  stderr:   string;
  exitCode: number;
}

export interface SandboxProvider {
  readonly name: string;
  create(opts: SandboxCreateOpts): Promise<SandboxHandle>;
  exec(handle: SandboxHandle, cmd: string[], env?: Record<string, string>): Promise<ExecResult>;
  writeFile(handle: SandboxHandle, path: string, content: string): Promise<void>;
  readFile(handle: SandboxHandle, path: string): Promise<string>;
  destroy(handle: SandboxHandle): Promise<void>;
  list?(filter?: { namePrefix?: string; labels?: Record<string, string> }): Promise<SandboxHandle[]>;
  createMany?(opts: SandboxCreateOpts[]): Promise<SandboxHandle[]>;
}
