import { Keyboard } from 'lucide-react';
import { Modal, SectionHeader, Stack } from '@/ui';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  const shortcuts = [
    { keys: ['Ctrl', 'K'], label: 'Open Command Palette' },
    { keys: ['Ctrl', 'B'], label: 'Toggle Sidebar' },
    { keys: ['/'], label: 'Focus Command Palette' },
    { keys: ['?'], label: 'Show this help modal' },
    { keys: ['ESC'], label: 'Close modals / palettes' },
  ];

  return (
    <Modal open={isOpen} onClose={onClose} size="520px" title="Keyboard Shortcuts">
      <SectionHeader
        title="Keyboard Shortcuts"
        icon={<Keyboard className="w-5 h-5 text-ac-blue" />}
        size="h4"
        mb="md"
        style={{ marginBottom: '12px' }}
        titleStyle={{
          fontSize: '18px',
          lineHeight: '24px',
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
        }}
      />
      <div className="space-y-4">
        {shortcuts.map((shortcut, i) => (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-ink-secondary">{shortcut.label}</span>
            <Stack direction="row" align="center" gap="xs">
              {shortcuts[i].keys.map((key, j) => (
                <kbd
                  key={j}
                  className="px-2 py-1 min-w-[24px] text-center text-[10px] font-bold text-ink-primary bg-surface-base border border-border-subtle shadow-sm uppercase"
                >
                  {key === 'Ctrl' && (navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl')}
                  {key !== 'Ctrl' && key}
                </kbd>
              ))}
            </Stack>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-border-subtle text-[10px] text-center text-ink-muted uppercase tracking-[0.2em]">
        Tactical Keyboard Interface · v0.1
      </div>
    </Modal>
  );
}
