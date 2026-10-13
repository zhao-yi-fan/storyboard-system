import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Explicit release configuration; preserves all existing secret values and file permissions.
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(rootDir, '.env');
const current = await fs.readFile(envPath, 'utf8');
const line = 'PUBLIC_APP_BASE_URL=https://popreels.zhaoyifan.top';
const updated = /^PUBLIC_APP_BASE_URL=.*$/m.test(current)
  ? current.replace(/^PUBLIC_APP_BASE_URL=.*$/m, line)
  : `${current.trimEnd()}\n${line}\n`;
if (updated !== current) await fs.writeFile(envPath, updated);
console.log('[media-config] Production origin configured');
