#!/usr/bin/env bats
# End-to-end tests for vakt list command

load '../test_helper'

setup() {
  setup_test_env
  vakt init
}

teardown() {
  teardown_test_env
}

@test "list shows MCP servers section" {
  run vakt list
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"MCP Servers"* ]]
}

@test "list shows Skills section" {
  run vakt list
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"Skills"* ]]
}

@test "list shows Secrets section" {
  run vakt list
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"Secrets"* ]]
}

@test "list shows configured servers" {
  vakt add-server test-server npx -y test-mcp
  
  run vakt list
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-server"* ]]
}

@test "list shows installed skills" {
  local base="$(mktemp -d)"
  local skill_dir="$base/test-skill"
  mkdir -p "$skill_dir"
  create_test_skill "$skill_dir" "test-skill"
  vakt add-skill "$skill_dir"

  run vakt list

  rm -rf "$base"
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-skill"* ]]
}

@test "list shows skill descriptions" {
  local base="$(mktemp -d)"
  local skill_dir="$base/test-skill"
  mkdir -p "$skill_dir"
  create_test_skill "$skill_dir" "test-skill"
  vakt add-skill "$skill_dir"

  run vakt list

  rm -rf "$base"
  [ "$status" -eq 0 ]
  [[ "$output" == *"A test skill"* ]]
}

@test "list shows secrets backend" {
  mock_secrets_backend
  
  run vakt list
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"Backend"* ]]
}

@test "list shows stored secrets" {
  mock_secrets_backend
  vakt secrets set TEST_KEY "test_value"
  
  run vakt list
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"TEST_KEY"* ]]
}

@test "list servers shows command" {
  vakt add-server my-server npx -y my-mcp
  
  run vakt list servers
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"my-server"* ]]
  [[ "$output" == *"npx"* ]]
}

@test "list skills only" {
  local base="$(mktemp -d)"
  local skill_dir="$base/test-skill"
  mkdir -p "$skill_dir"
  create_test_skill "$skill_dir" "test-skill"
  vakt add-skill "$skill_dir"

  run vakt list skills

  rm -rf "$base"
  [ "$status" -eq 0 ]
  [[ "$output" == *"test-skill"* ]]
  [[ "$output" != *"MCP Servers"* ]]
}

@test "list secrets only" {
  mock_secrets_backend
  vakt secrets set KEY1 "value1"
  
  run vakt list secrets
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"KEY1"* ]]
  [[ "$output" != *"MCP Servers"* ]]
  [[ "$output" != *"Skills"* ]]
}

@test "list empty state" {
  run vakt list
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"~/.agents/"* ]]
}

@test "list shows HTTP server URL" {
  vakt add-server http-server --http https://example.com/mcp
  
  run vakt list
  
  [ "$status" -eq 0 ]
  [[ "$output" == *"https://example.com/mcp"* ]]
}

@test "list handles multiple skills" {
  local bases=()
  for i in 1 2 3; do
    local base="$(mktemp -d)"
    bases+=("$base")
    local skill_dir="$base/skill-$i"
    mkdir -p "$skill_dir"
    create_test_skill "$skill_dir" "skill-$i"
    vakt add-skill "$skill_dir"
  done

  run vakt list

  for base in "${bases[@]}"; do rm -rf "$base"; done
  [ "$status" -eq 0 ]
  [[ "$output" == *"skill-1"* ]]
  [[ "$output" == *"skill-2"* ]]
  [[ "$output" == *"skill-3"* ]]
}
