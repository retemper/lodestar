---
name: review
description: Reviews changed code from expert perspectives (code, docs, release). No arguments = auto-detect.
argument-hint: '[code|docs|release|all] [file path]'
---

# review

Reviews changed code from **expert perspectives**. Selects the appropriate profile based on arguments or changed files.

## Usage

```
/review              → analyze git diff → auto-select relevant profiles
/review code         → code quality review only
/review docs         → documentation review only
/review release      → release readiness review only
/review all          → all profiles
/review code path    → review a specific file
```

## Execution Flow

### 1. Determine profiles

Parse arguments to decide which profiles to run:

- **Argument is `code`, `docs`, `release`, or `all`**: run that profile
- **No argument**: use auto-detection (Step 2)
- **Argument is a file path**: infer profile from file location

### 2. Collect target files and auto-detect profiles

```bash
# staged + unstaged changes
git diff --name-only HEAD
git diff --name-only --cached

# If no changes, use last commit
git diff --name-only HEAD~1
```

Map collected files to profiles:

| File pattern | Profile |
|---|---|
| `packages/*/src/**/*.ts` | code |
| `plugins/*/src/**/*.ts` | code |
| `internal/*/src/**/*.ts` | code |
| `docs/**/*.md` | docs |
| `docs/.vitepress/**/*.{ts,vue}` | docs |
| `.changeset/*.md` | release |
| `**/package.json` (version changes) | release |
| `**/CHANGELOG.md` | release |

- `code` profile runs whenever any source file is changed.
- If no files match any profile, output "No files to review" and exit.

### 3. Run profile-specific reviews

#### Profile: code

**Perspective:** Senior TypeScript library author

**Checklist:**

A. **Type safety**
   - Proper use of generics, no unnecessary `any` or type assertions
   - Exported types are well-defined and documented

B. **Public API design**
   - Breaking changes are intentional and documented
   - Exports are minimal and well-structured
   - Naming is consistent with existing conventions

C. **Module boundaries**
   - No circular dependencies between packages
   - Proper use of workspace dependencies (`workspace:*`)
   - Internal packages not imported from external packages

D. **Error handling**
   - Errors are descriptive and actionable for end users
   - No swallowed errors or silent failures

E. **Test coverage**
   - New logic has corresponding test cases
   - Edge cases and error paths are tested
   - Test descriptions are clear and specific

F. **Performance**
   - No unnecessary file system operations
   - Glob patterns are efficient
   - No O(n²) algorithms on potentially large inputs

G. **Compatibility**
   - Works with the supported Node.js version (v22+)
   - ESM-only — no CommonJS patterns
   - No platform-specific code without fallbacks

H. **Documentation sync**
   - Public API changes (new/removed/renamed exports, changed function signatures, new config options) have corresponding updates in `docs/`
   - Read the relevant docs pages and verify they still match the changed code
   - If no docs exist yet for the changed API, flag that documentation is missing

#### Profile: docs

**Perspective:** Developer experience writer

**Checklist:**

A. **API docs accuracy**
   - Code examples match the actual API
   - Parameter types and return types are correct
   - Deprecated APIs are marked

B. **i18n completeness**
   - Changes in English docs have corresponding Korean translations
   - New pages are added to both language directories
   - Sidebar config updated for both languages

C. **Code examples**
   - Examples are runnable and correct
   - Import paths match actual package exports
   - Examples cover common use cases

D. **Navigation**
   - New pages are linked from sidebar or parent pages
   - Internal links are not broken

#### Profile: release

**Perspective:** Release manager

**Checklist:**

A. **Changeset presence**
   - All changed publishable packages have a changeset entry
   - Version bump type matches the change severity (patch/minor/major)
   - Breaking changes use `major` bump

B. **Version consistency**
   - Peer dependency ranges are compatible
   - Workspace dependency versions are aligned

C. **Public API surface**
   - New exports are intentional (check `package.json` exports field)
   - No accidental exposure of internal utilities
   - Types are re-exported where needed

D. **Migration path**
   - Breaking changes have migration instructions
   - Deprecation warnings added before removal

### 4. Output format

For each profile, output only **violations** (skip passing items):

```markdown
## {Profile} Review

### {file path}

#### Violations

| # | Category | Location | Current | Issue | Principle |
|---|----------|----------|---------|-------|-----------|
| 1 | {cat}    | L{num}   | {code}  | {desc}| {basis}   |

#### Suggested fix

**#1: {brief description}**

```diff
- current code
+ suggested code
```

> **Rationale**: {explanation based on documented principles or industry standards}
```

### 5. Summary

```markdown
## Summary

| Profile | Critical | Warning | Suggestion |
|---------|----------|---------|------------|
| Code    | N        | N       | N          |
| Docs    | N        | N       | N          |
| Release | N        | N       | N          |
| **Total** | **N**  | **N**   | **N**      |
```

**Severity levels:**

| Severity   | Meaning |
|------------|---------|
| Critical   | Must fix — breaking change, data loss, security risk |
| Warning    | Should fix — inconsistency, missing coverage, quality gap |
| Suggestion | Nice to have — better pattern exists, minor improvement |

## Notes

- **Do NOT modify code** — review and suggest only
- Only report violations (skip passing checklist items)
- Suggested fixes must include diff format + rationale
- Base recommendations on project conventions, not personal preference
