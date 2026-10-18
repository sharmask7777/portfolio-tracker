//! Core financial data types, identifiers, and models.

use std::fmt::{self, Display, Formatter};
use std::ops::{Add, AddAssign, Deref, Div, Mul, Neg, Sub, SubAssign};
use std::str::FromStr;

use rust_decimal::{Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};

use crate::error::PortfolioError;

/// Money represents a monetary amount rounded to 2 decimal places (standard currency cents/paise).
/// Prevents floating-point precision loss.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct Money(pub Decimal);

impl Money {
    pub const PRECISION: u32 = 2;
    pub const ZERO: Money = Money(Decimal::ZERO);

    /// Creates a new `Money` instance rounded to 2 decimal places using Banker's rounding (`MidpointNearestEven`).
    pub fn new(amount: Decimal) -> Self {
        Self(amount.round_dp_with_strategy(Self::PRECISION, RoundingStrategy::MidpointNearestEven))
    }

    pub fn zero() -> Self {
        Self::ZERO
    }

    pub fn as_decimal(&self) -> Decimal {
        self.0
    }

    pub fn is_zero(&self) -> bool {
        self.0.is_zero()
    }

    pub fn is_positive(&self) -> bool {
        self.0.is_sign_positive() && !self.0.is_zero()
    }

    pub fn is_negative(&self) -> bool {
        self.0.is_sign_negative()
    }

    pub fn abs(&self) -> Self {
        Self(self.0.abs())
    }
}

impl Deref for Money {
    type Target = Decimal;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for Money {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{:.2}", self.0)
    }
}

impl FromStr for Money {
    type Err = PortfolioError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Decimal::from_str(s.trim())
            .map(Money::new)
            .map_err(|e| PortfolioError::ParseError(e.to_string()))
    }
}

impl From<Decimal> for Money {
    fn from(d: Decimal) -> Self {
        Money::new(d)
    }
}

impl From<Money> for Decimal {
    fn from(m: Money) -> Self {
        m.0
    }
}

impl Add for Money {
    type Output = Money;
    fn add(self, rhs: Self) -> Money {
        Money::new(self.0 + rhs.0)
    }
}

impl Add<&Money> for Money {
    type Output = Money;
    fn add(self, rhs: &Money) -> Money {
        Money::new(self.0 + rhs.0)
    }
}

impl Add<Money> for &Money {
    type Output = Money;
    fn add(self, rhs: Money) -> Money {
        Money::new(self.0 + rhs.0)
    }
}

impl Add<&Money> for &Money {
    type Output = Money;
    fn add(self, rhs: &Money) -> Money {
        Money::new(self.0 + rhs.0)
    }
}

impl AddAssign for Money {
    fn add_assign(&mut self, rhs: Self) {
        *self = *self + rhs;
    }
}

impl Sub for Money {
    type Output = Money;
    fn sub(self, rhs: Self) -> Money {
        Money::new(self.0 - rhs.0)
    }
}

impl Sub<&Money> for Money {
    type Output = Money;
    fn sub(self, rhs: &Money) -> Money {
        Money::new(self.0 - rhs.0)
    }
}

impl Sub<Money> for &Money {
    type Output = Money;
    fn sub(self, rhs: Money) -> Money {
        Money::new(self.0 - rhs.0)
    }
}

impl Sub<&Money> for &Money {
    type Output = Money;
    fn sub(self, rhs: &Money) -> Money {
        Money::new(self.0 - rhs.0)
    }
}

impl SubAssign for Money {
    fn sub_assign(&mut self, rhs: Self) {
        *self = *self - rhs;
    }
}

impl Neg for Money {
    type Output = Money;
    fn neg(self) -> Money {
        Money::new(-self.0)
    }
}

impl Mul<Percentage> for Money {
    type Output = Money;
    fn mul(self, rhs: Percentage) -> Money {
        Money::new(self.0 * rhs.as_fraction())
    }
}

impl Mul<&Percentage> for Money {
    type Output = Money;
    fn mul(self, rhs: &Percentage) -> Money {
        Money::new(self.0 * rhs.as_fraction())
    }
}

impl Mul<Decimal> for Money {
    type Output = Money;
    fn mul(self, rhs: Decimal) -> Money {
        Money::new(self.0 * rhs)
    }
}

impl Div<Decimal> for Money {
    type Output = Money;
    fn div(self, rhs: Decimal) -> Money {
        Money::new(self.0 / rhs)
    }
}

impl Div<Units> for Money {
    type Output = Nav;
    fn div(self, rhs: Units) -> Nav {
        Nav::new(self.0 / rhs.0)
    }
}

impl Div<Money> for Money {
    type Output = Decimal;
    fn div(self, rhs: Money) -> Decimal {
        self.0 / rhs.0
    }
}

