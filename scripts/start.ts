// Boots api, crm, admin, portal and prefixes their output. Ctrl-C stops all.
process.env.TEST_MODE ??= "1";
const apps = ["api", "crm", "admin", "portal"] as const;
const colors = { api: 36, crm: 35, admin: 33, portal: 32 };
const procs = apps.map((name) => {
  const p = Bun.spawn(["bun", "run", "dev"], {
    cwd: `${import.meta.dir}/../apps/${name}`,
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });
  const pipe = async (s: ReadableStream<Uint8Array>) => {
    const dec = new TextDecoder();
    for await (const chunk of s) {
      for (const line of dec.decode(chunk).split("\n")) {
        if (line.trim()) console.log(`\x1b[${colors[name]}m[${name}]\x1b[0m ${line}`);
      }
    }
  };
  pipe(p.stdout);
  pipe(p.stderr);
  return p;
});
const stop = () => {
  for (const p of procs) p.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await Promise.race(procs.map((p) => p.exited));
stop();
