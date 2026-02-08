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
    set((state) => {
      const map = new Map(state.contextualCommands.map(c => [c.id, c]));
      commands.forEach(c => map.set(c.id, c));
      return { contextualCommands: [...map.values()] };
    }),
  unregisterCommands: (ids) =>
    set((state) => ({
      contextualCommands: state.contextualCommands.filter((c) => !ids.includes(c.id))
    })),
  clearCommands: () => set({ contextualCommands: [] }),
}));
