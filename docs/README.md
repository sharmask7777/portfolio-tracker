# Portfolio Tracker Documentation

Welcome to the Portfolio Tracker documentation hub. This directory contains system architecture, domain internals, design specs, implementation plans, operational SOPs, documented solutions, and historical project artifacts.

> Looking to self-host or download the app? See the root [README.md](../README.md).  
> Looking to set up a local dev environment or contribute code? See [CONTRIBUTING.md](../CONTRIBUTING.md) and [CONCEPTS.md](../CONCEPTS.md).

---

## 📚 Table of Contents

### 1. Features
- [CAS Integration](features/cas_integration.md)
- [Analytics & X-Ray](features/analytics_xray.md)
- [Tax Optimization](features/tax_optimization.md)
- [Family Management](features/family_management.md)

### 2. Architecture & Infrastructure
- [System Overview](architecture/system_overview.md)
- [Market Data Pipeline](architecture/market_data_pipeline.md)
- [Background Workers](architecture/background_workers.md)

### 3. Domain Logic & Processing
- [Corporate Actions](domain/corporate_actions.md)
- [Tax Engine Internals](domain/tax_engine_internals.md)
- [Synthetic Anchors](domain/synthetic_anchors.md)

### 4. Known Limitations, Risks & Tech Debt
- [Tax Compliance Risks](risks/tax_compliance_risks.md)
- [External API Resilience](risks/external_api_resilience.md)
- [Security Vulnerabilities](risks/security_vulnerabilities.md)
- [Data Integrity](risks/data_integrity.md)

### 5. Engineering Knowledge & Solutions
- [Documented Solutions](solutions/) — Post-mortems and reusable patterns organized by category (`analytics`, `database-issues`, `developer-experience`, `mobile`, `tax`).
- [Design Docs & Reviews](designs/) — Architectural design documents and multi-round review artifacts.
- [Specs, Plans & SDD Logs](superpowers/README.md) — Feature specifications (`specs/`), implementation plans (`plans/`), and Spec-Driven Development execution ledgers (`sdd/`).

### 6. Operations, Planning & Archive
- [Standard Operating Procedures (SOPs)](sops/) — Operational runbooks for [CAS Adaptation](sops/cas_adaptation.md) and [Portfolio Evaluation](sops/portfolio_eval.md).
- [Agent Skills](skills/README.md) — Legacy AI-agnostic skill definitions (`quality-audit`, `pdd`, `code-assist`, etc.).
- [Project Planning & Milestones](planning/README.md) — Milestone roadmaps, requirements, codebase snapshots, and audit summaries.
- [Historical Archive](archive/README.md) — Superseded agent instructions, early brainstorming mockups, and legacy session scratchpads.
