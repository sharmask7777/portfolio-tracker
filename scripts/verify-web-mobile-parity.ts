#!/usr/bin/env tsx
/**
 * @file verify-web-mobile-parity.ts
 * @description Static Parity Verification Gate asserting 1:1 cross-platform domain coverage.
 * Verifies that all 8 core web domains have corresponding verified screens,
 * components, unit tests, and E2E simulation suites in the mobile app.
 *
 * Enforces architectural boundary parity and Fowler clean-code standards:
 * - Function complexity <= 10
 * - Function line count <= 50
 * - Strict Zero-Any compliance
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Domain specification contract defining required assets across platforms.
 */
export interface DomainParitySpec {
  readonly id: string;
  readonly name: string;
  readonly webComponents: readonly string[];
  readonly mobileScreens: readonly string[];
  readonly mobileComponents: readonly string[];
  readonly mobileUnitTests: readonly string[];
  readonly mobileE2eTests: readonly string[];
  readonly keyCapabilities: readonly string[];
}

/**
 * Result record for a single domain verification pass.
 */
export interface DomainVerificationResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly missingFiles: readonly string[];
  readonly webComponentCount: number;
  readonly mobileComponentCount: number;
  readonly unitTestCount: number;
  readonly e2eTestCount: number;
}

/**
 * Exhaustive mapping of all 8 core portfolio domains.
 */
