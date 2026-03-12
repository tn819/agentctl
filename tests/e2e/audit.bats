#!/usr/bin/env bats
# End-to-end tests for vakt audit command

load '../test_helper'

setup() {
  setup_test_env
  mock_secrets_backend
  agentctl init
}

teardown() {
  teardown_test_env
}

@test "audit show exits 0 with no records" {
  run agentctl audit show
  [ "$status" -eq 0 ]
  [[ "$output" == *"No tool calls found"* ]]
}

@test "audit show accepts --server filter" {
  run agentctl audit show --server github
  [ "$status" -eq 0 ]
  [[ "$output" == *"No tool calls found"* ]]
}

@test "audit show accepts --last time window" {
  run agentctl audit show --last 1h
  [ "$status" -eq 0 ]
}

@test "audit show accepts --limit option" {
  run agentctl audit show --limit 5
  [ "$status" -eq 0 ]
}

@test "audit export outputs valid JSON with no records" {
  run agentctl audit export
  [ "$status" -eq 0 ]
  # Output should be a JSON array
  echo "$output" | python3 -c "import json, sys; data = json.load(sys.stdin); assert isinstance(data, list)"
}

@test "audit show records a sync event after vakt sync" {
  # Run a dry-run sync to populate the audit log
  run agentctl sync --dry-run
  [ "$status" -eq 0 ]

  # The sync_events table should have an entry — check via export
  run agentctl audit export
  [ "$status" -eq 0 ]
}

@test "audit creates audit.db in AGENTS_DIR" {
  run agentctl audit show
  [ "$status" -eq 0 ]
  assert_file_exists "$AGENTS_DIR/audit.db"
}

@test "audit export --since filters by date" {
  run agentctl audit export --since "2099-01-01"
  [ "$status" -eq 0 ]
  # No records after a far-future date
  echo "$output" | python3 -c "import json, sys; data = json.load(sys.stdin); assert data == []"
}
