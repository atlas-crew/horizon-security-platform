import { create } from 'zustand';
import type { LucideIcon } from 'lucide-react';

export interface ContextualCommand {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  metadata?: string;
  shortcut?: string;
}

interface CommandState {
  contextualCommands: ContextualCommand[];
  registerCommands: (commands: ContextualCommand[]) => void;
  unregisterCommands: (ids: string[]) => void;
  clearCommands: () => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  contextualCommands: [],
  registerCommands: (commands) => 
    set((state) => ({
      contextualCommands: [...state.contextualCommands, ...commands]
    })),
  unregisterCommands: (ids) =>
    set((state) => ({
      contextualCommands: state.contextualCommands.filter((c) => !ids.includes(c.id))
    })),
  clearCommands: () => set({ contextualCommands: [] }),
}));
