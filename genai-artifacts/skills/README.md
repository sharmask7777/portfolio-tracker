# Agent Skills Manifest

This directory contains specialized agentic "skills" (SOPs, scripts, and references) that can be invoked by AI assistants to perform complex tasks in the Portfolio Tracker project.

## Available Skills

### 1. [quality-audit](./quality-audit/SKILL.md)
- **Description**: Audits portfolio reporting accuracy, financial invariants, and UI state consistency.
- **Triggers**: "Run a quality audit", "Validate CAS PDF", "Check for financial red flags".
- **Key Files**: `scripts/audit_engine.ts`, `references/financial_invariants.md`.

### 2. [pdd](./pdd/SKILL.md)
- **Description**: Prompt-Driven Development workflow for transforming rough ideas into executable plans.
- **Triggers**: "Plan a new feature", "Design the architecture for X".

### 3. [eval](./eval/SKILL.md)
- **Description**: Conversational evaluation framework for AI agents.
- **Triggers**: "Evaluate the performance of X", "Run a benchmark".

### 4. [codebase-summary](./codebase-summary/SKILL.md)
- **Description**: Analyzes codebase and generates architectural documentation.
- **Triggers**: "Summarize the project", "Generate AGENTS.md".

### 5. [code-task-generator](./code-task-generator/SKILL.md)
- **Description**: Generates structured code task files from descriptions.
- **Triggers**: "Create a task for X", "Generate a code task".

### 6. [code-assist](./code-assist/SKILL.md)
- **Description**: TDD-based implementation partner for code tasks.
- **Triggers**: "Implement this task", "Write the code for X".

## How to Invoke (for AI Agents)
1. Locate the relevant `SKILL.md` in this directory.
2. Read the instructions and bundled resources (scripts/references).
3. Execute the workflow as described.

## Installation (for Antigravity CLI)
If you are using the Antigravity CLI (`agy`), you can install these plugins directly from this folder:
```bash
agy plugin install skills/<plugin-name>
```

---
*This folder is AI-agnostic. Any agent capable of reading Markdown can follow these SOPs.*
