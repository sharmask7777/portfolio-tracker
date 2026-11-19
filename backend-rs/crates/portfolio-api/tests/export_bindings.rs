#![allow(
    missing_docs,
    clippy::unwrap_used,
    clippy::panic,
    clippy::undocumented_unsafe_blocks
)]

use portfolio_api::routes::auth::{
    PairClaimRequest, PairClaimResponse, PairInitResponse, UserResponse,
};
use portfolio_api::routes::holdings::HoldingsSummaryResponse;
use portfolio_api::routes::portfolio::{DragDecompositionDto, SummaryMetrics};
use portfolio_api::routes::tax::{
    HarvestOpportunityDto, HarvestTicketResponse, SimulationSellRequest, SimulationSellResponse,
    TaxViewResponse, TsExportExt, UnrealizedLotGainDto, UnrealizedSummaryDto,
};
use portfolio_api::services::{HistoryPoint, PortfolioValuationSnapshot};
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
    HistoryPoint::export_to(output_dir.join("HistoryPoint.ts")).expect("exported");
    PortfolioValuationSnapshot::export_to(output_dir.join("PortfolioValuationSnapshot.ts"))
        .expect("exported");

    // Export mobile pairing bindings
    PairInitResponse::export_all_to(&output_dir).expect("exported all deps for PairInitResponse");
    PairClaimRequest::export_all_to(&output_dir).expect("exported all deps for PairClaimRequest");
    PairClaimResponse::export_all_to(&output_dir).expect("exported all deps for PairClaimResponse");

    PairInitResponse::export_to(output_dir.join("PairInitResponse.ts")).expect("exported");
    PairClaimRequest::export_to(output_dir.join("PairClaimRequest.ts")).expect("exported");
    PairClaimResponse::export_to(output_dir.join("PairClaimResponse.ts")).expect("exported");
    UserResponse::export_to(output_dir.join("UserResponse.ts")).expect("exported");

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
    assert!(output_dir.join("HistoryPoint.ts").exists());
    assert!(output_dir.join("PortfolioValuationSnapshot.ts").exists());
    assert!(output_dir.join("PairInitResponse.ts").exists());
    assert!(output_dir.join("PairClaimRequest.ts").exists());
    assert!(output_dir.join("PairClaimResponse.ts").exists());
    assert!(output_dir.join("UserResponse.ts").exists());

    // Stage and synchronize all generated TypeScript bindings for the mobile app
    let mobile_output_dir = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("mobile/src/types/generated");

    fs::create_dir_all(&mobile_output_dir).expect("created mobile output dir");

    for entry in fs::read_dir(&output_dir).expect("read frontend generated dir") {
        let entry = entry.expect("valid entry");
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("ts") {
            let dest = mobile_output_dir.join(entry.file_name());
            fs::copy(&path, &dest).expect("copied to mobile");
        }
    }

    assert!(mobile_output_dir.join("PairInitResponse.ts").exists());
    assert!(mobile_output_dir.join("PairClaimRequest.ts").exists());
    assert!(mobile_output_dir.join("PairClaimResponse.ts").exists());
    assert!(mobile_output_dir.join("UserResponse.ts").exists());
}
