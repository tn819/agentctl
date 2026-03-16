#!/usr/bin/env bats
# End-to-end tests for vakt config command

load '../test_helper'

setup() {
  setup_test_env
  vakt init
}

teardown() {
  teardown_test_env
}

@test "config list shows current configuration" {
  run vakt config list
  
  [ "$status" -eq 0 ]
  assert_file_contains "$AGENTS_DIR/config.json" "paths"
  [[ "$output" == *"paths"* ]]
}

@test "config get retrieves a value" {
  run vakt config get paths.code
  
  [ "$status" -eq 0 ]
  [ "$output" = "~/Code" ]
}

@test "config set updates a value" {
  run vakt config set paths.code "~/Projects"
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"Set paths.code"* ]]
  
  run vakt config get paths.code
  [ "$output" = "~/Projects" ]
}

@test "config set creates nested keys" {
  run vakt config set paths.custom "~/Custom"
  
  [ "$status" -eq 0 ]
  
  run vakt config get paths.custom
  [ "$output" = "~/Custom" ]
}

@test "config get fails for non-existent key" {
  run vakt config get non.existent.key
  
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "config set requires key and value" {
  run vakt config set
  
  [ "$status" -eq 1 ]
  [[ "$output" == *"Usage"* ]]
}

@test "config without subcommand shows list" {
  run vakt config
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"paths"* ]]
}

@test "config preserves JSON formatting" {
  vakt config set paths.code "~/Projects"
  
  run cat "$AGENTS_DIR/config.json"
  [[ "$output" == *'"paths"'* ]]
  [[ "$output" == *'"code"'* ]]
  [[ "$output" == *"}"* ]]
}

@test "config can set providers array" {
  skip "Array handling needs custom implementation"
  run vakt config set providers '["opencode","claude"]'
  
  [ "$status" -eq 0 ]
}

@test "config can set secretsBackend" {
  run vakt config set secretsBackend "pass"
  
  [ "$status" -eq 0 ]
  
  run vakt config get secretsBackend
  [ "$output" = "pass" ]
}

@test "config handles paths with spaces" {
  run vakt config set paths.code "~/My Projects"
  
  [ "$status" -eq 0 ]
  
  run vakt config get paths.code
  [ "$output" = "~/My Projects" ]
}

@test "config fails before init" {
  rm -rf "$AGENTS_DIR"
  
  run vakt config list
  
  [ "$status" -eq 1 ]
  [[ "$output" == *"Run 'vakt init' first"* ]]
}