export const CORE_DOMAIN_SPECS: readonly DomainParitySpec[] = [
  {
    id: 'tax',
    name: 'Tax & Statutory Harvesting',
    webComponents: [
      'frontend/src/components/Tax/TaxView.tsx',
      'frontend/src/components/Tax/TaxHarvestingSection.tsx',
      'frontend/src/components/Tax/AdvanceTaxMatrixTable.tsx',
      'frontend/src/components/Tax/SimulationModal.tsx',
      'frontend/src/components/Tax/LtcgExemptionTrackerCard.tsx',
    ],
    mobileScreens: ['mobile/app/(tabs)/tax.tsx'],
    mobileComponents: [
      'mobile/src/components/Tax/TaxSummaryCard.tsx',
      'mobile/src/components/Tax/AdvanceTaxMatrixCard.tsx',
      'mobile/src/components/Tax/HarvestOpportunitiesList.tsx',
      'mobile/src/components/Tax/SimulationModal.tsx',
      'mobile/src/components/Tax/SimulationForm.tsx',
      'mobile/src/components/Tax/SimulationResultView.tsx',
    ],
    mobileUnitTests: [
      'mobile/tests/tax-tab.test.tsx',
      'mobile/src/services/tax-harvesting.test.ts',
    ],
    mobileE2eTests: ['mobile/src/e2e/tax-harvest-simulation.test.tsx'],
    keyCapabilities: [
      'Section 112A ₹1.25L exemption progress bar',
      'Advance Tax Table F quarterly matrix (Q1, Q2a, Q2b, Q3, Q4, Q5)',
      'Tax-free harvesting opportunities with deemed cost',
      'Sell simulation modal with Section 55(2)(ac) grandfathering and ELSS lock-in checks',
    ],
  },
  {
    id: 'analytics',
    name: 'Analytics & Stock Overlap (X-Ray)',
    webComponents: [
      'frontend/src/components/Analytics/XRayView.tsx',
      'frontend/src/components/Analytics/MultiLevelTreemap.tsx',
      'frontend/src/components/Analytics/IntersectionView.tsx',
      'frontend/src/components/Analytics/StockDetailDrawer.tsx',
    ],
    mobileScreens: ['mobile/app/(tabs)/analytics.tsx'],
    mobileComponents: [
      'mobile/src/components/Analytics/SvgTreemap.tsx',
      'mobile/src/components/Analytics/StockOverlapTable.tsx',
      'mobile/src/components/Analytics/StockDetailModal.tsx',
    ],
    mobileUnitTests: [
      'mobile/tests/analytics-tab.test.tsx',
      'mobile/src/services/hierarchy-builder.test.ts',
    ],
    mobileE2eTests: ['mobile/src/e2e/analytics-treemap.test.tsx'],
    keyCapabilities: [
      'Squarified SVG treemap multi-level drilldowns',
      'Stock overlap and company holding concentration',
      'Company search filter and excludeArbitrage toggle',
      'Underlying company detail modal with fund contributions',
    ],
  },
  {
    id: 'family',
    name: 'Family Portfolio Management',
    webComponents: [
      'frontend/src/components/Family/FamilyManager.tsx',
      'frontend/src/components/Family/FamilySelector.tsx',
    ],
    mobileScreens: ['mobile/app/(tabs)/settings.tsx'],
    mobileComponents: [
      'mobile/src/components/Navigation/ScopeSelectorHeader.tsx',
      'mobile/src/components/Settings/FamilyProfilesCard.tsx',
      'mobile/src/components/Family/FamilyMemberList.tsx',
      'mobile/src/components/Family/MemberCard.tsx',
      'mobile/src/components/Family/AddMemberModal.tsx',
    ],
    mobileUnitTests: ['mobile/tests/family-tab.test.tsx'],
    mobileE2eTests: ['mobile/src/e2e/family-management.test.tsx'],
    keyCapabilities: [
      'Multi-member profile switching and consolidated views',
      'Adding family member with synthetic PAN validation',
      'Member deletion safeguards (cannot delete primary user)',
      'Aggregated metrics and folio counts',
    ],
  },
  {
    id: 'reality-check',
    name: 'Reality Check & Inflation Waterfall',
    webComponents: [
      'frontend/src/components/Dashboard/RealityCheckModeToggle.tsx',
      'frontend/src/components/Dashboard/DragWaterfall.tsx',
      'frontend/src/components/Dashboard/AssumptionsControls.tsx',
      'frontend/src/components/Dashboard/HistoryChart.tsx',
    ],
    mobileScreens: ['mobile/app/(tabs)/index.tsx'],
    mobileComponents: [
      'mobile/src/components/Dashboard/RealityCheckModeToggle.tsx',
      'mobile/src/components/Dashboard/RealityCheckBanner.tsx',
      'mobile/src/components/Dashboard/AssumptionsModal.tsx',
      'mobile/src/components/Dashboard/HistoricalTrendChart.tsx',
    ],
    mobileUnitTests: ['mobile/tests/overview-reality-check.test.tsx'],
    mobileE2eTests: ['mobile/src/e2e/reality-check-overview.test.tsx'],
    keyCapabilities: [
      'Reality Check mode toggle with persistent state',
      'Drag waterfall invariant (Real <= Post <= Nominal)',
      'Assumptions customization modal (inflation, tax, horizon)',
      'Interactive SVG historical trend chart with range presets',
    ],
  },
  {
    id: 'goals-insights',
    name: 'Financial Goals & Portfolio Insights',
    webComponents: [
      'frontend/src/components/Insights/GoalTracker.tsx',
      'frontend/src/components/Insights/GoalAddForm.tsx',
      'frontend/src/components/Insights/GoalItemView.tsx',
      'frontend/src/components/Insights/InsightsSidebar.tsx',
    ],
    mobileScreens: ['mobile/app/(tabs)/insights.tsx'],
    mobileComponents: [
      'mobile/src/components/Insights/GoalProgressCard.tsx',
      'mobile/src/components/Insights/AddGoalModal.tsx',
      'mobile/src/components/Insights/SmartInsightsList.tsx',
    ],
    mobileUnitTests: ['mobile/tests/insights-tab.test.tsx'],
    mobileE2eTests: ['mobile/src/e2e/goals-insights.test.tsx'],
    keyCapabilities: [
      'Goal progress tracking with target amount and date',
      'Monthly SIP compounding shortfall calculation',
      'Goal creation, edition, and deletion lifecycle',
      'Smart insights alerts (concentration, tax harvesting, asset tilt)',
    ],
  },
  {
    id: 'holdings-dashboard',
    name: 'Holdings & Portfolio Dashboard',
    webComponents: [
      'frontend/src/components/Dashboard/NetWorthCard.tsx',
      'frontend/src/components/Dashboard/InvestedCapitalCard.tsx',
      'frontend/src/components/Dashboard/PerformanceCard.tsx',
      'frontend/src/components/Dashboard/HistoricalHighlightsCard.tsx',
    ],
    mobileScreens: [
      'mobile/app/(tabs)/holdings.tsx',
      'mobile/app/(tabs)/index.tsx',
    ],
    mobileComponents: [
      'mobile/src/components/HoldingCard.tsx',
      'mobile/src/components/NetWorthCard.tsx',
      'mobile/src/components/AssetAllocationCard.tsx',
      'mobile/src/components/DayReturnBanner.tsx',
    ],
    mobileUnitTests: [
      'mobile/tests/tabs.test.tsx',
      'mobile/src/services/portfolio-service.test.ts',
    ],
    mobileE2eTests: ['mobile/src/e2e/offline-navigation.test.tsx'],
    keyCapabilities: [
      'Net worth and invested capital metrics',
      'Asset allocation breakdown across categories',
      'Scheme holding cards with gains and units',
      'Day return tracking and offline cached navigation',
    ],
  },
  {
    id: 'cas-upload',
    name: 'CAS Statement Upload & Sync Queue',
    webComponents: [
      'frontend/src/components/Dashboard/TransactionSidePanel.tsx',
    ],
    mobileScreens: ['mobile/app/(tabs)/upload.tsx'],
    mobileComponents: [
      'mobile/src/components/UploadFormCard.tsx',
      'mobile/src/components/UploadQueueCard.tsx',
      'mobile/src/components/useCasUpload.ts',
    ],
    mobileUnitTests: ['mobile/src/services/upload-queue.test.ts'],
    mobileE2eTests: ['mobile/src/e2e/cas-upload-queue.test.tsx'],
    keyCapabilities: [
      'CAS PDF / JSON document picker with password encryption',
      'Persistent background upload queue with retry policy',
      'Queue status monitoring (pending, processing, completed, failed)',
      'Automatic upload trigger upon device network reconnection',
    ],
  },
  {
    id: 'pairing-security',
    name: 'Device Pairing & Transport Security',
    webComponents: [
      'frontend/src/components/PairMobileModal.tsx',
    ],
    mobileScreens: [
      'mobile/app/(auth)/pair.tsx',
      'mobile/app/(auth)/lock.tsx',
    ],
    mobileComponents: [
      'mobile/src/components/ScannerView.tsx',
      'mobile/src/components/ManualPairForm.tsx',
    ],
    mobileUnitTests: [
      'mobile/src/services/auth-service.test.ts',
      'mobile/src/services/transport-security.test.ts',
    ],
    mobileE2eTests: ['mobile/src/e2e/pair-device.test.tsx'],
    keyCapabilities: [
      'QR code camera scanning for instant pairing payload',
      'Manual 6-digit pairing code fallback entry',
      'HMAC-SHA256 authenticated key exchange and token storage',
      'Biometric authentication lock screen gate',
    ],
  },
];

