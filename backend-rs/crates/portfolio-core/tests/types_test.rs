use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

use portfolio_core::error::PortfolioError;
use portfolio_core::types::{AssetType, FolioNumber, Isin, Money, Nav, Pan, Percentage, Units};

#[allow(unused_macros)]
macro_rules! dec {
    ($val:literal) => {
        Decimal::from_str(stringify!($val).trim_matches('"')).expect("valid decimal literal")
    };
    ($val:expr) => {
        Decimal::from_str(&$val.to_string()).expect("valid decimal")
    };
}

fn dec(s: &str) -> Decimal {
    Decimal::from_str(s).expect("valid decimal string")
}

#[test]
fn test_money_addition_subtraction_prevent_floating_point_loss() {
    // In IEEE 754 f64: 0.1 + 0.2 != 0.3
    let f1 = 0.10_f64;
    let f2 = 0.20_f64;
    assert_ne!(f1 + f2, 0.30_f64);

    // Exact precision with Money
    let m1 = Money::from_str("0.10").expect("Valid money string");
    let m2 = Money::from_str("0.20").expect("Valid money string");
    let expected = Money::from_str("0.30").expect("Valid money string");

    assert_eq!(m1 + m2, expected);
    assert_eq!((m1 + m2) - m2, m1);
    assert_eq!(-m1, Money::from_str("-0.10").unwrap());

    // Iter sum
    let list = vec![m1, m2, expected];
    let total: Money = list.into_iter().sum();
    assert_eq!(total, Money::from_str("0.60").unwrap());
}

#[test]
fn test_money_rounding_to_two_decimal_places() {
    let m1 = Money::new(dec("100.456"));
    assert_eq!(m1, Money::from_str("100.46").unwrap());

    let m2 = Money::new(dec("100.454"));
    assert_eq!(m2, Money::from_str("100.45").unwrap());

    // Banker's rounding (MidpointNearestEven)
    let m3 = Money::new(dec("100.425"));
    assert_eq!(m3, Money::from_str("100.42").unwrap()); // 2 is even

    let m4 = Money::new(dec("100.435"));
    assert_eq!(m4, Money::from_str("100.44").unwrap()); // 3 is odd -> rounds to 4

    // Display always formats with 2 decimal places
    let m5 = Money::from_str("42.5").unwrap();
    assert_eq!(format!("{m5}"), "42.50");
}

#[test]
fn test_units_rounding_to_four_decimal_places() {
    let u1 = Units::new(dec("123.456789"));
    assert_eq!(u1, Units::from_str("123.4568").unwrap());

    let u2 = Units::new(dec("123.45674"));
    assert_eq!(u2, Units::from_str("123.4567").unwrap());

    // Arithmetic
    let u_sum = u1 + u2;
    assert_eq!(u_sum, Units::from_str("246.9135").unwrap());

    let u_sub = u1 - u2;
    assert_eq!(u_sub, Units::from_str("0.0001").unwrap());

    // Display always formats with 4 decimal places
    let u3 = Units::from_str("12.34").unwrap();
    assert_eq!(format!("{u3}"), "12.3400");
}

#[test]
fn test_nav_four_decimal_places_and_nav_units_multiplication() {
    let nav = Nav::new(dec("123.45678"));
    assert_eq!(nav, Nav::from_str("123.4568").unwrap());
    assert_eq!(format!("{nav}"), "123.4568");

    let units = Units::from_str("10.5000").unwrap();

    // Nav * Units -> Money (rounded to 2 decimal places)
    // 123.4568 * 10.5000 = 1296.2964 -> 1296.30
    let valuation_1: Money = nav * units;
    assert_eq!(valuation_1, Money::from_str("1296.30").unwrap());

    // Commutative multiplication: Units * Nav -> Money
    let valuation_2: Money = units * nav;
    assert_eq!(valuation_2, valuation_1);

    // Exact precision without penny loss
    let nav2 = Nav::from_str("45.1234").unwrap();
    let units2 = Units::from_str("100.0000").unwrap();
    assert_eq!(nav2 * units2, Money::from_str("4512.34").unwrap());
}

