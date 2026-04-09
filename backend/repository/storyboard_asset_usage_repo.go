package repository

import "storyboard-backend/database"

type StoryboardAssetUsageRepository struct{}

func (r *StoryboardAssetUsageRepository) ReplaceStoryboardUsage(storyboardID int64, usageType string, assetIDs []int64) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM storyboard_asset_usages WHERE storyboard_id = ? AND usage_type = ?`, storyboardID, usageType); err != nil {
		return err
	}

	seen := map[int64]struct{}{}
	for _, assetID := range assetIDs {
		if assetID <= 0 {
			continue
		}
		if _, ok := seen[assetID]; ok {
			continue
		}
		seen[assetID] = struct{}{}
		if _, err := tx.Exec(`INSERT INTO storyboard_asset_usages (storyboard_id, asset_id, usage_type) VALUES (?, ?, ?)`, storyboardID, assetID, usageType); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (r *StoryboardAssetUsageRepository) CountActiveStoryboardUsageByAssetID(assetID int64) (int, error) {
	var count int
	err := database.DB.QueryRow(`
		SELECT COUNT(*)
		FROM storyboard_asset_usages sau
		JOIN storyboards s ON s.id = sau.storyboard_id
		WHERE sau.asset_id = ?
		  AND s.deleted_at IS NULL
	`, assetID).Scan(&count)
	return count, err
}
