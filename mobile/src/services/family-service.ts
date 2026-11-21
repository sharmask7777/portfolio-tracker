import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabaseInstance, initDatabase } from '../db/client';
import { getAllFolios } from '../db/repository';
import type { FolioEntity } from '../db/schema';
export type { FolioEntity };
import {
  buildAssetAllocation,
  type AssetAllocationItem,
  type EnrichedHolding,
} from './portfolio-calculations';

export const SECURE_STORE_FAMILY_PROFILES_KEY = 'PORTFOLIO_FAMILY_PROFILES';
export const SECURE_STORE_ACTIVE_PROFILE_KEY = 'PORTFOLIO_ACTIVE_PROFILE_ID';

export type FamilyRelationship =
  | 'Self'
  | 'Spouse'
  | 'Parent'
  | 'Child'
  | 'Sibling'
  | 'Other';

export interface FamilyProfile {
  id: string;
  name: string;
  pan: string;
  relationship: FamilyRelationship | string;
  isPrimary: boolean;
  notes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyMemberMetrics {
  id?: string | undefined;
  name: string;
  relationship: string;
  pan?: string | undefined;
  totalInvested: number;
  currentValue: number;
  totalGain: number;
  totalGainPct: number;
  holdingsCount: number;
  allocationBreakdown: AssetAllocationItem[];
}

export interface PanValidationResult {
  isValid: boolean;
  error?: string | undefined;
}

export interface CreateProfileInput {
  name: string;
  pan: string;
  relationship: FamilyRelationship | string;
  notes?: string | undefined;
}

const PAN_REGEX = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/;

export const DEFAULT_PRIMARY_PROFILE: FamilyProfile = {
  id: 'prof-primary-self',
  name: 'Primary Investor',
  pan: 'ABCDE1234F',
  relationship: 'Self',
  isPrimary: true,
  notes: 'Primary account profile',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

/**
 * Validates whether a given PAN conforms to the synthetic statutory PAN format.
 *
 * @param pan - The Permanent Account Number string to validate
 * @returns Object indicating validity and optional error message
 */
export function validateSyntheticPan(pan: string): PanValidationResult {
  const trimmed = pan.trim();
  if (!trimmed) {
    return { isValid: false, error: 'PAN cannot be empty' };
  }
  if (!PAN_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid PAN format. Must be 5 letters, 4 numbers, and 1 letter (e.g. ABCDE1234F)',
    };
  }
  return { isValid: true };
}

/**
 * Filters holdings to only those belonging to folios linked to a given family profile.
 *
 * @param profile - Target profile or null for all holdings
 * @param holdings - List of enriched holdings
 * @param folios - List of folios with PAN associations
 * @returns Filtered holdings matching profile PAN
 */
export function filterHoldingsForProfile(
  profile: FamilyProfile | null,
  holdings: EnrichedHolding[],
  folios: FolioEntity[],
): EnrichedHolding[] {
  if (!profile) {
    return holdings;
  }
  const panNorm = profile.pan.toUpperCase().trim();
  const matchingFolios = folios.filter((f) => f.pan.toUpperCase().trim() === panNorm);
  const folioNumbers = new Set(matchingFolios.map((f) => f.folio_number));
  return holdings.filter((h) => folioNumbers.has(h.folio_number));
}

/**
 * Calculates financial metrics for a family profile or consolidated family.
 *
 * @param profile - Target family member profile, or null for consolidated
 * @param holdings - List of enriched portfolio holdings
 * @param folios - List of folios with PAN associations
 * @returns Computed metrics including invested cost, current value, and allocation
 */
export function calculateMemberMetrics(
  profile: FamilyProfile | null,
  holdings: EnrichedHolding[],
  folios: FolioEntity[],
): FamilyMemberMetrics {
  const matching = filterHoldingsForProfile(profile, holdings, folios);
  const isConsolidated = profile === null;

  if (matching.length === 0) {
    return {
      ...(profile ? { id: profile.id, pan: profile.pan } : {}),
      name: isConsolidated ? 'All Family Members' : profile.name,
      relationship: isConsolidated ? 'Consolidated' : profile.relationship,
      totalInvested: 0,
      currentValue: 0,
      totalGain: 0,
      totalGainPct: 0,
      holdingsCount: 0,
      allocationBreakdown: [],
    };
  }

  const totalInvested = matching.reduce((acc, h) => acc + h.invested_cost, 0);
  const currentValue = matching.reduce((acc, h) => acc + h.current_value, 0);
  const totalGain = currentValue - totalInvested;
  const totalGainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  return {
    ...(profile ? { id: profile.id, pan: profile.pan } : {}),
    name: isConsolidated ? 'All Family Members' : profile.name,
    relationship: isConsolidated ? 'Consolidated' : profile.relationship,
    totalInvested: Math.round(totalInvested * 100) / 100,
    currentValue: Math.round(currentValue * 100) / 100,
    totalGain: Math.round(totalGain * 100) / 100,
    totalGainPct,
    holdingsCount: matching.length,
    allocationBreakdown: buildAssetAllocation(matching, currentValue),
  };
}

async function resolveDb(db?: SQLiteDatabase): Promise<SQLiteDatabase> {
  if (db) return db;
  const existing = getDatabaseInstance();
  if (existing) return existing;
  return initDatabase();
}

/**
 * Loads stored folios from local SQLite database.
 *
 * @param db - Optional SQLite database handle
 * @returns Array of folios with PAN associations
 */
export async function getStoredFolios(db?: SQLiteDatabase): Promise<FolioEntity[]> {
  try {
    const targetDb = await resolveDb(db);
    return await getAllFolios(targetDb);
  } catch {
    return [];
  }
}

/**
 * Retrieves the stored list of family member profiles.
 *
 * @returns Array of family profiles
 */
export async function getStoredFamilyProfiles(): Promise<FamilyProfile[]> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_STORE_FAMILY_PROFILES_KEY);
    if (!raw) {
      return [DEFAULT_PRIMARY_PROFILE];
    }
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as FamilyProfile[];
    }
    return [DEFAULT_PRIMARY_PROFILE];
  } catch {
    return [DEFAULT_PRIMARY_PROFILE];
  }
}

