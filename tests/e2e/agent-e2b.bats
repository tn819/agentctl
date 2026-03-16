#!/usr/bin/env bats
# E2B sandbox backend — e2e tests
# Docs: docs/playbooks/sandbox-e2b.md
#
# Live sandbox tests require E2B_API_KEY in the environment.
# Without a key all tests that need a real sandbox are skipped.

load '../test_helper'

setup() {
  setup_test_env
  mock_secrets_backend
  agentctl init
}

teardown() {
  teardown_test_env
}

# ── Configuration ─────────────────────────────────────────────────────────────

@test "runtime config: set e2b api key reference" {
  run agentctl config set runtime.e2b.api_key secret:E2B_API_KEY
  [ "$status" -eq 0 ]

  run agentctl config get runtime.e2b.api_key
  [ "$status" -eq 0 ]
  [[ "$output" == *"E2B_API_KEY"* ]]
}

@test "runtime config: set server routing to e2b" {
  agentctl add-server my-server npx some-mcp-server

  run agentctl runtime set my-server e2b
  [ "$status" -eq 0 ]

  run agentctl runtime list
  [ "$status" -eq 0 ]
  [[ "$output" == *"my-server"* ]]
  [[ "$output" == *"e2b"* ]]
}

@test "runtime config: set optional template" {
  run agentctl config set runtime.e2b.template my-agent-template
  [ "$status" -eq 0 ]

  run agentctl config get runtime.e2b.template
  [ "$output" = "my-agent-template" ]
}

@test "runtime list shows local as default when no routing set" {
  agentctl add-server another-server npx some-mcp-server

  run agentctl runtime list
  [ "$status" -eq 0 ]
  [[ "$output" == *"local"* ]]
}

# ── Agent lifecycle (requires E2B_API_KEY) ────────────────────────────────────

@test "agent start: creates E2B sandbox and returns session id" {
  if [[ -z "${E2B_API_KEY:-}" ]]; then
    skip "E2B_API_KEY not set — skipping live sandbox test"
  fi
  skip "vakt agent command not yet implemented — see issue #62"

  set_test_secret E2B_API_KEY "$E2B_API_KEY"
  agentctl config set runtime.e2b.api_key secret:E2B_API_KEY

  run agentctl agent start --provider e2b
  [ "$status" -eq 0 ]
  [[ "$output" == *"session"* ]] || [[ "$output" == *"sandbox"* ]]
}

@test "agent exec: runs command in E2B sandbox" {
  if [[ -z "${E2B_API_KEY:-}" ]]; then
    skip "E2B_API_KEY not set"
  fi
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider e2b --format id)

  run agentctl agent exec "$session_id" "node --version"
  [ "$status" -eq 0 ]
  [[ "$output" == v* ]]

  agentctl agent destroy "$session_id"
}

@test "agent audit: E2B tool calls recorded in audit.db" {
  if [[ -z "${E2B_API_KEY:-}" ]]; then
    skip "E2B_API_KEY not set"
  fi
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider e2b --format id)
  agentctl agent exec "$session_id" "echo hello"

  run agentctl audit show
  [ "$status" -eq 0 ]
  [[ "$output" == *"e2b"* ]]

  agentctl agent destroy "$session_id"
}

@test "agent destroy: E2B sandbox is removed after session ends" {
  if [[ -z "${E2B_API_KEY:-}" ]]; then
    skip "E2B_API_KEY not set"
  fi
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider e2b --format id)

  run agentctl agent destroy "$session_id"
  [ "$status" -eq 0 ]
}
