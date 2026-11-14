#![allow(missing_docs, clippy::unwrap_used, clippy::panic)]

use std::collections::{HashMap, HashSet};

use portfolio_db::schema::generate_ddl;

/// Parses tables and their column sets from the schema DDL.
fn parse_schema_tables(ddl: &str) -> HashMap<String, HashSet<String>> {
    let mut tables = HashMap::new();
    let mut remaining = ddl;

    while let Some(table_keyword_idx) = remaining.find("CREATE TABLE IF NOT EXISTS \"") {
        let after_keyword = &remaining[table_keyword_idx + "CREATE TABLE IF NOT EXISTS \"".len()..];
        let table_name_end = after_keyword.find('"').expect("table name closing quote");
        let table_name = &after_keyword[..table_name_end];

        let open_paren = after_keyword.find('(').expect("table opening parenthesis");
        let close_paren = after_keyword[open_paren..]
            .find("\n    );")
            .expect("table closing parenthesis");

        let body = &after_keyword[open_paren + 1..open_paren + close_paren];
        let mut columns = HashSet::new();

        for line in body.lines() {
            let trimmed = line.trim();
            if let Some(stripped) = trimmed.strip_prefix('"')
                && let Some(quote_end) = stripped.find('"')
            {
                let col_name = &stripped[..quote_end];
                columns.insert(col_name.to_string());
            }
        }

        tables.insert(table_name.to_string(), columns);
        remaining = &after_keyword[open_paren + close_paren + "\n    );".len()..];
    }

    tables
}

#[test]
fn test_schema_ddl_contains_all_core_tables() {
    let ddl = generate_ddl();
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"User\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"ManagedProfile\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"FamilyGroup\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"FamilyMember\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Portfolio\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Asset\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Folio\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Transaction\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"UploadJob\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"PortfolioHistory\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"HistoricalNAV\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Goal\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"_GoalAssets\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"FundHolding\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"StockMetadata\""));
    assert!(ddl.contains("CREATE TYPE \"AssetType\" AS ENUM"));
    assert!(ddl.contains("CREATE TYPE \"UploadJobStatus\" AS ENUM"));
}

#[test]
fn test_schema_tables_and_columns_parsed_correctly() {
    let ddl = generate_ddl();
    let tables = parse_schema_tables(ddl);

    assert!(tables.contains_key("User"));
    assert!(tables["User"].contains("id"));
    assert!(tables["User"].contains("email"));
    assert!(tables["User"].contains("createdAt"));
    assert!(tables["User"].contains("updatedAt"));

    assert!(tables.contains_key("PortfolioHistory"));
    assert!(tables["PortfolioHistory"].contains("id"));
    assert!(tables["PortfolioHistory"].contains("portfolioId"));
    assert!(tables["PortfolioHistory"].contains("date"));
    assert!(tables["PortfolioHistory"].contains("value"));
    assert!(tables["PortfolioHistory"].contains("investedAmount"));
    assert!(tables["PortfolioHistory"].contains("createdAt"));
    // Critically: PortfolioHistory MUST NOT have updatedAt
    assert!(!tables["PortfolioHistory"].contains("updatedAt"));

    assert!(tables.contains_key("StockMetadata"));
    assert!(tables["StockMetadata"].contains("isin"));
    assert!(tables["StockMetadata"].contains("symbol"));
    assert!(tables["StockMetadata"].contains("name"));
    assert!(tables["StockMetadata"].contains("sector"));
    assert!(tables["StockMetadata"].contains("marketCapTier"));
    assert!(tables["StockMetadata"].contains("createdAt"));
    assert!(tables["StockMetadata"].contains("updatedAt"));
}

#[test]
fn test_cas_ingest_sql_queries_strictly_match_schema() {
    let ddl = generate_ddl();
    let tables = parse_schema_tables(ddl);
    let cas_repo_src = include_str!("../src/repositories/cas_ingest_repo.rs");

    // Scan for INSERT INTO "TableName" (...)
    let mut search_cursor = cas_repo_src;
    while let Some(insert_idx) = search_cursor.find("INSERT INTO \"") {
        let after_insert = &search_cursor[insert_idx + "INSERT INTO \"".len()..];
        let table_end = after_insert.find('"').expect("closing quote on table name");
        let table_name = &after_insert[..table_end];

        assert!(
            tables.contains_key(table_name),
            "Target table '{table_name}' in INSERT query does not exist in schema!"
        );
        let valid_columns = &tables[table_name];

        let open_paren = after_insert
            .find('(')
            .expect("opening paren for column list");
        let close_paren = after_insert[open_paren..]
            .find(')')
            .expect("closing paren for column list");
        let cols_str = &after_insert[open_paren + 1..open_paren + close_paren];

        for col_raw in cols_str.split(',') {
            let col = col_raw.trim().trim_matches('"');
            assert!(
                valid_columns.contains(col),
                "Column '{col}' in INSERT INTO \"{table_name}\" does NOT exist in schema! Valid columns: {valid_columns:?}"
            );
        }

        // Check if there is an ON CONFLICT (...) DO UPDATE SET ...
        let lookahead_len = std::cmp::min(after_insert.len(), open_paren + close_paren + 300);
        let lookahead = &after_insert[..lookahead_len];
        if let Some(on_conflict_idx) = lookahead.find("DO UPDATE") {
            let after_do_update = &lookahead[on_conflict_idx + "DO UPDATE".len()..];
            if let Some(set_idx) = after_do_update.find("SET") {
                let after_set = &after_do_update[set_idx + "SET".len()..];
                let clause_end = after_set.find(';').unwrap_or(after_set.len());
                let set_clause = &after_set[..clause_end];
                for assignment in set_clause.split(',') {
                    if let Some(eq_idx) = assignment.find('=') {
                        let target_col = assignment[..eq_idx].trim().trim_matches('"');
                        assert!(
                            valid_columns.contains(target_col),
                            "Column '{target_col}' in ON CONFLICT DO UPDATE SET for \"{table_name}\" does NOT exist in schema! Valid columns: {valid_columns:?}"
                        );
                    }
                }
            }
        }

        search_cursor = &after_insert[open_paren + close_paren..];
    }
}
