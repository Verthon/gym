#!/bin/sh
cmd=$(jq -r '.tool_input.command // ""')

block() {
  echo "BLOCKED: $1. Git hooks (lint, type-check, tests) must not be skipped. If a hook fails, fix the cause or stop and report the failure to the user." >&2
  exit 2
}

echo "$cmd" | grep -Eq -- '--no-verify' && block "--no-verify"
echo "$cmd" | grep -Eq 'git[[:space:]].*commit([[:space:]].*)?[[:space:]]-[a-zA-Z]*n[a-zA-Z]*([[:space:]]|$)' && block "git commit -n"
echo "$cmd" | grep -Eq 'core\.hooksPath' && echo "$cmd" | grep -Evq 'core\.hooksPath[[:space:]]+\.githooks' && block "overriding core.hooksPath"
exit 0
