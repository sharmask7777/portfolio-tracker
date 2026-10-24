use portfolio_db::market_data::{MfApiLatestResponse, MfApiMeta, MfApiNavRecord, parse_mfapi_date};
use rust_decimal::Decimal;

#[test]
fn test_deserialize_mfapi_latest_response() {
    let json_data = r#"{"meta":{"scheme_code":122639,"scheme_name":"Parag Parikh Flexi Cap Fund"},"data":[{"date":"23-10-2026","nav":"88.96950"}],"status":"SUCCESS"}"#;
    let resp: MfApiLatestResponse = serde_json::from_str(json_data).expect("valid mfapi payload");
    assert_eq!(resp.status, "SUCCESS");
    assert_eq!(resp.data.len(), 1);
    assert_eq!(
        resp.data[0].nav,
        Decimal::from_str_exact("88.96950").unwrap()
    );
    assert_eq!(
        parse_mfapi_date(&resp.data[0].date).unwrap().to_string(),
        "2026-10-23"
    );
}

#[test]
fn test_deserialize_mfapi_empty_data() {
    let json_data = r#"{"meta":{"scheme_code":122639,"scheme_name":"Parag Parikh Flexi Cap Fund"},"data":[],"status":"SUCCESS"}"#;
    let resp: MfApiLatestResponse = serde_json::from_str(json_data).expect("valid mfapi payload");
    assert_eq!(resp.status, "SUCCESS");
    assert!(resp.data.is_empty());
}

#[test]
fn test_deserialize_mfapi_meta_fields() {
    let json_data = r#"{
        "meta": {
            "fund_house": "PPFAS Mutual Fund",
            "scheme_type": "Open Ended Schemes",
            "scheme_category": "Flexi Cap Fund",
            "scheme_code": 122639,
            "scheme_name": "Parag Parikh Flexi Cap Fund - Direct Plan - Growth"
        },
        "data": [
            {"date": "23-10-2026", "nav": "88.96950"},
            {"date": "22-10-2026", "nav": "88.54120"}
        ],
        "status": "SUCCESS"
    }"#;
    let resp: MfApiLatestResponse = serde_json::from_str(json_data).expect("valid payload");
    assert_eq!(resp.status, "SUCCESS");
    assert_eq!(resp.data.len(), 2);
    let meta: MfApiMeta = resp.meta.expect("meta should be present");
    assert_eq!(meta.scheme_code, Some(122639));
    assert_eq!(
        meta.scheme_name.as_deref(),
        Some("Parag Parikh Flexi Cap Fund - Direct Plan - Growth")
    );
    assert_eq!(meta.fund_house.as_deref(), Some("PPFAS Mutual Fund"));
}

#[test]
fn test_mfapi_nav_record_roundtrip() {
    let record = MfApiNavRecord {
        date: "23-10-2026".to_string(),
        nav: Decimal::from_str_exact("88.96950").unwrap(),
    };
    let json = serde_json::to_string(&record).expect("serialize");
    let back: MfApiNavRecord = serde_json::from_str(&json).expect("deserialize");
    assert_eq!(back, record);
}

#[test]
fn test_parse_mfapi_date_valid_and_invalid() {
    assert_eq!(
        parse_mfapi_date("23-10-2026").map(|d| d.to_string()),
        Some("2026-10-23".to_string())
    );
    assert_eq!(
        parse_mfapi_date("01-01-2024").map(|d| d.to_string()),
        Some("2024-01-01".to_string())
    );
    assert_eq!(
        parse_mfapi_date(" 23-10-2026 ").map(|d| d.to_string()),
        Some("2026-10-23".to_string())
    );
    assert_eq!(parse_mfapi_date("2026-10-23"), None);
    assert_eq!(parse_mfapi_date("invalid-date"), None);
    assert_eq!(parse_mfapi_date(""), None);
}
