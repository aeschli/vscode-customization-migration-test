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

The pristine root contains **39 source definitions**: **29 migration candidates** and **10 exclusions**. The `same-name` target conflict is checked at execution, so it still appears as a candidate. These counts assume enabled servers, unrestricted MCP access, complete discovery, and no user/profile overrides. File migrations add the original **5 workspace files**: two prompts, one configured-location agent, one instruction file, and one skill.

Most server definitions do not need to be running to test migration. Start only the servers whose tools you want to check; the exclusion entries are negative configuration tests. Node must be available on the server machine to run the mock server. No credentials or packages are required; [.env](.env) contains only a dummy fixture value.

## Fixture layout

| Location | Role when the root folder is open |
| --- | --- |
| [.vscode/settings.json](.vscode/settings.json) | Enables migration categories and chat hints; edit here for setting checks |
| [.vscode/mcp.json](.vscode/mcp.json) | Active source definitions: successes, conflicts, exclusions, and one long-label case |
| [.mcp.json](.mcp.json) | Active destination with equivalent, conflicting, and already-migrated entries |
| [.github/prompts](.github/prompts) and [.custom](.custom) | Original file-customization migration cases, active alongside MCP cases |
| [mcp/mock-server.mjs](mcp/mock-server.mjs) | Read-only local MCP server invoked by the fixture definitions |
| [mcp/oauth-server.mjs](mcp/oauth-server.mjs) | The same probe behind a minimal local OAuth authorization server, for sign-in checks |
| [.vscode/tasks.json](.vscode/tasks.json) | Optional tasks to start the HTTP and OAuth fixtures |

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
| `uses-sandbox`, `uses-dev-mode`, `uses-version-metadata`, `uses-gallery`, `uses-gallery-disabled`, `uses-gallery-with-version`, `uses-gallery-disabled-with-version` | Move after a **warning** confirmation that names the property removed (`sandboxEnabled`, `dev`, `version`, `gallery`). |
| `uses-workspace-variable` | Move with `${workspaceFolder}` replaced by this repository's absolute path. |
| `uses-env-file`, `uses-explicit-cwd` | Stay in the source (`unrepresentableConfiguration`): the destination can't preserve `envFile` or `cwd`. |
| `uses-oauth-config`, `oauth-*` | See [Servers that use OAuth](#servers-that-use-oauth). |
| `uses-sse-transport` | Stays in the source (`unrepresentableConfiguration`). This is a negative configuration case, not a positive transport test for the mock HTTP server. |

Source comments must survive successful edits. The default destination is strict wrapped JSON so the normal case also remains discoverable by Local chat. Selecting all 29 candidates should move 28 and reject `same-name`, leaving that entry and the ten exclusions in the source.

## Servers that use inputs

The Copilot harness can't prompt for `${input:}` values, so migration replaces each input with an environment variable named after its id (uppercase, other characters become `_`). A local server also gets an `env` entry per input, set to the input's default, or empty if it has none, so it can be filled in there. A remote server has no `env`, so its reference keeps the default instead. Migration never prompts for an input.

| Definition | Expected result in `.mcp.json` |
| --- | --- |
| `requires-input` | `"${FIXTURELABEL}"` plus `"env": { "FIXTURELABEL": "manual-test" }` |
| `input-no-default` | `"FIXTURE_LOG_LEVEL": "${LOG_LEVEL}"` plus `"LOG_LEVEL": ""` in `env` |
| `input-pick` | `"--mode=${MODE}"` plus `"env": { "MODE": "safe" }` (the default option's `value`) |
| `input-reserved-name` | `"--tools=${MCP_PATH}"` plus `"env": { "MCP_PATH": "/usr/local/bin" }`: `PATH` is reserved, so the name gets an `MCP_` prefix |
| `input-http-header` | `"X-Fixture-Tenant": "${TENANT:-contoso}"` |
| `input-password` | Stays in the source (`unsupportedInputType`): password inputs are secrets and aren't migrated |
| `input-command` | Stays in the source (`unsupportedInputType`): command inputs run a command, which a variable can't replace |
| `input-in-url` | Stays in the source (`unrepresentableConfiguration`): the client forwards the URL percent-encoded, so the input can't be matched |

After migrating, input declarations that nothing left in `.vscode/mcp.json` uses are removed. With everything migrated, only `tenant` (still used by `input-in-url`), `token` and `picked` remain. Saved input values are not carried over.

`${NAME}` in `command`, `args` and headers is read from the environment the harness was started in, not from the server's `env`. To see a value arrive, set it in the shell you start VS Code from, for example `LOG_LEVEL=debug`.

## Servers that use settings

`${config:...}` references migrate to environment variables too, named after the setting key (`fixture.label` becomes `FIXTURE_LABEL`). Each is set to the setting's value at migration time: a local server gets an `env` entry with the value, and a remote server writes it in the reference. Later changes to the setting don't apply. Each migrated server shows the warning "Configs will become environment variables set to their current values".

A workspace server's destination is usually committed, so it only keeps values from the workspace's own settings, here [.vscode/settings.json](.vscode/settings.json). A setting that is unset, structured, not a string or number, or only in your user settings becomes an empty variable instead.

| Definition | Expected result in `.mcp.json` |
| --- | --- |
| `config-string` | `"--label=${FIXTURE_LABEL}"` and `"--again=${FIXTURE_LABEL}"` plus `"env": { "FIXTURE_LABEL": "from-workspace-settings" }`: one variable for both uses |
| `config-number-env` | `"env": { "FIXTURE_PORT": "48123" }`: the entry only referred to the setting, so it holds the value, as text |
| `config-http-header` | `"X-Fixture-Region": "${FIXTURE_REGION:-westus}"` |
| `config-http-url` | `"url": "http://127.0.0.1:48123/mcp?region=${FIXTURE_REGION:-westus}"` |
| `config-with-input` | `"--mode=${MODE}"` and `"--label=${FIXTURE_LABEL}"` plus `"MODE": "safe"` and `"FIXTURE_LABEL": "from-workspace-settings"` in `env`; both warnings are shown |
| `config-unset` | `"--missing=${FIXTURE_MISSING}"` plus `"FIXTURE_MISSING": ""` in `env`: `fixture.missing` isn't set |
| `config-structured` | `"--options=${FIXTURE_OPTIONS}"` plus `"FIXTURE_OPTIONS": ""` in `env`: `fixture.options` is an object |
| `config-user-only` | `"--user=${FIXTURE_USERONLY}"` plus `"FIXTURE_USERONLY": ""` in `env`, even after adding `"fixture.userOnly": "from-user-settings"` to your **user** settings |
| `config-in-env-name` | Stays in the source (`environmentVariableInName`): a setting in an `env` name is never expanded |
| `config-collision` | Stays in the source (`variableNameCollision`): `fixture.mode` and `${env:FIXTURE_MODE}` would share `FIXTURE_MODE` |
| `config-in-url-host` | Stays in the source (`unsupportedEnvironmentVariableInUrl`): the destination rejects a variable in the URL's host and port |

To check revalidation, open the migration page, then change `fixture.label` in [.vscode/settings.json](.vscode/settings.json) and migrate `config-string`. It fails with `sourceChanged` and stays in the source. Reopen the page to migrate it with the new value.

To see the values arrive, call `migration_probe` on a migrated STDIO server: its `env` shows the `FIXTURE_*` values. VS Code's own chat leaves `${FIXTURE_LABEL}` in `args` as written, since it only fills those from the environment it was started in; Copilot fills them from `env`.

## Servers that use OAuth

The OAuth client ID migrates as `oauthClientId`. The client secret never does: it stays in VS Code's secret storage, which the Copilot CLI can't read, so a server whose client has a stored secret stays in the source. Sign-ins aren't migrated.

| Definition | Expected result |
| --- | --- |
| `uses-oauth-config` | `"oauthClientId": "fixture-client-not-a-secret"`. It points at the plain HTTP fixture, so it only checks the configuration. |
| `oauth-public-client` | `"oauthClientId": "fixture-public-client"`, with the warning "You may need to sign in again after migration." |
| `oauth-not-enterprise-managed` | Same as `oauth-public-client`; `"enterpriseManaged": false` is dropped |
| `oauth-client-secret` | Migrates like `oauth-public-client` while no client secret is stored. After you store one, it stays in the source (`oauthClientSecret`). |
| `oauth-enterprise-managed` | Stays in the source (`enterpriseManagedOAuth`): it relies on a VS Code setting that Copilot doesn't have. Don't start it; it needs `mcp.enterpriseManagedAuth.idp`. |

To store the secret, select **Set Client Secret** above `oauth-client-secret`'s `clientId` in [.vscode/mcp.json](.vscode/mcp.json) and enter `fixture-secret-not-real`. To remove it, select **Replace Client Secret** and then the trash button. To check revalidation, open the migration page with no secret stored, store it, then migrate `oauth-client-secret`: it fails with `oauthClientSecret` and stays in the source.

To check a user server, copy `oauth-public-client` into your user `mcp.json` (**MCP: Open User Configuration**). It moves to `~/.copilot/mcp-config.json` and also warns "VS Code will ask you to trust this server again after migration."

### Signing in

Use **Tasks: Run Task → MCP: Start Local OAuth Fixture** to serve `http://127.0.0.1:48124/mcp` on loopback only. The same port hosts a minimal authorization server that approves every request automatically and has no dynamic client registration, so only these fixture clients can sign in:

| Client ID | Client secret |
| --- | --- |
| `fixture-public-client` | None (public client with PKCE) |
| `fixture-confidential-client` | `fixture-secret-not-real` (required at the token endpoint) |

These are fixture values for this loopback server only. `migration_probe` returns `oauth:<client ID>`, which shows the client that signed in. The task's terminal logs each authorization and token request, including rejected clients and missing secrets.

1. Before migrating, start `oauth-public-client` in VS Code's chat and sign in. The browser approves automatically. `migration_probe` returns `oauth:fixture-public-client`.
2. Migrate it, then start it from `.mcp.json`. VS Code reads `oauthClientId`, so it signs in with the same client, reusing the existing sign-in where possible, and the probe returns the same label.
3. In a Copilot Agent Host session, use the migrated server. Copilot asks VS Code to sign in, which uses the same client.
4. Optionally, run the Copilot CLI in this folder and use the migrated server. It asks you to sign in once.

A confidential client without a stored secret migrates, since nothing marks it as confidential, but signing in then fails at the token endpoint (`missing or wrong client secret` in the task's terminal). VS Code's own chat fails the same way without a stored secret.

## Optional HTTP tool check

Use **Tasks: Run Task → MCP: Start Local HTTP Fixture** to serve `http://127.0.0.1:48123/mcp` on loopback only. Stop the task when done. If the port is occupied, change the task port and fixture URLs together. Nothing starts automatically on folder open.

The probe exposes only `migration_probe`, which returns its label and working directory, plus, for STDIO servers, its extra arguments and `FIXTURE_*` environment variables. It does not read/write files, run shell commands, or use credentials. STDIO commands use `mcp/mock-server.mjs` relative to the root, both before and after migration.

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