impl std::iter::Sum for Money {
    fn sum<I: Iterator<Item = Self>>(iter: I) -> Self {
        iter.fold(Money::ZERO, |acc, m| acc + m)
    }
}

impl<'a> std::iter::Sum<&'a Money> for Money {
    fn sum<I: Iterator<Item = &'a Self>>(iter: I) -> Self {
        iter.fold(Money::ZERO, |acc, m| acc + *m)
    }
}

/// Units represents mutual fund or stock share count rounded to 4 decimal places.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct Units(pub Decimal);

impl Units {
    pub const PRECISION: u32 = 4;
    pub const ZERO: Units = Units(Decimal::ZERO);

    /// Creates a new `Units` instance rounded to 4 decimal places using Banker's rounding (`MidpointNearestEven`).
    pub fn new(amount: Decimal) -> Self {
        Self(amount.round_dp_with_strategy(Self::PRECISION, RoundingStrategy::MidpointNearestEven))
    }

    pub fn zero() -> Self {
        Self::ZERO
    }

    pub fn as_decimal(&self) -> Decimal {
        self.0
    }

    pub fn is_zero(&self) -> bool {
        self.0.is_zero()
    }

    pub fn is_positive(&self) -> bool {
        self.0.is_sign_positive() && !self.0.is_zero()
    }

    pub fn is_negative(&self) -> bool {
        self.0.is_sign_negative()
    }

    pub fn abs(&self) -> Self {
        Self(self.0.abs())
    }
}

impl Deref for Units {
    type Target = Decimal;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for Units {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{:.4}", self.0)
    }
}

impl FromStr for Units {
    type Err = PortfolioError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Decimal::from_str(s.trim())
            .map(Units::new)
            .map_err(|e| PortfolioError::ParseError(e.to_string()))
    }
}

impl From<Decimal> for Units {
    fn from(d: Decimal) -> Self {
        Units::new(d)
    }
}

impl From<Units> for Decimal {
    fn from(u: Units) -> Self {
        u.0
    }
}

impl Add for Units {
    type Output = Units;
    fn add(self, rhs: Self) -> Units {
        Units::new(self.0 + rhs.0)
    }
}

impl Add<&Units> for Units {
    type Output = Units;
    fn add(self, rhs: &Units) -> Units {
        Units::new(self.0 + rhs.0)
    }
}

impl Add<Units> for &Units {
    type Output = Units;
    fn add(self, rhs: Units) -> Units {
        Units::new(self.0 + rhs.0)
    }
}

impl Add<&Units> for &Units {
    type Output = Units;
    fn add(self, rhs: &Units) -> Units {
        Units::new(self.0 + rhs.0)
    }
}

impl AddAssign for Units {
    fn add_assign(&mut self, rhs: Self) {
        *self = *self + rhs;
    }
}

impl Sub for Units {
    type Output = Units;
    fn sub(self, rhs: Self) -> Units {
        Units::new(self.0 - rhs.0)
    }
}

impl Sub<&Units> for Units {
    type Output = Units;
    fn sub(self, rhs: &Units) -> Units {
        Units::new(self.0 - rhs.0)
    }
}

impl Sub<Units> for &Units {
    type Output = Units;
    fn sub(self, rhs: Units) -> Units {
        Units::new(self.0 - rhs.0)
    }
}

impl Sub<&Units> for &Units {
    type Output = Units;
    fn sub(self, rhs: &Units) -> Units {
        Units::new(self.0 - rhs.0)
    }
}

impl SubAssign for Units {
    fn sub_assign(&mut self, rhs: Self) {
        *self = *self - rhs;
    }
}

impl Neg for Units {
    type Output = Units;
    fn neg(self) -> Units {
        Units::new(-self.0)
    }
}

impl Mul<Nav> for Units {
    type Output = Money;
    fn mul(self, rhs: Nav) -> Money {
        Money::new(self.0 * rhs.0)
    }
}

impl Mul<&Nav> for Units {
    type Output = Money;
    fn mul(self, rhs: &Nav) -> Money {
        Money::new(self.0 * rhs.0)
    }
}

impl Mul<Nav> for &Units {
    type Output = Money;
    fn mul(self, rhs: Nav) -> Money {
        Money::new(self.0 * rhs.0)
    }
}

impl Mul<&Nav> for &Units {
    type Output = Money;
    fn mul(self, rhs: &Nav) -> Money {
        Money::new(self.0 * rhs.0)
    }
}

impl Mul<Decimal> for Units {
    type Output = Units;
    fn mul(self, rhs: Decimal) -> Units {
        Units::new(self.0 * rhs)
    }
}

impl Div<Decimal> for Units {
    type Output = Units;
    fn div(self, rhs: Decimal) -> Units {
        Units::new(self.0 / rhs)
    }
}

