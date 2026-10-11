import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DataWorkspaceOverview from './DataWorkspaceOverview';
import type { DataRelease, WorkspaceSummary } from './types';

const summary: WorkspaceSummary = {
  foodItems: 15072,
  foodAliases: 81,
  mealLibrary: 2027,
  completeMealLibrary: 0,
  consumptionStats: 2320,
  dataSources: 1,
  activeReleases: 1,
  priceSources: 0,
  pricePublications: 0,
  priceObservations: 0,
};
const release: DataRelease = {
  id: 'release',
  sourceId: 'source',
  versionLabel: '2018_2019_2021',
  sourceUrl: 'https://example.test/source',
  retrievedAt: '2026-10-10T12:00:00Z',
  status: 'ACTIVE',
  source: {
    code: 'FNRI_ENNS_IFCS',
    name: 'FNRI food consumption survey',
    domain: 'FOOD_CONSUMPTION',
    isEnabled: true,
    updateCadence: 'Per official public-use release',
  },
  createdByAdmin: { name: 'Admin' },
  mappings: {},
  _count: { consumptionStats: 2320, activations: 1 },
};
function show(values = summary, releases: DataRelease[] = [release], releaseCount = releases.length) {
  const onNavigate = vi.fn();
  render(
    <DataWorkspaceOverview summary={values} releases={releases} releaseCount={releaseCount} onNavigate={onNavigate} />
  );
  return onNavigate;
}

describe('nutrition data overview', () => {
  it('keeps all totals and release evidence without presenting zero completeness as approval', () => {
    show();
    expect(screen.getByText('15,072')).toBeInTheDocument();
    expect(screen.getByText('0 / 2,027')).toBeInTheDocument();
    expect(screen.getByText('2,320')).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    expect(screen.getByText('FNRI_ENNS_IFCS · 2018_2019_2021')).toBeInTheDocument();
    expect(screen.getByText('Food consumption')).toBeInTheDocument();
    expect(screen.getByText(/RNDs remain the only role/)).toBeVisible();
    expect(screen.getByText(/clinical-validity claim/)).toBeVisible();
  });
  it('collapses completed setup, retains its instructions, and routes publishing to the existing panel', () => {
    const navigate = show();
    const control = screen.getByText('Four-step publishing workflow');
    expect(control.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Manage imports & publishing' }));
    expect(navigate).toHaveBeenCalledWith('imports');
    fireEvent.click(screen.getByRole('button', { name: 'View releases' }));
    expect(navigate).toHaveBeenLastCalledWith('sources');
  });
  it('guides an empty workspace to source registration without inventing an active release', () => {
    const navigate = show({ ...summary, dataSources: 0, activeReleases: 0, consumptionStats: 0 }, [], 0);
    expect(screen.getByText('No active reference-data release is recorded in this workspace.')).toBeInTheDocument();
    expect(screen.getByText('Four-step publishing workflow').closest('details')).toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Register the first source' }));
    expect(navigate).toHaveBeenCalledWith('sources');
  });
  it('directs missing import work to imports even when another release is already active', () => {
    const navigate = show({ ...summary, consumptionStats: 0 });
    expect(screen.getByText('Next: Import and reconcile')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Continue import and review' }));
    expect(navigate).toHaveBeenCalledWith('imports');
  });
  it('counts drafts/staged releases separately and leaves retired evidence out of the active table', () => {
    show(summary, [
      release,
      { ...release, id: 'draft', status: 'DRAFT', versionLabel: 'Draft only' },
      { ...release, id: 'staged', status: 'STAGED', versionLabel: 'Staged only' },
      { ...release, id: 'retired', status: 'RETIRED', versionLabel: 'Retired only' },
    ]);
    expect(screen.getByText('Draft releases').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Staged releases').parentElement).toHaveTextContent('1');
    expect(screen.queryByText('FNRI_ENNS_IFCS · Retired only')).not.toBeInTheDocument();
  });
  it('does not turn an invalid recorded retrieval date into a fake freshness value', () => {
    show(summary, [{ ...release, retrievedAt: 'invalid' }]);
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
