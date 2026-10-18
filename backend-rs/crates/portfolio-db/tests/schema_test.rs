use portfolio_db::schema::generate_ddl;

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
}
