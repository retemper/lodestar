---
name: sync-main
description: Fetches latest main, analyzes incoming changes for conflicts, rebases, and pushes
disable-model-invocation: true
---

# sync-main

Synchronizes the current branch with the latest state of `main`. **Before rebasing, analyzes incoming changes** to detect conflicts and contention with the current branch proactively.

## Execution Flow

### 1. Check current branch

Do not run on `main`. Must be on a feature/fix/chore branch.

### 2. Fetch latest main

```bash
git fetch origin main
```

### 3. Analyze incoming changes (key step)

**Before** running rebase, compare incoming main changes against current branch changes.

#### 3-1. Check new commits from main

```bash
git log --oneline HEAD..origin/main
```

- If no new commits: inform "main has no new changes. Already up to date." and skip to **Step 4 (check local changes)**.

#### 3-2. Collect files changed on main

```bash
git diff --name-only HEAD...origin/main
```

#### 3-3. Collect files changed on current branch

```bash
git diff --name-only origin/main...HEAD
```

#### 3-4. Detect overlapping files (contention)

Compare the two lists to find **files changed on both sides**.

- **No overlap**: inform "No conflict risk — safe to proceed with rebase." and go to **Step 5 (rebase)**.
- **Overlap found**: perform detailed analysis below.

#### 3-5. Detailed contention analysis

For each overlapping file:

```bash
git diff HEAD...origin/main -- <file>
git diff origin/main...HEAD -- <file>
```

Read the changes and classify each file:

| Classification | Meaning | Example |
|---|---|---|
| ✅ **Safe** | Same file but different regions modified (auto-merge likely) | main edited function A, branch edited function B |
| ⚠️ **Caution** | Nearby regions modified (context conflict possible) | Both sides added imports at the same location |
| 🔴 **Conflict** | Same lines/blocks modified differently (conflict certain) | Both sides changed the same function signature |

#### 3-6. Report analysis to user

```
## 📋 Main Sync Analysis

### Incoming changes from main (N commits)
- <commit summary 1>
- <commit summary 2>

### Contention analysis

| File | Classification | main changes | Branch changes | Notes |
|------|---------------|-------------|----------------|-------|
| src/foo.ts | ✅ Safe | Modified fn A | Modified fn B | Different regions |
| src/bar.ts | ⚠️ Caution | Added import | Added import | Adjacent lines |
| src/baz.ts | 🔴 Conflict | Changed signature | Changed signature | Same block |
```

#### 3-7. User confirmation

- **All ✅ Safe**: inform "All contention files are safe. Proceeding with rebase." and go to **Step 5**.
- **⚠️ Caution or 🔴 Conflict present**: present options:
  1. **Proceed with rebase** — resolve conflicts as they come
  2. **Inspect specific files first** — show detailed diffs for conflicting files
  3. **Abort** — do not sync now

### 4. Check local changes

Check `git status` and `git diff` for unstaged changes.

- If no changes: inform "No local changes. Rebase only." and proceed to push.
- If changes exist: proceed to next steps.

### 5. Rebase

```bash
git rebase origin/main
```

- If rebase conflicts occur, use the **Step 3-5 analysis** to guide resolution.
- Provide specific guidance: "main changed X here, your branch changed Y, recommend resolving by..."

### 6. Commit (if needed)

If there are uncommitted local changes, commit with an appropriate message.

- Confirm the commit message with the user.
- Include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.

### 7. Push

```bash
git push origin <current-branch> --force-with-lease
```

- `--force-with-lease` is required after rebase — proceed without extra confirmation.
- **Never** use `--force`.

## Notes

- Do not run on `main` branch directly
- **Always complete change analysis before rebasing** — never rebase blindly
- Use pre-analysis results to provide specific conflict resolution guidance
- `--force-with-lease` after rebase is expected and safe
- When analyzing contention, actually read file contents — do not judge by filename alone
