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
		User:   config.GlobalConfig.DBUser,
		Passwd: config.GlobalConfig.DBPassword,
		Addr:   fmt.Sprintf("%s:%s", config.GlobalConfig.DBHost, config.GlobalConfig.DBPort),
		DBName: config.GlobalConfig.DBName,
		AllowNativePasswords: true,
		ParseTime: true,
	}

	var err error
	DB, err = sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connected successfully")
	return nil
}

// Close closes the database connection
func Close() {
	if DB != nil {
		DB.Close()
	}
}
