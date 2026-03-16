#!/usr/bin/env bats
# Docker sandbox backend — e2e tests (local development / CI fallback)
# Docs: docs/playbooks/sandbox-docker.md
#
# Tests that require Docker are skipped automatically if the Docker daemon
# is not running. This is the recommended backend for local development.

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

@test "runtime config: set docker as default backend" {
  run agentctl config set runtime.default docker
  [ "$status" -eq 0 ]

  run agentctl config get runtime.default
  [ "$output" = "docker" ]
}

@test "runtime config: set docker socket path" {
  run agentctl config set runtime.docker.socket /var/run/docker.sock
  [ "$status" -eq 0 ]

  run agentctl config get runtime.docker.socket
  [ "$output" = "/var/run/docker.sock" ]
}

@test "runtime config: set docker image" {
  run agentctl config set runtime.docker.image node:20-slim
  [ "$status" -eq 0 ]

  run agentctl config get runtime.docker.image
  [ "$output" = "node:20-slim" ]
}

@test "runtime config: set memory limit" {
  run agentctl config set runtime.docker.memory 512m
  [ "$status" -eq 0 ]

  run agentctl config get runtime.docker.memory
  [ "$output" = "512m" ]
}

@test "runtime config: route specific server to docker" {
  agentctl add-server my-coder npx some-mcp-server

  run agentctl runtime set my-coder docker
  [ "$status" -eq 0 ]

  run agentctl runtime list
  [ "$status" -eq 0 ]
  [[ "$output" == *"my-coder"* ]]
  [[ "$output" == *"docker"* ]]
}

# ── Docker availability check ─────────────────────────────────────────────────

@test "docker daemon is accessible" {
  skip_if_missing docker

  run docker info
  [ "$status" -eq 0 ]
}

# ── Agent lifecycle (requires Docker) ────────────────────────────────────────

@test "agent start: creates Docker container and returns session id" {
  skip_if_missing docker
  skip "vakt agent command not yet implemented — see issue #62"

  run agentctl agent start --provider docker
  [ "$status" -eq 0 ]
  [[ "$output" == *"session"* ]] || [[ "$output" == *"container"* ]]
}

@test "agent exec: runs command in Docker container" {
  skip_if_missing docker
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider docker --format id)

  run agentctl agent exec "$session_id" "node --version"
  [ "$status" -eq 0 ]
  [[ "$output" == v* ]]

  agentctl agent destroy "$session_id"
}

@test "agent write-file: writes file into container workspace" {
  skip_if_missing docker
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider docker --format id)

  agentctl agent write-file "$session_id" /workspace/hello.txt "hello from vakt"

  run agentctl agent exec "$session_id" "cat /workspace/hello.txt"
  [ "$status" -eq 0 ]
  [[ "$output" == *"hello from vakt"* ]]

  agentctl agent destroy "$session_id"
}

@test "agent read-file: reads file from container workspace" {
  skip_if_missing docker
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider docker --format id)
  agentctl agent exec "$session_id" "sh -c 'echo vakt-content > /workspace/out.txt'"

  run agentctl agent read-file "$session_id" /workspace/out.txt
  [ "$status" -eq 0 ]
  [[ "$output" == *"vakt-content"* ]]

  agentctl agent destroy "$session_id"
}

@test "agent audit: Docker tool calls recorded in audit.db" {
  skip_if_missing docker
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider docker --format id)
  agentctl agent exec "$session_id" "echo audit-test"

  run agentctl audit show
  [ "$status" -eq 0 ]
  [[ "$output" == *"docker"* ]]

  agentctl agent destroy "$session_id"
}

@test "agent destroy: container is removed after session ends" {
  skip_if_missing docker
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider docker --format id)

  run agentctl agent destroy "$session_id"
  [ "$status" -eq 0 ]

  # Container should no longer exist
  run docker inspect "$session_id" 2>&1
  [ "$status" -ne 0 ]
}

@test "agent: container network is isolated by default" {
  skip_if_missing docker
  skip "vakt agent command not yet implemented — see issue #62"

  local session_id
  session_id=$(agentctl agent start --provider docker --format id)

  # Default network=none — outbound should fail
  run agentctl agent exec "$session_id" "curl --max-time 2 https://example.com"
  [ "$status" -ne 0 ]

  agentctl agent destroy "$session_id"
}
