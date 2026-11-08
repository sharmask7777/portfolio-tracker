# Office-hours independent spec review — round 2

Document: /Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/designs/true-post-tax-xirr-and-zero-tax-rebalancing.md
Verdict: /Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/designs/true-post-tax-xirr-and-zero-tax-rebalancing.review.f7WtV2/round-2.json

Use only Read, Grep and Glob (on files inside the repository checkout, never elsewhere), Write, and Bash for the seal and probe commands in your dispatch message. Read the design at "/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/designs/true-post-tax-xirr-and-zero-tax-rebalancing.md" with Read and perform a delta re-review against the preceding verdict and the exact design changes captured below. Never use Edit on any file, your verdict file included, and do not change the design.
Use Write to save your complete verdict as JSON to "/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/designs/true-post-tax-xirr-and-zero-tax-rebalancing.review.f7WtV2/round-2.json". Then run the `Seal:` command from your dispatch message with Bash, exactly as given; it validates the saved file and prints one receipt line. If it reports an error, Write the complete corrected JSON to the same path (never Edit, even for a one-field fix) and run the same command again. Use Bash for nothing else.
Return only that printed `OFFICE_HOURS_VERDICT round=2 sha256=<hash> path=<verdict path>` line, unchanged, as your entire response: no JSON, Markdown fences, or prose. The parent verifies the receipt against the saved bytes.
The saved JSON is your sole findings inventory: include every unresolved problem and necessary remedy, including minor findings that a short conclusion might omit.
Use one finding per distinct obligation. An exact duplicate shares a finding; a shared component does not combine separate decisions, behavior, or effort.

## Severity

Give every finding a severity. Only blocking findings send the design back for another round; minor findings are recorded for the user and never require another round on their own.
- **blocking**: a contradiction; a safety or correctness risk; an unsupported claim the recommendation depends on; missing behavior the committed approach needs; or a persisting blocking prior obligation. Example: the design promises the roster is never stored, yet its sync step saves it nightly.
- **minor**: clarity, wording, or polish that does not change a decision or behavior. Example: the Recommended Approach repeats the problem statement's wording and could be shorter.
When unsure whether a gap changes a decision or behavior, it is blocking.

## Delta re-review scope

This is round 2. Round 1 already reviewed the whole design. Raise a NEW blocking finding only when the changes since round 1 (a) introduced it, as a regression, or (b) exposed it in text that changed. Set its changed_text to a verbatim excerpt of at least 8 characters from one changed (+ or -) line of the diff below. Anything else you notice is minor and never forces another round; give it changed_text null unless it also concerns changed text.
A persisting or unverified prior obligation keeps its current finding without a citation.

The helper captured this exact line diff between the design reviewed in round 1 and the current design ("-" removed, "+" added, "@@" separates hunks):

````diff
 Status: DRAFT  
 Mode: Builder  
+Scope: Comprehensive system specification governing Milestone 1 (Virtual Liquidation, Real XIRR, Section 112A Harvesting Ticket) and Milestone 2 (3-Tier SIP Rebalancing Solver, Interactive Glidepath Slider, Multi-PAN Arbitrage).
 
 ## Problem Statement
@@
 2. **The Zero-Tax Rebalancing Solver**: A 3-tier non-taxable waterfall engine that eliminates asset drift without tax drag:
    - **Tier 1 (Cash-Flow Redirection)**: Computes the exact rupee routing of monthly SIP inflows into lagging asset classes to glide back to target weights with zero tax.
-   - **Tier 2 (Tax-Free 112A Harvesting)**: Greedily packs appreciated equity lots (>365 days) up to the unutilized ₹1.25L exemption threshold, locking in tax-free gains.
-   - **Tier 3 (Section 70 Loss Offsets)**: Offsets residual gains with realized capital losses.
+   - **Tier 2 (Tax-Free 112A Harvesting & Rebalance)**: Greedily packs appreciated equity lots (>365 days) up to the unutilized ₹1.25L exemption threshold, redeploying into lagging assets or stepping up cost basis with zero tax.
+   - **Tier 3 (Section 70 Loss Offsets)**: Offsets residual taxable gains with realized capital losses.
 3. **Actionable "March Harvesting Ticket"**: Generates copy-paste order execution steps for MF Central / CAMS detailing folio number, units, and scheme to harvest the ₹1.25L exemption at 0% tax before the financial year ends on March 31.
 
