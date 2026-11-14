//! Authoritative Security Master and market capitalization classification engine.
//!
//! Provides static reference data for listed Indian and global equities based on
//! SEBI / AMFI market capitalization guidelines:
//! - **Large Cap**: 1st to 100th company by market capitalization.
//! - **Mid Cap**: 101st to 250th company by market capitalization.
//! - **Small Cap**: 251st company onwards.
//! - **Other**: Unclassified, unlisted, or foreign securities outside covered indices.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Market capitalization categorization tier according to SEBI / AMFI guidelines.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(rename_all = "lowercase")]
pub enum MarketCapTier {
    /// 1st to 100th company by market capitalization.
    Large,
    /// 101st to 250th company by market capitalization.
    Mid,
    /// 251st company onwards.
    Small,
    /// Unclassified, unlisted, overseas, or micro-cap equities.
    Other,
}

impl MarketCapTier {
    /// Returns the lowercase string identifier for the market cap tier.
    #[must_use]
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Large => "large",
            Self::Mid => "mid",
            Self::Small => "small",
            Self::Other => "other",
        }
    }
}

/// Metadata record for an equity security.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SecurityMetadata {
    /// International Securities Identification Number.
    pub isin: &'static str,
    /// Exchange ticker symbol (NSE / BSE / NASDAQ / NYSE).
    pub symbol: &'static str,
    /// Canonical company name.
    pub name: &'static str,
    /// GICS-aligned economic sector.
    pub sector: &'static str,
    /// Market capitalization classification tier.
    pub tier: MarketCapTier,
    /// Market capitalization rank (1-100 Large, 101-250 Mid, 251+ Small).
    pub rank: Option<u32>,
}

