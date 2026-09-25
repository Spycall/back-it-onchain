'use client';

import * as React from 'react';
import { useFeedPrefs, type FeedPrefs } from '@/src/hooks/useFeedPrefs';
import { cn } from '@/lib/utils';
import type { DiscoveryFilters } from '@/src/lib/discovery-filters';

/**
 * Feed personalization panel (FE-30): mute authors, filter chains, and tune
 * ranking weights.
 */
export function FeedPersonalize() {
  const { prefs, setPrefs, resetPrefs, filters, setFilters, resetFilters } = useFeedPrefs();
  const [muteInput, setMuteInput] = React.useState('');
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const toggleChain = (chain: FeedPrefs['chains'][number]) => {
    const hasAll = prefs.chains.includes('all');
    if (chain === 'all') {
      setPrefs({ chains: hasAll ? [] : ['all'] });
      return;
    }
    const withoutAll = prefs.chains.filter((c) => c !== 'all');
    const next = withoutAll.includes(chain)
      ? withoutAll.filter((c) => c !== chain)
      : [...withoutAll, chain];
    setPrefs({ chains: next.length === 0 ? ['all'] : next });
  };

  const setWeight = (key: keyof FeedPrefs['weights'], value: number) => {
    setPrefs({ weights: { ...prefs.weights, [key]: value } });
  };

  const addMute = () => {
    const value = muteInput.trim();
    if (!value) return;
    if (!prefs.mutedAuthors.some((m) => m.toLowerCase() === value.toLowerCase())) {
      setPrefs({ mutedAuthors: [...prefs.mutedAuthors, value] });
    }
    setMuteInput('');
  };

  const removeMuted = (author: string) => {
    setPrefs({ mutedAuthors: prefs.mutedAuthors.filter((m) => m !== author) });
  };

  const updateFilter = <K extends keyof DiscoveryFilters>(key: K, value: DiscoveryFilters[K]) => {
    setFilters({ [key]: value });
  };

  const activeFilters = [
    filters.volume !== null ? `Volume >= ${filters.volume}` : null,
    filters.expiry !== 'any' ? `Expires < ${filters.expiry}` : null,
    filters.surge !== 'any' ? `Surge: ${filters.surge}` : null,
    filters.chain !== 'all' ? `Chain: ${filters.chain}` : null,
    filters.category ? `Category: ${filters.category}` : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-border bg-card/50 p-4"
      data-testid="feed-personalize"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Feed settings</h3>
        <div className="flex items-center gap-3">
          <button type="button" onClick={resetFilters} className="text-xs text-muted-foreground hover:text-foreground">
            Reset filters
          </button>
          <button type="button" onClick={resetPrefs} className="text-xs text-muted-foreground hover:text-foreground" data-testid="personalize-reset">
            Reset settings
          </button>
        </div>
      </div>

      <section aria-label="Discovery filters" className="border-b border-border pb-4">
        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          className="flex w-full items-center justify-between text-left text-sm font-semibold"
          data-testid="discovery-filter-toggle"
        >
          <span>Discovery filters{activeFilters.length ? ` (${activeFilters.length})` : ''}</span>
          <span aria-hidden="true">{filtersOpen ? '−' : '+'}</span>
        </button>

        {activeFilters.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5" data-testid="active-filter-chips">
            {activeFilters.map((filter) => (
              <span key={filter} className="rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary">
                {filter}
              </span>
            ))}
          </div>
        ) : null}

        {filtersOpen ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Minimum staking volume
              <input
                type="number"
                min="0"
                value={filters.volume ?? ''}
                onChange={(event) => updateFilter('volume', event.target.value ? Number(event.target.value) : null)}
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                placeholder="Any volume"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Expiry horizon
              <select value={filters.expiry} onChange={(event) => updateFilter('expiry', event.target.value as DiscoveryFilters['expiry'])} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                <option value="any">Any time</option>
                <option value="24h">Within 24 hours</option>
                <option value="7d">Within 7 days</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Surge fee
              <select value={filters.surge} onChange={(event) => updateFilter('surge', event.target.value as DiscoveryFilters['surge'])} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                <option value="any">Any tier</option>
                <option value="standard">Standard</option>
                <option value="elevated">Elevated</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Chain
              <select value={filters.chain} onChange={(event) => updateFilter('chain', event.target.value as DiscoveryFilters['chain'])} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground">
                <option value="all">All chains</option>
                <option value="base">Base</option>
                <option value="stellar">Stellar</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground sm:col-span-2">
              Category or asset
              <input value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground" placeholder="Search category, title, or asset" />
            </label>
          </div>
        ) : null}
      </section>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted-foreground">Chains</legend>
        <div className="flex flex-wrap gap-2">
          {(['all', 'base', 'stellar'] as const).map((chain) => {
            const active = prefs.chains.includes(chain);
            return (
              <button
                key={chain}
                type="button"
                onClick={() => toggleChain(chain)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-secondary/40',
                )}
              >
                {chain}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted-foreground">Ranking weights</legend>
        {(
          [
            ['stake', 'Stake size'],
            ['acumen', 'Tracker accuracy'],
            ['recency', 'Recency'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="mb-1 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.5}
              value={prefs.weights[key]}
              onChange={(e) => setWeight(key, Number(e.target.value))}
              className="w-32 accent-primary"
              aria-label={`${label} weight`}
            />
          </label>
        ))}
      </fieldset>

      {prefs.mutedAuthors.length > 0 ? (
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-muted-foreground">
            Muted ({prefs.mutedAuthors.length})
          </legend>
          <ul className="flex flex-col gap-1">
            {prefs.mutedAuthors.map((author) => (
              <li key={author} className="flex items-center justify-between text-sm">
                <span className="truncate text-muted-foreground">{author}</span>
                <button
                  type="button"
                  onClick={() => removeMuted(author)}
                  className="text-xs text-destructive hover:underline"
                >
                  Unmute
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-muted-foreground">
          Mute a user or token
        </legend>
        <div className="flex gap-2">
          <input
            type="text"
            value={muteInput}
            onChange={(e) => setMuteInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addMute();
              }
            }}
            placeholder="0x... or handle"
            aria-label="User or token to mute"
            data-testid="personalize-mute-input"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={addMute}
            disabled={!muteInput.trim()}
            data-testid="personalize-mute-add"
            className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/60 disabled:opacity-50"
          >
            Mute
          </button>
        </div>
      </fieldset>
    </div>
  );
}
