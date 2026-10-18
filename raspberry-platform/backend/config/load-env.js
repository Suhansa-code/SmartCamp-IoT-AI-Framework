// Loads raspberry-platform/backend/.env regardless of the process CWD.
// `import 'dotenv/config'` resolves .env from process.cwd(), so starting the
// backend from the repo root would silently fall back to the hard-coded
// broker/database defaults instead of this deployment's .env.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(backendRoot, '.env') });