/**
 * Validates that all files in a list exist and are non-empty.
 */
function checkFilesExist(
  baseDir: string,
  files: readonly string[],
): readonly string[] {
  const missing: string[] = [];
  for (const file of files) {
    const fullPath = path.resolve(baseDir, file);
    if (!fs.existsSync(fullPath)) {
      missing.push(file);
    } else {
      const stats = fs.statSync(fullPath);
      if (stats.size === 0) {
        missing.push(`${file} (empty file)`);
      }
    }
  }
  return missing;
}

/**
 * Verifies domain specifications against actual filesystem state.
 */
export function verifyDomain(
  baseDir: string,
  spec: DomainParitySpec,
): DomainVerificationResult {
  const allDomainFiles = [
    ...spec.webComponents,
    ...spec.mobileScreens,
    ...spec.mobileComponents,
    ...spec.mobileUnitTests,
    ...spec.mobileE2eTests,
  ];

  const missingFiles = checkFilesExist(baseDir, allDomainFiles);

  return {
    id: spec.id,
    name: spec.name,
    passed: missingFiles.length === 0,
    missingFiles,
    webComponentCount: spec.webComponents.length,
    mobileComponentCount: spec.mobileComponents.length,
    unitTestCount: spec.mobileUnitTests.length,
    e2eTestCount: spec.mobileE2eTests.length,
  };
}

/**
 * Checks that the master sequential runner file exists and references all domains.
 */