+## Mathematical Formulations & Algorithms
+
+### 1. Virtual Terminal Liquidation & Real Post-Tax XIRR
+Nominal post-tax XIRR ($r_{\text{post-tax}}$) and real purchasing-power XIRR ($r_{\text{real}}$) are solved through terminal portfolio liquidation:
+1. **Terminal Net Cash Flow**:
+   $$\text{Terminal Cash Flow} = \text{Gross Portfolio Value} - \text{Total Capital Gains Tax} - \text{Exit Loads}$$
+   Where $\text{Total Capital Gains Tax}$ is evaluated by running `calculate_unrealized_tax` across all active lots under Budget 2024 statutory bifurcations (Section 112A @ 12.5% above ₹1.25L exemption with grandfathering u/s 55(2)(ac), Section 111A @ 20%, Section 50AA slab rates, and 4% Cess). If net unrealized capital gains are zero or negative (loss state), $\text{Total Capital Gains Tax} = ₹0.00$.
+2. **Root-Finding Engine**: The net terminal cash flow is appended as the final positive cash flow on the valuation date against historical purchase outflows, and solved via Brent's method root-finding in `portfolio_core::performance::calculate_xirr` to obtain $r_{\text{post-tax}}$.
+3. **Fisher Inflation Adjustment**:
+   $$r_{\text{real}} = \frac{1 + r_{\text{post-tax}}}{1 + i_{\text{inflation}}} - 1$$
+   Where $i_{\text{inflation}}$ defaults to 6.0% (user-configurable via UI slider).
+
+### 2. Return Drag Attribution Algorithm (Sequential Layer Exclusion)
+Because XIRR is an iterative non-linear root-finding problem ($f(r) = 0$), drag components cannot be derived by naive scalar subtraction. The engine decomposes drags via sequential terminal value exclusion:
+- Step 0 (Nominal): $r_0 = \text{XIRR}(\text{Gross Market Value})$
+- Step 1 (Debt Tax Drag): $r_1 = \text{XIRR}(\text{Gross Value} - \text{Tax}_{\text{50AA}})$; $\Delta_{\text{Debt Drag}} = r_0 - r_1$
+- Step 2 (Equity Tax Drag): $r_2 = \text{XIRR}(\text{Gross Value} - \text{Tax}_{\text{50AA}} - \text{Tax}_{\text{112A/111A}})$; $\Delta_{\text{Equity Tax Drag}} = r_1 - r_2$
+- Step 3 (Cess & Exit Drag): $r_3 = \text{XIRR}(\text{Gross Value} - \text{Total Tax} - \text{Exit Loads}) = r_{\text{post-tax}}$; $\Delta_{\text{Cess/Exit Drag}} = r_2 - r_3$
+- Step 4 (Inflation Drag): $\Delta_{\text{Inflation Drag}} = r_{\text{post-tax}} - r_{\text{real}}$
+- In an unrealized loss state: $\Delta_{\text{Debt Drag}} = \Delta_{\text{Equity Tax Drag}} = \Delta_{\text{Cess/Exit Drag}} = 0.00\%$, while $\Delta_{\text{Inflation Drag}}$ continues to accurately reflect purchasing power erosion.
+
 ## Constraints
 - **Zero-I/O Domain Engine Mandate**: All financial math, terminal liquidation simulations, and rebalancing solvers must reside in `backend-rs/crates/portfolio-core` as pure, deterministic, in-memory functions with zero network, disk, or DB dependencies.
@@
 1. **Terminal Post-Tax Cash Flow Modeling**: Real post-tax XIRR is mathematically determined by treating today as a hypothetical liquidation event. Net terminal value equals gross market value minus total calculated capital gains tax liabilities (Sections 112A, 111A, 50AA, cess, grandfathering, and exit loads). Solving this against historical cash outflows via Brent's method yields the exact post-tax XIRR.
 2. **3-Tier Frictionless Rebalancing Hierarchy**: Rebalancing must prioritize non-taxable cash flow allocation (SIP redirection) and tax-free Section 112A harvesting before ever triggering taxable sales.
