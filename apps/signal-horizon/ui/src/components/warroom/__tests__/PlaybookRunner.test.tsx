import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PlaybookRunner } from '../PlaybookRunner';
import type { Playbook } from '../PlaybookSelector';

describe('PlaybookRunner', () => {
  const playbook: Playbook = {
    id: 'pb-test',
    name: 'Contain Threat',
    description: 'Test playbook',
    steps: [
      { name: 'Identify threat', type: 'action' },
      { name: 'Notify SOC', type: 'notification' },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders steps and allows closing', () => {
    const onClose = vi.fn();
    const onComplete = vi.fn();

    render(
      <PlaybookRunner playbook={playbook} onClose={onClose} onComplete={onComplete} />
    );

    expect(screen.getByText('Running: Contain Threat')).toBeInTheDocument();
    expect(screen.getByText('Identify threat')).toBeInTheDocument();
    expect(screen.getByText('Notify SOC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Execute Playbook' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close playbook runner' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('executes steps and calls onComplete', async () => {
    const onClose = vi.fn();
    const onComplete = vi.fn();

    render(
      <PlaybookRunner playbook={playbook} onClose={onClose} onComplete={onComplete} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Execute Playbook' }));

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Playbook Completed Successfully')).toBeInTheDocument();
  });
});
