import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SigmaRule } from '../../hooks/useHunt';
import { SigmaRulesPanel } from './SigmaRulesPanel';

function makeRule(overrides: Partial<SigmaRule> = {}): SigmaRule {
  const now = new Date('2026-02-09T00:00:00.000Z').toISOString();
  return {
    id: overrides.id ?? 'rule-1',
    tenantId: overrides.tenantId ?? 'tenant-1',
    name: overrides.name ?? 'Test Rule',
    description: overrides.description,
    enabled: overrides.enabled ?? false,
    sqlTemplate: overrides.sqlTemplate ?? 'SELECT * FROM signal_events WHERE {{whereClause}}',
    whereClause: overrides.whereClause ?? "signal_type = 'path_traversal'",
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

describe('SigmaRulesPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders disabled state when historical analytics is unavailable', () => {
    const getSigmaRules = vi.fn().mockResolvedValue([]);
    render(
      <SigmaRulesPanel
        historicalEnabled={false}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    expect(screen.getByText(/Historical analytics unavailable/i)).toBeInTheDocument();
    expect(getSigmaRules).not.toHaveBeenCalled();
  });

  it('loads and renders rules when enabled', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([makeRule({ enabled: true })]);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockResolvedValue(makeRule({ enabled: true }))}
        deleteSigmaRule={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Test Rule')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('toggles enabled by calling updateSigmaRule and updating the row', async () => {
    const rule = makeRule({ id: 'rule-2', enabled: false });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const updateSigmaRule = vi.fn().mockResolvedValue({ ...rule, enabled: true, updatedAt: new Date().toISOString() });

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByText(rule.name)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    await waitFor(() => expect(updateSigmaRule).toHaveBeenCalledWith('rule-2', { enabled: true }));
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('deletes a rule after confirmation', async () => {
    const rule = makeRule({ id: 'rule-3', name: 'Delete Me', enabled: true });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const deleteSigmaRule = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockResolvedValue(rule)}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Delete Me')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    await waitFor(() => expect(deleteSigmaRule).toHaveBeenCalledWith('rule-3'));
    await waitFor(() => expect(screen.queryByText('Delete Me')).not.toBeInTheDocument());
  });

  it('refreshes when refreshNonce changes', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([makeRule({ id: 'rule-4' })]);
    const { rerender } = render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockResolvedValue(makeRule({ id: 'rule-4' }))}
        deleteSigmaRule={vi.fn().mockResolvedValue(undefined)}
        refreshNonce={0}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));

    rerender(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockResolvedValue(makeRule({ id: 'rule-4' }))}
        deleteSigmaRule={vi.fn().mockResolvedValue(undefined)}
        refreshNonce={1}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(2));
  });
});

