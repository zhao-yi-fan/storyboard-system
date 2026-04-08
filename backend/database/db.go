package database

import (
	"database/sql"
	"fmt"
	"log"

	"github.com/go-sql-driver/mysql"
	"storyboard-backend/config"
)

var DB *sql.DB

// Init initializes the database connection
func Init() error {
	cfg := mysql.Config{
		User:                 config.GlobalConfig.DBUser,
		Passwd:               config.GlobalConfig.DBPassword,
		Addr:                 fmt.Sprintf("%s:%s", config.GlobalConfig.DBHost, config.GlobalConfig.DBPort),
		DBName:               config.GlobalConfig.DBName,
		AllowNativePasswords: true,
		ParseTime:            true,
	}

	var err error
	DB, err = sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	if err := runMigrations(); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	log.Println("Database connected successfully")
	return nil
}

func runMigrations() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS storyboard_media_generations (
			id BIGINT PRIMARY KEY AUTO_INCREMENT,
			storyboard_id BIGINT NOT NULL,
			media_type VARCHAR(20) NOT NULL,
			model VARCHAR(100) NOT NULL,
			status VARCHAR(20) NOT NULL,
			result_url VARCHAR(500) NULL,
			preview_url VARCHAR(500) NULL,
			source_url VARCHAR(500) NULL,
			error_message TEXT NULL,
			is_current TINYINT(1) NOT NULL DEFAULT 0,
			meta_json JSON NULL,
			deleted_at DATETIME NULL DEFAULT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
			FOREIGN KEY (storyboard_id) REFERENCES storyboards(id),
			INDEX idx_storyboard_media_storyboard_id (storyboard_id),
			INDEX idx_storyboard_media_type (storyboard_id, media_type),
			INDEX idx_storyboard_media_current (storyboard_id, media_type, is_current),
			INDEX idx_storyboard_media_deleted (storyboard_id, deleted_at)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分镜媒体生成历史表'`,
	}

	for _, query := range queries {
		if _, err := DB.Exec(query); err != nil {
			return err
		}
	}

	if !columnExists("storyboard_media_generations", "deleted_at") {
		if _, err := DB.Exec(`ALTER TABLE storyboard_media_generations ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL AFTER meta_json`); err != nil {
			return err
		}
	}

	if !columnExists("storyboards", "video_preview_url") {
		if _, err := DB.Exec(`ALTER TABLE storyboards ADD COLUMN video_preview_url VARCHAR(500) NULL DEFAULT NULL AFTER video_url`); err != nil {
			return err
		}
	}

	if !columnExists("storyboards", "dialogue") {
		if _, err := DB.Exec(`ALTER TABLE storyboards ADD COLUMN dialogue TEXT NULL AFTER content`); err != nil {
			return err
		}
	}

	if !columnExists("storyboards", "shot_type") {
		if _, err := DB.Exec(`ALTER TABLE storyboards ADD COLUMN shot_type VARCHAR(50) NULL DEFAULT NULL AFTER dialogue`); err != nil {
			return err
		}
	}

	if !columnExists("storyboards", "mood") {
		if _, err := DB.Exec(`ALTER TABLE storyboards ADD COLUMN mood VARCHAR(50) NULL DEFAULT NULL AFTER shot_type`); err != nil {
			return err
		}
	}

	if !columnExists("storyboards", "camera_motion") {
		if _, err := DB.Exec(`ALTER TABLE storyboards ADD COLUMN camera_motion VARCHAR(50) NULL DEFAULT NULL AFTER camera_direction`); err != nil {
			return err
		}
	}

	if !columnExists("assets", "cover_url") {
		if _, err := DB.Exec(`ALTER TABLE assets ADD COLUMN cover_url VARCHAR(500) NULL DEFAULT NULL AFTER file_url`); err != nil {
			return err
		}
	}

	if !columnExists("scenes", "cover_url") {
		if _, err := DB.Exec(`ALTER TABLE scenes ADD COLUMN cover_url VARCHAR(500) NULL DEFAULT NULL AFTER time_of_day`); err != nil {
			return err
		}
	}

	if !columnExists("scenes", "cover_preview_url") {
		if _, err := DB.Exec(`ALTER TABLE scenes ADD COLUMN cover_preview_url VARCHAR(500) NULL DEFAULT NULL AFTER cover_url`); err != nil {
			return err
		}
	}

	backfillQueries := []string{
		`UPDATE storyboards
		SET shot_type = TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(notes, '景别：', -1), '\n', 1), '\r', ''))
		WHERE (shot_type IS NULL OR shot_type = '') AND notes LIKE '%景别：%'`,
		`UPDATE storyboards
		SET mood = TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(notes, '情绪：', -1), '\n', 1), '\r', ''))
		WHERE (mood IS NULL OR mood = '') AND notes LIKE '%情绪：%'`,
		`UPDATE storyboards
		SET dialogue = TRIM(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(notes, '台词：', -1), '\n', 1), '\r', ''))
		WHERE (dialogue IS NULL OR dialogue = '') AND notes LIKE '%台词：%'`,
	}

	for _, query := range backfillQueries {
		if _, err := DB.Exec(query); err != nil {
			return err
		}
	}

	return nil
}

func columnExists(tableName, columnName string) bool {
	var count int
	err := DB.QueryRow(`SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, tableName, columnName).Scan(&count)
	return err == nil && count > 0
}

// Close closes the database connection
func Close() {
	if DB != nil {
		DB.Close()
	}
}
