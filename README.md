# VS Code Customization Migration Test

**Open this repository's root folder and test.** The root [.vscode/settings.json](.vscode/settings.json), [.vscode/mcp.json](.vscode/mcp.json), and [.mcp.json](.mcp.json) are ready to use; no separate workspace files, installation, fixture generation, or reset scripts are needed.

## Quick start: open the root folder

1. Use **File: Open Folder** to open `~/repos/vscode-customization-migration-test` in the VS Code build containing the migration changes. Open the repository root, not `mcp/`.
2. Start a **Copilot Agent Host** chat and use this repository itself as the session working directory. Avoid worktree isolation unless testing it specifically: migration follows the session roots, not necessarily the folder visible in Explorer.
3. Review/trust the fixture configurations if prompted and wait for MCP discovery.
4. Open **Agent Customizations → Migrate MCP Servers**, or send a request and select **Review customizations** in the hint. That link opens the first applicable category; use **Migrate MCP Servers** to switch from a file migration page.
5. Clear **Select all**, then check only `stdio-basic`, `equivalent`, and `same-name`. Verify that the selected count is **3**, choose **Migrate**, and confirm.

No task or HTTP server needs to be started for this first file-migration test. Starting a server is only needed when checking actual tool calls.

### Expected result of the first test

Expect **2 migrated and 1 target conflict**:

| Server | Source `.vscode/mcp.json` | Destination `.mcp.json` |
| --- | --- | --- |
| `stdio-basic` | Entry removed | Entry added with the same command, arguments, and environment |
| `equivalent` | Entry removed | Existing equivalent entry retained without duplication |
| `same-name` | Original entry retained | Original, different destination entry retained; `targetConflict` reported |
| All unselected entries | Unchanged | Unchanged |

This test deliberately includes a conflict; the error is an expected result, not a broken fixture. Inspect the Git diff to verify the two successful moves and preserved source comments.

### Initial inventory

The pristine root contains **16 source definitions**: **7 initial migration candidates** and **9 exclusions**. The `same-name` target conflict is checked at execution, so it still appears as a candidate. These counts assume enabled servers, unrestricted MCP access, complete discovery, and no user/profile overrides. File migrations add the original **5 workspace files**: two prompts, one configured-location agent, one instruction file, and one skill.

Most server definitions do not need to be running to test migration. Start only the servers whose tools you want to check; the exclusion entries are negative configuration tests. Node must be available on the server machine to run the mock server. No credentials or packages are required; [.env](.env) contains only a dummy fixture value.

## Fixture layout

| Location | Role when the root folder is open |
| --- | --- |
| [.vscode/settings.json](.vscode/settings.json) | Enables migration categories and chat hints; edit here for setting checks |
| [.vscode/mcp.json](.vscode/mcp.json) | Active source definitions: successes, conflicts, exclusions, and one long-label case |
| [.mcp.json](.mcp.json) | Active destination with equivalent, conflicting, and already-migrated entries |
| [.github/prompts](.github/prompts) and [.custom](.custom) | Original file-customization migration cases, active alongside MCP cases |
| [mcp/mock-server.mjs](mcp/mock-server.mjs) | Read-only local MCP server invoked by the fixture definitions |
| [.vscode/tasks.json](.vscode/tasks.json) | Optional task to start the HTTP fixture |

Only the root configurations are used by default. There are no separate `.code-workspace` files to open. Use Git to restore fixture files between destructive tests; no reset tooling is required.

## Cases already active in the root

| Definition(s) | Expected behavior |
| --- | --- |
| `stdio-basic` | Move the command, arguments, and environment without changing them. Calling `migration_probe` before/after returns the same label and root working directory. |
| `http-basic` | Move the loopback URL and headers. Start the HTTP fixture task below only when testing actual tool calls. |
| `leave-unselected` | Uncheck it and verify it remains in `.vscode/mcp.json` when other entries migrate. |
| `equivalent` | Already has an equivalent destination entry, despite omitted `type` and empty `env` in the source. Remove only the source entry; do not duplicate it. |
| `same-name` | Destination has different arguments. Return `targetConflict`, preserve both definitions, and continue migrating unrelated selected entries. |
| `already-migrated`, `existing` | Present only in `.mcp.json`. Not migration candidates; preserve them during all other moves. |
| `spaces-and-unicode Ω` | Preserve the name and arguments with spaces/Unicode. To test a path containing those characters too, move/clone the repository into such a path and reopen the root. |
| `long-server-name-for-checking-label-truncation-and-focus` | One representative long label for truncation and focus checks. The default fixture intentionally omits repetitive rows used only to force a large list. |
| `uses-env-file`, `uses-explicit-cwd`, `uses-sandbox`, `uses-dev-mode` | Stay in the source because their launch behavior cannot be preserved by this migration. |
| `uses-version-metadata`, `uses-workspace-variable` | Stay in the source: moving must not discard metadata or silently replace the source expression with its resolved value. |
| `requires-input` | Stay in the source; migration discovery must not prompt for an input value. Starting this server manually is a separate operation and can prompt. |
| `uses-oauth-config`, `uses-sse-transport` | Stay in the source. These are negative configuration cases, not positive transport tests for the mock HTTP server. |

