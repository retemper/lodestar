---
name: pr
description: Analyzes current branch changes, creates a commit, pushes, and opens a PR
argument-hint: '[PR title (optional)]'
---

# pr

Analyzes all commits and changes on the current branch, drafts an appropriate PR title and body, pushes, and creates a pull request.

## Execution Flow

### 1. Check current state

```bash
BRANCH=$(git branch --show-current)

# Abort if on main
if [ "$BRANCH" = "main" ]; then
  echo "Cannot create a PR from the main branch."
  exit 1
fi

git status
git diff --stat
```

- If on `main`, inform the user and stop.
- If there are uncommitted changes, ask the user whether to commit them first.

### 2. Analyze changes

```bash
git log origin/main..HEAD --oneline
git diff origin/main...HEAD --stat
```

Analyze all commits and changed files to determine:

- Nature of changes (feat, fix, chore, docs, refactor, etc.)
- Summary of key changes (1-3 lines)
- Test plan items

### 3. Check for changeset

If the changes touch any files under `packages/` or `plugins/`, verify that a changeset file exists:

```bash
ls .changeset/*.md 2>/dev/null | grep -v README
```

If no changeset is found for a publishable package change:
- Warn the user: "No changeset found. Consider running `pnpm changeset` before creating the PR."
- Ask whether to proceed anyway or create a changeset first.

### 4. Draft PR title and body

**Title priority:**

1. If `$ARGUMENTS` is provided, use it as-is.
2. Otherwise, auto-generate from commit messages and changes.

**Title rules:**

- Under 70 characters
- Use conventional prefix (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `ci:`, `test:`, etc.)

**Body format:**

```markdown
## Summary
- [1-3 bullet points summarizing key changes]

## Test plan
- [ ] [Testing checklist items]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### 5. Sync with main

```bash
git fetch origin main
git merge origin/main
```

- If merge conflicts occur, resolve them before proceeding.

### 6. Push and create PR

```bash
git push -u origin $BRANCH

gh pr create \
  --title "$TITLE" \
  --body "$BODY"
```

### 7. Report result

Display the created PR URL to the user.

## Notes

- Cannot run on `main` branch
- If uncommitted changes exist, confirm commit intent first
- Always run `git fetch origin main && git merge origin/main` before push
- PR title must accurately reflect the nature of the changes
- If a PR already exists for this branch, inform the user and stop
