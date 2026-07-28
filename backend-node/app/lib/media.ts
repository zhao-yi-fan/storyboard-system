'use strict';
// @ts-nocheck

const fs = require('node:fs');
const fsp = fs.promises;
const os = require('node:os');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const {
  generatedPublicPath,
  isGeneratedAssetPath,
  resolveGeneratedAssetRoot,
  generatedObjectKey,
  generatedObjectKeyToLocalPath,
  isOssEnabled,
  uploadLocalFile,
  downloadGeneratedToFile,
  resolveUrl,
} = require('./generated_asset');

const execFileAsync = promisify(execFile);

function storyboardPreviewSpec() {
  return { width: 480, height: 270, crop: true };
}

function assetPreviewSpec() {
  return { width: 480, height: 270, crop: true };
}

function avatarPreviewSpec() {
  return { width: 256, height: 256, crop: true };
}

function videoPosterSpec() {
  return { width: 480, height: 480, crop: false };
}

function sanitizeFileName(value) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[\/\\ :?&#=]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'preview';
}

async function run(cmd, args) {
  try {
    return await execFileAsync(cmd, args, { maxBuffer: 20 * 1024 * 1024 });
  } catch (error) {
    const stderr = String(error.stderr || '').trim();
    throw new Error(stderr || error.message);
  }
}

async function ensureFfmpeg() {
  await run('ffmpeg', ['-version']);
}

async function ensureFfprobe() {
  await run('ffprobe', ['-version']);
}

