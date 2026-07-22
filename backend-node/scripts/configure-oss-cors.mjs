import path from 'node:path';
import { fileURLToPath } from 'node:url';
import OSS from 'ali-oss';
import dotenv from 'dotenv';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const required = [
  'ALIYUN_OSS_ENDPOINT',
  'ALIYUN_OSS_ACCESS_KEY_ID',
  'ALIYUN_OSS_ACCESS_KEY_SECRET',
  'ALIYUN_OSS_BUCKET',
];
const missing = required.filter((name) => !String(process.env[name] || '').trim());
if (missing.length) {
  throw new Error(`OSS CORS 配置缺少环境变量：${missing.join(', ')}`);
}

function normalizeEndpoint(raw) {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/-internal(?=\.)/, '');
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeRule(rule) {
  return {
    allowedOrigin: asArray(rule.allowedOrigin),
    allowedMethod: asArray(rule.allowedMethod),
    allowedHeader: asArray(rule.allowedHeader),
    exposeHeader: asArray(rule.exposeHeader),
    maxAgeSeconds: Number(rule.maxAgeSeconds || 3600),
  };
}

const origins = new Set(['http://localhost:5173']);
const publicBaseUrl = String(process.env.PUBLIC_APP_BASE_URL || '').trim();
if (publicBaseUrl) {
  try {
    origins.add(new URL(publicBaseUrl).origin);
  } catch {
    throw new Error('PUBLIC_APP_BASE_URL 不是有效 URL');
  }
}

const bucket = String(process.env.ALIYUN_OSS_BUCKET).trim();
const client = new OSS({
  endpoint: normalizeEndpoint(process.env.ALIYUN_OSS_PUBLIC_ENDPOINT || process.env.ALIYUN_OSS_ENDPOINT),
  accessKeyId: String(process.env.ALIYUN_OSS_ACCESS_KEY_ID).trim(),
  accessKeySecret: String(process.env.ALIYUN_OSS_ACCESS_KEY_SECRET).trim(),
  bucket,
  secure: true,
});

let existingRules = [];
try {
  existingRules = (await client.getBucketCORS(bucket)).rules.map(normalizeRule);
} catch (error) {
  if (error?.status !== 404) throw error;
}

const managedOrigins = [...origins];
const preservedRules = existingRules.filter(
  (rule) => !rule.allowedOrigin.some((origin) => managedOrigins.includes(origin)),
);
const frameExtractionRule = {
  allowedOrigin: managedOrigins,
  allowedMethod: ['GET', 'HEAD'],
  allowedHeader: ['*'],
  exposeHeader: ['Content-Length', 'Accept-Ranges', 'ETag'],
  maxAgeSeconds: 3600,
};

await client.putBucketCORS(bucket, [...preservedRules, frameExtractionRule]);
const updated = await client.getBucketCORS(bucket);
const configuredOrigins = updated.rules.flatMap((rule) => asArray(rule.allowedOrigin));

console.log(`[oss-cors] Bucket configured: ${bucket}`);
console.log(`[oss-cors] Frame extraction origins: ${managedOrigins.join(', ')}`);
console.log(`[oss-cors] Total rules: ${updated.rules.length}`);
if (!managedOrigins.every((origin) => configuredOrigins.includes(origin))) {
  throw new Error('OSS CORS 写入后校验失败');
}
