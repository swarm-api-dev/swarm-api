#!/usr/bin/env node
// Ensures the given JS file starts with `#!/usr/bin/env node`.
// Used as a post-build step on packages whose `bin` entry must execute under Node.
import { readFileSync, writeFileSync } from "node:fs";

const target = process.argv[2];
if (!target) {
  console.error("usage: ensure-shebang.mjs <file>");
  process.exit(1);
}

const SHEBANG = "#!/usr/bin/env node\n";
const content = readFileSync(target, "utf8");
if (content.startsWith("#!")) process.exit(0);

writeFileSync(target, SHEBANG + content);
console.log(`ensure-shebang: prepended to ${target}`);
