import { FileText, ChevronRight } from 'lucide-react';

export interface Playbook {
  id: string;
  name: string;
  description: string;
  steps: PlaybookStep[];
}

export interface PlaybookStep {
  name: string;
  type: 'action' | 'approval' | 'notification';
}

const PLAYBOOKS: Playbook[] = [
  {
    id: 'pb-1',
    name: 'Mitigate Credential Stuffing',
    description: 'Standard response for high-velocity login attempts.',
    steps: [
      { name: 'Identify Target Endpoints', type: 'action' },
      { name: 'Block Malicious IPs', type: 'action' },
      { name: 'Rotate API Keys', type: 'approval' },
      { name: 'Notify Customer', type: 'notification' },
    ]
  },
  {
    id: 'pb-2',
    name: 'Isolate Compromised Sensor',
    description: 'Disconnect a sensor suspected of compromise.',
    steps: [
      { name: 'Revoke Sensor Keys', type: 'action' },
      { name: 'Block Sensor IP', type: 'action' },
      { name: 'Flush Fleet Cache', type: 'action' },
    ]
  },
];

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
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-ac-blue" />
                <span className="font-medium text-ink-primary">{playbook.name}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-ink-muted opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-ink-secondary mt-1 ml-6">{playbook.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
