#!/bin/sh
raw=$(jq -r '.tool_input.command // ""')
code=$(printf '%s' "$raw" | perl -0pe 's/<<-?\s*([\x27"]?)(\w+)\1.*?^\2$//gms')
bare=$(printf '%s' "$code" | perl -0pe 's/\x27[^\x27]*\x27//gs; s/"(?:\\.|[^"\\])*"//gs')

block() {
  echo "BLOCKED: $1. Git hooks (lint, type-check, arch, tests) must not be skipped or weakened. If a hook fails, fix the cause or stop and report the failure to the user." >&2
  exit 2
}

has() { printf '%s' "$1" | grep -Eiq -- "$2"; }

has "$bare" '(^|[^[:alnum:]-])--no-verify([^[:alnum:]-]|$)' && block "--no-verify"
has "$bare" '(^|[;&|(`[:space:]])git([[:space:]]+[^;&|[:space:]]+)*[[:space:]]+commit([[:space:]]+[^;&|[:space:]]+)*[[:space:]]+-[a-z]*n[a-z]*([[:space:];&|)]|$)' && block "git commit -n"

has "$code" 'core\.hookspath[[:space:]]*=' && block "overriding core.hooksPath"
has "$code" 'config[^;&|]*(--unset|--unset-all|--replace-all|--add|[[:space:]]unset)[^;&|]*core\.hookspath' && block "overriding core.hooksPath"
if has "$code" 'config[^;&|]*core\.hookspath[[:space:]]+[^-[:space:];&|]'; then
  has "$code" 'core\.hookspath[[:space:]]+\.githooks/?([[:space:];&|]|$)' || block "overriding core.hooksPath"
fi
has "$code" 'GIT_CONFIG_[A-Z0-9_]*=' && block "setting git config through GIT_CONFIG_* env"

has "$code" '(^|[;&|(`[:space:]])(rm|mv|cp|ln|chmod|chflags|truncate|install|dd)[[:space:]][^;&|]*\.githooks' && block "changing .githooks outside the editor"
has "$code" 'git[^;&|]*[[:space:]](checkout|restore|rm|mv|update-index)[[:space:]][^;&|]*\.githooks' && block "changing .githooks through git"
has "$code" '(sed|perl)[[:space:]]+-[a-z]*i[^;&|]*\.githooks' && block "changing .githooks in place"

has "$code" 'CLAUDE_CODE_CHILD_SESSION[[:space:]]*=|unset[^;&|]*CLAUDE_CODE_CHILD_SESSION|-u[[:space:]]*CLAUDE_CODE_CHILD_SESSION' && block "hiding the Claude Code session from git hooks"
has "$code" '(^|[;&|(`[:space:]])env[[:space:]]+(-[a-z]*i|--ignore-environment|-)([[:space:]]|$)' && block "clearing the environment hides the Claude Code session from git hooks"
exit 0
