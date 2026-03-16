#!/usr/bin/env bats
# microsandbox backend — e2e tests
# Docs: docs/playbooks/sandbox-microsandbox.md
#
# Live sandbox tests require the msb daemon to be running.
# Tests skip automatically if msb is not installed.

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

@test "runtime config: set microsandbox api url" {
  run agentctl config set runtime.microsandbox.api_url http://localhost:7681
  [ "$status" -eq 0 ]

  run agentctl config get runtime.microsandbox.api_url
  [ "$output" = "http://localhost:7681" ]
}

@test "runtime config: set microsandbox rootfs image" {
  run agentctl config set runtime.microsandbox.rootfs ghcr.io/microsandbox/node:20
  [ "$status" -eq 0 ]

  run agentctl config get runtime.microsandbox.rootfs
  [ "$output" = "ghcr.io/microsandbox/node:20" ]
}

@test "runtime config: set resource limits" {
  run agentctl config set runtime.microsandbox.cpus 1
  [ "$status" -eq 0 ]

  run agentctl config set runtime.microsandbox.mem_mb 512
  [ "$status" -eq 0 ]

  run agentctl config get runtime.microsandbox.mem_mb
  [ "$output" = "512" ]
}

@test "runtime config: route server to microsandbox" {
  agentctl add-server my-coder npx some-mcp-server

  run agentctl runtime set my-coder microsandbox
  [ "$status" -eq 0 ]

  run agentctl runtime list
  [ "$status" -eq 0 ]
  [[ "$output" == *"my-coder"* ]]
  [[ "$output" == *"microsandbox"* ]]
}

# ── Daemon availability check ─────────────────────────────────────────────────

@test "msb daemon is running" {
  skip_if_missing msb

  run msb daemon status
  [ "$status" -eq 0 ]
  [[ "$output" == *"running"* ]]
}

# ── Agent lifecycle (requires msb daemon) ────────────────────────────────────

@test "agent start: creates microsandbox and returns session id" {
  skip_if_missing msb
  skip "vakt agent command not yet implemented — see issue #62"

  run agentctl agent start --provider microsandbox
  [ "$status" -eq 0 ]
  [[ "$output" == *"session"* ]] || [[ "$output" == *"sandbox"* ]]
}

@test "agent exec: runs command in microsandbox" {
  skip_if_missing msb
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider microsandbox --format id)

  run agentctl agent exec "$session_id" "node --version"
  [ "$status" -eq 0 ]
  [[ "$output" == v* ]]

  agentctl agent destroy "$session_id"
}

@test "agent destroy: microsandbox is removed after session ends" {
  skip_if_missing msb
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider microsandbox --format id)

  run agentctl agent destroy "$session_id"
  [ "$status" -eq 0 ]
}

@test "agent: cold start is under 500ms" {
  skip_if_missing msb
  skip "vakt agent command not yet implemented — see issue #62"

  local start end duration
  start=$(date +%s%3N)
  session_id=$(agentctl agent start --provider microsandbox --format id)
  end=$(date +%s%3N)
  duration=$(( end - start ))

  [ "$duration" -lt 500 ]
  agentctl agent destroy "$session_id"
}
