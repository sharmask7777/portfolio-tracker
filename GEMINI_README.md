# Gemini CLI & GSD Orchestration

This project leverages Gemini CLI and the GSD (Get Shit Done) framework for automated agentic development.

### Configuring Agent Models
You can control the models used by child agents to balance quality and speed.

- **Check Current Profile:**
  ```bash
  gsd-sdk query config-get model_profile
  ```
- **Set Quality Profile (Recommended):**
  ```bash
  gsd-sdk query config-set model_profile quality
  ```
- **Inherit Session Model:**
  ```bash
  gsd-sdk query config-set model_profile inherit
  ```
- **Advanced Overrides:** 
  Use `/gsd:settings-advanced` to map specific models (e.g., `gemini-3-pro`) to agent tiers (Opus/Sonnet/Haiku).
