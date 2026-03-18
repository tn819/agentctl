#!/usr/bin/env bats
# Smoke-tests the compiled binary — catches issues that only manifest after
# `bun build --compile` (e.g. missing embedded assets like providers.json).

load '../test_helper'

BINARY="${BATS_TEST_DIRNAME}/../../dist/vakt"

setup() {
  setup_test_env
  mock_secrets_backend
}

teardown() {
  teardown_test_env
}

# Build once per suite — bats runs setup/teardown per test but the binary is
# written to dist/vakt which persists across tests in this file.
build_binary() {
  if [[ ! -x "$BINARY" ]]; then
    local project_root
    project_root="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
    bun build "$project_root/src/index.ts" --compile --outfile "$project_root/dist/vakt" >&3 2>&1
  fi
}

@test "compiled binary: vakt --version exits 0" {
  build_binary
  run "$BINARY" --version
  [ "$status" -eq 0 ]
}

@test "compiled binary: vakt sync --dry-run does not crash with ENOENT providers.json" {
  build_binary
  "$BINARY" init
  run "$BINARY" sync --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" != *"ENOENT"* ]]
  [[ "$output" != *"providers.json"* ]]
}

@test "compiled binary: vakt list exits 0" {
  build_binary
  "$BINARY" init
  run "$BINARY" list
  [ "$status" -eq 0 ]
}
