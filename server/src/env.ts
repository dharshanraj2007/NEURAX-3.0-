import path from "node:path";
import { fileURLToPath } from "node:url";

// Side-effect-only module: must be the first import wherever process.env
// values from .env are read at module-evaluation time (e.g. db.ts), since
// ES module imports are evaluated before the importing module's own body.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // no .env file present -- fall back to whatever's already in the environment
}
