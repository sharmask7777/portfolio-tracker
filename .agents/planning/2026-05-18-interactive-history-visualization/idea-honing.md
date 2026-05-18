# Idea Honing: Interactive History Visualization

This document tracks the requirements clarification for Phase 12.

## Decisions from Discussion Phase:
- **Time Range Selection**: Standard presets only (1M, 3M, 6M, 1Y, 3Y, 5Y, ALL). No custom date picker.
- **Chart Presentation**: Overlapping Areas with transparent fills. Recharts `AreaChart` standard.
- **Tooltip**: Comprehensive (Date, Current, Invested, Gain ₹, Gain %).
- **Performance**: Dynamic frontend sampling for long ranges.