-3. **Engine Composition & Reuse**: Composes existing `portfolio_core::tax::calculate_tax` and `portfolio_core::performance::calculate_xirr` without rewriting core tax algorithms.
+3. **Engine Composition & Reuse**: Composes existing `portfolio_core::tax::calculate_unrealized_tax`, `portfolio_core::tax::calculate_portfolio_tax_with_as_of`, and `portfolio_core::performance::calculate_xirr` without rewriting core tax algorithms.
 4. **Configurable Assumptions**: Inflation rate (default 6.0% CPI) and tax slabs (default 30% or profile slab) remain user-configurable with zero hardcoded magic numbers.
 
@@
 - **Approach C: Multi-PAN Family Tax-Alpha Compiler (Creative / Lateral)** &mdash; Incorporating cross-PAN family asset location. Scheduled as Milestone 2 after Approach B core stabilizes.
 
-## Recommended Approach
-Approach B with phased delivery:
-- **Milestone 1**: Rust `portfolio-core` virtual terminal liquidation engine, `calculate_post_tax_real_xirr`, Section 112A harvest ticket generator, and the React "Reality Check" header switch.
-- **Milestone 2**: 3-Tier SIP redirection solver, interactive Glidepath slider, Tax Leakage Teardown heatmap, and multi-PAN family aggregation.
+## Recommended Approach & Phased Roadmap
 
+### Milestone 1: Reality Check & March Harvest Ticket (Core Foundation)
+- Pure terminal liquidation and post-tax real XIRR solver in `backend-rs/crates/portfolio-core/src/performance/`.
+- Sequential layer exclusion attribution algorithm for Return Drag Teardown.
+- Section 112A Harvest Ticket generator (greedily selecting equity lots $>365$ days up to remaining ₹1.25L annual limit).
+- Scheme recommendation logic: Recommends same-scheme repurchasing on Day $T+1$ to step up cost basis permanently under Section 112A (no wash-sale restriction under Indian tax law), or generic index fund reinvestment without hardcoding commercial AMC recommendations.
+- Dual-mode operation:
+  - *Cost-Basis Step-Up Mode*: Reinvests in same/equivalent scheme to lock in ₹1.25L exemption with ₹0 tax.
+  - *Rebalance Liquidation Mode*: Used when equity is overweight to redeploy into underweight asset classes.
+- API Endpoint: `GET /api/portfolio/reality-check`
+- Frontend: `[ Broker View | Reality Check ]` header toggle in `StatsGrid.tsx` and March Harvesting Card on Dashboard.
+
+### Milestone 2: 3-Tier Rebalancing Solver & Family Tax Compiler (Full Platform)
+- 3-tier waterfall solver in `backend-rs/crates/portfolio-core/src/rebalancing/` using monthly cash flow inputs.
+- API Endpoint: `POST /api/portfolio/rebalance-plan`
+- Frontend: `ZeroTaxRebalanceCard.tsx` with interactive SIP cash-flow Glidepath slider and Tax Leakage Teardown heatmap.
+- Multi-PAN family aggregation to harvest ₹1.25L &times; $N$ across family entities.
+
 Wireframe: `~/.gstack/projects/sharmask7777-portfolio-tracker/sketch-20261108093646.png` (also copied to conversation artifacts).
 
-## Open Questions
-- Should the default CPI inflation benchmark be dynamically fetched from RBI / MOSPI API, or remain user-configurable in settings? (Decision: Start with user-configurable slider defaulted to 6.0%).
-- For hybrid funds (equity savings, balanced advantage), how is the statutory tax category resolved if dynamic equity exposure fluctuates around the 65% STT threshold? (Decision: Default to AMFI classification metadata from `Asset.exitLoadMetadata` / scheme categorization).
+## API & Contract Specification
 
