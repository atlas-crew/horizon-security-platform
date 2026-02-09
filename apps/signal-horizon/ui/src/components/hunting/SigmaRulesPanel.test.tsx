import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SigmaRule } from '../../hooks/useHunt';
import { SigmaRulesPanel } from './SigmaRulesPanel';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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
    const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
    expect(refreshBtn).toBeDisabled();
    fireEvent.click(refreshBtn);
    // Defense-in-depth: even if a disabled button is triggered programmatically,
    // refresh() should still no-op when ClickHouse is disabled.
    (refreshBtn as HTMLButtonElement).disabled = false;
    fireEvent.click(refreshBtn);
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

  it('renders rule description when present', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([
      makeRule({ id: 'rule-desc', name: 'Has Desc', description: 'Some desc', enabled: true }),
    ]);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Has Desc')).toBeInTheDocument();
    expect(screen.getByText('Some desc')).toBeInTheDocument();
  });

  it('shows whereClause inside expandable details', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([
      makeRule({ id: 'rule-wc', name: 'Has Where', whereClause: "source_ip = '1.2.3.4'", enabled: true }),
    ]);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    expect(await screen.findByText('Has Where')).toBeInTheDocument();
    const summary = screen.getByText('whereClause');
    fireEvent.click(summary);
    const details = summary.closest('details');
    expect(details).toHaveAttribute('open');
    expect(screen.getByText("source_ip = '1.2.3.4'")).toBeInTheDocument();
  });

  it('shows empty state when there are no rules', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([]);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/No rules yet/i)).toBeInTheDocument();
  });

  it('shows error when getSigmaRules fails', async () => {
    const getSigmaRules = vi.fn().mockRejectedValue(new Error('load failed'));
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/load failed/i)).toBeInTheDocument();
  });

  it('uses fallback error text when getSigmaRules rejects with non-Error', async () => {
    const getSigmaRules = vi.fn().mockRejectedValue('nope');
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/Failed to load sigma rules/i)).toBeInTheDocument();
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

  it('shows error when updateSigmaRule fails and clears busy state', async () => {
    const rule = makeRule({ id: 'rule-uerr', enabled: false });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const updateSigmaRule = vi.fn().mockRejectedValue(new Error('update failed'));

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByText(rule.name)).toBeInTheDocument();

    const enableBtn = screen.getByRole('button', { name: 'Enable' });
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });

    fireEvent.click(enableBtn);

    await waitFor(() => expect(updateSigmaRule).toHaveBeenCalledWith('rule-uerr', { enabled: true }));
    expect(await screen.findByText(/update failed/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable' })).toBeEnabled();
    expect(deleteBtn).toBeEnabled();
  });

  it('uses fallback error text when updateSigmaRule rejects with non-Error', async () => {
    const rule = makeRule({ id: 'rule-uerr2', enabled: false });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const updateSigmaRule = vi.fn().mockRejectedValue('nope');

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
    await waitFor(() => expect(updateSigmaRule).toHaveBeenCalledWith('rule-uerr2', { enabled: true }));
    expect(await screen.findByText(/Failed to update sigma rule/i)).toBeInTheDocument();
  });

  it('disables buttons while toggle is in flight', async () => {
    const rule = makeRule({ id: 'rule-busy', enabled: false });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const d = deferred<SigmaRule>();
    const updateSigmaRule = vi.fn().mockReturnValue(d.promise);
    const deleteSigmaRule = vi.fn().mockResolvedValue(undefined);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText(rule.name)).toBeInTheDocument();

    const enableBtn = screen.getByRole('button', { name: 'Enable' });
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });

    fireEvent.click(enableBtn);

    expect(enableBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    fireEvent.click(enableBtn);
    expect(updateSigmaRule).toHaveBeenCalledTimes(1);
    fireEvent.click(deleteBtn);
    expect(deleteSigmaRule).not.toHaveBeenCalled();

    d.resolve({ ...rule, enabled: true, updatedAt: '2026-02-09T01:00:00.000Z' });
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Delete/i })).toBeEnabled();
  });

  it('prevents delete on the same rule while a toggle is in flight (internal guard)', async () => {
    const rule = makeRule({ id: 'rule-same', name: 'Same Rule', enabled: false });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const d = deferred<SigmaRule>();
    const updateSigmaRule = vi.fn().mockReturnValue(d.promise);
    const deleteSigmaRule = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Same Rule')).toBeInTheDocument();

    const enableBtn = screen.getByRole('button', { name: 'Enable' });
    const deleteBtn = screen.getByRole('button', { name: /Delete/i }) as HTMLButtonElement;

    fireEvent.click(enableBtn);
    // Defense-in-depth: even if HTML disabled is bypassed, the handler should still block
    // deleting while the rule is busy.
    deleteBtn.disabled = false;
    fireEvent.click(deleteBtn);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(deleteSigmaRule).not.toHaveBeenCalled();

    d.resolve({ ...rule, enabled: true, updatedAt: '2026-02-09T07:00:00.000Z' });
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument();
  });

  it('deletes a rule after confirmation', async () => {
    const rule = makeRule({ id: 'rule-3', name: 'Delete Me', enabled: true });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const deleteSigmaRule = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

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
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Delete Me'));
    await waitFor(() => expect(deleteSigmaRule).toHaveBeenCalledWith('rule-3'));
    await waitFor(() => expect(screen.queryByText('Delete Me')).not.toBeInTheDocument());
  });

  it('does not delete when confirmation is cancelled', async () => {
    const rule = makeRule({ id: 'rule-cancel', name: 'Cancel Delete', enabled: true });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const deleteSigmaRule = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockResolvedValue(rule)}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Cancel Delete')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    expect(deleteSigmaRule).not.toHaveBeenCalled();
    expect(screen.getByText('Cancel Delete')).toBeInTheDocument();
  });

  it('shows error when deleteSigmaRule fails and keeps the row', async () => {
    const rule = makeRule({ id: 'rule-derr', name: 'Delete Fails', enabled: true });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const deleteSigmaRule = vi.fn().mockRejectedValue(new Error('delete failed'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockResolvedValue(rule)}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Delete Fails')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    await waitFor(() => expect(deleteSigmaRule).toHaveBeenCalledWith('rule-derr'));
    expect(await screen.findByText(/delete failed/i)).toBeInTheDocument();
    expect(screen.getByText('Delete Fails')).toBeInTheDocument();
  });

  it('uses fallback error text when deleteSigmaRule rejects with non-Error', async () => {
    const rule = makeRule({ id: 'rule-derr2', name: 'Delete NonError', enabled: true });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const deleteSigmaRule = vi.fn().mockRejectedValue('nope');
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockResolvedValue(rule)}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Delete NonError')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    await waitFor(() => expect(deleteSigmaRule).toHaveBeenCalledWith('rule-derr2'));
    expect(await screen.findByText(/Failed to delete sigma rule/i)).toBeInTheDocument();
    expect(screen.getByText('Delete NonError')).toBeInTheDocument();
  });

  it('disables buttons while delete is in flight', async () => {
    const rule = makeRule({ id: 'rule-delbusy', name: 'Busy Delete', enabled: true });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const d = deferred<void>();
    const deleteSigmaRule = vi.fn().mockReturnValue(d.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockResolvedValue(rule)}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Busy Delete')).toBeInTheDocument();
    const toggleBtn = screen.getByRole('button', { name: 'Disable' });
    const deleteBtn = screen.getByRole('button', { name: /Delete/i });

    fireEvent.click(deleteBtn);
    expect(toggleBtn).toBeDisabled();
    expect(deleteBtn).toBeDisabled();
    fireEvent.click(deleteBtn);
    expect(deleteSigmaRule).toHaveBeenCalledTimes(1);

    d.resolve(undefined);
    await waitFor(() => expect(screen.queryByText('Busy Delete')).not.toBeInTheDocument());
  });

  it('sorts rules by updatedAt descending', async () => {
    const newer = makeRule({ id: 'r-new', name: 'Newer', updatedAt: '2026-02-09T03:00:00.000Z' });
    const mid = makeRule({ id: 'r-mid', name: 'Middle', updatedAt: '2026-02-09T02:00:00.000Z' });
    const older = makeRule({ id: 'r-old', name: 'Older', updatedAt: '2026-02-09T01:00:00.000Z' });
    const getSigmaRules = vi.fn().mockResolvedValue([older, newer, mid]);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
    const rows = screen.getAllByRole('row').slice(1);
    const names = rows.map((r) => within(r).getByText(/Newer|Middle|Older/).textContent);
    expect(names).toEqual(['Newer', 'Middle', 'Older']);
  });

  it('renders Invalid Date when updatedAt is malformed', async () => {
    const bad = makeRule({ id: 'rule-bad-date', name: 'Bad Date', updatedAt: 'not-a-date' });
    const getSigmaRules = vi.fn().mockResolvedValue([bad]);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    expect(await screen.findByText('Bad Date')).toBeInTheDocument();
    expect(screen.getByText('Invalid Date')).toBeInTheDocument();
  });

  it('renders all rules even when updatedAt timestamps are identical', async () => {
    const t = '2026-02-09T03:00:00.000Z';
    const r1 = makeRule({ id: 'same-1', name: 'Same 1', updatedAt: t });
    const r2 = makeRule({ id: 'same-2', name: 'Same 2', updatedAt: t });
    const r3 = makeRule({ id: 'same-3', name: 'Same 3', updatedAt: t });
    const getSigmaRules = vi.fn().mockResolvedValue([r1, r2, r3]);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    expect(await screen.findByText('Same 1')).toBeInTheDocument();
    expect(screen.getByText('Same 2')).toBeInTheDocument();
    expect(screen.getByText('Same 3')).toBeInTheDocument();
  });

  it('busy state disables only the targeted row when multiple rules are rendered', async () => {
    const a = makeRule({ id: 'rule-a', name: 'Rule A', enabled: false });
    const b = makeRule({ id: 'rule-b', name: 'Rule B', enabled: false });
    const getSigmaRules = vi.fn().mockResolvedValue([a, b]);
    const d = deferred<SigmaRule>();
    const updateSigmaRule = vi.fn().mockReturnValue(d.promise);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByText('Rule A')).toBeInTheDocument();
    expect(screen.getByText('Rule B')).toBeInTheDocument();

    const rowA = screen.getByText('Rule A').closest('tr');
    const rowB = screen.getByText('Rule B').closest('tr');
    expect(rowA).not.toBeNull();
    expect(rowB).not.toBeNull();

    const enableA = within(rowA as HTMLElement).getByRole('button', { name: 'Enable' });
    const enableB = within(rowB as HTMLElement).getByRole('button', { name: 'Enable' });
    const deleteB = within(rowB as HTMLElement).getByRole('button', { name: /Delete/i });

    fireEvent.click(enableA);
    expect(enableA).toBeDisabled();
    expect(enableB).toBeEnabled();
    expect(deleteB).toBeEnabled();

    d.resolve({ ...a, enabled: true, updatedAt: '2026-02-09T04:00:00.000Z' });
    await waitFor(() => expect(updateSigmaRule).toHaveBeenCalled());
  });

  it('clears prior error immediately when toggling enabled state', async () => {
    const rule = makeRule({ id: 'rule-clear1', name: 'Clear Toggle Error', enabled: false });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const d = deferred<SigmaRule>();
    const updateSigmaRule = vi.fn()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockReturnValueOnce(d.promise);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByText('Clear Toggle Error')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(await screen.findByText(/first failure/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(screen.queryByText(/first failure/i)).not.toBeInTheDocument();

    d.resolve({ ...rule, enabled: true, updatedAt: '2026-02-09T05:00:00.000Z' });
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument();
  });

  it('clears prior error immediately when deleting', async () => {
    const rule = makeRule({ id: 'rule-clear2', name: 'Clear Delete Error', enabled: true });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const d = deferred<void>();
    const deleteSigmaRule = vi.fn().mockReturnValueOnce(d.promise);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn().mockRejectedValue(new Error('seed error'))}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Clear Delete Error')).toBeInTheDocument();

    // Seed an error via a failed toggle attempt.
    fireEvent.click(screen.getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText(/seed error/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));
    expect(screen.queryByText(/seed error/i)).not.toBeInTheDocument();

    d.resolve(undefined);
    await waitFor(() => expect(screen.queryByText('Clear Delete Error')).not.toBeInTheDocument());
  });

  it('clears previously loaded rows when refresh fails', async () => {
    const rule = makeRule({ id: 'rule-refresh-fail', name: 'Will Disappear', enabled: true });
    const getSigmaRules = vi.fn()
      .mockResolvedValueOnce([rule])
      .mockRejectedValueOnce(new Error('refresh failed'));

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    expect(await screen.findByText('Will Disappear')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));

    expect(await screen.findByText(/refresh failed/i)).toBeInTheDocument();
    expect(screen.queryByText('Will Disappear')).not.toBeInTheDocument();
  });

  it('can toggle one rule while deleting another (no stuck state)', async () => {
    const a = makeRule({ id: 'rule-conc-a', name: 'Conc A', enabled: false });
    const b = makeRule({ id: 'rule-conc-b', name: 'Conc B', enabled: true });
    const getSigmaRules = vi.fn().mockResolvedValue([a, b]);
    const d = deferred<SigmaRule>();
    const updateSigmaRule = vi.fn().mockReturnValue(d.promise);
    const deleteSigmaRule = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Conc A')).toBeInTheDocument();
    expect(screen.getByText('Conc B')).toBeInTheDocument();

    const rowA = screen.getByText('Conc A').closest('tr') as HTMLElement;
    const rowB = screen.getByText('Conc B').closest('tr') as HTMLElement;
    fireEvent.click(within(rowA).getByRole('button', { name: 'Enable' }));
    fireEvent.click(within(rowB).getByRole('button', { name: /Delete/i }));

    await waitFor(() => expect(deleteSigmaRule).toHaveBeenCalledWith('rule-conc-b'));
    await waitFor(() => expect(screen.queryByText('Conc B')).not.toBeInTheDocument());

    d.resolve({ ...a, enabled: true, updatedAt: '2026-02-09T06:00:00.000Z' });
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument();
  });

  it('does not re-fetch on rerender (loadedOnceRef guard)', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([makeRule({ id: 'rule-once' })]);
    const { rerender } = render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
        refreshNonce={0}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
    rerender(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
        refreshNonce={0}
      />,
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(getSigmaRules).toHaveBeenCalledTimes(1);
  });

  it('clears state when historicalEnabled flips false then reloads when re-enabled', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([makeRule({ id: 'rule-flip', name: 'Flip' })]);
    const { rerender } = render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    expect(await screen.findByText('Flip')).toBeInTheDocument();

    rerender(
      <SigmaRulesPanel
        historicalEnabled={false}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );
    expect(screen.queryByText('Flip')).not.toBeInTheDocument();
    expect(screen.getByText(/Historical analytics unavailable/i)).toBeInTheDocument();

    rerender(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );
    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(2));
  });

  it('disables refresh button while loading', async () => {
    const d = deferred<SigmaRule[]>();
    const getSigmaRules = vi.fn().mockReturnValue(d.promise);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
    expect(refreshBtn).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();

    d.resolve([]);
    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  });

  it('does not double-fetch on mount when refreshNonce is 0', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([makeRule({ id: 'rule-nonce0' })]);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
        refreshNonce={0}
      />,
    );

    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(1));
  });

  it('clears error after a subsequent successful refresh', async () => {
    const rule = makeRule({ id: 'rule-clear', name: 'Clear Error', enabled: false });
    const getSigmaRules = vi.fn().mockResolvedValue([rule]);
    const updateSigmaRule = vi.fn().mockRejectedValueOnce(new Error('update failed'));

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(await screen.findByText('Clear Error')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(await screen.findByText(/update failed/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText(/update failed/i)).not.toBeInTheDocument());
  });

  it('refresh button click re-fetches rules', async () => {
    const getSigmaRules = vi.fn().mockResolvedValue([makeRule({ id: 'rule-refresh', name: 'Refresh Me' })]);
    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={vi.fn()}
        deleteSigmaRule={vi.fn()}
      />,
    );

    expect(await screen.findByText('Refresh Me')).toBeInTheDocument();
    expect(getSigmaRules).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    await waitFor(() => expect(getSigmaRules).toHaveBeenCalledTimes(2));
  });

  it('prevents toggle and delete while a refresh load is in flight (internal guard)', async () => {
    const rule = makeRule({ id: 'rule-load', name: 'Load Guard', enabled: false });
    const d = deferred<SigmaRule[]>();
    const getSigmaRules = vi.fn()
      .mockResolvedValueOnce([rule])
      .mockReturnValueOnce(d.promise);
    const updateSigmaRule = vi.fn().mockResolvedValue({ ...rule, enabled: true });
    const deleteSigmaRule = vi.fn().mockResolvedValue(undefined);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <SigmaRulesPanel
        historicalEnabled={true}
        getSigmaRules={getSigmaRules}
        updateSigmaRule={updateSigmaRule}
        deleteSigmaRule={deleteSigmaRule}
      />,
    );

    expect(await screen.findByText('Load Guard')).toBeInTheDocument();

    // Start a manual refresh, leaving loading=true with rows still present.
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }));
    expect(getSigmaRules).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    expect(updateSigmaRule).not.toHaveBeenCalled();
    expect(deleteSigmaRule).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();

    d.resolve([rule]);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
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