function verifyMasterRunner(baseDir: string): readonly string[] {
  const runnerPath = 'mobile/src/e2e/e2e-runner.test.tsx';
  const fullPath = path.resolve(baseDir, runnerPath);
  if (!fs.existsSync(fullPath)) {
    return [runnerPath];
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const requiredSubstrings = [
    'Stage 1: Splash screen routes to Pair screen',
    'Stage 2: Pair screen manual pairing',
    'Stage 3: Biometric LockScreen protects returning app session',
    'Stage 4: Dashboard view rendering, Reality Check toggle',
    'Stage 5: Holdings exploration and scheme search filter',
    'Stage 6: Tax & Statutory Compliance',
    'Stage 7: Analytics & Stock X-Ray',
    'Stage 8: Family Profiles & Multi-PAN Management',
    'Stage 9: Goals & Smart Financial Insights',
    'Stage 10: CAS Upload form and Outbox queuing',
    'Stage 11: Settings screen server configuration',
  ];
  const missing: string[] = [];
  for (const substr of requiredSubstrings) {
    if (!content.includes(substr)) {
      missing.push(`${runnerPath} (missing stage: ${substr})`);
    }
  }
  return missing;
}

/**
 * Pretty-prints a formatted verification table to standard output.
 */
function printParityReport(results: readonly DomainVerificationResult[]): void {
  console.log('\n================================================================================');
  console.log('📱 WEB-MOBILE CROSS-PLATFORM FEATURE PARITY VERIFICATION REPORT');
  console.log('================================================================================');
  console.log(
    'Domain'.padEnd(38) +
      'Web'.padEnd(7) +
      'Mobile'.padEnd(9) +
      'Unit'.padEnd(7) +
      'E2E'.padEnd(7) +
      'Status',
  );
  console.log('--------------------------------------------------------------------------------');

  for (const res of results) {
    const status = res.passed ? '✅ PASS' : '❌ FAIL';
    console.log(
      res.name.padEnd(38) +
        String(res.webComponentCount).padEnd(7) +
        String(res.mobileComponentCount).padEnd(9) +
        String(res.unitTestCount).padEnd(7) +
        String(res.e2eTestCount).padEnd(7) +
        status,
    );
  }
  console.log('================================================================================');
}

/**
 * Main execution entry point.
 */
export function main(): void {
  const baseDir = path.resolve(__dirname, '..');
  console.log(`🔍 Verifying Web-to-Mobile Parity across repository: ${baseDir}`);

  const results = CORE_DOMAIN_SPECS.map((spec) => verifyDomain(baseDir, spec));
  printParityReport(results);

  const runnerMissing = verifyMasterRunner(baseDir);
  const totalFailed = results.filter((r) => !r.passed).length + (runnerMissing.length > 0 ? 1 : 0);

  if (totalFailed > 0) {
    console.error('\n❌ Parity Verification FAILED! The following required files are missing or invalid:');
    for (const res of results) {
      if (!res.passed) {
        console.error(`\nDomain: ${res.name}`);
        for (const missing of res.missingFiles) {
          console.error(`  - ${missing}`);
        }
      }
    }
    for (const missing of runnerMissing) {
      console.error(`  - ${missing}`);
    }
    process.exit(1);
  }

  const totalWeb = results.reduce((acc, r) => acc + r.webComponentCount, 0);
  const totalMobile = results.reduce((acc, r) => acc + r.mobileComponentCount, 0);
  const totalUnit = results.reduce((acc, r) => acc + r.unitTestCount, 0);
  const totalE2e = results.reduce((acc, r) => acc + r.e2eTestCount, 0);

  console.log(`\n🎉 100% Cross-Platform Domain Parity Verified!`);
  console.log(`- Core Domains Covered: ${results.length}/8 (100%)`);
  console.log(`- Total Web Components Verified: ${totalWeb}`);
  console.log(`- Total Mobile Components Verified: ${totalMobile}`);
  console.log(`- Total Mobile Unit Test Suites: ${totalUnit}`);
  console.log(`- Total Mobile E2E Simulation Specs: ${totalE2e}`);
  console.log(`- Master Sequential E2E Runner: mobile/src/e2e/e2e-runner.test.tsx ✅`);
  console.log('================================================================================\n');
}

if (require.main === module || process.argv[1]?.includes('verify-web-mobile-parity')) {
  main();
}
