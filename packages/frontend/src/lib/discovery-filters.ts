import type { Call } from '../../lib/types';

export type ExpiryHorizon = 'any' | '24h' | '7d';
export type SurgeTier = 'any' | 'standard' | 'elevated';

export interface DiscoveryFilters {
  volume: number | null;
  expiry: ExpiryHorizon;
  surge: SurgeTier;
  chain: 'all' | 'base' | 'stellar';
  category: string;
}

export const DEFAULT_DISCOVERY_FILTERS: DiscoveryFilters = {
  volume: null,
  expiry: 'any',
  surge: 'any',
  chain: 'all',
  category: '',
};

const EXPIRY_VALUES: ExpiryHorizon[] = ['any', '24h', '7d'];
const SURGE_VALUES: SurgeTier[] = ['any', 'standard', 'elevated'];

function positiveNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseDiscoveryFilters(params: URLSearchParams): DiscoveryFilters {
  const expiry = params.get('expiry') as ExpiryHorizon;
  const surge = params.get('surge') as SurgeTier;
  const chain = params.get('chain');

  return {
    volume: positiveNumber(params.get('volume')),
    expiry: EXPIRY_VALUES.includes(expiry) ? expiry : 'any',
    surge: SURGE_VALUES.includes(surge) ? surge : 'any',
    chain: chain === 'base' || chain === 'stellar' ? chain : 'all',
    category: params.get('category')?.trim() ?? '',
  };
}

export function serializeDiscoveryFilters(filters: DiscoveryFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.volume !== null) params.set('volume', String(filters.volume));
  if (filters.expiry !== 'any') params.set('expiry', filters.expiry);
  if (filters.surge !== 'any') params.set('surge', filters.surge);
  if (filters.chain !== 'all') params.set('chain', filters.chain);
  if (filters.category.trim()) params.set('category', filters.category.trim());
  return params;
}

function numericVolume(call: Call): number {
  const total = Number(call.totalStakeYes || 0) + Number(call.totalStakeNo || 0);
  if (total > 0) return total;
  return Number(call.volume ?? call.stakeAmount ?? call.stake ?? 0) || 0;
}

function deadlineMs(call: Call): number | null {
  const value = call.deadline ?? call.endTs;
  if (!value) return null;
  const timestamp = typeof value === 'number' ? value : Number(value);
  const parsed = Number.isFinite(timestamp) && timestamp > 10_000_000_000
    ? timestamp
    : Number.isFinite(timestamp) && timestamp > 0
      ? timestamp * 1000
      : Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

export function applyDiscoveryFilters(calls: Call[], filters: DiscoveryFilters, now = Date.now()): Call[] {
  return calls.filter((call) => {
    if (filters.volume !== null && numericVolume(call) < filters.volume) return false;
    if (filters.chain !== 'all' && call.chain !== filters.chain) return false;

    if (filters.category) {
      const haystack = `${call.title ?? ''} ${call.thesis ?? ''} ${call.asset ?? ''}`.toLowerCase();
      if (!haystack.includes(filters.category.toLowerCase())) return false;
    }

    if (filters.expiry !== 'any') {
      const deadline = deadlineMs(call);
      const horizon = filters.expiry === '24h' ? 86_400_000 : 604_800_000;
      if (deadline === null || deadline < now || deadline - now > horizon) return false;
    }

    if (filters.surge !== 'any') {
      const surge = Number((call as Call & { surgeFeeBps?: number }).surgeFeeBps ?? 0);
      if (filters.surge === 'standard' && surge >= 100) return false;
      if (filters.surge === 'elevated' && surge < 100) return false;
    }

    return true;
  });
}