async function downloadToBuffer(source, timeoutMs = 120000) {
  const response = await fetch(source, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function materializeSourceToLocalFile(app, source, suffix = '') {
  const value = String(source || '').trim();
  if (!value) {
    throw new Error('source is empty');
  }

  if (/^https?:\/\//.test(value) || value.startsWith('data:')) {
    const tempPath = path.join(
      os.tmpdir(),
      `storyboard-src-${Date.now()}-${Math.random().toString(16).slice(2)}${suffix}`,
    );
    if (value.startsWith('data:')) {
      const [, dataPart = ''] = value.split(',', 2);
      await fsp.writeFile(tempPath, Buffer.from(dataPart, 'base64'));
    } else {
      await fsp.writeFile(tempPath, await downloadToBuffer(value));
    }
    return {
      localPath: tempPath,
      cleanup: async () => {
        await fsp.rm(tempPath, { force: true });
      },
    };
  }

  if (isGeneratedAssetPath(app, value)) {
    if (isOssEnabled(app)) {
      const tempPath = path.join(
        os.tmpdir(),
        `storyboard-gen-${Date.now()}-${Math.random().toString(16).slice(2)}${suffix}`,
      );
      await downloadGeneratedToFile(app, value, tempPath);
      return {
        localPath: tempPath,
        cleanup: async () => {
          await fsp.rm(tempPath, { force: true });
        },
      };
    }
    return {
      localPath: await generatedObjectKeyToLocalPath(app, generatedObjectKey(app, value)),
      cleanup: async () => {},
    };
  }

  if (path.isAbsolute(value)) {
    return { localPath: value, cleanup: async () => {} };
  }

  return { localPath: path.resolve(app.baseDir, value), cleanup: async () => {} };
}

function buildScaleFilter(spec) {
  if (spec.crop) {
    return `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=increase,crop=${spec.width}:${spec.height}`;
  }
  return `scale=${spec.width}:${spec.height}:force_original_aspect_ratio=decrease`;
}

async function createPreviewFromLocalPath(app, localPath, subdir, previewFilename, spec) {
  await ensureFfmpeg();
  const publicPath = generatedPublicPath(app, subdir, previewFilename);
  const outputExtension = path.extname(previewFilename) || '.webp';

  if (isOssEnabled(app)) {
    const tempOutput = path.join(
      os.tmpdir(),
      `storyboard-preview-${Date.now()}-${Math.random().toString(16).slice(2)}${outputExtension}`,
    );
    try {
      await run('ffmpeg', [
        '-y',
        '-i',
        localPath,
        '-vf',
        buildScaleFilter(spec),
        '-frames:v',
        '1',
        tempOutput,
      ]);
      await uploadLocalFile(app, tempOutput, publicPath);
      return publicPath;
    } finally {
      await fsp.rm(tempOutput, { force: true });
    }
  }

  const dir = path.join(await resolveGeneratedAssetRoot(app), subdir);
  await fsp.mkdir(dir, { recursive: true });
  const outputPath = path.join(dir, previewFilename);
  await run('ffmpeg', [
    '-y',
    '-i',
    localPath,
    '-vf',
    buildScaleFilter(spec),
    '-frames:v',
    '1',
    outputPath,
  ]);
  return publicPath;
}

function isMissingWebpEncoderError(error) {
  const message = String(error?.message || error);
  return /(?:webp|encoder).*(?:disabled|not found)|Error selecting an encoder/i.test(message);
}

async function createPreviewFromInput(app, input, subdir, baseName, spec) {
  const sanitizedBaseName = sanitizeFileName(baseName);
  try {
    return await createPreviewFromLocalPath(
      app,
      input,
      subdir,
      `${sanitizedBaseName}.thumb.webp`,
      spec,
    );
  } catch (error) {
    if (!isMissingWebpEncoderError(error)) throw error;
    return await createPreviewFromLocalPath(
      app,
      input,
      subdir,
      `${sanitizedBaseName}.thumb.jpg`,
      spec,
    );
  }
}

async function createPreviewFromSource(app, source, subdir, baseName, spec) {
  const materialized = await materializeSourceToLocalFile(app, source);
  try {
    return await createPreviewFromInput(app, materialized.localPath, subdir, baseName, spec);
  } finally {
    await materialized.cleanup();
  }
}

async function createPreviewFromRemoteSource(app, source, subdir, baseName, spec) {
  const value = String(source || '').trim();
  if (!/^https?:\/\//.test(value)) {
    throw new Error('remote preview source must be an HTTP URL');
  }
  return await createPreviewFromInput(app, value, subdir, baseName, spec);
}

async function storeBuffer(
  app,
  buffer,
  subdir,
  filename,
  contentType = 'application/octet-stream',
) {
  const publicPath = generatedPublicPath(app, subdir, filename);
  if (isOssEnabled(app)) {
    const tempPath = path.join(
      os.tmpdir(),
      `storyboard-store-${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(filename)}`,
    );
    try {
      await fsp.writeFile(tempPath, buffer);
      await uploadLocalFile(app, tempPath, publicPath, contentType);
      return { publicPath, localPath: tempPath };
    } catch (error) {
      await fsp.rm(tempPath, { force: true });
      throw error;
    }
  }

  const dir = path.join(await resolveGeneratedAssetRoot(app), subdir);
  await fsp.mkdir(dir, { recursive: true });
  const localPath = path.join(dir, filename);
  await fsp.writeFile(localPath, buffer);
  return { publicPath, localPath };
}

async function downloadAndStore(
  app,
  sourceUrl,
  subdir,
  filename,
  contentType = 'application/octet-stream',
) {
  const buffer = await downloadToBuffer(sourceUrl);
  return await storeBuffer(app, buffer, subdir, filename, contentType);
}

async function probeDuration(localPath) {
  await ensureFfprobe();
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    localPath,
  ]);
  const value = Number(String(stdout || '').trim());
  return Number.isFinite(value) ? value : 0;
}

function formatDurationSeconds(value: any) {
  const duration = Number(value || 0);
  return `${duration.toFixed(1)}秒`;
}

