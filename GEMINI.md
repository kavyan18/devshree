# Gemini Directives & Project Rules for Devshree Brass

## 🧠 Continuous Memory & State Continuity (CRITICAL)
- **At the start of ANY new conversation**, the assistant MUST FIRST read `CONVERSATION_MEMORY.md` in the project root.
- Do not make the user explain previous decisions, project background, or what was already accomplished.
- Greet the user by briefly acknowledging the last completed milestone (found in Section 4 of `CONVERSATION_MEMORY.md`), and pick up seamlessly right where the last session stopped.
- Whenever new features are built, bugs are fixed, or commits are made, ALWAYS update `CONVERSATION_MEMORY.md` so the next conversation has complete updated memory.

## 🔒 Security & Git Push Rule
- **NEVER push to GitHub** without explicit user permission or a direct user request to push.
- When pushing, use the proven GitHub API sync script (`push_all_to_github.js`) with the credentials stored in `.env`.

## 🎨 Architectural Identity & Code Standards
- Devshree Brass uses a warm architectural aesthetic: Terracotta (`#C2623B`), deep bronze, ivory, and brushed gold.
- Ensure all 274 unit/integration tests continue to pass whenever core files are edited.
- Maintain the 0ms instant preview engine for file uploads (`FileReader.readAsDataURL`).
