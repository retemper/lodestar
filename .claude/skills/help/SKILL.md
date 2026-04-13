---
name: help
description: Lists all available custom slash commands with descriptions
disable-model-invocation: true
---

# Help — Custom Slash Command Reference

Dynamically discovers and displays all available custom slash commands.

## Execution Flow

### Step 1/1: Discover and display slash commands

1. Search for all `SKILL.md` files under `.claude/skills/` subdirectories.
2. Parse the `name`, `description`, and `argument-hint` fields from each file's YAML frontmatter.
3. Output in the following format:

```
## Available Slash Commands

| Command | Description | Arguments |
|---------|-------------|-----------|
| /command-name | Description | Argument hint (if any) |
```

**Implementation:**

Use the Glob tool to find `.claude/skills/*/SKILL.md`, then Read each file's frontmatter.

- `name` → command name (displayed as `/name`)
- `description` → description
- `argument-hint` → arguments (show "-" if absent)

Sort all commands alphabetically by name and output as a table.

**Important:** Do NOT hardcode the list. Always scan the filesystem to reflect the latest state.
