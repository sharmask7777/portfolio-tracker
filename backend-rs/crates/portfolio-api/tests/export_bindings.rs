#![allow(
    missing_docs,
    clippy::unwrap_used,
    clippy::panic,
    clippy::undocumented_unsafe_blocks
)]

use portfolio_api::routes::holdings::HoldingsSummaryResponse;
use portfolio_api::routes::portfolio::{DragDecompositionDto, SummaryMetrics};
use portfolio_api::routes::tax::{
    HarvestOpportunityDto, HarvestTicketResponse, SimulationSellRequest, SimulationSellResponse,
    TaxViewResponse, TsExportExt, UnrealizedLotGainDto, UnrealizedSummaryDto,
};
use std::fs;
use std::path::Path;
use ts_rs::TS;

#[test]
fn test_export_typescript_bindings() {
    let output_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("frontend/src/types/generated");

    fs::create_dir_all(&output_dir).expect("created output dir");

    // Export all dependencies first using ts-rs export_all_to
    SimulationSellResponse::export_all_to(&output_dir).expect("exported all deps for response");
    HoldingsSummaryResponse::export_all_to(&output_dir).expect("exported all deps for holdings");
    HarvestTicketResponse::export_all_to(&output_dir)
        .expect("exported all deps for harvest ticket");

    // Export individual bindings matching the test specification
    SimulationSellRequest::export_to(output_dir.join("SimulationSellRequest.ts"))
        .expect("exported");
    SimulationSellResponse::export_to(output_dir.join("SimulationSellResponse.ts"))
        .expect("exported");
    TaxViewResponse::export_to(output_dir.join("TaxViewResponse.ts")).expect("exported");
    HoldingsSummaryResponse::export_to(output_dir.join("HoldingsSummaryResponse.ts"))
        .expect("exported");
    SummaryMetrics::export_to(output_dir.join("SummaryMetrics.ts")).expect("exported");
    DragDecompositionDto::export_to(output_dir.join("DragDecompositionDto.ts")).expect("exported");
    HarvestTicketResponse::export_to(output_dir.join("HarvestTicketResponse.ts"))
        .expect("exported");
    HarvestOpportunityDto::export_to(output_dir.join("HarvestOpportunityDto.ts"))
        .expect("exported");
    UnrealizedSummaryDto::export_to(output_dir.join("UnrealizedSummaryDto.ts")).expect("exported");
    UnrealizedLotGainDto::export_to(output_dir.join("UnrealizedLotGainDto.ts")).expect("exported");

    assert!(output_dir.join("SimulationSellRequest.ts").exists());
    assert!(output_dir.join("SimulationSellResponse.ts").exists());
    assert!(output_dir.join("TaxViewResponse.ts").exists());
    assert!(output_dir.join("HoldingsSummaryResponse.ts").exists());
    assert!(output_dir.join("SummaryMetrics.ts").exists());
    assert!(output_dir.join("DragDecompositionDto.ts").exists());
    assert!(output_dir.join("HarvestTicketResponse.ts").exists());
    assert!(output_dir.join("HarvestOpportunityDto.ts").exists());
    assert!(output_dir.join("UnrealizedSummaryDto.ts").exists());
    assert!(output_dir.join("UnrealizedLotGainDto.ts").exists());
}
