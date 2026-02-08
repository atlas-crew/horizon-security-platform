import { useEffect } from 'react';
import { useCommandStore, type ContextualCommand } from '../stores/commandStore';

/**
 * Hook to register page-specific commands in the Command Palette.
 * Commands are automatically unregistered when the component unmounts.
 */
export function useContextualCommands(commands: ContextualCommand[]) {
  const register = useCommandStore((s) => s.registerCommands);
  const unregister = useCommandStore((s) => s.unregisterCommands);

  useEffect(() => {
    register(commands);
    return () => {
      unregister(commands.map((c) => c.id));
    };
  }, [commands, register, unregister]);
}
