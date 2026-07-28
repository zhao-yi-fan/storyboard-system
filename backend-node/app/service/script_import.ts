'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const { ASSET_KIND } = require('../lib/domain_constants');
const { parseScriptWithDeepSeek } = require('../lib/deepseek');
const {
  normalizeLLMStoryboardDocument,
  buildCharacterDescription,
  uniqueNonEmpty,
} = require('../lib/script_import');

class ScriptImportService extends Service {
  get pool() {
    return this.app.mysqlPool;
  }

  /**
   * 使用 DeepSeek 解析整段小说/剧本，并重建项目下的章节、场景、镜头和角色关联。
   * @param {number} projectId 项目 id，例如 `19`。
   * @param {string} scriptText 原始小说或剧本文本，例如 `"李明推开便利店门。"`。
   * @returns {Promise<object>} 导入结果统计，例如 `{ chapter_count: 2, scene_count: 6, storyboard_count: 18 }`。
   * @example
   * await service.parseAndImport(19, "李明推开便利店门。")
   * // => { project_id: 19, chapter_count: 1, scene_count: 1, storyboard_count: 3, character_count: 2 }
   */
  async parseAndImport(projectId, scriptText) {
    const project = await this.ctx.service.project.findById(projectId);
    if (!project) {
      throw new Error('project not found');
    }

    const { cleaned, document } = await parseScriptWithDeepSeek(
      this.app.config.storyboard,
      scriptText,
    );
    const { parsed, normalizedCharacters } = normalizeLLMStoryboardDocument(document);

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
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

      const [characterRows] = await conn.query(
        'SELECT id, name FROM characters WHERE project_id = ? AND deleted_at IS NULL',
        [projectId],
      );
      const characterIds = new Map(
        characterRows.map((row) => [String(row.name).trim(), Number(row.id)]),
      );

      const result = {
        project_id: projectId,
        chapter_count: 0,
        scene_count: 0,
        storyboard_count: 0,
        character_count: 0,
      };

      const parsedCharacters = new Set();

      const upsertAsset = async (name, type, meta) => {
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

      const upsertCharacter = async (name) => {
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
        const chapterCharacters = new Set();
        const chapterAssetRequirements = new Map();
        const collectAssetRequirement = (kind, name, description, entityId) => {
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
            .map((storyboard, shotIndex) => {
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
            const propAssetId = await upsertAsset(
              prop.name,
              ASSET_KIND.PROP,
              prop.description,
            );
            collectAssetRequirement(
              ASSET_KIND.PROP,
              prop.name,
              prop.description,
              propAssetId,
            );
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
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = ScriptImportService;
