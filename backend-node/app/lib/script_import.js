'use strict';

function filterNonEmptyStrings(values) {
  return values.map(value => String(value || '').trim()).filter(Boolean);
}

function uniqueNonEmpty(values) {
  return [ ...new Set(filterNonEmptyStrings(values)) ];
}

function prefixIfNotEmpty(prefix, value) {
  return String(value || '').trim() ? `${prefix}${String(value).trim()}` : '';
}

function containsAnyKeyword(value, keywords) {
  return keywords.some(keyword => value.includes(keyword));
}

function isLikelyCharacterName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  if ([ ...trimmed ].length > 12) return false;
  if (/[·，,。：:；;、（）()《》[\]【】/|]/.test(trimmed)) return false;
  if (containsAnyKeyword(trimmed, [
    '场景', '地点', '时间', '夜晚', '深夜', '凌晨', '清晨', '黄昏', '傍晚', '中午', '下午', '晚上',
    '雨夜', '旧城区', '城区', '小巷', '街道', '天台', '校园', '车站', '仓库', '门口', '室内', '室外',
    '照相馆', '办公室', '病房', '公园', '广场', '走廊', '房间', '废弃',
  ])) {
    return false;
  }
  return true;
}

function normalizeCharacterNames(values) {
  return uniqueNonEmpty(values).filter(isLikelyCharacterName);
}

function normalizeDuration(duration) {
  return Number(duration) > 0 ? Number(duration) : 5;
}

function normalizeVisualDescription(visualDescription, notes, dialogue, sceneSummary) {
  return filterNonEmptyStrings([ visualDescription, notes, dialogue, sceneSummary ])[0] || '';
}

function normalizedPositiveOrder(value, fallback) {
  return Number(value) > 0 ? Number(value) : fallback;
}

function buildStoryboardBackground(title, location, timeOfDay) {
  return filterNonEmptyStrings([ title, location, timeOfDay ]).join(' · ');
}

function buildStoryboardNotes(storyboard) {
  return String(storyboard.notes || '').trim();
}

function buildCharacterDescription(detail) {
  return filterNonEmptyStrings([
    detail.description,
    prefixIfNotEmpty('外貌：', detail.appearance),
    prefixIfNotEmpty('标签：', uniqueNonEmpty(detail.tags || []).join('、')),
  ]).join('\n');
}

function normalizeLLMStoryboardDocument(document) {
  if (!document) {
    throw new Error('DeepSeek 解析失败：未返回结构化结果');
  }

  const normalizedCharacters = new Map();
  for (const character of document.characters || []) {
    const name = String(character.name || '').trim();
    if (!isLikelyCharacterName(name)) {
      continue;
    }
    normalizedCharacters.set(name, {
      name,
      description: String(character.description || '').trim(),
      appearance: String(character.appearance || '').trim(),
      tags: uniqueNonEmpty(character.tags || []),
    });
  }

  if (!(document.chapters || []).length) {
    throw new Error('DeepSeek 解析失败：未识别出章节');
  }

  const parsed = { chapters: [] };
  for (let chapterIndex = 0; chapterIndex < document.chapters.length; chapterIndex++) {
    const chapter = document.chapters[chapterIndex];
    const chapterTitle = String(chapter.title || '').trim();
    const chapterSummary = String(chapter.summary || '').trim();
    if (!chapterTitle) throw new Error(`DeepSeek 解析失败：第 ${chapterIndex + 1} 个章节缺少标题`);
    if (!chapterSummary) throw new Error(`DeepSeek 解析失败：章节《${chapterTitle}》缺少摘要`);
    if (!(chapter.scenes || []).length) throw new Error(`DeepSeek 解析失败：章节《${chapterTitle}》没有场景`);

    const parsedChapter = {
      title: chapterTitle,
      summary: chapterSummary,
      sortOrder: normalizedPositiveOrder(chapter.order, chapterIndex + 1),
      scenes: [],
    };

    for (let sceneIndex = 0; sceneIndex < chapter.scenes.length; sceneIndex++) {
      const scene = chapter.scenes[sceneIndex];
      const sceneTitle = String(scene.title || '').trim();
      const sceneSummary = String(scene.summary || '').trim();
      if (!sceneTitle) throw new Error(`DeepSeek 解析失败：章节《${chapterTitle}》的第 ${sceneIndex + 1} 个场景缺少标题`);
      if (!sceneSummary) throw new Error(`DeepSeek 解析失败：场景《${sceneTitle}》缺少摘要`);
      if (!(scene.storyboards || []).length) throw new Error(`DeepSeek 解析失败：场景《${sceneTitle}》没有分镜`);

      const sceneCharacters = normalizeCharacterNames(scene.characters || []);
      const parsedScene = {
        title: sceneTitle,
        description: sceneSummary,
        location: String(scene.location || '').trim(),
        timeOfDay: String(scene.time_of_day || '').trim(),
        sortOrder: normalizedPositiveOrder(scene.order, sceneIndex + 1),
        storyboards: [],
      };

      for (let storyboardIndex = 0; storyboardIndex < scene.storyboards.length; storyboardIndex++) {
        const storyboard = scene.storyboards[storyboardIndex];
        const visualDescription = normalizeVisualDescription(
          storyboard.visual_description,
          storyboard.notes,
          storyboard.dialogue,
          sceneSummary
        );
        if (!visualDescription) {
          throw new Error(`DeepSeek 解析失败：场景《${sceneTitle}》的第 ${storyboardIndex + 1} 个分镜缺少 visual_description`);
        }

        const shotCharacters = normalizeCharacterNames([ ...sceneCharacters, ...(storyboard.characters || []) ]);
        for (const name of shotCharacters) {
          if (!normalizedCharacters.has(name)) {
            normalizedCharacters.set(name, { name, description: '', appearance: '', tags: [] });
          }
        }

        parsedScene.storyboards.push({
          content: visualDescription,
          dialogue: String(storyboard.dialogue || '').trim(),
          shotType: String(storyboard.shot_type || '').trim(),
          mood: String(storyboard.mood || '').trim(),
          cameraDirection: String(storyboard.camera_angle || '').trim() || '平视',
          cameraMotion: '',
          duration: normalizeDuration(storyboard.duration_seconds),
          background: buildStoryboardBackground(parsedScene.title, parsedScene.location, parsedScene.timeOfDay),
          notes: buildStoryboardNotes(storyboard),
          characterNames: shotCharacters,
        });
      }

      parsedChapter.scenes.push(parsedScene);
    }

    parsed.chapters.push(parsedChapter);
  }

  return { parsed, normalizedCharacters };
}

module.exports = {
  normalizeLLMStoryboardDocument,
  buildCharacterDescription,
  uniqueNonEmpty,
};
