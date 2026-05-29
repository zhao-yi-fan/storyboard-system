'use strict';
// @ts-nocheck

const Service = require('egg').Service;
const { parseScriptWithDeepSeek } = require('../lib/deepseek');
const { normalizeLLMStoryboardDocument, buildCharacterDescription, uniqueNonEmpty } = require('../lib/script_import');

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

    const { cleaned, document } = await parseScriptWithDeepSeek(this.app.config.storyboard, scriptText);
    const { parsed, normalizedCharacters } = normalizeLLMStoryboardDocument(document);

    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE projects SET script_text = ? WHERE id = ? AND deleted_at IS NULL', [ cleaned, projectId ]);

      await conn.query(`
        DELETE sc FROM storyboard_characters sc
        JOIN storyboards sb ON sc.storyboard_id = sb.id
        WHERE sb.project_id = ?
      `, [ projectId ]);
      await conn.execute('UPDATE storyboards SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL', [ projectId ]);
      await conn.execute('UPDATE scenes SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL', [ projectId ]);
      await conn.execute('UPDATE chapters SET deleted_at = NOW() WHERE project_id = ? AND deleted_at IS NULL', [ projectId ]);

      const [ characterRows ] = await conn.query('SELECT id, name FROM characters WHERE project_id = ? AND deleted_at IS NULL', [ projectId ]);
      const characterIds = new Map(characterRows.map(row => [ String(row.name).trim(), Number(row.id) ]));

      const result = {
        project_id: projectId,
        chapter_count: 0,
        scene_count: 0,
        storyboard_count: 0,
        character_count: 0,
      };

      const parsedCharacters = new Set();

      const upsertCharacter = async name => {
        const detail = normalizedCharacters.get(name) || { description: '', appearance: '', tags: [] };
        if (characterIds.has(name)) {
          await conn.execute('UPDATE characters SET description = ? WHERE id = ?', [ buildCharacterDescription(detail), characterIds.get(name) ]);
          return characterIds.get(name);
        }
        const [ insertResult ] = await conn.execute(
          `INSERT INTO characters (project_id, name, description, avatar_url) VALUES (?, ?, ?, '')`,
          [ projectId, name, buildCharacterDescription(detail) ]
        );
        characterIds.set(name, insertResult.insertId);
        return insertResult.insertId;
      };

      for (let chapterIndex = 0; chapterIndex < parsed.chapters.length; chapterIndex++) {
        const chapter = parsed.chapters[chapterIndex];
        const [ chapterInsert ] = await conn.execute(
          'INSERT INTO chapters (project_id, title, summary, sort_order) VALUES (?, ?, ?, ?)',
          [ projectId, chapter.title, chapter.summary, chapterIndex + 1 ]
        );
        result.chapter_count++;

        for (let sceneIndex = 0; sceneIndex < chapter.scenes.length; sceneIndex++) {
          const scene = chapter.scenes[sceneIndex];
          const [ sceneInsert ] = await conn.execute(
            `INSERT INTO scenes (chapter_id, project_id, title, description, location, time_of_day, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ chapterInsert.insertId, projectId, scene.title, scene.description, scene.location, scene.timeOfDay, sceneIndex + 1 ]
          );
          result.scene_count++;

          for (let shotIndex = 0; shotIndex < scene.storyboards.length; shotIndex++) {
            const storyboard = scene.storyboards[shotIndex];
            const [ storyboardInsert ] = await conn.execute(
              `INSERT INTO storyboards (
                scene_id, chapter_id, project_id, shot_number, content, dialogue, shot_type, mood, camera_direction, camera_motion, duration, background, thumbnail_url, notes, sort_order
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
              [
                sceneInsert.insertId,
                chapterInsert.insertId,
                projectId,
                shotIndex + 1,
                storyboard.content,
                storyboard.dialogue,
                storyboard.shotType,
                storyboard.mood,
                storyboard.cameraDirection,
                storyboard.cameraMotion,
                storyboard.duration,
                storyboard.background,
                storyboard.notes,
                shotIndex + 1,
              ]
            );
            result.storyboard_count++;

            for (const name of uniqueNonEmpty(storyboard.characterNames)) {
              parsedCharacters.add(name);
              const characterId = await upsertCharacter(name);
              await conn.execute(
                `INSERT INTO storyboard_characters (storyboard_id, character_id, line)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE line = VALUES(line)`,
                [ storyboardInsert.insertId, characterId, storyboard.dialogue || storyboard.content ]
              );
            }
          }
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
