//! In-memory CAS and transaction data structures and parsing abstractions.

/// Normalizes a raw CAS transaction description/type string into a canonical
/// uppercase transaction type identifier.
///
/// Ordering is significant:
/// - `REVERSAL` is checked before `SIP` / `PURCHASE` / `REDEMPTION` so `"SIP REVERSAL"`
///   maps to `"REVERSAL"` rather than `"SIP"`.
/// - `REINVEST` is checked before `PURCHASE` and `DIVIDEND` so `"DIVIDEND REINVESTMENT"`
///   or `"PURCHASE REINVEST"` maps to `"DIVIDEND_REINVEST"`.
/// - `SWP`, `STP IN`, `STP OUT`, `SWITCH IN`, `SWITCH OUT`, and `BONUS` are matched
///   explicitly before generic `PURCHASE` / `REDEMPTION` fallbacks.
pub fn normalize_cas_tx_type(raw: &str) -> &'static str {
    let upper = raw.trim().to_ascii_uppercase();

    if upper.contains("REVERSAL") || upper.contains("REVERSED") {
        return "REVERSAL";
    }
    if upper.contains("STAMP DUTY") || upper.contains("STT") {
        return "STAMP_DUTY";
    }
    if upper.contains("SWP") || upper.contains("SYSTEMATIC WITHDRAWAL") {
        return "SWP";
    }
    if upper.contains("STP IN") || upper.contains("STP-IN") || upper.contains("STP_IN") {
        return "STP_IN";
    }
    if upper.contains("STP OUT") || upper.contains("STP-OUT") || upper.contains("STP_OUT") {
        return "STP_OUT";
    }
    if upper.contains("SWITCH IN") || upper.contains("SWITCH-IN") || upper.contains("SWITCH_IN") {
        return "SWITCH_IN";
    }
    if upper.contains("SWITCH OUT") || upper.contains("SWITCH-OUT") || upper.contains("SWITCH_OUT")
    {
        return "SWITCH_OUT";
    }
    if upper.contains("REINVEST") {
        return "DIVIDEND_REINVEST";
    }
    if upper.contains("DIVIDEND") || upper.contains("IDCW") {
        return "DIVIDEND_PAYOUT";
    }
    if upper.contains("BONUS") {
        return "BONUS";
    }
    if upper.contains("SIP") || upper.contains("SYSTEMATIC INVESTMENT") {
        return "SIP";
    }
    if upper.contains("REDEMPTION") || upper.contains("REDEEM") || upper.contains("SELL") {
        return "REDEMPTION";
    }
    if upper.contains("PURCHASE")
        || upper.contains("BUY")
        || upper.contains("NFO")
        || upper.contains("ALLOTMENT")
    {
        return "PURCHASE";
    }
    "OTHER"
}