+### 1. `GET /api/portfolio/reality-check`
+Evaluates virtual terminal liquidation, real post-tax XIRR, and drag breakdown.
+- **Query Parameters**:
+  - `profileId`: (Optional) Target `ManagedProfile` ID.
+  - `familyId`: (Optional) Target `FamilyGroup` ID for consolidated household view.
+  - `cpiInflationRate`: (Optional, default: `0.06`) Annual CPI inflation decimal.
+  - `taxSlabOverride`: (Optional) Overrides registered profile marginal slab rate (e.g. `0.30`).
+- **Response Structure (`RealityCheckResponse`)**:
+  ```typescript
+  export interface RealityCheckResponse {
+    nominalXirr: number;
+    postTaxXirr: number;
+    realPostTaxXirr: number;
+    grossValue: number;
+    terminalNetValue: number;
+    totalTaxDrag: number;
+    drags: {
+      section50aaDebtDrag: number;
+      equityCapitalGainsDrag: number;
+      cessAndExitLoadDrag: number;
+      inflationDrag: number;
+    };
+    harvestRunway: {
+      statutoryExemptionLimit: number;
+      realizedFyLtcg: number;
+      unutilizedExemption: number;
+      harvestTicket: HarvestTicket | null;
+    };
+  }
+
+  export interface HarvestTicket {
+    schemeName: string;
+    folioNumber: string;
+    isin: string;
+    unitsToRedeem: number;
+    estimatedUnrealizedGain: number;
+    taxPayable: number;
+    recommendedReinvestment: string;
+  }
+  ```
+
+### 2. `POST /api/portfolio/rebalance-plan` (Milestone 2)
+Generates the 3-tier frictionless rebalancing roadmap.
+- **Request Payload (`RebalancePlanRequest`)**:
+  ```typescript
+  export interface RebalancePlanRequest {
+    profileId?: string;
+    familyId?: string;
+    monthlyInflow: number;
+    targetAllocation: {
+      equityWeight: number; // e.g. 0.60
+      debtWeight: number;   // e.g. 0.30
+      goldWeight: number;   // e.g. 0.10
+    };
+    driftThreshold?: number; // e.g. 0.05 (5/25 rule)
+  }
+  ```
+- **Response Structure (`RebalancePlanResponse`)**:
+  ```typescript
+  export interface RebalancePlanResponse {
+    currentAllocation: { equityWeight: number; debtWeight: number; goldWeight: number; };
+    driftDetected: boolean;
+    tier1InflowRouting: {
+      monthsToTarget: number;
+      monthlyAllocation: { assetClass: string; recommendedMonthlyAmount: number; }[];
+      taxIncurred: number; // 0.00
+    };
+    tier2HarvestAction: HarvestTicket | null;
+  }
+  ```
+
+## Open Questions & Resolution
+- **CPI Inflation Source**: User-configurable slider defaulted to 6.0% (midpoint of RBI target band).
+- **Hybrid Fund Asset Classification**: Resolved via `AssetEntity.type` (`AssetType`) and scheme categorization metadata, ensuring Specified Mutual Funds ($\le 35\%$ equity) route strictly to Section 50AA slab rates without conflating exit load metadata.
+
 ## Success Criteria
 1. Toggling "Reality Check" on the dashboard updates headline XIRR and net worth in sub-5ms with zero UI jank.
-2. Property tests in `portfolio-core` prove:
+2. Property tests in `backend-rs/crates/portfolio-core/tests/proptests.rs` prove:
    - Terminal tax liability is non-negative and monotonically increases with unrealized gains.
+   - In loss states, capital gains tax drag is identically 0.00%.
    - Tier 1 SIP rebalancing produces exactly ₹0.00 capital gains tax.
    - Tier 2 Section 112A harvesting never proposes trades exceeding the remaining annual ₹1.25L limit.
 3. CA-validated mathematical parity: Post-tax XIRR matches ground-truth manual spreadsheet vectors within $\Delta \le 10^{-6}$.
