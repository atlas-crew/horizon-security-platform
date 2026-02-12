import { FileText, ChevronRight } from 'lucide-react';
import { PLAYBOOKS, type Playbook } from '../../data/playbooks';
import { Stack } from '@/ui';

interface PlaybookSelectorProps {
  onSelect: (playbook: Playbook) => void;
}

export function PlaybookSelector({ onSelect }: PlaybookSelectorProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink-muted">Available Playbooks</h3>
      <div className="space-y-2">
        {PLAYBOOKS.map((playbook) => (
          <button
            key={playbook.id}
            onClick={() => onSelect(playbook)}
            className="w-full text-left p-3 border border-border-subtle bg-surface-base hover:bg-surface-subtle group transition-colors"
          >
            <div className="flex items-start justify-between">
              <Stack direction="row" align="center" gap="sm">
                <FileText className="w-4 h-4 text-ac-blue" />
                <span className="font-medium text-ink-primary">{playbook.name}</span>
              </Stack>
              <ChevronRight className="w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-ink-secondary mt-1 ml-6">{playbook.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