impl std::iter::Sum for Units {
    fn sum<I: Iterator<Item = Self>>(iter: I) -> Self {
        iter.fold(Units::ZERO, |acc, u| acc + u)
    }
}

impl<'a> std::iter::Sum<&'a Units> for Units {
    fn sum<I: Iterator<Item = &'a Self>>(iter: I) -> Self {
        iter.fold(Units::ZERO, |acc, u| acc + *u)
    }
}

/// Nav represents the Net Asset Value per unit rounded to 4 decimal places.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct Nav(pub Decimal);

impl Nav {
    pub const PRECISION: u32 = 4;
    pub const ZERO: Nav = Nav(Decimal::ZERO);

    /// Creates a new `Nav` instance rounded to 4 decimal places using Banker's rounding (`MidpointNearestEven`).
    pub fn new(val: Decimal) -> Self {
        Self(val.round_dp_with_strategy(Self::PRECISION, RoundingStrategy::MidpointNearestEven))
    }

    pub fn zero() -> Self {
        Self::ZERO
    }

    pub fn as_decimal(&self) -> Decimal {
        self.0
    }
}

impl Deref for Nav {
    type Target = Decimal;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for Nav {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{:.4}", self.0)
    }
}

impl FromStr for Nav {
    type Err = PortfolioError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Decimal::from_str(s.trim())
            .map(Nav::new)
            .map_err(|e| PortfolioError::ParseError(e.to_string()))
    }
}

impl From<Decimal> for Nav {
    fn from(d: Decimal) -> Self {
        Nav::new(d)
    }
}

impl From<Nav> for Decimal {
    fn from(n: Nav) -> Self {
        n.0
    }
}

impl Mul<Units> for Nav {
    type Output = Money;
    fn mul(self, rhs: Units) -> Money {
        Money::new(self.0 * rhs.0)
    }
}

impl Mul<&Units> for Nav {
    type Output = Money;
    fn mul(self, rhs: &Units) -> Money {
        Money::new(self.0 * rhs.0)
    }
}

impl Mul<Units> for &Nav {
    type Output = Money;
    fn mul(self, rhs: Units) -> Money {
        Money::new(self.0 * rhs.0)
    }
}

impl Mul<&Units> for &Nav {
    type Output = Money;
    fn mul(self, rhs: &Units) -> Money {
        Money::new(self.0 * rhs.0)
    }
}

/// Percentage represents a percentage value (e.g. 15.5 for 15.5%).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, Default)]
#[serde(transparent)]
pub struct Percentage(pub Decimal);

impl Percentage {
    pub const ZERO: Percentage = Percentage(Decimal::ZERO);

    pub fn from_percentage(pct: Decimal) -> Self {
        Self(pct)
    }

    pub fn from_fraction(fraction: Decimal) -> Self {
        Self(fraction * Decimal::from(100))
    }

    pub fn from_ratio(numerator: Decimal, denominator: Decimal) -> Result<Self, PortfolioError> {
        if denominator.is_zero() {
            return Err(PortfolioError::DivisionByZero);
        }
        Ok(Self((numerator / denominator) * Decimal::from(100)))
    }

    pub fn as_percentage(&self) -> Decimal {
        self.0
    }

    pub fn as_fraction(&self) -> Decimal {
        self.0 / Decimal::from(100)
    }
}

impl Deref for Percentage {
    type Target = Decimal;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for Percentage {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}%", self.0)
    }
}

impl FromStr for Percentage {
    type Err = PortfolioError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let trimmed = s.trim();
        let cleaned = trimmed.strip_suffix('%').unwrap_or(trimmed).trim();
        Decimal::from_str(cleaned)
            .map(Percentage::from_percentage)
            .map_err(|e| PortfolioError::ParseError(e.to_string()))
    }
}

/// Strongly-typed Permanent Account Number (PAN) with Indian ITD validation.
/// Format: exactly 10 characters `^[A-Z]{5}[0-9]{4}[A-Z]$`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Pan(String);

