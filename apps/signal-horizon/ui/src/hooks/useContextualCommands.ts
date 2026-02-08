import { useEffect, useRef, useMemo } from 'react';
import { useCommandStore, type ContextualCommand } from '../stores/commandStore';

/**
 * Hook to register page-specific commands in the Command Palette.
 * Commands are automatically unregistered when the component unmounts.
 * Stable: only re-registers when the set of command IDs changes.
 */
export function useContextualCommands(commands: ContextualCommand[]) {
  const register = useCommandStore((s) => s.registerCommands);
  const unregister = useCommandStore((s) => s.unregisterCommands);
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  const idsKey = useMemo(() => commands.map((c) => c.id).join(','), [commands]);

  useEffect(() => {
    register(commandsRef.current);
    const ids = commandsRef.current.map((c) => c.id);
    return () => {
      unregister(ids);
    };
  }, [idsKey, register, unregister]);
}
