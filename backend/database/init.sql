-- =====================================================
--  Storyboard System Database Initialization
--  漫剧分镜系统 数据库初始化
-- =====================================================

CREATE DATABASE IF NOT EXISTS storyboard DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE storyboard;

-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL COMMENT '项目名称',
    description TEXT COMMENT '项目描述',
    script_text TEXT COMMENT '导入的原始剧本文本',
    video_url VARCHAR(500) NULL COMMENT '项目总片原图URL',
    video_preview_url VARCHAR(500) NULL COMMENT '项目总片预览URL',
    video_status VARCHAR(20) NULL COMMENT '项目总片状态',
    video_error TEXT NULL COMMENT '项目总片错误信息',
    video_duration DECIMAL(8,2) NULL COMMENT '项目总片时长（秒）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    UNIQUE KEY uk_projects_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='项目表';

-- 章节表
CREATE TABLE IF NOT EXISTS chapters (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL COMMENT '章节标题',
    summary TEXT COMMENT '章节摘要',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX idx_project_id (project_id),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='章节表';

-- 场景表
CREATE TABLE IF NOT EXISTS scenes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    chapter_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL COMMENT '场景标题',
    description TEXT COMMENT '场景描述',
    location VARCHAR(255) COMMENT '地点',
    time_of_day VARCHAR(50) COMMENT '时间（白天/夜晚等）',
    style_preset VARCHAR(50) NULL COMMENT '场景风格预设',
    style_notes TEXT NULL COMMENT '场景风格补充说明',
    cover_url VARCHAR(500) NULL COMMENT '场景封面原图URL',
    cover_preview_url VARCHAR(500) NULL COMMENT '场景封面缩略图URL',
    video_url VARCHAR(500) NULL COMMENT '场景视频原图URL',
    video_preview_url VARCHAR(500) NULL COMMENT '场景视频预览URL',
    video_status VARCHAR(20) NULL COMMENT '场景视频状态',
    video_error TEXT NULL COMMENT '场景视频错误信息',
    video_duration DECIMAL(8,2) NULL COMMENT '场景视频时长（秒）',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX idx_chapter_id (chapter_id),
    INDEX idx_project_id (project_id),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='场景表';

-- 分镜表
CREATE TABLE IF NOT EXISTS storyboards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    scene_id BIGINT NOT NULL,
    chapter_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    shot_number INT COMMENT '镜号',
    content TEXT NOT NULL COMMENT '分镜内容/台词',
    dialogue TEXT COMMENT '主要台词',
    shot_type VARCHAR(50) COMMENT '景别',
    mood VARCHAR(50) COMMENT '情绪',
    style_preset VARCHAR(50) COMMENT '镜头风格预设（为空表示跟随场景）',
    style_notes TEXT COMMENT '镜头风格补充说明',
    camera_direction VARCHAR(100) COMMENT '观察角度/机位',
    camera_motion VARCHAR(50) COMMENT '镜头运动',
    duration DECIMAL(8,2) COMMENT '时长（秒）',
    background TEXT COMMENT '背景描述',
    thumbnail_url VARCHAR(500) COMMENT '原图URL',
    thumbnail_preview_url VARCHAR(500) COMMENT '缩略图预览URL',
    video_url VARCHAR(500) COMMENT '视频URL',
    video_preview_url VARCHAR(500) COMMENT '视频预览URL',
    video_status VARCHAR(50) COMMENT '视频生成状态',
    video_error TEXT COMMENT '视频生成错误信息',
    video_duration DECIMAL(8,2) COMMENT '视频时长（秒）',
    notes TEXT COMMENT '备注',
    sort_order INT DEFAULT 0 COMMENT '排序',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (scene_id) REFERENCES scenes(id),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX idx_scene_id (scene_id),
    INDEX idx_project_id (project_id),
    INDEX idx_chapter_id (chapter_id),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分镜表';

-- 角色表
CREATE TABLE IF NOT EXISTS characters (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    name VARCHAR(100) NOT NULL COMMENT '角色名称',
    description TEXT COMMENT '角色描述',
    avatar_url VARCHAR(500) COMMENT '头像原图URL',
    avatar_preview_url VARCHAR(500) COMMENT '头像缩略图URL',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    INDEX idx_project_id (project_id),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 资产表
CREATE TABLE IF NOT EXISTS assets (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    project_id BIGINT NOT NULL,
    character_id BIGINT NULL COMMENT '关联角色（可为空，场景资产无）',
    name VARCHAR(255) NOT NULL COMMENT '资产名称',
    type VARCHAR(50) NOT NULL COMMENT '类型: character/image/scene/background',
    file_url VARCHAR(500) NOT NULL COMMENT '文件URL',
    cover_url VARCHAR(500) NULL COMMENT '封面原图URL',
    thumbnail_url VARCHAR(500) NULL COMMENT '缩略图URL',
    meta JSON NULL COMMENT '元数据（宽高、文件大小等）',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (character_id) REFERENCES characters(id),
    INDEX idx_project_id (project_id),
    INDEX idx_character_id (character_id),
    INDEX idx_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='资产表';

-- 分镜-角色关联表（多对多）
CREATE TABLE IF NOT EXISTS storyboard_characters (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    storyboard_id BIGINT NOT NULL,
    character_id BIGINT NOT NULL,
    line TEXT COMMENT '该角色在此分镜的台词',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES storyboards(id),
    FOREIGN KEY (character_id) REFERENCES characters(id),
    UNIQUE KEY uk_storyboard_character (storyboard_id, character_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分镜角色关联表';

-- 分镜媒体生成历史表
CREATE TABLE IF NOT EXISTS storyboard_media_generations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    storyboard_id BIGINT NOT NULL,
    media_type VARCHAR(20) NOT NULL COMMENT '媒体类型: cover/video',
    model VARCHAR(100) NOT NULL COMMENT '生成模型',
    status VARCHAR(20) NOT NULL COMMENT '生成状态',
    result_url VARCHAR(500) NULL COMMENT '正式资源URL',
    preview_url VARCHAR(500) NULL COMMENT '预览资源URL',
    source_url VARCHAR(500) NULL COMMENT '输入源URL',
    error_message TEXT NULL COMMENT '错误信息',
    is_current TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否当前采用版本',
    meta_json JSON NULL COMMENT '附加元数据',
    deleted_at DATETIME NULL DEFAULT NULL COMMENT '软删除时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES storyboards(id),
    INDEX idx_storyboard_media_storyboard_id (storyboard_id),
    INDEX idx_storyboard_media_type (storyboard_id, media_type),
    INDEX idx_storyboard_media_current (storyboard_id, media_type, is_current),
    INDEX idx_storyboard_media_deleted (storyboard_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分镜媒体生成历史表';

CREATE TABLE IF NOT EXISTS storyboard_asset_usages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    storyboard_id BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,
    usage_type VARCHAR(50) NOT NULL COMMENT '用途: cover_reference',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (storyboard_id) REFERENCES storyboards(id),
    FOREIGN KEY (asset_id) REFERENCES assets(id),
    UNIQUE KEY uk_storyboard_asset_usage (storyboard_id, asset_id, usage_type),
    INDEX idx_storyboard_asset_usage_asset (asset_id, usage_type),
    INDEX idx_storyboard_asset_usage_storyboard (storyboard_id, usage_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分镜资产使用关系表';
