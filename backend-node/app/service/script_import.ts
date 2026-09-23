'use strict';

const Service = require('egg').Service;
import type { DbRow } from '../lib/entity';
const { ASSET_KIND } = require('../lib/domain_constants');
const { parseScriptWithDeepSeek, DEFAULT_MAX_SCRIPT_CHARS } = require('../lib/deepseek');
const {
  normalizeLLMStoryboardDocument,
  buildCharacterDescription,
  splitScriptIntoChunks,
  uniqueNonEmpty,
} = require('../lib/script_import');
import type { DeepSeekConfig } from '../lib/deepseek';

type ParseScriptFn = (
  config: DeepSeekConfig,
  scriptText: string,
) => Promise<{ cleaned: string; document: Record<string, unknown> }>;

/** 文本指纹：续传时校验文本未被改过，切分才可复用。 */
function hashScriptText(scriptText: string): string {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(String(scriptText || '').trim()).digest('hex');
}

class ScriptImportService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  /**
   * 使用 DeepSeek 解析整段小说/剧本，并重建项目下的章节、场景、镜头和角色关联。
   * @param {number} projectId 项目 id，例如 `19`。
   * @param {string} scriptText 原始小说或剧本文本，例如 `"李明推开便利店门。"`。
   * @param {Function} [parseScript] 解析函数，默认 DeepSeek，可注入 fake。
   * @param {object} [options] 选项：`append` 为 true 时跳过清空阶段，直接追加。
   * @returns {Promise<object>} 导入结果统计，例如 `{ chapter_count: 2, scene_count: 6, storyboard_count: 18 }`。
   * @example
   * await service.parseAndImport(19, "李明推开便利店门。")
   * // => { project_id: 19, chapter_count: 1, scene_count: 1, storyboard_count: 3, character_count: 2 }
   */
  async parseAndImport(
    projectId: number,
    scriptText: string,
    parseScript: ParseScriptFn = parseScriptWithDeepSeek,
    options: { append?: boolean } = {},
  ) {
    const project = await this.ctx.service.project.findById(projectId);
    if (!project) {
      throw new Error('project not found');
    }

    const { cleaned, document } = await parseScript(this.app.config.storyboard, scriptText);
    const { parsed, normalizedCharacters } = normalizeLLMStoryboardDocument(document);

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      if (options.append) {
        await conn.execute(
          "UPDATE projects SET script_text = CONCAT(COALESCE(script_text, ''), ?, ?) WHERE id = ? AND deleted_at IS NULL",
          ['\n\n', cleaned, projectId],
        );
      } else {
        await conn.execute(
          'UPDATE projects SET script_text = ? WHERE id = ? AND deleted_at IS NULL',
          [cleaned, projectId],
        );
      await conn.execute(
        'UPDATE asset_requirements SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL',
        [projectId],
      );

      await conn.query(
        `
        DELETE sc FROM storyboard_characters sc
        JOIN storyboards sb ON sc.storyboard_id = sb.id
        WHERE sb.project_id = ?
      `,
        [projectId],
      );
      await conn.query(
        `DELETE sc FROM scene_characters sc
         JOIN scenes s ON sc.scene_id = s.id
         WHERE s.project_id = ?`,
        [projectId],
      );
      await conn.query(
        `DELETE sau FROM scene_asset_usages sau
         JOIN scenes s ON sau.scene_id = s.id
         WHERE s.project_id = ?`,
        [projectId],
      );
      await conn.execute(
        'UPDATE storyboards SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL',
        [projectId],
      );
      await conn.execute(
        'UPDATE scenes SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL',
        [projectId],
      );
      await conn.execute(
        'UPDATE chapters SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL',
        [projectId],
      );
      }

      const [characterRows] = await conn.query(
        'SELECT id, name FROM characters WHERE project_id = ? AND deleted_at IS NULL',
        [projectId],
      );
      const characterIds = new Map(
        characterRows.map((row: DbRow) => [String(row.name).trim(), Number(row.id)]),
      );

      const result = {
        project_id: projectId,
        chapter_count: 0,
        scene_count: 0,
        storyboard_count: 0,
        character_count: 0,
      };

      const parsedCharacters = new Set();

      const upsertAsset = async (name: string, type: string, meta: unknown) => {
        const serializedMeta = meta ? JSON.stringify({ description: String(meta) }) : null;
        const [rows] = await conn.query(
          `SELECT id FROM assets
           WHERE project_id = ? AND name = ? AND type = ? AND deleted_at IS NULL LIMIT 1`,
          [projectId, name, type],
        );
        if (rows.length) {
          await conn.execute('UPDATE assets SET meta = ? WHERE id = ?', [
            serializedMeta,
            rows[0].id,
          ]);
          return Number(rows[0].id);
        }
        const [insert] = await conn.execute(
          `INSERT INTO assets (project_id, character_id, name, type, file_url, cover_url, thumbnail_url, meta)
           VALUES (?, NULL, ?, ?, '', '', '', ?)`,
          [projectId, name, type, serializedMeta],
        );
        return Number(insert.insertId);
      };

      const upsertCharacter = async (name: string) => {
        const detail = normalizedCharacters.get(name) || {
          description: '',
          appearance: '',
          tags: [],
        };
        if (characterIds.has(name)) {
          await conn.execute('UPDATE characters SET description = ? WHERE id = ?', [
            buildCharacterDescription(detail),
            characterIds.get(name),
          ]);
          return characterIds.get(name);
        }
        const [insertResult] = await conn.execute(
          `INSERT INTO characters (project_id, name, description, avatar_url) VALUES (?, ?, ?, '')`,
          [projectId, name, buildCharacterDescription(detail)],
        );
        characterIds.set(name, insertResult.insertId);
        return insertResult.insertId;
      };

      for (let chapterIndex = 0; chapterIndex < parsed.chapters.length; chapterIndex++) {
        const chapter = parsed.chapters[chapterIndex];
        const chapterCharacters = new Set<string>();
        const chapterAssetRequirements = new Map();
        const collectAssetRequirement = (
          kind: string,
          name: string,
          description: string,
          entityId: number,
        ) => {
          const key = `${kind}:${name}`;
          const current = chapterAssetRequirements.get(key);
          chapterAssetRequirements.set(key, {
            kind,
            name,
            description: current?.description || description,
            entityId,
            sourceCount: (current?.sourceCount || 0) + 1,
          });
        };
        const [chapterInsert] = await conn.execute(
          'INSERT INTO chapters (project_id, title, summary, sort_order) VALUES (?, ?, ?, ?)',
          [projectId, chapter.title, chapter.summary, chapterIndex + 1],
        );
        result.chapter_count++;

        for (let sceneIndex = 0; sceneIndex < chapter.scenes.length; sceneIndex++) {
          const scene = chapter.scenes[sceneIndex];
          const prompt = (scene.storyboards || [])
            .map((storyboard: DbRow, shotIndex: number) => {
              const fields = [
                `镜号：${shotIndex + 1}`,
                storyboard.duration ? `[0-${storyboard.duration}s]` : '',
                [storyboard.shotType, storyboard.cameraDirection].filter(Boolean).join('，'),
                storyboard.cameraMotion,
                storyboard.content,
                storyboard.dialogue ? `台词 & 音效：${storyboard.dialogue}` : '',
              ].filter(Boolean);
              return fields.join(' | ');
            })
            .join('\n\n');
          const [sceneInsert] = await conn.execute(
            `INSERT INTO scenes (chapter_id, project_id, title, description, prompt, location, time_of_day, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              chapterInsert.insertId,
              projectId,
              scene.title,
              scene.description,
              prompt,
              scene.location,
              scene.timeOfDay,
              sceneIndex + 1,
            ],
          );
          result.scene_count++;

          const sceneAssetName = String(scene.location || scene.title || '').trim();
          if (sceneAssetName) {
            const sceneAssetId = await upsertAsset(
              sceneAssetName,
              ASSET_KIND.SCENE,
              [scene.description, scene.timeOfDay].filter(Boolean).join('\n'),
            );
            collectAssetRequirement(
              ASSET_KIND.SCENE,
              sceneAssetName,
              scene.description,
              sceneAssetId,
            );
            await conn.execute(
              `INSERT IGNORE INTO scene_asset_usages (scene_id, asset_id, usage_type)
               VALUES (?, ?, 'reference_asset')`,
              [sceneInsert.insertId, sceneAssetId],
            );
          }

          for (const prop of scene.props || []) {
            const propAssetId = await upsertAsset(prop.name, ASSET_KIND.PROP, prop.description);
            collectAssetRequirement(ASSET_KIND.PROP, prop.name, prop.description, propAssetId);
            await conn.execute(
              `INSERT IGNORE INTO scene_asset_usages (scene_id, asset_id, usage_type)
               VALUES (?, ?, 'reference_asset')`,
              [sceneInsert.insertId, propAssetId],
            );
          }

          for (let shotIndex = 0; shotIndex < scene.storyboards.length; shotIndex++) {
            const storyboard = scene.storyboards[shotIndex];
            result.storyboard_count++;

            for (const name of uniqueNonEmpty(storyboard.characterNames)) {
              parsedCharacters.add(name);
              chapterCharacters.add(name);
              const characterId = await upsertCharacter(name);
              await conn.execute(
                `INSERT INTO scene_characters (scene_id, character_id, line)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE line = VALUES(line)`,
                [sceneInsert.insertId, characterId, storyboard.dialogue || storyboard.content],
              );
            }
          }
        }

        for (const name of chapterCharacters) {
          const characterId = await upsertCharacter(name);
          const detail = normalizedCharacters.get(name) || {};
          await conn.execute(
            `INSERT INTO asset_requirements
             (project_id, chapter_id, kind, name, description, status, linked_entity_type, linked_entity_id, source_count)
             VALUES (?, ?, 'character', ?, ?, 'pending', 'character', ?, 1)`,
            [
              projectId,
              chapterInsert.insertId,
              name,
              buildCharacterDescription(detail),
              characterId,
            ],
          );
        }

        for (const requirement of chapterAssetRequirements.values()) {
          await conn.execute(
            `INSERT INTO asset_requirements
             (project_id, chapter_id, kind, name, description, status, linked_entity_type, linked_entity_id, source_count)
             VALUES (?, ?, ?, ?, ?, 'pending', 'asset', ?, ?)`,
            [
              projectId,
              chapterInsert.insertId,
              requirement.kind,
              requirement.name,
              requirement.description,
              requirement.entityId,
              requirement.sourceCount,
            ],
          );
        }
      }

      result.character_count = parsedCharacters.size;
      await conn.commit();
      return { ...result, character_names: [...parsedCharacters] };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  /**
   * 自动分段导入：超长文本按段落切成多段，首段重建、后续段追加。
   * 单段与过去行为一致；中途失败已提交的分段保留，重试即整篇重导
   * （首段清空，幂等）。调用方第一次失败后如需续传，可自行对剩余
   * 分段调 parseAndImport 追加。
   * @param {number} projectId 项目 id，例如 `19`。
   * @param {string} scriptText 原始小说或剧本文本。
   * @param {Function} [parseScript] 解析函数，默认 DeepSeek，可注入 fake。
   * @param {object} [options] 选项：`skipChunks` 跳过前 N 段（续传），
   * 须配合 `textHash` 校验文本未变更。
   * @returns {Promise<object>} 合计统计 + 分段数，例如 `{ chunk_count: 3, ... }`。
   */
  async importScriptChunked(
    projectId: number,
    scriptText: string,
    parseScript: ParseScriptFn = parseScriptWithDeepSeek,
    options: { skipChunks?: number; textHash?: string } = {},
  ) {
    const project = await this.ctx.service.project.findById(projectId);
    if (!project) {
      throw new Error('project not found');
    }
    const chunks = splitScriptIntoChunks(scriptText, DEFAULT_MAX_SCRIPT_CHARS);
    if (!chunks.length) {
      throw new Error('script text is empty');
    }
    const skipChunks = Math.floor(Number(options.skipChunks) || 0);
    if (skipChunks < 0 || skipChunks >= chunks.length) {
      throw new Error('没有可继续导入的分段，请重新完整导入');
    }
    if (skipChunks > 0) {
      const expectedHash = String(options.textHash || '').trim();
      const actualHash = hashScriptText(scriptText);
      if (!expectedHash || expectedHash !== actualHash) {
        throw new Error('文本已变更，请重新完整导入');
      }
    }
    const total = {
      project_id: projectId,
      chunk_count: chunks.length,
      completed_chunks: chunks.length,
      text_hash: hashScriptText(scriptText),
      chapter_count: 0,
      scene_count: 0,
      storyboard_count: 0,
      character_count: 0,
    };
    const seenCharacters = new Set<string>();
    // 续传时历史数据已在库中，全程追加不再清空。
    const alwaysAppend = skipChunks > 0;
    for (let index = skipChunks; index < chunks.length; index += 1) {
      try {
        const result = await this.parseAndImport(projectId, chunks[index], parseScript, {
          append: alwaysAppend || index > 0,
        });
        total.chapter_count += Number(result.chapter_count) || 0;
        total.scene_count += Number(result.scene_count) || 0;
        total.storyboard_count += Number(result.storyboard_count) || 0;
        for (const name of result.character_names || []) seenCharacters.add(String(name));
      } catch (error) {
        // 已提交的分段保留：把进度挂在错误上，调用方可凭此续传剩余分段。
        const completed = index - skipChunks;
        const progress = new Error(
          `${(error as Error).message}（已导入 ${completed}/${chunks.length - skipChunks} 段）`,
        );
        (progress as { completedChunks?: number }).completedChunks = completed;
        (progress as { totalChunks?: number }).totalChunks = chunks.length - skipChunks;
        (progress as { skippedChunks?: number }).skippedChunks = skipChunks;
        (progress as { textHash?: string }).textHash = total.text_hash;
        throw progress;
      }
    }
    total.character_count = seenCharacters.size || total.character_count;
    return total;
  }
}

module.exports = ScriptImportService;