impl Pan {
    pub fn new(s: impl AsRef<str>) -> Result<Self, PortfolioError> {
        let input = s.as_ref();
        let raw = input.trim();
        if raw.len() != 10 {
            return Err(PortfolioError::InvalidPan(input.to_string()));
        }

        let bytes = raw.as_bytes();
        // First 5 characters: ASCII uppercase letters [A-Z]
        for &b in &bytes[0..5] {
            if !b.is_ascii_uppercase() {
                return Err(PortfolioError::InvalidPan(input.to_string()));
            }
        }
        // Next 4 characters: ASCII digits [0-9]
        for &b in &bytes[5..9] {
            if !b.is_ascii_digit() {
                return Err(PortfolioError::InvalidPan(input.to_string()));
            }
        }
        // Last 1 character: ASCII uppercase letter [A-Z]
        if !bytes[9].is_ascii_uppercase() {
            return Err(PortfolioError::InvalidPan(input.to_string()));
        }

        Ok(Self(raw.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Deref for Pan {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for Pan {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for Pan {
    type Err = PortfolioError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::new(s)
    }
}

impl Serialize for Pan {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for Pan {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Self::new(&s).map_err(serde::de::Error::custom)
    }
}

/// Strongly-typed mutual fund or brokerage folio number.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct FolioNumber(String);

impl FolioNumber {
    pub fn new(s: impl AsRef<str>) -> Result<Self, PortfolioError> {
        let input = s.as_ref();
        let raw = input.trim();
        if raw.is_empty() {
            return Err(PortfolioError::InvalidFolio(input.to_string()));
        }

        // Must be ASCII printable without control chars or angle brackets
        for c in raw.chars() {
            if !c.is_ascii() || c.is_ascii_control() || c == '<' || c == '>' || c == '\0' {
                return Err(PortfolioError::InvalidFolio(input.to_string()));
            }
        }

        Ok(Self(raw.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Deref for FolioNumber {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for FolioNumber {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for FolioNumber {
    type Err = PortfolioError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::new(s)
    }
}

impl Serialize for FolioNumber {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for FolioNumber {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Self::new(&s).map_err(serde::de::Error::custom)
    }
}

/// Strongly-typed International Securities Identification Number (ISIN).
/// Format: exactly 12 characters `^[A-Z]{2}[A-Z0-9]{10}$`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Isin(String);

impl Isin {
    pub fn new(s: impl AsRef<str>) -> Result<Self, PortfolioError> {
        let input = s.as_ref();
        let raw = input.trim();
        if raw.len() != 12 {
            return Err(PortfolioError::InvalidIsin(input.to_string()));
        }

        let bytes = raw.as_bytes();
        // First 2 characters: uppercase ASCII letters (country code)
        if !bytes[0].is_ascii_uppercase() || !bytes[1].is_ascii_uppercase() {
            return Err(PortfolioError::InvalidIsin(input.to_string()));
        }

        // Remaining 10 characters: uppercase ASCII alphanumeric
        for &b in &bytes[2..12] {
            if !b.is_ascii_uppercase() && !b.is_ascii_digit() {
                return Err(PortfolioError::InvalidIsin(input.to_string()));
            }
        }

        Ok(Self(raw.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    pub fn country_code(&self) -> &str {
        &self.0[0..2]
    }
}

impl Deref for Isin {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl Display for Isin {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for Isin {
    type Err = PortfolioError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::new(s)
    }
}

impl Serialize for Isin {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.0)
    }
}

impl<'de> Deserialize<'de> for Isin {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        let s = String::deserialize(deserializer)?;
        Self::new(&s).map_err(serde::de::Error::custom)
    }
}

/// Asset types supported in portfolio tracker matching PostgreSQL enum `AssetType`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AssetType {
    MutualFund,
    Stock,
    FixedDeposit,
    Epf,
    Ppf,
    Sgb,
    PhysicalGold,
}

impl AssetType {
    pub fn is_equity(&self) -> bool {
        matches!(self, AssetType::Stock)
    }

    pub fn is_alternative(&self) -> bool {
        matches!(
            self,
            AssetType::Epf | AssetType::Ppf | AssetType::Sgb | AssetType::PhysicalGold
        )
    }

    pub fn is_gold(&self) -> bool {
        matches!(self, AssetType::Sgb | AssetType::PhysicalGold)
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            AssetType::MutualFund => "MUTUAL_FUND",
            AssetType::Stock => "STOCK",
            AssetType::FixedDeposit => "FIXED_DEPOSIT",
            AssetType::Epf => "EPF",
            AssetType::Ppf => "PPF",
            AssetType::Sgb => "SGB",
            AssetType::PhysicalGold => "PHYSICAL_GOLD",
        }
    }
}

impl Display for AssetType {
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for AssetType {
    type Err = PortfolioError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let clean = s.trim().to_uppercase();
        match clean.as_str() {
            "MUTUAL_FUND" | "MUTUALFUND" => Ok(AssetType::MutualFund),
            "STOCK" => Ok(AssetType::Stock),
            "FIXED_DEPOSIT" | "FIXEDDEPOSIT" | "FD" => Ok(AssetType::FixedDeposit),
            "EPF" => Ok(AssetType::Epf),
            "PPF" => Ok(AssetType::Ppf),
            "SGB" => Ok(AssetType::Sgb),
            "PHYSICAL_GOLD" | "PHYSICALGOLD" | "GOLD" => Ok(AssetType::PhysicalGold),
            _ => Err(PortfolioError::ParseError(format!("Unknown asset type: {s}"))),
        }
    }
}