#[test]
fn test_percentage_type() {
    let p1 = Percentage::from_percentage(dec("15.5"));
    assert_eq!(p1.as_percentage(), dec("15.5"));
    assert_eq!(p1.as_fraction(), dec("0.155"));

    let p2 = Percentage::from_fraction(dec("0.25"));
    assert_eq!(p2.as_percentage(), dec("25.0"));
    assert_eq!(p2.as_fraction(), dec("0.25"));

    let p3 = Percentage::from_ratio(dec("1"), dec("4")).unwrap();
    assert_eq!(p3.as_percentage(), dec("25.0"));
    assert_eq!(p3.as_fraction(), dec("0.25"));

    // Zero denominator returns DivisionByZero error
    let err = Percentage::from_ratio(dec("1"), dec("0"));
    assert_eq!(err, Err(PortfolioError::DivisionByZero));

    // Money * Percentage -> Money
    let principal = Money::from_str("1000.00").unwrap();
    let pct = Percentage::from_percentage(dec("15"));
    let result: Money = principal * pct;
    assert_eq!(result, Money::from_str("150.00").unwrap());

    // Display formatting
    assert_eq!(format!("{p1}"), "15.5%");

    // FromStr with and without percent sign
    assert_eq!(Percentage::from_str("15.5%").unwrap(), p1);
    assert_eq!(Percentage::from_str("15.5").unwrap(), p1);
}

#[test]
fn test_pan_strong_type_with_validation() {
    // Synthetic PANs per privacy rules
    let valid_pan1 = Pan::new("ABCDE1234F").expect("Valid synthetic PAN");
    assert_eq!(valid_pan1.as_str(), "ABCDE1234F");
    assert_eq!(format!("{valid_pan1}"), "ABCDE1234F");

    let valid_pan2 = Pan::from_str("ALPAC1001A").expect("Valid synthetic PAN");
    assert_eq!(valid_pan2.as_str(), "ALPAC1001A");

    // Invalid PAN checks: must match ^[A-Z]{5}[0-9]{4}[A-Z]$
    assert_eq!(
        Pan::new("invalid"),
        Err(PortfolioError::InvalidPan("invalid".to_string()))
    );
    assert_eq!(
        Pan::new("ABCDE12345"), // Ends in digit
        Err(PortfolioError::InvalidPan("ABCDE12345".to_string()))
    );
    assert_eq!(
        Pan::new("12345ABCDE"), // Starts with digits
        Err(PortfolioError::InvalidPan("12345ABCDE".to_string()))
    );
    assert_eq!(
        Pan::new("ABCD12345F"), // 4 letters instead of 5
        Err(PortfolioError::InvalidPan("ABCD12345F".to_string()))
    );
    assert_eq!(
        Pan::new("ABCDEF1234F"), // 11 characters
        Err(PortfolioError::InvalidPan("ABCDEF1234F".to_string()))
    );
    assert_eq!(
        Pan::new(""),
        Err(PortfolioError::InvalidPan("".to_string()))
    );
}

#[test]
fn test_folio_number_strong_type_with_validation() {
    let f1 = FolioNumber::new("12345678/90").expect("Valid folio number");
    assert_eq!(f1.as_str(), "12345678/90");
    assert_eq!(format!("{f1}"), "12345678/90");

    let f2 = FolioNumber::new("101010101").expect("Valid numeric folio");
    assert_eq!(f2.as_str(), "101010101");

    let f3 = FolioNumber::new("FOLIO-12345.01").expect("Valid alphanumeric folio");
    assert_eq!(f3.as_str(), "FOLIO-12345.01");

    // Invalid folios: empty or invalid characters
    assert_eq!(
        FolioNumber::new(""),
        Err(PortfolioError::InvalidFolio("".to_string()))
    );
    assert_eq!(
        FolioNumber::new("   "),
        Err(PortfolioError::InvalidFolio("   ".to_string()))
    );
    assert_eq!(
        FolioNumber::new("folio\0invalid"),
        Err(PortfolioError::InvalidFolio("folio\0invalid".to_string()))
    );
    assert_eq!(
        FolioNumber::new("<script>"),
        Err(PortfolioError::InvalidFolio("<script>".to_string()))
    );
}

