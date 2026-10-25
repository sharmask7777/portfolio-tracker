use portfolio_api::routes::holdings::HoldingsSummaryResponse;
use portfolio_api::routes::tax::{
    SimulationSellRequest, SimulationSellResponse, TaxViewResponse, TsExportExt,
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

    // Export individual bindings matching the test specification
    SimulationSellRequest::export_to(output_dir.join("SimulationSellRequest.ts"))
        .expect("exported");
    SimulationSellResponse::export_to(output_dir.join("SimulationSellResponse.ts"))
        .expect("exported");
    TaxViewResponse::export_to(output_dir.join("TaxViewResponse.ts")).expect("exported");
    HoldingsSummaryResponse::export_to(output_dir.join("HoldingsSummaryResponse.ts"))
        .expect("exported");

    assert!(output_dir.join("SimulationSellRequest.ts").exists());
    assert!(output_dir.join("SimulationSellResponse.ts").exists());
    assert!(output_dir.join("TaxViewResponse.ts").exists());
    assert!(output_dir.join("HoldingsSummaryResponse.ts").exists());
}
