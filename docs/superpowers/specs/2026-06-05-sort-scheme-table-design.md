# Spec: Ability to Sort Scheme Table by Columns

## Goal Description
Add the ability to sort the Scheme Breakdown table in the overview dashboard by its columns, focusing on performance columns (XIRR, post-tax XIRR) as well as all other data columns.

## User Requirements
- Sort by all data columns: Scheme Name, Type, Invested, Current Value, Day Change, XIRR/Return, and Post-Tax XIRR/Return.
- The interaction pattern should cycle through: `Unsorted` ➔ `Descending (↓)` ➔ `Ascending (↑)`.
- Clicking a new header starts in the `Descending (desc)` order since high values are usually of most interest.
- On dashboard initialization, the table should be sorted by **Current Value (Descending)** by default.

## Proposed Design (Approach 1: Client-Side Sorting)

### 1. State Variables
We introduce two React state hooks in `Dashboard`:
```tsx
const [sortField, setSortField] = useState<'name' | 'type' | 'invested' | 'value' | 'dayChange' | 'performance' | 'postTaxPerformance' | null>('value');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('desc');
```

### 2. Interaction Handlers
A click on a table header calls `handleSort(field)`:
- If the clicked field is different from `sortField`, change the field and set direction to `desc`.
- If the clicked field is the same, cycle: `desc` ➔ `asc` ➔ `null`.

### 3. Sorting Execution
Before rendering, map folios through a sorting helper that performs ascending/descending comparisons depending on `sortField` and `sortDirection`. When `sortDirection` is `null`, fallback to the raw order returned by the API.

### 4. UI Indicators
Table headers will display a Lucide icon indicating the sort state:
- sorted ascending: `ArrowUp`
- sorted descending: `ArrowDown`
- unsorted: `ArrowUpDown` (rendered with low opacity)
Cursor pointers and interactive hover states will be applied to the headers to make them discoverable.

## Verification Plan
1. **Manual Verification**:
   - Verify initial load is sorted by Current Value descending.
   - Click each column header and verify cycling behavior (Desc ➔ Asc ➔ Unsorted).
   - Ensure performance sorting handles different `performanceMode` values (`XIRR` vs `ABS`) correctly.
2. **Automated Tests**:
   - Verify no typescript or build errors are introduced.
