import { StyleSheet } from 'react-native';

/**
 * Standard inflation presets for reality check scenarios.
 */
export const INFLATION_PRESETS = [
  { label: 'RBI 4%', value: 0.04 },
  { label: 'Baseline 6%', value: 0.06 },
  { label: 'Conservative 8%', value: 0.08 },
  { label: 'Stress 10%', value: 0.10 },
];

/**
 * Statutory tax presets matching Indian capital gains regimes and slabs.
 */
export const TAX_PRESETS = [
  { label: '0% Nil', value: 0.0 },
  { label: '10% LTCG', value: 0.10 },
  { label: '12.5% Sec 112A', value: 0.125 },
  { label: '15% Blended', value: 0.15 },
  { label: '20% Sec 111A', value: 0.20 },
  { label: '30% Slab', value: 0.30 },
];

/**
 * Compounding horizon presets in years.
 */
export const HORIZON_PRESETS = [
  { label: '1 Year', value: 1 },
  { label: '3 Years', value: 3 },
  { label: '5 Years', value: 5 },
  { label: '10 Years', value: 10 },
];

/**
 * Modal styles for assumptions configuration dialog.
 */
export const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: '#27272a',
    padding: 20,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f4f4f5',
    marginLeft: 8,
  },
  closeBtn: {
    padding: 6,
  },
  closeText: {
    fontSize: 18,
    color: '#a1a1aa',
    fontWeight: '600',
  },
  descriptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 12,
    color: '#a1a1aa',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f4f4f5',
  },
  sectionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flex: 1,
    minWidth: 90,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: '#f59e0b',
  },
  chipText: {
    fontSize: 12,
    color: '#a1a1aa',
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  applyButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090b',
  },
});
