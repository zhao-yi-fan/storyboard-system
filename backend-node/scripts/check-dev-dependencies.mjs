import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 3306);
const timeoutMs = 2500;

function checkTcpConnection() {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    const finish = (error) => {
      socket.destroy();
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    };
    socket.setTimeout(timeoutMs, () => finish(new Error('connection timeout')));
    socket.once('connect', () => finish());
    socket.once('error', finish);
  });
}

try {
  await checkTcpConnection();
  console.log(`[dev-check] MySQL endpoint reachable: ${host}:${port}`);
} catch (error) {
  console.error(`[dev-check] Cannot reach MySQL at ${host}:${port}.`);
  if (host === '127.0.0.1' && port !== 3306) {
    console.error(
      `[dev-check] This looks like an SSH tunnel. Recreate the port mapping before starting Egg:\n` +
        `  ssh -N -L ${port}:127.0.0.1:3306 <user>@<server>`,
    );
  }
  console.error(`[dev-check] ${error?.message || error}`);
  process.exitCode = 1;
}