#[test]
fn test_isin_strong_type_with_validation() {
    // Valid standard ISINs (12 chars: 2 letter country code + 10 alphanumeric)
    let isin1 = Isin::new("INF879O01027").expect("Valid synthetic ISIN");
    assert_eq!(isin1.as_str(), "INF879O01027");
    assert_eq!(isin1.country_code(), "IN");
    assert_eq!(format!("{isin1}"), "INF879O01027");

    let isin2 = Isin::new("US0378331005").expect("Valid Apple ISIN");
    assert_eq!(isin2.country_code(), "US");

    // Invalid ISIN checks
    assert_eq!(
        Isin::new("short"),
        Err(PortfolioError::InvalidIsin("short".to_string()))
    );
    assert_eq!(
        Isin::new("123456789012"), // Starts with digits
        Err(PortfolioError::InvalidIsin("123456789012".to_string()))
    );
    assert_eq!(
        Isin::new("INF879O0102799"), // 14 characters
        Err(PortfolioError::InvalidIsin("INF879O0102799".to_string()))
    );
    assert_eq!(
        Isin::new("IN-879O01027"), // Invalid dash character
        Err(PortfolioError::InvalidIsin("IN-879O01027".to_string()))
    );
}

#[test]
fn test_asset_type_variants_and_methods() {
    assert_eq!(AssetType::MutualFund.as_str(), "MUTUAL_FUND");
    assert_eq!(AssetType::Stock.as_str(), "STOCK");
    assert_eq!(AssetType::FixedDeposit.as_str(), "FIXED_DEPOSIT");
    assert_eq!(AssetType::Epf.as_str(), "EPF");
    assert_eq!(AssetType::Ppf.as_str(), "PPF");
    assert_eq!(AssetType::Sgb.as_str(), "SGB");
    assert_eq!(AssetType::PhysicalGold.as_str(), "PHYSICAL_GOLD");

    assert!(AssetType::Stock.is_equity());
    assert!(!AssetType::FixedDeposit.is_equity());

    assert!(AssetType::Sgb.is_gold());
    assert!(AssetType::PhysicalGold.is_gold());
    assert!(!AssetType::MutualFund.is_gold());

    assert!(AssetType::Epf.is_alternative());
    assert!(AssetType::Ppf.is_alternative());
    assert!(AssetType::Sgb.is_alternative());
    assert!(AssetType::PhysicalGold.is_alternative());
    assert!(!AssetType::Stock.is_alternative());

    // Serde roundtrip (SCREAMING_SNAKE_CASE)
    let json = serde_json::to_string(&AssetType::MutualFund).unwrap();
    assert_eq!(json, "\"MUTUAL_FUND\"");
    let parsed: AssetType = serde_json::from_str("\"MUTUAL_FUND\"").unwrap();
    assert_eq!(parsed, AssetType::MutualFund);

    // FromStr
    assert_eq!(
        AssetType::from_str("MUTUAL_FUND").unwrap(),
        AssetType::MutualFund
    );
    assert_eq!(AssetType::from_str("stock").unwrap(), AssetType::Stock);
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
struct FinancialRecord {
    pan: Pan,
    folio: FolioNumber,
    isin: Isin,
    asset_type: AssetType,
    units: Units,
    nav: Nav,
    invested_amount: Money,
    current_value: Money,
    allocation: Percentage,
}

#[test]
fn test_serde_with_str_exact_precision_without_floating_point_loss() {
    let money = Money::from_str("123456789.99").unwrap();
    let serialized_money = serde_json::to_string(&money).unwrap();
    // Must be serialized as string to prevent IEEE 754 precision loss
    assert_eq!(serialized_money, "\"123456789.99\"");

    let deserialized_money: Money = serde_json::from_str(&serialized_money).unwrap();
    assert_eq!(deserialized_money, money);

    // Units exact string serialization
    let units = Units::from_str("1234.5678").unwrap();
    let serialized_units = serde_json::to_string(&units).unwrap();
    assert_eq!(serialized_units, "\"1234.5678\"");

    // Nav exact string serialization
    let nav = Nav::from_str("987.6543").unwrap();
    let serialized_nav = serde_json::to_string(&nav).unwrap();
    assert_eq!(serialized_nav, "\"987.6543\"");

    // Deserialization also accepts numeric literal for flexibility
    let from_number: Money = serde_json::from_str("42.50").unwrap();
    assert_eq!(from_number, Money::from_str("42.50").unwrap());

    // Full financial record serialization & deserialization roundtrip
    let record = FinancialRecord {
        pan: Pan::new("ABCDE1234F").unwrap(),
        folio: FolioNumber::new("123456/78").unwrap(),
        isin: Isin::new("INF879O01027").unwrap(),
        asset_type: AssetType::MutualFund,
        units,
        nav,
        invested_amount: Money::from_str("1000000.00").unwrap(),
        current_value: nav * units,
        allocation: Percentage::from_percentage(dec("45.5")),
    };

    let record_json = serde_json::to_string(&record).unwrap();
    let deserialized_record: FinancialRecord = serde_json::from_str(&record_json).unwrap();
    assert_eq!(deserialized_record, record);

    // Deserializing invalid PAN inside JSON fails
    let invalid_json = record_json.replace("ABCDE1234F", "INVALID_PAN");
    let err = serde_json::from_str::<FinancialRecord>(&invalid_json);
    assert!(err.is_err());
}

#[test]
fn test_serde_deserialization_rounding_invariant() {
    // Deserializing "100.4567" string into Money produces Banker's rounded 100.46
    let deserialized_money: Money = serde_json::from_str("\"100.4567\"").unwrap();
    assert_eq!(deserialized_money, Money::new(dec!(100.46)));
    assert_eq!(deserialized_money, Money::from_str("100.46").unwrap());

    // Deserializing numeric 100.4567 literal into Money produces Banker's rounded 100.46
    let deserialized_money_num: Money = serde_json::from_str("100.4567").unwrap();
    assert_eq!(deserialized_money_num, Money::new(dec!(100.46)));
    assert_eq!(deserialized_money_num, Money::from_str("100.46").unwrap());

    // Deserializing "100.45678" into Units rounds to 4 decimal places
    let deserialized_units: Units = serde_json::from_str("\"100.45678\"").unwrap();
    assert_eq!(deserialized_units, Units::new(dec!(100.4568)));
    assert_eq!(deserialized_units, Units::from_str("100.4568").unwrap());

    // Deserializing "100.45678" into Nav rounds to 4 decimal places
    let deserialized_nav: Nav = serde_json::from_str("\"100.45678\"").unwrap();
    assert_eq!(deserialized_nav, Nav::new(dec!(100.4568)));
    assert_eq!(deserialized_nav, Nav::from_str("100.4568").unwrap());
}

#[test]
fn test_encapsulation_and_conversions() {
    let m = Money::from_str("123.45").unwrap();
    assert_eq!(*m.as_decimal(), dec!(123.45));
    assert_eq!(m.to_decimal(), dec!(123.45));

    let u = Units::from_str("123.4567").unwrap();
    assert_eq!(*u.as_decimal(), dec!(123.4567));
    assert_eq!(u.to_decimal(), dec!(123.4567));

    let n = Nav::from_str("456.7890").unwrap();
    assert_eq!(*n.as_decimal(), dec!(456.7890));
    assert_eq!(n.to_decimal(), dec!(456.7890));

    let p = Percentage::from_percentage(dec!(12.34));
    assert_eq!(*p.as_decimal(), dec!(12.34));
    assert_eq!(p.to_decimal(), dec!(12.34));
}

#[test]
#[allow(clippy::op_ref)]
fn test_commutative_multiplication_money_percentage_and_precision() {
    let m = Money::from_str("1000.00").unwrap();
    let p = Percentage::from_percentage(dec!(15.5));

    let expected = Money::from_str("155.00").unwrap();

    // Commutative multiplication: Money * Percentage == Percentage * Money
    assert_eq!(m * p, expected);
    assert_eq!(p * m, expected);

    // Borrowed variants
    assert_eq!(m * &p, expected);
    assert_eq!(&m * p, expected);
    assert_eq!(&m * &p, expected);
    assert_eq!(p * &m, expected);
    assert_eq!(&p * m, expected);
    assert_eq!(&p * &m, expected);

    // Non-premature division test:
    // Compute (money * pct) / 100 before rounding to Money
    let m2 = Money::from_str("300.00").unwrap();
    let p2 = Percentage::from_percentage(dec!(33.33333333333333333333333333));
    let res = m2 * p2;
    assert_eq!(res, Money::from_str("100.00").unwrap());
    assert_eq!(p2 * m2, Money::from_str("100.00").unwrap());
}

#[test]
#[allow(clippy::op_ref)]
fn test_units_division_operator() {
    let u1 = Units::from_str("100.0000").unwrap();
    let u2 = Units::from_str("25.0000").unwrap();

    let div_res = (u1 / u2).expect("valid division");
    assert_eq!(div_res, dec!(4));

    // Borrowed variants
    assert_eq!((&u1 / u2).unwrap(), dec!(4));
    assert_eq!((u1 / &u2).unwrap(), dec!(4));
    assert_eq!((&u1 / &u2).unwrap(), dec!(4));

    // Division by zero
    let zero_units = Units::ZERO;
    assert_eq!(u1 / zero_units, Err(PortfolioError::DivisionByZero));
    assert_eq!(&u1 / zero_units, Err(PortfolioError::DivisionByZero));
    assert_eq!(u1 / &zero_units, Err(PortfolioError::DivisionByZero));
    assert_eq!(&u1 / &zero_units, Err(PortfolioError::DivisionByZero));
}

#[test]
fn test_portfolio_error_variants() {
    let err1 = PortfolioError::InsufficientUnits {
        available: Units::from_str("10.0000").unwrap(),
        requested: Units::from_str("15.0000").unwrap(),
    };
    assert_eq!(
        format!("{err1}"),
        "Insufficient units: available 10.0000, requested 15.0000"
    );

    let err2 = PortfolioError::UnitsLocked {
        available: Units::from_str("5.0000").unwrap(),
        locked: Units::from_str("10.0000").unwrap(),
    };
    assert_eq!(
        format!("{err2}"),
        "Units locked: available 5.0000, locked 10.0000"
    );

    let err3 = PortfolioError::XirrConvergenceFailure {
        iterations: 100,
        last_guess: dec("0.15"),
    };
    assert_eq!(
        format!("{err3}"),
        "XIRR failed to converge after 100 iterations with last guess 0.15"
    );

    let err4 = PortfolioError::InvalidTransaction {
        reason: "Unknown transaction type".to_string(),
    };
    assert_eq!(
        format!("{err4}"),
        "Invalid transaction: Unknown transaction type"
    );

    let err5 = PortfolioError::InvalidPan("INVALID".to_string());
    assert_eq!(format!("{err5}"), "Invalid PAN: INVALID");

    let err6 = PortfolioError::InvalidFolio("".to_string());
    assert_eq!(format!("{err6}"), "Invalid folio number: ");

    let err7 = PortfolioError::InvalidIsin("BAD".to_string());
    assert_eq!(format!("{err7}"), "Invalid ISIN: BAD");

    let err8 = PortfolioError::NegativeAmount(dec("-50.00"));
    assert_eq!(format!("{err8}"), "Negative amount: -50.00");

    let err9 = PortfolioError::DivisionByZero;
    assert_eq!(format!("{err9}"), "Division by zero");

    let err10 = PortfolioError::EmptyPortfolio;
    assert_eq!(format!("{err10}"), "Empty portfolio");

    let err11 = PortfolioError::ParseError("Invalid decimal format".to_string());
    assert_eq!(format!("{err11}"), "Parse error: Invalid decimal format");
}

use proptest::prelude::*;

proptest! {
    #[test]
    fn prop_money_addition_commutative(a in -100_000_000i64..100_000_000i64, b in -100_000_000i64..100_000_000i64) {
        let m1 = Money::new(Decimal::new(a, 2));
        let m2 = Money::new(Decimal::new(b, 2));
        prop_assert_eq!(m1 + m2, m2 + m1);
    }

    #[test]
    fn prop_money_addition_subtraction_identity(a in -100_000_000i64..100_000_000i64, b in -100_000_000i64..100_000_000i64) {
        let m1 = Money::new(Decimal::new(a, 2));
        let m2 = Money::new(Decimal::new(b, 2));
        prop_assert_eq!((m1 + m2) - m2, m1);
    }

    #[test]
    fn prop_units_nav_multiplication_commutative(u in 0i64..100_000_000i64, n in 0i64..100_000_000i64) {
        let units = Units::new(Decimal::new(u, 4));
        let nav = Nav::new(Decimal::new(n, 4));
        prop_assert_eq!(units * nav, nav * units);
    }
}
