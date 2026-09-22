import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { describe, it } from 'mocha';

const cjsRequire = createRequire(import.meta.url);
const { matchesComposeTargetSpec, parseFrameRate } = cjsRequire('../app/lib/media');

let hasFfmpeg: boolean;
try {
  execSync('ffmpeg -version', { stdio: 'ignore' });
  execSync('ffprobe -version', { stdio: 'ignore' });
  hasFfmpeg = true;
} catch {
  hasFfmpeg = false;
}

const maybeDescribe = hasFfmpeg ? describe : describe.skip;

describe('test/compose_spec.test.ts parseFrameRate', () => {
  it('parses ffmpeg frame rate expressions', async () => {
    assert.equal(parseFrameRate('24/1'), 24);
    assert.ok(Math.abs(parseFrameRate('24000/1001') - 23.976) < 0.001);
    assert.equal(parseFrameRate('30'), 30);
    assert.equal(parseFrameRate(''), 0);
    assert.equal(parseFrameRate('0/0'), 0);
    assert.equal(parseFrameRate('nonsense'), 0);
  });
});

maybeDescribe('test/compose_spec.test.ts matchesComposeTargetSpec', () => {
  it('skips transcoding for spec-matching files only', async function () {
    this.timeout(60000);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compose-spec-'));
    const matching = path.join(dir, 'matching.mp4');
    const odd = path.join(dir, 'odd.mp4');
    const tone = path.join(dir, 'tone.wav');
    execFileSync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=1',
      '-ar',
      '48000',
      '-ac',
      '2',
      tone,
    ]);
    execFileSync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=1280x720:rate=24:duration=1',
      '-i',
      tone,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '24',
      '-c:a',
      'aac',
      '-ar',
      '48000',
      '-shortest',
      matching,
    ]);
    execFileSync('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=640x480:rate=30:duration=1',
      '-i',
      tone,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
      odd,
    ]);
    assert.equal(await matchesComposeTargetSpec(matching), true);
    assert.equal(await matchesComposeTargetSpec(odd), false);
    assert.equal(await matchesComposeTargetSpec(path.join(dir, 'missing.mp4')), false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
