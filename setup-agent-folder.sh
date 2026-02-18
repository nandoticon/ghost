#!/usr/bin/env bash

###############################################################################
# Google Antigravity IDE - Agent Folder Setup Script
# Version: 2.0
# Date: February 2026
# Purpose: Initialize .agent folder structure safely (idempotent + non-destructive)
###############################################################################

set -euo pipefail

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() { printf "${GREEN}[OK] %s${NC}\n" "$1"; }
print_info() { printf "${BLUE}[INFO] %s${NC}\n" "$1"; }
print_warning() { printf "${YELLOW}[WARN] %s${NC}\n" "$1"; }
print_error() { printf "${RED}[ERR] %s${NC}\n" "$1"; }

print_header() {
  printf "\n${BLUE}====================================================${NC}\n"
  printf "${BLUE}  %s${NC}\n" "$1"
  printf "${BLUE}====================================================${NC}\n\n"
}

# Write file only if it does not already exist.
write_if_missing() {
  local target="$1"
  if [ -e "$target" ]; then
    print_warning "Exists, skipping: $target"
    return 0
  fi
  mkdir -p "$(dirname "$target")"
  cat > "$target"
  print_success "Created: $target"
}

print_header "Google Antigravity .agent Setup"

# Lightweight project-dir sanity check
if [ ! -d ".git" ] && [ ! -f "package.json" ] && [ ! -f "pyproject.toml" ] && [ ! -f "requirements.txt" ]; then
  print_warning "Current directory does not look like a project root."
  printf "Continue anyway? (y/n): "
  read -r reply
  if [ "${reply:-n}" != "y" ] && [ "${reply:-n}" != "Y" ]; then
    print_error "Aborted."
    exit 1
  fi
fi

# Antigravity installation check (best effort)
if command -v antigravity >/dev/null 2>&1; then
  print_success "Antigravity CLI detected."
else
  print_warning "Antigravity CLI not detected in PATH (continuing)."
  print_info "If needed, install/check Antigravity IDE/CLI before running workflows."
fi

print_info "Creating .agent directory structure..."
mkdir -p .agent/{skills,workflows,rules,agents,patterns,solutions,decisions,context}
print_success "Directory structure ready."

print_info "Creating placeholder docs (non-destructive)..."

write_if_missing ".agent/README.md" <<'EOF'
# .agent Folder - AI Agent Configuration System

This folder stores AI agent configuration for Google Antigravity IDE.

## What this is for
- Standardize agent behavior across security, quality, and workflows.
- Enable reusable skills, persona-based agents, and multi-step orchestration.
- Preserve project knowledge (patterns, decisions, solutions, context).

## Structure
- `skills/` task-specific capabilities
- `workflows/` multi-step execution processes
- `rules/` governance and standards
- `agents/` specialized agent personas
- `patterns/` reusable implementation patterns
- `solutions/` issue-resolution records
- `decisions/` architecture decision records (ADRs)
- `context/` domain/project-specific knowledge

## How Antigravity uses this
1. Loads `GEMINI.md` in project root.
2. Loads `.agent/rules/` for guardrails.
3. Uses `.agent/skills/` for domain execution.
4. Runs `.agent/workflows/` for complex tasks.
5. Applies `.agent/agents/` personas when requested.

## Adding new configurations
- Add new markdown files to the relevant folder.
- Keep naming explicit and domain-specific.
- Include examples/checklists for repeatability.

## Best practices
- Keep rules prescriptive and testable.
- Keep skills actionable with templates.
- Keep workflows time-boxed with clear outputs.
- Keep personas explicit on escalation and quality gates.
EOF

write_if_missing ".agent/skills/README.md" <<'EOF'
# Skills Directory

Skills define task-specific capabilities and execution guidance.

Each skill should include:
- capability scope
- step-by-step process
- decision tree
- templates/examples
- quality and safety checks
EOF

write_if_missing ".agent/workflows/README.md" <<'EOF'
# Workflows Directory

Workflows define repeatable multi-step processes.

Each workflow should include:
- purpose
- step-by-step actions with time estimates
- decision points
- parallelization rules
- outputs/artifacts
- exit criteria
EOF

write_if_missing ".agent/rules/README.md" <<'EOF'
# Rules Directory

Rules define mandatory engineering and governance standards.

Rules should be:
- explicit
- enforceable
- example-driven
- aligned to security, quality, and stack constraints
EOF

write_if_missing ".agent/agents/README.md" <<'EOF'
# Agents Directory

Agent personas define role-specific expertise and behavior.

Each persona should include:
- role and mission
- competencies
- decision framework
- automatic behaviors
- escalation criteria
- references to rules/skills/workflows
EOF

write_if_missing ".agent/.gitignore" <<'EOF'
# Sensitive/local-only agent artifacts
*.secret.md
*credentials*
experiments/
sandbox/
EOF

write_if_missing "GEMINI.md" <<'EOF'
# GEMINI.md - Global Agent Configuration

This workspace uses `.agent/` rules, skills, workflows, and personas.
See `.agent/README.md` and folder-level files for guidance.
EOF

print_header "Setup Complete"
print_success "Safe, idempotent .agent scaffolding initialized."
print_info "Next steps:"
printf "1) Populate rules in .agent/rules/\n"
printf "2) Add skills in .agent/skills/\n"
printf "3) Add workflows in .agent/workflows/\n"
printf "4) Add personas in .agent/agents/\n"
printf "5) Validate by running a sample feature workflow in Antigravity\n"