/**
 * Persists family profiles to hardware secure storage.
 *
 * @param profiles - Array of profiles to store
 */
export async function saveFamilyProfiles(profiles: FamilyProfile[]): Promise<void> {
  await SecureStore.setItemAsync(
    SECURE_STORE_FAMILY_PROFILES_KEY,
    JSON.stringify(profiles),
  );
}

/**
 * Gets currently active profile ID (null signifies consolidated view).
 *
 * @returns Active profile ID or null
 */
export async function getActiveProfileId(): Promise<string | null> {
  try {
    const id = await SecureStore.getItemAsync(SECURE_STORE_ACTIVE_PROFILE_KEY);
    return id && id !== 'ALL' ? id : null;
  } catch {
    return null;
  }
}

/**
 * Sets active profile ID for app-wide filtering (null signifies consolidated).
 *
 * @param profileId - Profile ID to activate or null for consolidated
 */
export async function setActiveProfileId(profileId: string | null): Promise<void> {
  if (!profileId) {
    await SecureStore.deleteItemAsync(SECURE_STORE_ACTIVE_PROFILE_KEY);
  } else {
    await SecureStore.setItemAsync(SECURE_STORE_ACTIVE_PROFILE_KEY, profileId);
  }
}

/**
 * Adds a new family profile after validating PAN format.
 *
 * @param input - Member details to add
 * @returns Created profile
 */
export async function addFamilyProfile(input: CreateProfileInput): Promise<FamilyProfile> {
  const validation = validateSyntheticPan(input.pan);
  if (!validation.isValid) {
    throw new Error(validation.error ?? 'Invalid PAN');
  }

  const existing = await getStoredFamilyProfiles();
  const now = new Date().toISOString();
  const newProfile: FamilyProfile = {
    id: `prof-${Date.now()}`,
    name: input.name.trim(),
    pan: input.pan.trim().toUpperCase(),
    relationship: input.relationship,
    isPrimary: existing.length === 0,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [...existing, newProfile];
  await saveFamilyProfiles(updated);
  return newProfile;
}

/**
 * Deletes a family profile unless it is primary or the sole profile.
 *
 * @param profileId - Profile ID to delete
 * @returns True if deleted, false if prohibited
 */
export async function deleteFamilyProfile(profileId: string): Promise<boolean> {
  const existing = await getStoredFamilyProfiles();
  const target = existing.find((p) => p.id === profileId);
  if (!target || target.isPrimary || existing.length <= 1) {
    return false;
  }

  const updated = existing.filter((p) => p.id !== profileId);
  await saveFamilyProfiles(updated);

  const activeId = await getActiveProfileId();
  if (activeId === profileId) {
    await setActiveProfileId(null);
  }
  return true;
}
