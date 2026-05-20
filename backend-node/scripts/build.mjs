import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const sourcePackagePath = path.join(rootDir, 'package.json');
const distPackagePath = path.join(distDir, 'package.json');

async function removeDist() {
  await fs.rm(distDir, { recursive: true, force: true });
}

async function runTsc() {
  await execFileAsync(path.join(rootDir, 'node_modules/.bin/tsc'), [ '-p', 'tsconfig.json' ], {
    cwd: rootDir,
    maxBuffer: 20 * 1024 * 1024,
  });
}

async function writeDistPackageJson() {
  const packageJson = JSON.parse(await fs.readFile(sourcePackagePath, 'utf8'));
  const distPackageJson = {
    name: packageJson.name,
    version: packageJson.version,
    private: packageJson.private,
    description: packageJson.description,
    egg: packageJson.egg || {},
  };
  await fs.writeFile(distPackagePath, `${JSON.stringify(distPackageJson, null, 2)}\n`);
}

async function main() {
  await removeDist();
  await runTsc();
  await writeDistPackageJson();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