async function normalizeAudioDuration(buffer: Buffer, options: any = {}) {
  const minSeconds = Number(options.minSeconds || 0);
  const maxSeconds = Number(options.maxSeconds || 0);
  const extension = String(options.extension || 'wav').replace(/^\./, '') || 'wav';
  const outputExtension =
    String(options.outputExtension || extension).replace(/^\./, '') || extension;
  const sampleRate = Number(options.sampleRate || 24000);
  const channels = Number(options.channels || 1);
  const label = String(options.label || '音频');
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'storyboard-audio-'));
  const inputPath = path.join(workDir, `input.${extension}`);
  const outputPath = path.join(workDir, `output.${outputExtension}`);

  try {
    await fsp.writeFile(inputPath, buffer);
    const originalDuration = await probeDuration(inputPath);
    if (!originalDuration) {
      throw new Error(`${label}生成成功但无法读取音频时长，请重试`);
    }
    if (minSeconds > 0 && originalDuration < minSeconds) {
      throw new Error(
        `${label}只有 ${formatDurationSeconds(originalDuration)}，低于目标下限 ${formatDurationSeconds(minSeconds)}。系统已保留原语音，请稍后重试。`,
      );
    }
    if ((maxSeconds > 0 && originalDuration > maxSeconds) || outputExtension !== extension) {
      await ensureFfmpeg();
      const args = [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-ar',
        String(sampleRate),
        '-ac',
        String(channels),
      ];
      if (maxSeconds > 0 && originalDuration > maxSeconds) {
        args.push('-t', String(maxSeconds));
      }
      args.push(outputPath);
      await run('ffmpeg', args);
      const duration = await probeDuration(outputPath);
      return {
        audioBuffer: await fsp.readFile(outputPath),
        duration,
        originalDuration,
        wasTrimmed: maxSeconds > 0 && originalDuration > maxSeconds,
      };
    }

    return {
      audioBuffer: buffer,
      duration: originalDuration,
      originalDuration,
      wasTrimmed: false,
    };
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

async function composeVideos(app, sources, subdir, filename) {
  await ensureFfmpeg();
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'storyboard-compose-'));
  try {
    const inputPaths = [];
    for (let index = 0; index < sources.length; index++) {
      const materialized = await materializeSourceToLocalFile(app, sources[index], '.mp4');
      const tempInput = path.join(workDir, `input-${String(index + 1).padStart(3, '0')}.mp4`);
      await fsp.copyFile(materialized.localPath, tempInput);
      await materialized.cleanup();
      const transcoded = path.join(workDir, `transcoded-${String(index + 1).padStart(3, '0')}.mp4`);
      await run('ffmpeg', [
        '-y',
        '-i',
        tempInput,
        '-vf',
        'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=24',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '28',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ar',
        '48000',
        transcoded,
      ]);
      inputPaths.push(transcoded);
    }

    const concatFile = path.join(workDir, 'inputs.txt');
    const concatBody = `${inputPaths.map((item) => `file '${item.replaceAll("'", "'\\''")}'`).join('\n')}\n`;
    await fsp.writeFile(concatFile, concatBody);

    const finalPath = path.join(workDir, filename);
    await run('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatFile,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      finalPath,
    ]);

    const duration = await probeDuration(finalPath);
    const publicPath = generatedPublicPath(app, subdir, filename);
    if (isOssEnabled(app)) {
      await uploadLocalFile(app, finalPath, publicPath);
      return { publicPath, previewPath: publicPath, duration };
    }

    const dir = path.join(await resolveGeneratedAssetRoot(app), subdir);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.copyFile(finalPath, path.join(dir, filename));
    return { publicPath, previewPath: publicPath, duration };
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

async function trimVideo(app, source, startSeconds, endSeconds, subdir, filename) {
  await ensureFfmpeg();
  const materialized = await materializeSourceToLocalFile(app, source, '.mp4');
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'storyboard-trim-'));
  const outputPath = path.join(workDir, filename);
  try {
    await run('ffmpeg', [
      '-y',
      '-ss',
      String(startSeconds),
      '-i',
      materialized.localPath,
      '-t',
      String(endSeconds - startSeconds),
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
    const duration = await probeDuration(outputPath);
    const publicPath = generatedPublicPath(app, subdir, filename);
    if (isOssEnabled(app)) {
      await uploadLocalFile(app, outputPath, publicPath);
    } else {
      const dir = path.join(await resolveGeneratedAssetRoot(app), subdir);
      await fsp.mkdir(dir, { recursive: true });
      await fsp.copyFile(outputPath, path.join(dir, filename));
    }
    return { publicPath, previewPath: publicPath, duration };
  } finally {
    await materialized.cleanup();
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

function resolveMediaUrl(app, raw) {
  return resolveUrl(app, raw, app.config.storyboard.publicAppBaseUrl || '');
}

module.exports = {
  storyboardPreviewSpec,
  assetPreviewSpec,
  avatarPreviewSpec,
  videoPosterSpec,
  sanitizeFileName,
  downloadToBuffer,
  materializeSourceToLocalFile,
  createPreviewFromLocalPath,
  createPreviewFromSource,
  createPreviewFromRemoteSource,
  storeBuffer,
  downloadAndStore,
  probeDuration,
  normalizeAudioDuration,
  composeVideos,
  trimVideo,
  resolveMediaUrl,
};
