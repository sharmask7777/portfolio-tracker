# Antigravity CLI & GSD Orchestration

This project leverages the **Antigravity CLI (`agy`)** and the GSD (Get Shit Done) framework for automated agentic development.

### Configuring Agent Models
You can control the models used by child agents to balance quality and speed.

- **Check Current Profile:**
  ```bash
  node .antigravitycli/get-shit-done/bin/gsd-tools.cjs config-get model_profile
  ```
- **Set Quality Profile (Recommended):**
  ```bash
  node .antigravitycli/get-shit-done/bin/gsd-tools.cjs config-set model_profile quality
  ```
- **Inherit Session Model:**
  ```bash
  node .antigravitycli/get-shit-done/bin/gsd-tools.cjs config-set model_profile inherit
  ```
- **Advanced Overrides:** 
  Use `/gsd:settings-advanced` to map specific models (e.g., `gemini-3.5-flash` or `gemini-1.5-pro`) to agent tiers (Opus/Sonnet/Haiku).
