# Phase 01: Beads System Validation and Integration Testing

This phase validates the newly implemented Beads task tracking system by verifying the core functionality works end-to-end. The Beads system replaces the previous Todo system with a dependency-aware task graph using the external `bd` CLI tool. By the end of this phase, we'll have confirmed that beads can be created, listed, updated, and displayed correctly through the tool interface.

## Tasks

- [x] Verify the bd CLI tool is installed and functional:
  - Run `bd --version` to confirm installation
  - Run `bd init --quiet` in a temp directory to verify it creates a `.beads/` folder
  - Run `bd create "Test task" --json` to verify JSON output format matches the Bead.Info schema
  - Run `bd list --json` and `bd ready --json` to verify list output formats
  - Document any version requirements or compatibility notes

  **Completion Notes (2026-01-28):**
  - bd CLI version 0.49.0 (b5178e18) is installed and functional
  - `bd init --quiet` correctly creates `.beads/` folder with beads.db, config.yaml, metadata.json, interactions.jsonl, README.md, and .gitignore
  - JSON output from `bd create`, `bd list`, and `bd ready` matches Bead.Info schema (id, title, status, priority, issue_type, owner, created_at, created_by, updated_at, dependency_count, dependent_count)
  - Note: bd shows a warning when creating issues with "Test" prefix in production database, suggests using `BEADS_DB=/tmp/test.db` for testing
  - No strict version requirements identified; v0.49.0 works correctly with the implemented schema

- [x] Test the Bead namespace functions in isolation:
  - Create a test file at `packages/opencode/test/session/bead.test.ts`
  - Test `Bead.init()` creates `.beads/` directory when missing
  - Test `Bead.create()` with various input combinations (title only, with description, with priority, with type, with parent, with deps)
  - Test `Bead.list()` with filters: undefined (default), "ready", "all"
  - Test `Bead.get()` returns bead info for valid ID, undefined for invalid ID
  - Test `Bead.update()` for status changes including "closed" special case
  - Test `Bead.depAdd()` adds dependencies correctly

  **Completion Notes (2026-01-28):**
  - Created comprehensive test file at `packages/opencode/test/session/bead.test.ts` with 19 tests
  - All tests pass using isolated temp directories (via `tmpdir` fixture with git init)
  - Tests cover all Bead namespace functions as specified:
    - `Bead.init()`: Verified .beads/ creation and idempotency
    - `Bead.create()`: Tested with title only, description, priority, type, parent, and dependencies
    - `Bead.list()`: Verified filters for undefined (open), "ready", and "all" (including closed)
    - `Bead.get()`: Verified returns info for valid ID, undefined for invalid
    - `Bead.update()`: Tested status, priority, title updates, and special "closed" case
    - `Bead.depAdd()`: Verified dependency creation between beads
  - Note: `bd create` JSON output doesn't include `dependency_count` (only present in `bd list`), tests adjusted to use `Bead.list()` for verification

- [ ] Verify the beads tools are properly registered and callable:
  - Check that `BeadsCreateTool`, `BeadsUpdateTool`, `BeadsListTool`, `BeadsShowTool` are exported from registry
  - Verify tool parameters match the Zod schemas defined in beads.ts
  - Confirm tool descriptions are properly loaded from beads.txt

- [ ] Run the existing test suite and ensure no regressions from beads changes:
  - Run `bun test` to execute all tests
  - Note any failures unrelated to beads (pre-existing issues)
  - Confirm no new failures introduced by the beads system
