#!/usr/bin/env bats
# End-to-end tests for vakt init command

load '../test_helper'

setup() {
  setup_test_env
}

teardown() {
  teardown_test_env
}

@test "init creates ~/.agents/ directory structure" {
  run vakt init
  
  [ "$status" -eq 0 ]
  assert_dir_exists "$AGENTS_DIR"
  assert_dir_exists "$AGENTS_DIR/skills"
}

@test "init creates default config files" {
  run vakt init
  
  [ "$status" -eq 0 ]
  assert_file_exists "$AGENTS_DIR/config.json"
  assert_file_exists "$AGENTS_DIR/mcp-config.json"
  assert_file_exists "$AGENTS_DIR/AGENTS.md"
}

@test "init config.json has correct structure" {
  vakt init
  
  assert_json_key_exists "$AGENTS_DIR/config.json" "paths"
  assert_json_key_exists "$AGENTS_DIR/config.json" "providers"
  assert_json_key_exists "$AGENTS_DIR/config.json" "secretsBackend"
}

@test "init mcp-config.json has default servers" {
  vakt init
  
  assert_json_key_exists "$AGENTS_DIR/mcp-config.json" "github"
}

@test "init config.json has correct default paths" {
  vakt init
  
  assert_json_equals "$AGENTS_DIR/config.json" "['paths']['code']" "~/Code"
  assert_json_equals "$AGENTS_DIR/config.json" "['paths']['documents']" "~/Documents"
  assert_json_equals "$AGENTS_DIR/config.json" "['paths']['vault']" "~/Documents/vault"
}

@test "init shows success message with checkmarks" {
  run vakt init
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"✓"* ]]
  [[ "$output" == *"Created $AGENTS_DIR"* ]]
}

@test "init prompts before overwriting existing directory" {
  vakt init
  run vakt init <<< "n"
  
  [ "$status" -eq 1 ]
  [[ "$output" == *"already exists"* ]]
}

@test "init --dry-run shows what would be created" {
  run vakt init --dry-run

  [ "$status" -eq 0 ]
  [[ "$output" == *"dry-run"* ]]
  [[ "$output" == *"Would create"* ]]
  [ ! -d "$AGENTS_DIR/skills" ]
}

@test "init can overwrite existing directory when confirmed" {
  vakt init
  echo "modified" > "$AGENTS_DIR/config.json"

  run vakt init <<< "o"

  [ "$status" -eq 0 ]
  assert_file_contains "$AGENTS_DIR/config.json" '"paths"'
}

@test "init merge keeps existing files unchanged" {
  vakt init
  echo "modified" > "$AGENTS_DIR/config.json"

  run vakt init <<< "m"

  [ "$status" -eq 0 ]
  # existing file must not be overwritten
  [[ "$(cat "$AGENTS_DIR/config.json")" == "modified" ]]
}

@test "init merge with empty input (default) keeps existing files" {
  vakt init
  echo "modified" > "$AGENTS_DIR/config.json"

  run vakt init <<< ""

  [ "$status" -eq 0 ]
  [[ "$(cat "$AGENTS_DIR/config.json")" == "modified" ]]
}

@test "init merge creates missing files without touching existing ones" {
  vakt init
  rm "$AGENTS_DIR/AGENTS.md"
  echo "modified" > "$AGENTS_DIR/config.json"

  run vakt init <<< "m"

  [ "$status" -eq 0 ]
  # missing file restored
  assert_file_exists "$AGENTS_DIR/AGENTS.md"
  # existing file untouched
  [[ "$(cat "$AGENTS_DIR/config.json")" == "modified" ]]
}

@test "init AGENTS.md has correct content" {
  vakt init
  
  assert_file_contains "$AGENTS_DIR/AGENTS.md" "Agent Standards"
  assert_file_contains "$AGENTS_DIR/AGENTS.md" "~/.agents/skills/"
}

@test "init creates skills directory" {
  vakt init

  assert_dir_exists "$AGENTS_DIR/skills"
}

@test "init outputs next steps" {
  run vakt init
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"Next steps"* ]]
  [[ "$output" == *"vakt secrets"* ]]
  [[ "$output" == *"vakt sync"* ]]
}