Source comments must survive successful edits. The default destination is strict wrapped JSON so the normal case also remains discoverable by Local chat. Selecting all 7 initial candidates should move 6 and reject `same-name`, leaving that entry and the nine exclusions in the source.

## Optional HTTP tool check

Use **Tasks: Run Task → MCP: Start Local HTTP Fixture** to serve `http://127.0.0.1:48123/mcp` on loopback only. Stop the task when done. If the port is occupied, change the task port and fixture URLs together. Nothing starts automatically on folder open.

The probe exposes only `migration_probe`, which returns its label and working directory. It does not read/write files, run shell commands, or use credentials. STDIO commands use `mcp/mock-server.mjs` relative to the root, both before and after migration.

## Settings and UI checks in the same folder

Change [.vscode/settings.json](.vscode/settings.json) or use Workspace Settings; no workspace switching is needed. Test these before migrating everything, or restore the files with Git between passes.

| Change / action | Expected result |
| --- | --- |
| Set `chat.customizations.mcpServerMigration.enabled` to `false` | No MCP migration candidates, file planning, or “can be migrated” MCP hint. Existing file-category hints may remain. |
| Keep MCP migration off and leave exclusions present | Unsupported/partially supported inventory warnings can still appear; they open the **regular MCP page**, not the disabled migration page. |
| Disable prompt/user-data/location migration flags individually | Corresponding file-migration counts and hints disappear; unrelated categories remain. All three must be off for an MCP-only hint. |
| Set `chat.agentSessions.customizationEntryPoints` to `false` | Entry-point availability count becomes zero and its scans stop. This is not the migration flag; explicitly opened customization UI and independent chat hints may still work. |
| Set `chat.customizations.migrationHint` to `never` | No chat hint; migration UI remains available. |
| Set the hint to `once` | Send twice and reload the same chat: no repeated hint. A fresh eligible session can show one. |
| Keep the hint at `always` | Every eligible request gets a hint unless dismissed for this workspace/harness. |
| Set `chat.mcp.access` to `none`, then restore `all` | No eligible MCP migrations while access is blocked; counts recover after discovery. Managed policy takes precedence. |
| Disable/re-enable a selected server in the MCP UI | Candidates and availability refresh. Explicit deselection survives a transient discovery gap. |
| Cancel confirmation | No file changes. Only the captured selection may be migrated after confirmation. |
| Switch sessions/harnesses during confirmation or discovery | No writes for a stale execution context. A new session clears MCP selection state. |
| Turn the MCP migration flag off after selection | Execution performs no migration writes. |
| Cancel a request during pending MCP discovery | The migration hint must not hold the request open; support-scope lifetime is covered by the product's deterministic cancellation tests. |
| Tab/Shift+Tab, check/uncheck rows, scroll | Selection/group mixed state/counts agree. Surviving rows regain focus after refresh; updates do not steal focus from another control. MCP rows do not gain file-only Open/Delete actions. |

The original `.github/prompts` and `.custom` files are unchanged. With their flags enabled, **Copilot** can show both their five-file summary and the MCP summary; **Claude** remains useful for file migrations. The current MCP migration requires Copilot's support assessment. Local chat must not show an Agent Host migration hint. Personal/profile customizations can add counts; do not mistake those for extra fixture entries.

Test **Hide for this workspace** last. Dismissal is stored per workspace/harness and is independent of migration enablement. Restoring files with Git does not clear dismissal, chat history, trust, or remembered server enablement.

## Scope and failure handling

This is a single-folder manual fixture. Cross-root scenarios, alternate document formats, and deterministic file-failure injection are not included. Use the product's regression tests for those cases.

For failures, inspect `[MCP Customization Migration]` logs for the reason, server name, and URIs. Failure does not imply no side effects: a newly created target is deliberately retained if safe deletion cannot be established during rollback. Preserve the last safe copy and review both files.
