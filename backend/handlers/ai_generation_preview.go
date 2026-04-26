package handlers

type AIGenerationPreview struct {
	Action      string            `json:"action"`
	Model       string            `json:"model"`
	Fields      map[string]string `json:"fields"`
	FinalPrompt string            `json:"final_prompt"`
	Notes       []string          `json:"notes,omitempty"`
}
