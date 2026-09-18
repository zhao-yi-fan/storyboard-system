'use strict';

const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const { URL } = require('node:url');
const OSS = require('ali-oss');
const DIST_DIR_NAME = 'dist';

type StoryboardConfig = {
  generatedAssetBasePath?: string;
  generatedAssetDir?: string;
  publicAppBaseUrl?: string;
  aliyunOssEndpoint?: string;
  aliyunOssPublicEndpoint?: string;
  aliyunOssAccessKeyId?: string;
  aliyunOssAccessKeySecret?: string;
  aliyunOssBucket?: string;
};

type App = {
  baseDir: string;
  config: { storyboard: StoryboardConfig };
};

export type OssClient = {
  signatureUrl: (objectKey: string, options?: Record<string, unknown>) => string;
  put: (...args: unknown[]) => Promise<unknown>;
  get: (...args: unknown[]) => Promise<{ res?: { status?: number } }>;
  getStream: (...args: unknown[]) => Promise<{ stream: NodeJS.ReadableStream; res: { status: number; headers: Record<string, string | string[] | undefined> } }>;
  delete: (...args: unknown[]) => Promise<unknown>;
};

function storyboardConfig(app: App): StoryboardConfig {
  return app.config.storyboard || {};
}

function resolveBackendNodeRootDir(app: App): string {
  const baseDir = String(app.baseDir || '').trim();
  if (!baseDir) {
    return process.cwd();
  }
  return path.basename(baseDir) === DIST_DIR_NAME ? path.resolve(baseDir, '..') : baseDir;
}

function normalizedGeneratedBasePath(app: App): string {
  const base =
    String(storyboardConfig(app).generatedAssetBasePath || '/generated').trim() || '/generated';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}

function generatedPublicPathFromObjectKey(app: App, objectKey: string): string {
  const cleaned = String(objectKey || '')
    .trim()
    .replace(/^\/+/, '');
  return `${normalizedGeneratedBasePath(app)}/${cleaned}`;
}

function generatedPublicPath(app: App, subdir: string, filename: string): string {
  const left = String(subdir || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
  const right = String(filename || '')
    .trim()
    .replace(/^\/+/, '');
  return generatedPublicPathFromObjectKey(app, left ? `${left}/${right}` : right);
}

function generatedObjectKey(app: App, raw: unknown): string {
  let value = String(raw || '').trim();
  if (!value) {
    throw new Error('empty generated path');
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname) {
      value = parsed.pathname;
    }
  } catch { /* intentionally ignored */ }

  const base = normalizedGeneratedBasePath(app);
  if (!value.startsWith(`${base}/`)) {
    throw new Error(`not a generated path: ${raw}`);
  }

  const rawRelative = value.slice(base.length + 1);
  if (rawRelative.split('/').some((segment) => segment === '..')) {
    throw new Error(`invalid generated path: ${raw}`);
  }
  const relative = path.posix.normalize(`/${rawRelative}`).replace(/^\/+/, '');
  if (!relative || relative.startsWith('..')) {
    throw new Error(`invalid generated path: ${raw}`);
  }
  return relative;
}

function isGeneratedAssetPath(app: App, raw: unknown): boolean {
  try {
    generatedObjectKey(app, raw);
    return true;
  } catch {
    return false;
  }
}

async function resolveGeneratedAssetRoot(app: App): Promise<string> {
  const configured =
    String(storyboardConfig(app).generatedAssetDir || '../storage').trim() || '../storage';
  if (path.isAbsolute(configured)) {
    return configured;
  }
  return path.resolve(resolveBackendNodeRootDir(app), configured);
}

async function generatedObjectKeyToLocalPath(app: App, objectKey: string): Promise<string> {
  return path.join(await resolveGeneratedAssetRoot(app), objectKey.split('/').join(path.sep));
}

function buildOssEndpoint(raw: unknown): string {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//, '');
}

function derivePublicOssEndpoint(endpoint: unknown): string {
  return buildOssEndpoint(endpoint).replace('-internal.aliyuncs.com', '.aliyuncs.com');
}

function isOssEnabled(app: App): boolean {
  const cfg = storyboardConfig(app);
  return Boolean(
    cfg.aliyunOssEndpoint &&
    cfg.aliyunOssAccessKeyId &&
    cfg.aliyunOssAccessKeySecret &&
    cfg.aliyunOssBucket,
  );
}

function createOssClient(app: App, usePublicEndpoint = false): OssClient {
  const cfg = storyboardConfig(app);
  if (!isOssEnabled(app)) {
    throw new Error('OSS not configured');
  }
  const endpoint = usePublicEndpoint
    ? buildOssEndpoint(cfg.aliyunOssPublicEndpoint) ||
      derivePublicOssEndpoint(cfg.aliyunOssEndpoint)
    : buildOssEndpoint(cfg.aliyunOssEndpoint);
  return new OSS({
    endpoint,
    accessKeyId: cfg.aliyunOssAccessKeyId,
    accessKeySecret: cfg.aliyunOssAccessKeySecret,
    bucket: cfg.aliyunOssBucket,
    secure: true,
  });
}

