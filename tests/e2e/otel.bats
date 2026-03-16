#!/usr/bin/env bats
# End-to-end tests for vakt OTel config integration

load '../test_helper'

setup() {
  setup_test_env
  mock_secrets_backend
  vakt init
}

teardown() {
  teardown_test_env
}

@test "config set otel.endpoint stores value" {
  run vakt config set otel.endpoint http://localhost:4317
  [ "$status" -eq 0 ]
  assert_file_contains "$AGENTS_DIR/config.json" "otel"
  assert_file_contains "$AGENTS_DIR/config.json" "localhost:4317"
}

@test "config get otel.endpoint retrieves stored value" {
  vakt config set otel.endpoint http://localhost:4317
  run vakt config get otel.endpoint
  [ "$status" -eq 0 ]
  [[ "$output" == *"localhost:4317"* ]]
}

@test "config set otel.enabled stores boolean" {
  run vakt config set otel.enabled false
  [ "$status" -eq 0 ]
  assert_file_contains "$AGENTS_DIR/config.json" "otel"
}

@test "sync runs cleanly with otel endpoint configured" {
  vakt config set otel.endpoint http://localhost:4317
  run vakt sync --dry-run
  [ "$status" -eq 0 ]
}

@test "config list shows otel section when configured" {
  vakt config set otel.endpoint http://collector:4317
  run vakt config list
  [ "$status" -eq 0 ]
  [[ "$output" == *"otel"* ]]
}