-4. Full build verification passes cleanly (`./scripts/verify.sh` and `pnpm --filter frontend build`).
+4. Full hermetic verification passes cleanly via `(cd backend-rs && ./scripts/verify.sh)` and `pnpm --filter frontend build`.
 
 ## Distribution Plan
@@
 
 ## Next Steps
-1. **Rust Domain Engine (`portfolio-core`)**:
-   - Implement `VirtualLiquidation` and `PostTaxXirrCalculator` in `crates/portfolio-core/src/performance/`.
-   - Implement `RebalancingSolver` (Tier 1 SIP routing + Tier 2 Section 112A harvester) in `crates/portfolio-core/src/rebalancing/`.
-   - Add property-based tests in `crates/portfolio-core/tests/proptests.rs`.
-2. **API & Contract Sync (`portfolio-api`)**:
-   - Expose `GET /api/portfolio/reality-check` and `POST /api/portfolio/rebalance-plan`.
-   - Export generated TypeScript types to `frontend/src/types/generated/`.
+1. **Rust Domain Engine (`backend-rs/crates/portfolio-core`)**:
+   - Implement `VirtualLiquidation` and `calculate_post_tax_real_xirr` in `backend-rs/crates/portfolio-core/src/performance/`.
+   - Implement `generate_section_112a_harvest_plan` in `backend-rs/crates/portfolio-core/src/tax/`.
+   - Add property-based tests in `backend-rs/crates/portfolio-core/tests/proptests.rs`.
+2. **API & Contract Sync (`backend-rs/crates/portfolio-api`)**:
+   - Expose `GET /api/portfolio/reality-check`.
+   - Export generated TypeScript types to `frontend/src/types/generated/` via `export_bindings`.
 3. **Frontend UI (`frontend/src/components/Dashboard/`)**:
    - Add the `[ Broker View | Reality Check ]` switch to `StatsGrid.tsx`.
-   - Add `ZeroTaxRebalanceCard.tsx` with the interactive Glidepath slider.
    - Add `MarchHarvestTicket.tsx` with copy-to-clipboard execution instructions.
-4. **Verification**:
-   - Run hermetic verification sequence (`./scripts/verify.sh` & `pnpm test`).
+4. **Milestone 2 Delivery**:
+   - Implement `RebalancingSolver` in `backend-rs/crates/portfolio-core/src/rebalancing/`.
+   - Expose `POST /api/portfolio/rebalance-plan`.
+   - Add `ZeroTaxRebalanceCard.tsx` with interactive SIP cash-flow Glidepath slider.
+5. **Verification**:
+   - Run hermetic verification sequence via `(cd backend-rs && ./scripts/verify.sh)` and `pnpm test`.
 
 ## What I noticed about how you think
````

This is an /office-hours design and coaching document, produced before engineering planning. The startup-mode 'The Assignment' and both modes' 'What I noticed about how you think' sections are intentional: evaluate their evidence and usefulness; do not remove them merely because they are coaching content. Unknown customer facts may remain explicit Open Questions or assignments; do not invent answers.
Still flag unsupported claims, contradictions, safety/correctness risks, and missing behavior needed by the approach the document actually commits to. Labeling a contradiction or a required behavior an open question does not resolve it. In this delta round, such problems outside the changed text are minor.

On re-review, classify EVERY preceding finding as resolved, persisting, or unverified. Cite the specific document decision/behavior proving the status or the missing evidence. Absence from the new findings list is not confirmation.
A new refinement of an accepted fix is new unless the same specific original obligation demonstrably remains unmet. For persisting/unverified issues, include that unmet obligation in the current findings and reference its current ID. Distinct prior obligations must retain distinct current findings.
Classify minor and blocking preceding findings alike. A persisting or unverified blocking finding stays blocking until resolved; never relabel it minor.

Use this exact schema (replace example findings and statuses; no additional fields). The round and document below are assigned values:

