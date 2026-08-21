import { useState } from 'react';
import type { Venue } from '../lib/types';
import { defaultInputs, estimate, fmtMoney, nightsForEvent, type CostInputs } from '../lib/costing';
import { SmallLabel } from './Bits';

/** The currencies the estimator offers. Add to taste — anything ISO 4217 works. */
const CURRENCIES = ['USD', 'EUR', 'GBP', 'PLN', 'CHF', 'JPY', 'CAD', 'AUD'];

/**
 * A running total for attending one venue.
 *
 * Every figure except the registration tier and the night count is the reader's own — see
 * lib/costing.ts for why nothing is estimated for them. Inputs persist per venue so a
 * watchlisted conference keeps its numbers between visits.
 */
export function CostEstimator({
  venue,
  inputs,
  setInputs,
}: {
  venue: Venue;
  inputs: CostInputs | undefined;
  setInputs: (next: CostInputs) => void;
}) {
  const [currency, setCurrency] = useState(inputs?.currency ?? 'USD');
  const value = inputs ?? defaultInputs(venue, currency);
  const tiers = venue.registration?.tiers ?? [];
  const result = estimate(venue, value);
  const derivedNights = nightsForEvent(venue);

  const set = (patch: Partial<CostInputs>) => setInputs({ ...value, ...patch });

  const num = (label: string, key: keyof CostInputs, hint?: string) => (
    <label style={{ display: 'grid', gap: 3 }}>
      <span className="cg-muted" style={{ fontSize: 11 }}>{label}</span>
      <input
        type="number"
        className="input"
        min={0}
        value={value[key] as number}
        onChange={(e) => set({ [key]: Math.max(0, Number(e.target.value) || 0) } as Partial<CostInputs>)}
        style={{ fontSize: 12, minHeight: 30 }}
      />
      {hint && <span className="cg-muted" style={{ fontSize: 10 }}>{hint}</span>}
    </label>
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <SmallLabel>What it costs to go</SmallLabel>
        <select
          className="input"
          value={currency}
          aria-label="Currency"
          onChange={(e) => { setCurrency(e.target.value); set({ currency: e.target.value }); }}
          style={{ fontSize: 11, minHeight: 26, padding: '2px 6px', marginLeft: 'auto', width: 'auto', flex: '0 0 auto' }}
        >
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
        <label style={{ display: 'grid', gap: 3, gridColumn: '1 / -1' }}>
          <span className="cg-muted" style={{ fontSize: 11 }}>Registration</span>
          {tiers.length > 0 ? (
            <select
              className="input"
              value={value.tierIndex ?? ''}
              onChange={(e) => set({ tierIndex: e.target.value === '' ? null : Number(e.target.value) })}
              style={{ fontSize: 12, minHeight: 30, maxWidth: 420 }}
            >
              {tiers.map((t, i) => (
                <option key={i} value={i}>
                  {t.label} — {fmtMoney(t.amount, t.currency)}{t.cutoff ? ` (until ${t.cutoff})` : ''}
                </option>
              ))}
              <option value="">Enter my own figure</option>
            </select>
          ) : (
            <>
              <input
                type="number"
                className="input"
                min={0}
                value={value.registrationOverride}
                onChange={(e) => set({ registrationOverride: Math.max(0, Number(e.target.value) || 0) })}
                style={{ fontSize: 12, minHeight: 30, maxWidth: 200 }}
              />
              <span className="cg-muted" style={{ fontSize: 10 }}>
                This venue has published no fee table yet, so there is nothing to pick from.
              </span>
            </>
          )}
        </label>

        {tiers.length > 0 && value.tierIndex === null && num('Your fee', 'registrationOverride')}
        {num('Nights', 'nights', derivedNights ? `${derivedNights} = the event's own length` : 'event dates not published')}
        {num('Per night', 'nightlyRate', 'your figure — nothing is guessed')}
        {num('Travel', 'travel', 'return fare')}
        {num('Visa', 'visa', 'zero if you need none')}
        {num('Per diem', 'perDiem', 'food and local transport')}
        {num('Per-diem days', 'perDiemDays')}
      </div>

      <table className="table" style={{ fontSize: 12, width: '100%' }}>
        <tbody>
          {result.lines.map((l) => (
            <tr key={l.label}>
              <td style={{ whiteSpace: 'nowrap' }}>{l.label}</td>
              <td className="cg-muted" style={{ fontSize: 11 }}>{l.detail}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {l.blank ? <span className="cg-muted">—</span> : fmtMoney(l.amount, result.currency)}
              </td>
            </tr>
          ))}
          <tr>
            <td style={{ fontFamily: 'var(--font-heading)', fontWeight: 800 }}>
              {result.unfilled > 0 ? 'At least' : 'Total'}
            </td>
            <td className="cg-muted" style={{ fontSize: 11 }}>
              {result.unfilled > 0
                ? `${result.unfilled} ${result.unfilled === 1 ? 'line is' : 'lines are'} still blank`
                : 'every line filled'}
            </td>
            <td style={{ textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: 800, whiteSpace: 'nowrap' }}>
              {fmtMoney(result.total, result.currency)}
            </td>
          </tr>
        </tbody>
      </table>

      {result.currencyMismatch && (
        <div style={{ fontSize: 11, marginTop: 8, color: 'var(--color-accent-700)', lineHeight: 1.5 }}>
          The fee is published in {result.currencyMismatch} and is counted here as though it were{' '}
          {result.currency}. Fees are never converted — put your own converted figure in if the
          difference matters.
        </div>
      )}
    </div>
  );
}
