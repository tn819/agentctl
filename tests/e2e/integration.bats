#!/usr/bin/env bats
# Integration test: Full vakt workflow

load '../test_helper'

setup() {
  setup_test_env
  mock_secrets_backend
}

teardown() {
  teardown_test_env
}

@test "full workflow: init -> config -> secrets -> add-server -> add-skill -> sync" {
  # 1. Initialize
  run vakt init
  [ "$status" -eq 0 ]
  assert_dir_exists "$AGENTS_DIR"
  
  # 2. Configure paths
  run vakt config set paths.code "~/Projects"
  [ "$status" -eq 0 ]
  
  run vakt config get paths.code
  [ "$output" = "~/Projects" ]
  
  # 3. Add secrets
  run vakt secrets set GITHUB_TOKEN "ghp_test123"
  [ "$status" -eq 0 ]
  
  run vakt secrets get GITHUB_TOKEN
  [ "$output" = "ghp_test123" ]
  
  # 4. Add MCP server
  run vakt add-server my-github npx -y @modelcontextprotocol/server-github
  [ "$status" -eq 0 ]
  
  # 5. Add skill
  local skill_base="$(mktemp -d)"
  local skill_dir="$skill_base/test-skill"
  mkdir -p "$skill_dir"
  create_test_skill "$skill_dir" "test-skill"

  run vakt add-skill "$skill_dir"
  [ "$status" -eq 0 ]

  # 6. List everything (skill_base kept alive so symlink resolves)
  run vakt list
  rm -rf "$skill_base"
  [ "$status" -eq 0 ]
  [[ "$output" == *"my-github"* ]]
  [[ "$output" == *"test-skill"* ]]
  [[ "$output" == *"GITHUB_TOKEN"* ]]
  
  # 7. Sync (dry-run)
  run vakt sync --dry-run
  [ "$status" -eq 0 ]
}

@test "workflow: multiple servers and skills" {
  vakt init
  
  # Add multiple servers
  vakt add-server fs npx -y @modelcontextprotocol/server-filesystem /tmp
  vakt add-server gh npx -y @modelcontextprotocol/server-github
  vakt add-server http-server --http https://api.example.com/mcp
  
  # Add multiple skills
  local skill_bases=()
  for i in 1 2 3; do
    local base="$(mktemp -d)"
    skill_bases+=("$base")
    local skill_dir="$base/skill-$i"
    mkdir -p "$skill_dir"
    create_test_skill "$skill_dir" "skill-$i"
    vakt add-skill "$skill_dir"
  done

  # Verify all are listed (keep dirs alive so symlinks resolve)
  run vakt list
  for base in "${skill_bases[@]}"; do rm -rf "$base"; done
  [ "$status" -eq 0 ]

  [[ "$output" == *"fs"* ]]
  [[ "$output" == *"gh"* ]]
  [[ "$output" == *"http-server"* ]]
  [[ "$output" == *"skill-1"* ]]
  [[ "$output" == *"skill-2"* ]]
  [[ "$output" == *"skill-3"* ]]
}

@test "workflow: update and re-sync" {
  vakt init
  
  # Initial setup
  vakt add-server test-server npx -y test-mcp
  vakt secrets set TEST_TOKEN "initial_token"
  
  # Sync
  run vakt sync --dry-run
  [ "$status" -eq 0 ]
  
  # Update config
  vakt add-server test-server npx -y updated-mcp
  
  # Update secret
  vakt secrets set TEST_TOKEN "updated_token"
  
  # Re-sync
  run vakt sync --dry-run
  [ "$status" -eq 0 ]
  
  # Verify updates
  run vakt secrets get TEST_TOKEN
  [ "$output" = "updated_token" ]
}

@test "workflow: delete and cleanup" {
  vakt init
  vakt secrets set TEMP_KEY "temp_value"
  
  # Verify secret exists
  run vakt secrets get TEMP_KEY
  [ "$output" = "temp_value" ]
  
  # Delete secret
  run vakt secrets delete TEMP_KEY
  [ "$status" -eq 0 ]
  
  # Verify deletion
  run vakt secrets get TEMP_KEY
  [ "$status" -eq 1 ]
}

@test "workflow: error recovery" {
  vakt init
  
  # Try invalid command
  run vakt add-server
  [ "$status" -eq 1 ]
  
  # System should still work
  run vakt config list
  [ "$status" -eq 0 ]
  
  # Try adding skill with invalid path
  run vakt add-skill "/non/existent/path"
  [ "$status" -eq 1 ]
  
  # System should still work
  run vakt list
  [ "$status" -eq 0 ]
}

@test "workflow: config modifications" {
  vakt init
  
  # Modify multiple config values
  vakt config set paths.code "~/MyCode"
  vakt config set paths.documents "~/MyDocs"
  vakt config set paths.vault "~/MyVault"
  vakt config set secretsBackend "env"
  
  # Verify all changes
  run vakt config get paths.code
  [ "$output" = "~/MyCode" ]
  
  run vakt config get paths.documents
  [ "$output" = "~/MyDocs" ]
  
  run vakt config get paths.vault
  [ "$output" = "~/MyVault" ]
  
  run vakt config get secretsBackend
  [ "$output" = "env" ]
}

@test "workflow: re-initialize" {
  # First init
  vakt init
  vakt config set paths.code "~/First"
  
  # Re-init with overwrite
  run vakt init <<< "o"
  [ "$status" -eq 0 ]
  
  # Should be back to defaults
  run vakt config get paths.code
  [ "$output" = "~/Code" ]
}

@test "workflow: secrets with special characters" {
  vakt init

  # Test various special characters — use a stable key per iteration
  local test_values=(
    "value with spaces"
    "value_with_underscores"
    "value-with-hyphens"
    "value.with.dots"
    "value123numbers"
  )

  local i=0
  for value in "${test_values[@]}"; do
    local key="SPECIAL_KEY_$i"
    vakt secrets set "$key" "$value"

    run vakt secrets get "$key"
    [ "$status" -eq 0 ]
    [ "$output" = "$value" ]
    (( i++ )) || true
  done
}

@test "workflow: list filtering" {
  vakt init
  vakt add-server test-server npx -y test-mcp
  
  local skill_base="$(mktemp -d)"
  local skill_dir="$skill_base/test-skill"
  mkdir -p "$skill_dir"
  create_test_skill "$skill_dir" "test-skill"
  vakt add-skill "$skill_dir"

  vakt secrets set TEST_KEY "value"
  
  # List only servers
  run vakt list servers
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-server"* ]]
  [[ "$output" != *"test-skill"* ]]
  [[ "$output" != *"TEST_KEY"* ]]

  # List only skills (keep skill_base alive so symlink resolves)
  run vakt list skills
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-skill"* ]]
  [[ "$output" != *"test-server"* ]]

  # List only secrets
  run vakt list secrets
  rm -rf "$skill_base"
  [ "$status" -eq 0 ]
  [[ "$output" == *"TEST_KEY"* ]]
  [[ "$output" != *"test-server"* ]]
  [[ "$output" != *"test-skill"* ]]
}
