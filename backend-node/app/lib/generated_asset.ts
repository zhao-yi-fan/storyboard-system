'use strict';
// @ts-nocheck

const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const { URL } = require('node:url');
const OSS = require('ali-oss');

function storyboardConfig(app) {
  return app.config.storyboard || {};
}

function normalizedGeneratedBasePath(app) {
  const base = String(storyboardConfig(app).generatedAssetBasePath || '/generated').trim() || '/generated';
  return `/${base.replace(/^\/+|\/+$/g, '')}`;
}

function generatedPublicPathFromObjectKey(app, objectKey) {
  const cleaned = String(objectKey || '').trim().replace(/^\/+/, '');
  return `${normalizedGeneratedBasePath(app)}/${cleaned}`;
}

function generatedPublicPath(app, subdir, filename) {
  const left = String(subdir || '').trim().replace(/^\/+|\/+$/g, '');
  const right = String(filename || '').trim().replace(/^\/+/, '');
  return generatedPublicPathFromObjectKey(app, left ? `${left}/${right}` : right);
}

function generatedObjectKey(app, raw) {
  let value = String(raw || '').trim();
  if (!value) {
    throw new Error('empty generated path');
  }

  try {
    const parsed = new URL(value);
    if (parsed.pathname) {
      value = parsed.pathname;
    }
  } catch {}

  const base = normalizedGeneratedBasePath(app);
  if (!value.startsWith(`${base}/`)) {
    throw new Error(`not a generated path: ${raw}`);
  }

  const relative = path.posix.normalize(`/${value.slice(base.length + 1)}`).replace(/^\/+/, '');
  if (!relative || relative.startsWith('..')) {
    throw new Error(`invalid generated path: ${raw}`);
  }
  return relative;
}

function isGeneratedAssetPath(app, raw) {
  try {
    generatedObjectKey(app, raw);
    return true;
  } catch {
    return false;
  }
}

async function resolveGeneratedAssetRoot(app) {
  const configured = String(storyboardConfig(app).generatedAssetDir || '../storage').trim() || '../storage';
  if (path.isAbsolute(configured)) {
    return configured;
  }
  return path.resolve(app.baseDir, configured);
}

async function generatedObjectKeyToLocalPath(app, objectKey) {
  return path.join(await resolveGeneratedAssetRoot(app), objectKey.split('/').join(path.sep));
}

function buildOssEndpoint(raw) {
  return String(raw || '').trim().replace(/^https?:\/\//, '');
}

function derivePublicOssEndpoint(endpoint) {
  return buildOssEndpoint(endpoint).replace('-internal.aliyuncs.com', '.aliyuncs.com');
}

function isOssEnabled(app) {
  const cfg = storyboardConfig(app);
  return Boolean(cfg.aliyunOssEndpoint && cfg.aliyunOssAccessKeyId && cfg.aliyunOssAccessKeySecret && cfg.aliyunOssBucket);
}

function createOssClient(app, usePublicEndpoint = false) {
  const cfg = storyboardConfig(app);
  if (!isOssEnabled(app)) {
    throw new Error('OSS not configured');
  }
  const endpoint = usePublicEndpoint
    ? buildOssEndpoint(cfg.aliyunOssPublicEndpoint) || derivePublicOssEndpoint(cfg.aliyunOssEndpoint)
    : buildOssEndpoint(cfg.aliyunOssEndpoint);
  return new OSS({
    endpoint,
    accessKeyId: cfg.aliyunOssAccessKeyId,
    accessKeySecret: cfg.aliyunOssAccessKeySecret,
    bucket: cfg.aliyunOssBucket,
    secure: true,
  });
}

function normalizeSignedUrl(raw) {
  return String(raw || '')
    .replaceAll('%2F', '/')
    .replaceAll('%2f', '/')
    .replace(/^http:\/\//, 'https://');
}

function resolveGeneratedUrl(app, raw) {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }
  if (!isGeneratedAssetPath(app, value)) {
    return value;
  }
  if (!isOssEnabled(app)) {
    return value;
  }
  const client = createOssClient(app, true);
  const signed = client.signatureUrl(generatedObjectKey(app, value), { method: 'GET', expires: 3600 });
  return normalizeSignedUrl(signed);
}

function resolveUrl(app, raw, publicBaseUrl = '') {
  const value = String(raw || '').trim();
  if (!value) {
    return '';
  }
  if (isGeneratedAssetPath(app, value)) {
    return resolveGeneratedUrl(app, value);
  }
  if (/^https?:\/\//.test(value)) {
    return value;
  }
  if (value.startsWith('/') && String(publicBaseUrl || '').trim()) {
    return `${String(publicBaseUrl).trim().replace(/\/$/, '')}${value}`;
  }
  return value;
}

function isManagedOssHost(app, host) {
  const value = String(host || '').trim().toLowerCase();
  if (!value) {
    return false;
  }
  const cfg = storyboardConfig(app);
  const bucket = String(cfg.aliyunOssBucket || '').trim().toLowerCase();
  const hosts = [
    buildOssEndpoint(cfg.aliyunOssEndpoint),
    buildOssEndpoint(cfg.aliyunOssPublicEndpoint),
    derivePublicOssEndpoint(cfg.aliyunOssEndpoint),
  ].map(item => item.toLowerCase()).filter(Boolean);
  return hosts.some(candidate => value === candidate || (bucket && value === `${bucket}.${candidate}`));
}

function normalizeGeneratedAssetReference(app, raw) {
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

async function ensureGeneratedDir(app, subdir) {
  const root = await resolveGeneratedAssetRoot(app);
  const dir = path.join(root, String(subdir || '').trim());
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function uploadLocalFile(app, localPath, generatedPath) {
  if (!isOssEnabled(app)) {
    return;
  }
  const client = createOssClient(app, false);
  await client.put(generatedObjectKey(app, generatedPath), localPath);
}

async function uploadBuffer(app, buffer, generatedPath) {
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

async function downloadGeneratedToFile(app, generatedPath, localPath) {
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
  if (!result || !result.res || result.res.status >= 300) {
    throw new Error('download generated asset from OSS failed');
  }
}

async function writeBufferToTempFile(buffer, suffix = '') {
  const tempPath = path.join(os.tmpdir(), `storyboard-${Date.now()}-${Math.random().toString(16).slice(2)}${suffix}`);
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
  normalizeGeneratedAssetReference,
  ensureGeneratedDir,
  uploadLocalFile,
  uploadBuffer,
  downloadGeneratedToFile,
  writeBufferToTempFile,
};