function normalizeSignedUrl(raw: unknown): string {
  return String(raw || '')
    .replaceAll('%2F', '/')
    .replaceAll('%2f', '/')
    .replace(/^http:\/\//, 'https://');
}

function resolveGeneratedUrl(app: App, raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }
  if (!isGeneratedAssetPath(app, value)) {
    return value;
  }
  if (!isOssEnabled(app)) {
    const publicBaseUrl = String(storyboardConfig(app).publicAppBaseUrl || '').trim();
    return publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, '')}${value}` : value;
  }
  const client = createOssClient(app, true);
  const signed: string = client.signatureUrl(generatedObjectKey(app, value), {
    method: 'GET',
    expires: 3600,
  });
  return normalizeSignedUrl(signed);
}

function resolveUrl(app: App, raw: unknown, publicBaseUrl = ''): string {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }
  if (isGeneratedAssetPath(app, value)) {
    return value;
  }
  if (/^https?:\/\//.test(value)) {
    return normalizeGeneratedAssetReference(app, value);
  }
  if (value.startsWith('/') && String(publicBaseUrl || '').trim()) {
    return `${String(publicBaseUrl).trim().replace(/\/$/, '')}${value}`;
  }
  return value;
}

function resolveSignedUrl(app: App, raw: unknown, publicBaseUrl = ''): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  const normalized = normalizeGeneratedAssetReference(app, value);
  if (isGeneratedAssetPath(app, normalized)) return resolveGeneratedUrl(app, normalized);
  if (/^https?:\/\//.test(normalized)) return normalized;
  return normalized.startsWith('/') && publicBaseUrl
    ? `${String(publicBaseUrl).replace(/\/$/, '')}${normalized}`
    : normalized;
}

function isManagedOssHost(app: App, host: string): boolean {
  const value = String(host || '')
    .trim()
    .toLowerCase();
  if (!value) {
    return false;
  }
  const cfg = storyboardConfig(app);
  const bucket = String(cfg.aliyunOssBucket || '')
    .trim()
    .toLowerCase();
  const hosts = [
    buildOssEndpoint(cfg.aliyunOssEndpoint),
    buildOssEndpoint(cfg.aliyunOssPublicEndpoint),
    derivePublicOssEndpoint(cfg.aliyunOssEndpoint),
  ]
    .map((item) => item.toLowerCase())
    .filter(Boolean);
  return hosts.some(
    (candidate) => value === candidate || (bucket && value === `${bucket}.${candidate}`),
  );
}

function normalizeGeneratedAssetReference(app: App, raw: unknown): string {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }
  if (isGeneratedAssetPath(app, value)) {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (!parsed.host || !parsed.pathname || !isManagedOssHost(app, parsed.host)) {
      return value;
    }
    const objectKey = path.posix.normalize(parsed.pathname).replace(/^\/+/, '');
    if (!objectKey || objectKey === '.') {
      return value;
    }
    return generatedPublicPathFromObjectKey(app, objectKey);
  } catch {
    return value;
  }
}

async function ensureGeneratedDir(app: App, subdir: string): Promise<string> {
  const root = await resolveGeneratedAssetRoot(app);
  const dir = path.join(root, String(subdir || '').trim());
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function uploadLocalFile(app: App, localPath: string, generatedPath: string): Promise<void> {
  if (!isOssEnabled(app)) {
    return;
  }
  const client = createOssClient(app, false);
  await client.put(generatedObjectKey(app, generatedPath), localPath);
}

async function uploadBuffer(app: App, buffer: Buffer, generatedPath: string): Promise<void> {
  if (!isOssEnabled(app)) {
    const objectKey = generatedObjectKey(app, generatedPath);
    const localPath = await generatedObjectKeyToLocalPath(app, objectKey);
    await fsp.mkdir(path.dirname(localPath), { recursive: true });
    await fsp.writeFile(localPath, buffer);
    return;
  }
  const client = createOssClient(app, false);
  await client.put(generatedObjectKey(app, generatedPath), Buffer.from(buffer));
}

async function deleteGeneratedAsset(app: App, generatedPath: string): Promise<void> {
  if (!isGeneratedAssetPath(app, generatedPath)) return;
  const objectKey = generatedObjectKey(app, generatedPath);
  if (!isOssEnabled(app)) {
    const localPath = await generatedObjectKeyToLocalPath(app, objectKey);
    await fsp.rm(localPath, { force: true });
    return;
  }
  const client = createOssClient(app, false);
  await client.delete(objectKey);
}

async function downloadGeneratedToFile(app: App, generatedPath: string, localPath: string): Promise<void> {
  if (!isGeneratedAssetPath(app, generatedPath)) {
    throw new Error(`not a generated path: ${generatedPath}`);
  }
  if (!isOssEnabled(app)) {
    const source = await generatedObjectKeyToLocalPath(app, generatedObjectKey(app, generatedPath));
    await fsp.copyFile(source, localPath);
    return;
  }
  const client = createOssClient(app, false);
  const result = await client.get(generatedObjectKey(app, generatedPath), localPath);
  if (!result || !result.res || (result.res.status || 0) >= 300) {
    throw new Error('download generated asset from OSS failed');
  }
}

async function writeBufferToTempFile(buffer: Buffer, suffix = ''): Promise<string> {
  const tempPath = path.join(
    os.tmpdir(),
    `storyboard-${Date.now()}-${Math.random().toString(16).slice(2)}${suffix}`,
  );
  await fsp.writeFile(tempPath, buffer);
  return tempPath;
}

module.exports = {
  normalizedGeneratedBasePath,
  generatedPublicPath,
  generatedPublicPathFromObjectKey,
  generatedObjectKey,
  isGeneratedAssetPath,
  resolveGeneratedAssetRoot,
  generatedObjectKeyToLocalPath,
  isOssEnabled,
  createOssClient,
  resolveGeneratedUrl,
  resolveUrl,
  resolveSignedUrl,
  normalizeGeneratedAssetReference,
  ensureGeneratedDir,
  uploadLocalFile,
  uploadBuffer,
  deleteGeneratedAsset,
  downloadGeneratedToFile,
  writeBufferToTempFile,
};