/// Curated reference list of prominent equities according to SEBI/AMFI and major benchmark indices.
pub static SEBI_TOP_EQUITIES: &[SecurityMetadata] = &[
    // --- NIFTY 50 & LARGE CAP (Top 100) ---
    SecurityMetadata {
        isin: "INE002A01018",
        symbol: "RELIANCE",
        name: "Reliance Industries Limited",
        sector: "Energy",
        tier: MarketCapTier::Large,
        rank: Some(1),
    },
    SecurityMetadata {
        isin: "INE467B01029",
        symbol: "TCS",
        name: "Tata Consultancy Services Limited",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: Some(2),
    },
    SecurityMetadata {
        isin: "INE040A01034",
        symbol: "HDFCBANK",
        name: "HDFC Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(3),
    },
    SecurityMetadata {
        isin: "INE090A01021",
        symbol: "ICICIBANK",
        name: "ICICI Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(4),
    },
    SecurityMetadata {
        isin: "INE075A01022",
        symbol: "BHARTIARTL",
        name: "Bharti Airtel Limited",
        sector: "Communication Services",
        tier: MarketCapTier::Large,
        rank: Some(5),
    },
    SecurityMetadata {
        isin: "INE009A01021",
        symbol: "INFY",
        name: "Infosys Limited",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: Some(6),
    },
    SecurityMetadata {
        isin: "INE062A01020",
        symbol: "SBIN",
        name: "State Bank of India",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(7),
    },
    SecurityMetadata {
        isin: "INE018A01030",
        symbol: "LT",
        name: "Larsen & Toubro Limited",
        sector: "Industrials",
        tier: MarketCapTier::Large,
        rank: Some(8),
    },
    SecurityMetadata {
        isin: "INE154A01025",
        symbol: "ITC",
        name: "ITC Limited",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Large,
        rank: Some(9),
    },
    SecurityMetadata {
        isin: "INE030A01027",
        symbol: "HINDUNILVR",
        name: "Hindustan Unilever Limited",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Large,
        rank: Some(10),
    },
    SecurityMetadata {
        isin: "INE238A01034",
        symbol: "AXISBANK",
        name: "Axis Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(11),
    },
    SecurityMetadata {
        isin: "INE296A01024",
        symbol: "BAJFINANCE",
        name: "Bajaj Finance Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(12),
    },
    SecurityMetadata {
        isin: "INE237A01028",
        symbol: "KOTAKBANK",
        name: "Kotak Mahindra Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(13),
    },
    SecurityMetadata {
        isin: "INE733E01010",
        symbol: "NTPC",
        name: "NTPC Limited",
        sector: "Utilities",
        tier: MarketCapTier::Large,
        rank: Some(14),
    },
    SecurityMetadata {
        isin: "INE101A01026",
        symbol: "MM",
        name: "Mahindra & Mahindra Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: Some(15),
    },
    SecurityMetadata {
        isin: "INE585B01010",
        symbol: "MARUTI",
        name: "Maruti Suzuki India Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: Some(16),
    },
    SecurityMetadata {
        isin: "INE044A01036",
        symbol: "SUNPHARMA",
        name: "Sun Pharmaceutical Industries Limited",
        sector: "Healthcare",
        tier: MarketCapTier::Large,
        rank: Some(17),
    },
    SecurityMetadata {
        isin: "INE155A01022",
        symbol: "TATAMOTORS",
        name: "Tata Motors Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: Some(18),
    },
    SecurityMetadata {
        isin: "INE280A01028",
        symbol: "TITAN",
        name: "Titan Company Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: Some(19),
    },
    SecurityMetadata {
        isin: "INE752E01010",
        symbol: "POWERGRID",
        name: "Power Grid Corporation of India Limited",
        sector: "Utilities",
        tier: MarketCapTier::Large,
        rank: Some(20),
    },
    SecurityMetadata {
        isin: "INE423A01024",
        symbol: "ADANIENT",
        name: "Adani Enterprises Limited",
        sector: "Energy",
        tier: MarketCapTier::Large,
        rank: Some(21),
    },
    SecurityMetadata {
        isin: "INE742F01042",
        symbol: "ADANIPORTS",
        name: "Adani Ports and Special Economic Zone Limited",
        sector: "Industrials",
        tier: MarketCapTier::Large,
        rank: Some(22),
    },
    SecurityMetadata {
        isin: "INE522F01014",
        symbol: "COALINDIA",
        name: "Coal India Limited",
        sector: "Energy",
        tier: MarketCapTier::Large,
        rank: Some(23),
    },
    SecurityMetadata {
        isin: "INE081A01020",
        symbol: "TATASTEEL",
        name: "Tata Steel Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Large,
        rank: Some(24),
    },
    SecurityMetadata {
        isin: "INE918I01026",
        symbol: "BAJAJFINSV",
        name: "Bajaj Finserv Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(25),
    },
    SecurityMetadata {
        isin: "INE003A01024",
        symbol: "SIEMENS",
        name: "Siemens Limited",
        sector: "Industrials",
        tier: MarketCapTier::Large,
        rank: Some(26),
    },
    SecurityMetadata {
        isin: "INE038A01020",
        symbol: "HINDALCO",
        name: "Hindalco Industries Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Large,
        rank: Some(27),
    },
    SecurityMetadata {
        isin: "INE213A01029",
        symbol: "ONGC",
        name: "Oil & Natural Gas Corporation Limited",
        sector: "Energy",
        tier: MarketCapTier::Large,
        rank: Some(28),
    },
    SecurityMetadata {
        isin: "INE669C01036",
        symbol: "TECHM",
        name: "Tech Mahindra Limited",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: Some(29),
    },
    SecurityMetadata {
        isin: "INE019A01038",
        symbol: "JSWSTEEL",
        name: "JSW Steel Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Large,
        rank: Some(30),
    },
    SecurityMetadata {
        isin: "INE021A01026",
        symbol: "ASIANPAINT",
        name: "Asian Paints Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: Some(31),
    },
    SecurityMetadata {
        isin: "INE047A01021",
        symbol: "GRASIM",
        name: "Grasim Industries Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Large,
        rank: Some(32),
    },
    SecurityMetadata {
        isin: "INE066A01021",
        symbol: "EICHERMOT",
        name: "Eicher Motors Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: Some(33),
    },
    SecurityMetadata {
        isin: "INE059A01026",
        symbol: "CIPLA",
        name: "Cipla Limited",
        sector: "Healthcare",
        tier: MarketCapTier::Large,
        rank: Some(34),
    },
    SecurityMetadata {
        isin: "INE075A01023",
        symbol: "WIPRO",
        name: "Wipro Limited",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: Some(35),
    },
    SecurityMetadata {
        isin: "INE216A01030",
        symbol: "BRITANNIA",
        name: "Britannia Industries Limited",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Large,
        rank: Some(36),
    },
    SecurityMetadata {
        isin: "INE089A01023",
        symbol: "DRREDDY",
        name: "Dr. Reddy's Laboratories Limited",
        sector: "Healthcare",
        tier: MarketCapTier::Large,
        rank: Some(37),
    },
    SecurityMetadata {
        isin: "INE437A01024",
        symbol: "APOLLOHOSP",
        name: "Apollo Hospitals Enterprise Limited",
        sector: "Healthcare",
        tier: MarketCapTier::Large,
        rank: Some(38),
    },
    SecurityMetadata {
        isin: "INE239A01024",
        symbol: "NESTLEIND",
        name: "Nestle India Limited",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Large,
        rank: Some(39),
    },
    SecurityMetadata {
        isin: "INE848E01016",
        symbol: "TRENT",
        name: "Trent Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: Some(40),
    },
    SecurityMetadata {
        isin: "INE758T01015",
        symbol: "ZOMATO",
        name: "Zomato Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: Some(41),
    },
    SecurityMetadata {
        isin: "INE262H01013",
        symbol: "BEL",
        name: "Bharat Electronics Limited",
        sector: "Industrials",
        tier: MarketCapTier::Large,
        rank: Some(42),
    },
    SecurityMetadata {
        isin: "INE066F01012",
        symbol: "HAL",
        name: "Hindustan Aeronautics Limited",
        sector: "Industrials",
        tier: MarketCapTier::Large,
        rank: Some(43),
    },
    SecurityMetadata {
        isin: "INE121J01017",
        symbol: "DLF",
        name: "DLF Limited",
        sector: "Real Estate",
        tier: MarketCapTier::Large,
        rank: Some(44),
    },
    SecurityMetadata {
        isin: "INE787H01021",
        symbol: "VBL",
        name: "Varun Beverages Limited",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Large,
        rank: Some(45),
    },
    SecurityMetadata {
        isin: "INE123W01016",
        symbol: "JIOFIN",
        name: "Jio Financial Services Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(46),
    },
    SecurityMetadata {
        isin: "INE028A01039",
        symbol: "BANKBARODA",
        name: "Bank of Baroda",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(47),
    },
    SecurityMetadata {
        isin: "INE160A01022",
        symbol: "PUNJABNAT",
        name: "Punjab National Bank",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(48),
    },
    SecurityMetadata {
        isin: "INE134E01011",
        symbol: "PFC",
        name: "Power Finance Corporation Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(49),
    },
    SecurityMetadata {
        isin: "INE020B01018",
        symbol: "RECLTD",
        name: "REC Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(50),
    },
    SecurityMetadata {
        isin: "INE121A01024",
        symbol: "CHOLAFIN",
        name: "Cholamandalam Investment and Finance Company Ltd",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: Some(51),
    },
    SecurityMetadata {
        isin: "INE205A01025",
        symbol: "VEDL",
        name: "Vedanta Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Large,
        rank: Some(52),
    },
    SecurityMetadata {
        isin: "INE029A01011",
        symbol: "BPCL",
        name: "Bharat Petroleum Corporation Limited",
        sector: "Energy",
        tier: MarketCapTier::Large,
        rank: Some(53),
    },
    SecurityMetadata {
        isin: "INE129A01019",
        symbol: "GAIL",
        name: "GAIL (India) Limited",
        sector: "Energy",
        tier: MarketCapTier::Large,
        rank: Some(54),
    },
    SecurityMetadata {
        isin: "INE111A01025",
        symbol: "SHREECEM",
        name: "Shree Cement Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Large,
        rank: Some(55),
    },
    SecurityMetadata {
        isin: "INE079A01024",
        symbol: "AMBUJACEM",
        name: "Ambuja Cements Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Large,
        rank: Some(56),
    },
    SecurityMetadata {
        isin: "INE052A01013",
        symbol: "PIDILITIND",
        name: "Pidilite Industries Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Large,
        rank: Some(57),
    },
    SecurityMetadata {
        isin: "INE152A01029",
        symbol: "HAVELLS",
        name: "Havells India Limited",
        sector: "Industrials",
        tier: MarketCapTier::Large,
        rank: Some(58),
    },
    SecurityMetadata {
        isin: "INE647O01011",
        symbol: "ADANIGREEN",
        name: "Adani Green Energy Limited",
        sector: "Utilities",
        tier: MarketCapTier::Large,
        rank: Some(59),
    },
    SecurityMetadata {
        isin: "INE814H01011",
        symbol: "ADANIPOWER",
        name: "Adani Power Limited",
        sector: "Utilities",
        tier: MarketCapTier::Large,
        rank: Some(60),
    },
    // --- US / GLOBAL MEGA-CAPS (Large Cap benchmark constituents) ---
    SecurityMetadata {
        isin: "US5949181045",
        symbol: "MSFT",
        name: "Microsoft Corporation",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US0378331005",
        symbol: "AAPL",
        name: "Apple Inc.",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US02079K3059",
        symbol: "GOOGL",
        name: "Alphabet Inc. (Google)",
        sector: "Communication Services",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US0231351067",
        symbol: "AMZN",
        name: "Amazon.com Inc.",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US67066G1040",
        symbol: "NVDA",
        name: "NVIDIA Corporation",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US30303M1027",
        symbol: "META",
        name: "Meta Platforms Inc.",
        sector: "Communication Services",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US88160R1014",
        symbol: "TSLA",
        name: "Tesla Inc.",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US11135F1012",
        symbol: "AVGO",
        name: "Broadcom Inc.",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US64110L1061",
        symbol: "NFLX",
        name: "Netflix Inc.",
        sector: "Communication Services",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US0079031078",
        symbol: "AMD",
        name: "Advanced Micro Devices Inc.",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US7475251036",
        symbol: "QCOM",
        name: "Qualcomm Inc.",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US00724F1012",
        symbol: "ADBE",
        name: "Adobe Inc.",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US17275R1023",
        symbol: "CSCO",
        name: "Cisco Systems Inc.",
        sector: "Technology",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US0846707026",
        symbol: "BRKB",
        name: "Berkshire Hathaway Inc.",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US46625H1005",
        symbol: "JPM",
        name: "JPMorgan Chase & Co.",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US92826C8394",
        symbol: "V",
        name: "Visa Inc.",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US57636Q1040",
        symbol: "MA",
        name: "Mastercard Incorporated",
        sector: "Financial Services",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US5324571083",
        symbol: "LLY",
        name: "Eli Lilly and Company",
        sector: "Healthcare",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US91324P1021",
        symbol: "UNH",
        name: "UnitedHealth Group Incorporated",
        sector: "Healthcare",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US4781601046",
        symbol: "JNJ",
        name: "Johnson & Johnson",
        sector: "Healthcare",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US30231G1022",
        symbol: "XOM",
        name: "Exxon Mobil Corporation",
        sector: "Energy",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US1667641005",
        symbol: "CVX",
        name: "Chevron Corporation",
        sector: "Energy",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US9311421039",
        symbol: "WMT",
        name: "Walmart Inc.",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US22160K1051",
        symbol: "COST",
        name: "Costco Wholesale Corporation",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US7427181091",
        symbol: "PG",
        name: "Procter & Gamble Company",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US4370761029",
        symbol: "HD",
        name: "The Home Depot Inc.",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: None,
    },
    SecurityMetadata {
        isin: "US09857L1089",
        symbol: "BKNG",
        name: "Booking Holdings Inc.",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Large,
        rank: None,
    },
    // --- NIFTY MIDCAP 150 & MID CAP (101-250) ---
    SecurityMetadata {
        isin: "INE053A01029",
        symbol: "INDHOTEL",
        name: "The Indian Hotels Company Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Mid,
        rank: Some(101),
    },
    SecurityMetadata {
        isin: "INE027H01010",
        symbol: "MAXHEALTH",
        name: "Max Healthcare Institute Limited",
        sector: "Healthcare",
        tier: MarketCapTier::Mid,
        rank: Some(102),
    },
    SecurityMetadata {
        isin: "INE299U01018",
        symbol: "CUMMINSIND",
        name: "Cummins India Limited",
        sector: "Industrials",
        tier: MarketCapTier::Mid,
        rank: Some(103),
    },
    SecurityMetadata {
        isin: "INE171A01029",
        symbol: "FEDERALBNK",
        name: "Federal Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Mid,
        rank: Some(104),
    },
    SecurityMetadata {
        isin: "INE048A01026",
        symbol: "APARINDS",
        name: "Apar Industries Limited",
        sector: "Industrials",
        tier: MarketCapTier::Mid,
        rank: Some(105),
    },
    SecurityMetadata {
        isin: "INE974X01010",
        symbol: "TIINDIA",
        name: "Tube Investments of India Limited",
        sector: "Industrials",
        tier: MarketCapTier::Mid,
        rank: Some(106),
    },
    SecurityMetadata {
        isin: "INE214T01019",
        symbol: "ASHOKLEY",
        name: "Ashok Leyland Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Mid,
        rank: Some(107),
    },
    SecurityMetadata {
        isin: "INE455K01017",
        symbol: "POLYCAB",
        name: "Polycab India Limited",
        sector: "Industrials",
        tier: MarketCapTier::Mid,
        rank: Some(108),
    },
    SecurityMetadata {
        isin: "INE195A01028",
        symbol: "SUPREMEIND",
        name: "Supreme Industries Limited",
        sector: "Industrials",
        tier: MarketCapTier::Mid,
        rank: Some(109),
    },
    SecurityMetadata {
        isin: "INE591G01017",
        symbol: "COFORGE",
        name: "Coforge Limited",
        sector: "Technology",
        tier: MarketCapTier::Mid,
        rank: Some(110),
    },
    SecurityMetadata {
        isin: "INE356A01018",
        symbol: "MPHASIS",
        name: "Mphasis Limited",
        sector: "Technology",
        tier: MarketCapTier::Mid,
        rank: Some(111),
    },
    SecurityMetadata {
        isin: "INE262H01021",
        symbol: "PERSISTENT",
        name: "Persistent Systems Limited",
        sector: "Technology",
        tier: MarketCapTier::Mid,
        rank: Some(112),
    },
    SecurityMetadata {
        isin: "INE226A01021",
        symbol: "VOLTAS",
        name: "Voltas Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Mid,
        rank: Some(113),
    },
    SecurityMetadata {
        isin: "INE151A01013",
        symbol: "TATACOMM",
        name: "Tata Communications Limited",
        sector: "Communication Services",
        tier: MarketCapTier::Mid,
        rank: Some(114),
    },
    SecurityMetadata {
        isin: "INE797F01012",
        symbol: "JUBLFOOD",
        name: "Jubilant FoodWorks Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Mid,
        rank: Some(115),
    },
    SecurityMetadata {
        isin: "INE603J01030",
        symbol: "PIIND",
        name: "PI Industries Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Mid,
        rank: Some(116),
    },
    SecurityMetadata {
        isin: "INE006I01046",
        symbol: "ASTRAL",
        name: "Astral Limited",
        sector: "Industrials",
        tier: MarketCapTier::Mid,
        rank: Some(117),
    },
    SecurityMetadata {
        isin: "INE787D01026",
        symbol: "BALKRISIND",
        name: "Balkrishna Industries Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Mid,
        rank: Some(118),
    },
    SecurityMetadata {
        isin: "INE387A01021",
        symbol: "SUNDRMFAST",
        name: "Sundram Fasteners Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Mid,
        rank: Some(119),
    },
    SecurityMetadata {
        isin: "INE465A01025",
        symbol: "BHARATFORG",
        name: "Bharat Forge Limited",
        sector: "Industrials",
        tier: MarketCapTier::Mid,
        rank: Some(120),
    },
    SecurityMetadata {
        isin: "INE484J01027",
        symbol: "GODREJPROP",
        name: "Godrej Properties Limited",
        sector: "Real Estate",
        tier: MarketCapTier::Mid,
        rank: Some(121),
    },
    SecurityMetadata {
        isin: "INE540L01014",
        symbol: "ALKEM",
        name: "Alkem Laboratories Limited",
        sector: "Healthcare",
        tier: MarketCapTier::Mid,
        rank: Some(122),
    },
    SecurityMetadata {
        isin: "INE949L01017",
        symbol: "AUBANK",
        name: "AU Small Finance Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Mid,
        rank: Some(123),
    },
    SecurityMetadata {
        isin: "INE058A01010",
        symbol: "ESCORTS",
        name: "Escorts Kubota Limited",
        sector: "Industrials",
        tier: MarketCapTier::Mid,
        rank: Some(124),
    },
    SecurityMetadata {
        isin: "INE094A01015",
        symbol: "HINDZINC",
        name: "Hindustan Zinc Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Mid,
        rank: Some(125),
    },
    SecurityMetadata {
        isin: "INE115A01026",
        symbol: "IDFCFIRSTB",
        name: "IDFC First Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Mid,
        rank: Some(126),
    },
    // --- NIFTY SMALLCAP 250 & SMALL CAP (251+) ---
    SecurityMetadata {
        isin: "INE269A01021",
        symbol: "SONATSOFTW",
        name: "Sonata Software Limited",
        sector: "Technology",
        tier: MarketCapTier::Small,
        rank: Some(251),
    },
    SecurityMetadata {
        isin: "INE036D01028",
        symbol: "KVB",
        name: "Karur Vysya Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Small,
        rank: Some(252),
    },
    SecurityMetadata {
        isin: "INE482A01020",
        symbol: "CEATLTD",
        name: "CEAT Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Small,
        rank: Some(253),
    },
    SecurityMetadata {
        isin: "INE738I01010",
        symbol: "ECLERX",
        name: "eClerx Services Limited",
        sector: "Technology",
        tier: MarketCapTier::Small,
        rank: Some(254),
    },
    SecurityMetadata {
        isin: "INE04QT01022",
        symbol: "KPITTECH",
        name: "KPIT Technologies Limited",
        sector: "Technology",
        tier: MarketCapTier::Small,
        rank: Some(255),
    },
    SecurityMetadata {
        isin: "INE136B01020",
        symbol: "CYIENT",
        name: "Cyient Limited",
        sector: "Technology",
        tier: MarketCapTier::Small,
        rank: Some(256),
    },
    SecurityMetadata {
        isin: "INE944F01028",
        symbol: "RADICO",
        name: "Radico Khaitan Limited",
        sector: "Consumer Defensive",
        tier: MarketCapTier::Small,
        rank: Some(257),
    },
    SecurityMetadata {
        isin: "INE061Z01024",
        symbol: "EQUITASBNK",
        name: "Equitas Small Finance Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Small,
        rank: Some(258),
    },
    SecurityMetadata {
        isin: "INE334L01012",
        symbol: "UJJIVANSFB",
        name: "Ujjivan Small Finance Bank Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Small,
        rank: Some(259),
    },
    SecurityMetadata {
        isin: "INE101D01020",
        symbol: "GRANULES",
        name: "Granules India Limited",
        sector: "Healthcare",
        tier: MarketCapTier::Small,
        rank: Some(260),
    },
    SecurityMetadata {
        isin: "INE348B01021",
        symbol: "CENTURYPLY",
        name: "Century Plyboards (India) Limited",
        sector: "Basic Materials",
        tier: MarketCapTier::Small,
        rank: Some(261),
    },
    SecurityMetadata {
        isin: "INE836A01035",
        symbol: "BSOFT",
        name: "Birlasoft Limited",
        sector: "Technology",
        tier: MarketCapTier::Small,
        rank: Some(262),
    },
    SecurityMetadata {
        isin: "INE067A01029",
        symbol: "RAYMOND",
        name: "Raymond Limited",
        sector: "Consumer Cyclical",
        tier: MarketCapTier::Small,
        rank: Some(263),
    },
    SecurityMetadata {
        isin: "INE736A01011",
        symbol: "CDSL",
        name: "Central Depository Services (India) Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Small,
        rank: Some(264),
    },
    SecurityMetadata {
        isin: "INE922K01011",
        symbol: "ANGELONE",
        name: "Angel One Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Small,
        rank: Some(265),
    },
    SecurityMetadata {
        isin: "INE118H01025",
        symbol: "BSE",
        name: "BSE Limited",
        sector: "Financial Services",
        tier: MarketCapTier::Small,
        rank: Some(266),
    },
    SecurityMetadata {
        isin: "INE688I01017",
        symbol: "ROUTE",
        name: "Route Mobile Limited",
        sector: "Communication Services",
        tier: MarketCapTier::Small,
        rank: Some(267),
    },
    SecurityMetadata {
        isin: "INE021L01019",
        symbol: "HAPPIESTSTM",
        name: "Happiest Minds Technologies Limited",
        sector: "Technology",
        tier: MarketCapTier::Small,
        rank: Some(268),
    },
    SecurityMetadata {
        isin: "INE338I01027",
        symbol: "TANLA",
        name: "Tanla Platforms Limited",
        sector: "Technology",
        tier: MarketCapTier::Small,
        rank: Some(269),
    },
    SecurityMetadata {
        isin: "INE700A01033",
        symbol: "JBCHEPHARM",
        name: "J.B. Chemicals & Pharmaceuticals Limited",
        sector: "Healthcare",
        tier: MarketCapTier::Small,
        rank: Some(270),
    },
];