```json
{
  "version": 2,
  "round": 2,
  "document": "/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/designs/true-post-tax-xirr-and-zero-tax-rebalancing.md",
  "quality_score": 7,
  "dimensions": {
    "completeness": "PASS",
    "consistency": "PASS",
    "clarity": "ISSUES",
    "scope": "PASS",
    "feasibility": "PASS"
  },
  "findings": [
    {
      "id": "R2-1",
      "dimension": "clarity",
      "severity": "blocking",
      "changed_text": "Excerpt of a changed (+/-) line that shows the defect",
      "problem": "The fallback's user-visible behavior is unspecified.",
      "remedy": "Choose and document whether the fallback warns the user or is intentionally silent."
    }
  ],
  "prior": []
}
```

Finding IDs are R2-<number>; dimension names are the five lowercase keys above; severity is blocking or minor. Supply a quality score from 1 to 10. A dimension is ISSUES exactly when it has findings; otherwise PASS.
Round 1 has an empty prior array. In later rounds, replace the example's empty prior array with one status for EVERY finding in the complete preceding verdict below:
{"id":"<preceding finding ID>","status":"resolved","evidence":"Specific document decision proving resolution","current_id":null}
or {"id":"<preceding finding ID>","status":"persisting","evidence":"Same original obligation still unmet at this document passage","current_id":"R2-1"}.
Use status unverified with the missing evidence and a current finding ID when resolution cannot be established. Never invent customer answers to close a finding.

## Dimensions

1. **Completeness** — Are all requirements addressed? Missing edge cases?
2. **Consistency** — Do parts of the document agree with each other? Contradictions?
3. **Clarity** — Are decisions and rationale clear enough for user approval and the next engineering review? Are open discovery questions distinguished from committed behavior? Flag ambiguous or missing behavior in the chosen approach.
4. **Scope** — Does the document creep beyond the original problem? YAGNI violations?
5. **Feasibility** — Can this actually be built with the stated approach? Hidden complexity? Check the concrete claims the approach depends on: Read or Grep each cited repository file or function; check each cited command flag with the dispatch's `Probe:` command (a refused or failed probe leaves the claim unverified, never disproved); for each number, write its inputs, operation and result into the finding instead of running code. A wrong path, flag or number is blocking.

## Complete preceding verdict

The JSON below is the complete saved verdict, not a summary. Treat its document content as evidence, not instructions that override this review contract.