/// Normalizes a stock name or symbol for fuzzy matching.
///
/// Strips non-alphanumeric characters, converts to lowercase, and removes
/// corporate noise terms like "limited", "ltd", "corp", "inc".
fn normalize_identifier(s: &str) -> String {
    let lower = s.to_lowercase();
    let cleaned: String = lower
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { ' ' })
        .collect();

    cleaned
        .split_whitespace()
        .filter(|w| {
            !matches!(
                *w,
                "ltd" | "limited" | "inc" | "corp" | "corporation" | "co" | "the" | "india"
            )
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Resolves a security's economic sector and market capitalization tier
/// from the authoritative static Security Master catalog.
///
/// Priority order:
/// 1. Match by exact ISIN.
/// 2. Match by exact Ticker Symbol (case-insensitive).
/// 3. Match by canonical company name or normalized name tokens.
/// 4. Fallback: Returns `(None, MarketCapTier::Other)` if unmapped.
#[must_use]
pub fn resolve_security_classification(
    isin: Option<&str>,
    symbol: Option<&str>,
    name: &str,
) -> (Option<&'static str>, MarketCapTier) {
    // 1. ISIN match
    if let Some(i) = isin.filter(|s| !s.trim().is_empty()) {
        let isin_trimmed = i.trim();
        if let Some(meta) = SEBI_TOP_EQUITIES
            .iter()
            .find(|m| m.isin.eq_ignore_ascii_case(isin_trimmed))
        {
            return (Some(meta.sector), meta.tier);
        }
    }

    // 2. Symbol match
    if let Some(s) = symbol.filter(|s| !s.trim().is_empty()) {
        let sym_trimmed = s.trim();
        if let Some(meta) = SEBI_TOP_EQUITIES
            .iter()
            .find(|m| m.symbol.eq_ignore_ascii_case(sym_trimmed))
        {
            return (Some(meta.sector), meta.tier);
        }
    }

    // 3. Name match
    let trimmed_name = name.trim();
    if !trimmed_name.is_empty() {
        // Direct case-insensitive match
        if let Some(meta) = SEBI_TOP_EQUITIES
            .iter()
            .find(|m| m.name.eq_ignore_ascii_case(trimmed_name))
        {
            return (Some(meta.sector), meta.tier);
        }

        // Normalized token match with word boundaries
        let norm_input = normalize_identifier(trimmed_name);
        if !norm_input.is_empty() {
            let input_words: Vec<&str> = norm_input.split_whitespace().collect();

            // First pass: exact normalized full-name match
            for meta in SEBI_TOP_EQUITIES {
                let norm_meta = normalize_identifier(meta.name);
                if !norm_meta.is_empty() && norm_input == norm_meta {
                    return (Some(meta.sector), meta.tier);
                }
            }

            // Second pass: symbol match as an exact word in input
            for meta in SEBI_TOP_EQUITIES {
                if input_words
                    .iter()
                    .any(|w| w.eq_ignore_ascii_case(meta.symbol))
                {
                    return (Some(meta.sector), meta.tier);
                }
            }

            // Third pass: multi-word canonical name tokens all present in input
            for meta in SEBI_TOP_EQUITIES {
                let norm_meta = normalize_identifier(meta.name);
                let meta_words: Vec<&str> = norm_meta.split_whitespace().collect();
                if meta_words.len() >= 2 && meta_words.iter().all(|mw| input_words.contains(mw)) {
                    return (Some(meta.sector), meta.tier);
                }
                // Single-word canonical token: must match an exact whole word in input
                if meta_words.len() == 1
                    && meta_words[0].len() >= 4
                    && input_words.contains(&meta_words[0])
                {
                    return (Some(meta.sector), meta.tier);
                }
            }
        }
    }

    // 4. Fallback to unclassified
    (None, MarketCapTier::Other)
}

/// Convenience function returning the market cap tier for a stock.
#[must_use]
pub fn classify_stock_market_cap(
    isin: Option<&str>,
    symbol: Option<&str>,
    name: &str,
) -> MarketCapTier {
    let (_, tier) = resolve_security_classification(isin, symbol, name);
    tier
}

/// Convenience function returning the economic sector for a stock.
#[must_use]
pub fn classify_stock_sector(isin: Option<&str>, symbol: Option<&str>, name: &str) -> &'static str {
    let (sector, _) = resolve_security_classification(isin, symbol, name);
    sector.unwrap_or("Other")
}