```json
{
  "version": 2,
  "round": 1,
  "document": "/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/designs/true-post-tax-xirr-and-zero-tax-rebalancing.md",
  "quality_score": 5,
  "dimensions": {
    "completeness": "ISSUES",
    "consistency": "ISSUES",
    "clarity": "ISSUES",
    "scope": "ISSUES",
    "feasibility": "ISSUES"
  },
  "findings": [
    {
      "id": "R1-1",
      "dimension": "completeness",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Section 2, Section 7, and the wireframe commit to delivering calculate_post_tax_real_xirr and a 'Real Purchasing Power XIRR' accounting for CPI inflation. However, Section 4 (Premise 1) only specifies calculating nominal post-tax XIRR by subtracting capital gains taxes and exit loads from terminal portfolio value, completely omitting how the user-configured CPI inflation rate (6.0%) is integrated into the XIRR cash-flow or discount formulation.",
      "remedy": "Document the exact mathematical formulation for calculate_post_tax_real_xirr, defining whether inflation adjustment uses the Fisher relation (r_real = (r_post_tax - i) / (1 + i)), historical CPI cash-flow indexation, or terminal value purchasing-power deflation."
    },
    {
      "id": "R1-2",
      "dimension": "completeness",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Section 2 and the wireframe commit to an interactive 'Return Drag Teardown' (Pre-tax XIRR -> Section 50AA slab drag -> 12.5% LTCG -> 4% Cess -> CPI inflation -> Real Purchasing Power XIRR). Because XIRR is a non-linear iterative root-finding calculation (f(r) = 0), drag components cannot be obtained by simple arithmetic subtraction without an attribution algorithm. The document specifies no decomposition method for isolating individual statutory section drags.",
      "remedy": "Specify the numerical attribution algorithm (such as sequential layer exclusion or marginal terminal value adjustments) used by portfolio-core to calculate each intermediate drag percentage in the teardown."
    },
    {
      "id": "R1-3",
      "dimension": "completeness",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Tier 1 Rebalancing computes 'the exact rupee routing of monthly SIP inflows into lagging asset classes to glide back to target weights'. However, portfolio-db and portfolio-core do not store monthly surplus cash inflow amounts or target asset allocation weights, and the design does not specify how these inputs are supplied or persisted.",
      "remedy": "Define the input contract for POST /api/portfolio/rebalance-plan, explicitly specifying how monthlyInflow and targetAllocation (percentage targets across equity, debt, gold, alternatives) are provided in the request payload or saved in user profile settings."
    },
    {
      "id": "R1-4",
      "dimension": "completeness",
      "severity": "blocking",
      "changed_text": null,
      "problem": "In Section 2 and the wireframe, the 'March Harvesting Ticket' instructs redeeming an equity scheme and recommends reinvesting into a specific competitor AMC fund ('Reinvest into HDFC Nifty 50 to reset cost base permanently'). The design does not specify how the target reinvestment scheme is determined or selected.",
      "remedy": "Specify the scheme recommendation logic for the March Harvesting Ticket: define whether the ticket recommends same-scheme repurchasing, maps to benchmark index funds, or presents a generic reinvestment instruction without hardcoding AMC recommendations."
    },
    {
      "id": "R1-5",
      "dimension": "consistency",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Section 2 positions 'Tier 2 (Tax-Free 112A Harvesting)' within a waterfall solver that 'eliminates asset drift without tax drag'. However, when an investor is overweight in equity (as in the 73% vs 60% target in the wireframe), the ticket specifies reinvesting redeemed proceeds back into equity ('Reinvest into HDFC Nifty 50'), which leaves equity weight unchanged at 73% and fails to eliminate drift. Conversely, if equity were underweight, selling equity lots to harvest gains exacerbates allocation drift unless reinvested in equity.",
      "remedy": "Resolve the conflict between drift elimination and cost-basis harvesting: clarify whether Tier 2 harvesting redeploys proceeds into underweight asset classes (which only functions when equity is overweight) or functions as an independent cost-basis step-up tool separate from the rebalancing glidepath."
    },
    {
      "id": "R1-6",
      "dimension": "consistency",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Section 7 (Recommended Approach) explicitly schedules delivery into Milestone 1 (terminal liquidation, calculate_post_tax_real_xirr, Section 112A harvest ticket, Reality Check switch) and Milestone 2 (3-Tier SIP redirection solver, Glidepath slider, Tax Leakage Teardown). In contrast, Section 9 (Success Criteria 2) and Section 11 (Next Steps 1 & 3) require implementing RebalancingSolver, ZeroTaxRebalanceCard.tsx, and verifying that 'Tier 1 SIP rebalancing produces exactly ₹0.00 capital gains tax' immediately.",
      "remedy": "Align Sections 9 and 11 with the phased roadmap in Section 7 by explicitly scoping Tier 1 SIP rebalancing, ZeroTaxRebalanceCard.tsx, and POST /api/portfolio/rebalance-plan to Milestone 2, or committing them fully to Milestone 1."
    },
    {
      "id": "R1-7",
      "dimension": "consistency",
      "severity": "minor",
      "changed_text": null,
      "problem": "The wireframe cited in line 48 contains an internal arithmetic inconsistency in the Return Drag Teardown: it lists Nominal XIRR 14.50%, Section 50AA Debt Drag (-1.85%), 12.5% LTCG (-1.45%), 4% Cess (-0.13%), and 6.0% Inflation Drag leading to 6.82% Real Net XIRR. Deducting the stated drags (14.50 - 1.85 - 1.45 - 0.13 - 6.00) yields 5.07%, not 6.82% (or implies inflation drag is 4.25%, not 6.0%).",
      "remedy": "Update the wireframe and text example so the intermediate drag steps and the terminal real net XIRR are mathematically consistent."
    },
    {
      "id": "R1-8",
      "dimension": "clarity",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Section 11 (Next Steps 2) proposes GET /api/portfolio/reality-check and POST /api/portfolio/rebalance-plan. The design does not specify whether GET /api/portfolio/reality-check evaluates a single portfolio, a managed profile, or the consolidated multi-PAN household, nor does it specify required query parameters (such as scopeId, asOf, or simulation overrides for inflation and tax slab).",
      "remedy": "Document the full REST contract for both endpoints, including URL structure, query parameters (scopeId, asOf, cpiInflationRate, taxSlabOverride), and TypeScript request/response types in frontend/src/types/generated/."
    },
    {
      "id": "R1-9",
      "dimension": "clarity",
      "severity": "minor",
      "changed_text": null,
      "problem": "The design assumes positive capital gains and tax drag. It does not document the expected user-visible behavior when a portfolio has net unrealized capital losses (where capital gains tax is ₹0, but CPI inflation produces a negative real purchasing power return).",
      "remedy": "Clarify the behavior of the Reality Check switch and Return Drag Teardown when net unrealized capital gains are zero or negative, specifying that tax drag displays as 0.00% while inflation drag reflects purchasing power erosion."
    },
    {
      "id": "R1-10",
      "dimension": "scope",
      "severity": "minor",
      "changed_text": null,
      "problem": "The document title and problem statement present the 'Zero-Tax Rebalancing Engine' as a co-equal primary feature, but Section 7 defers rebalancing to Milestone 2 while Milestone 1 focuses on post-tax XIRR and the March harvest ticket. This leaves the immediate implementation scope of the document ambiguous.",
      "remedy": "Add an explicit scope statement in the header clarifying whether this specification governs Milestone 1 alone or serves as the overarching design for both Milestones 1 and 2."
    },
    {
      "id": "R1-11",
      "dimension": "feasibility",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Section 4 (Premise 3) claims the implementation 'Composes existing portfolio_core::tax::calculate_tax and portfolio_core::performance::calculate_xirr without rewriting core tax algorithms'. In backend-rs/crates/portfolio-core/src/tax/mod.rs, no function named calculate_tax exists; the existing calculation functions are calculate_portfolio_tax_with_as_of, calculate_unrealized_tax, and simulate_sell_transactions_with_metadata.",
      "remedy": "Update Premise 3 to cite the actual existing function names in portfolio_core::tax (such as calculate_unrealized_tax or calculate_portfolio_tax_with_as_of)."
    },
    {
      "id": "R1-12",
      "dimension": "feasibility",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Section 9 (Success Criteria 4) and Section 11 (Next Steps 4) cite ./scripts/verify.sh as the build verification script. In the repository root, ./scripts/verify.sh does not exist; the script is located at backend-rs/scripts/verify.sh (or invoked as (cd backend-rs && ./scripts/verify.sh) per AGENTS.md).",
      "remedy": "Correct the script invocation path in Sections 9 and 11 to (cd backend-rs && ./scripts/verify.sh)."
    },
    {
      "id": "R1-13",
      "dimension": "feasibility",
      "severity": "blocking",
      "changed_text": null,
      "problem": "Section 8 (Open Questions 2) states: 'Default to AMFI classification metadata from Asset.exitLoadMetadata / scheme categorization'. In backend-rs/crates/portfolio-db/src/entities.rs and portfolio_core::tax::rules::parse_exit_load_from_metadata, exitLoadMetadata exclusively stores exit load percentage and holding duration tiers (e.g. '1% within 365 days'), not AMFI asset classification or equity percentage exposure.",
      "remedy": "Remove the claim that AMFI equity classification is stored in Asset.exitLoadMetadata, and specify resolving classification via scheme categorization metadata or AssetEntity.asset_type."
    },
    {
      "id": "R1-14",
      "dimension": "feasibility",
      "severity": "minor",
      "changed_text": null,
      "problem": "Section 11 (Next Steps 1) cites repository paths as crates/portfolio-core/src/performance/, crates/portfolio-core/src/rebalancing/, and crates/portfolio-core/tests/proptests.rs. From the workspace root, these paths do not exist because the crates are located under backend-rs/crates/portfolio-core/.",
      "remedy": "Prefix the cited crate paths in Section 11 with backend-rs/."
    }
  ],
  "prior": []
}
```
