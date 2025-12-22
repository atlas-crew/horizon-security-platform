/**
 * CommandSender manages reliable command delivery to sensors.
 * Queues commands when sensors are offline, retries on failure.
 */

import { EventEmitter } from 'events';
import type WebSocket from 'ws';

export type CommandType = 'push_config' | 'push_rules' | 'restart' | 'collect_diagnostics';
export type CommandStatus = 'pending' | 'sent' | 'success' | 'failed' | 'timeout';

export interface Command {
  id: string;
  type: CommandType;
  sensorId: string;
  payload: unknown;
  status: CommandStatus;
  createdAt: number;
  sentAt?: number;
  completedAt?: number;
  attempts: number;
  maxAttempts: number;
  timeoutMs: number;
  error?: string;
}

export class CommandSender extends EventEmitter {
  private commands = new Map<string, Command>();
  private sensorConnections = new Map<string, WebSocket>();
  private timeoutHandles = new Map<string, NodeJS.Timeout>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  start(): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.cleanupOldCommands(), 60000);
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    for (const handle of this.timeoutHandles.values()) {
      clearTimeout(handle);
    }
    this.timeoutHandles.clear();
  }

  registerConnection(sensorId: string, ws: WebSocket): void {
    this.sensorConnections.set(sensorId, ws);
    this.flushPendingCommands(sensorId);
  }

  unregisterConnection(sensorId: string): void {
    this.sensorConnections.delete(sensorId);
  }

  sendCommand(sensorId: string, type: CommandType, payload: unknown, customId?: string): string {
    const id = customId ?? `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const command: Command = {
      id,
      type,
      sensorId,
      payload,
      status: 'pending',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: this.getMaxAttempts(type),
      timeoutMs: this.getTimeout(type),
    };

    this.commands.set(id, command);
    this.trySendCommand(command);
    return id;
  }

  handleResponse(commandId: string, success: boolean, error?: string): void {
    const cmd = this.commands.get(commandId);
    if (!cmd) return;

    this.clearCommandTimeout(commandId);
    cmd.completedAt = Date.now();
    cmd.status = success ? 'success' : 'failed';
    if (error) cmd.error = error;

    this.emit(success ? 'command-complete' : 'command-failed', cmd);
  }

  private trySendCommand(cmd: Command): void {
    const ws = this.sensorConnections.get(cmd.sensorId);
    if (!ws || ws.readyState !== 1) return; // WebSocket.OPEN = 1

    cmd.attempts++;
    cmd.sentAt = Date.now();
    cmd.status = 'sent';

    ws.send(JSON.stringify({
      type: cmd.type,
      commandId: cmd.id,
      payload: cmd.payload,
    }));

    this.setCommandTimeout(cmd);
    this.emit('command-sent', cmd);
  }

  private setCommandTimeout(cmd: Command): void {
    const handle = setTimeout(() => {
      if (cmd.status === 'sent') {
        if (cmd.attempts < cmd.maxAttempts) {
          this.trySendCommand(cmd);
        } else {
          cmd.status = 'timeout';
          cmd.error = `Timed out after ${cmd.maxAttempts} attempts`;
          cmd.completedAt = Date.now();
          this.emit('command-timeout', cmd);
        }
      }
    }, cmd.timeoutMs);

    this.timeoutHandles.set(cmd.id, handle);
  }

  private clearCommandTimeout(cmdId: string): void {
    const handle = this.timeoutHandles.get(cmdId);
    if (handle) {
      clearTimeout(handle);
      this.timeoutHandles.delete(cmdId);
    }
  }

  private getTimeout(type: CommandType): number {
    const timeouts: Record<CommandType, number> = {
      restart: 60000,
      collect_diagnostics: 120000,
      push_config: 30000,
      push_rules: 30000,
    };
    return timeouts[type];
  }

  private getMaxAttempts(type: CommandType): number {
    return type === 'restart' || type === 'collect_diagnostics' ? 2 : 3;
  }

  private flushPendingCommands(sensorId: string): void {
    for (const cmd of this.commands.values()) {
      if (cmd.sensorId === sensorId && cmd.status === 'pending') {
        this.trySendCommand(cmd);
      }
    }
  }

  private cleanupOldCommands(): void {
    const now = Date.now();
    const ttl = 300000; // 5 minutes
    for (const [id, cmd] of this.commands) {
      if (['success', 'failed', 'timeout'].includes(cmd.status) && cmd.completedAt) {
        if (now - cmd.completedAt > ttl) {
          this.commands.delete(id);
        }
      }
    }
  }

  getCommand(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getPendingCommands(sensorId: string): Command[] {
    return Array.from(this.commands.values()).filter(
      (c) => c.sensorId === sensorId && c.status === 'pending'
    );
  }

  getStats(): {
    total: number;
    pending: number;
    sent: number;
    success: number;
    failed: number;
    timeout: number;
  } {
    const commands = Array.from(this.commands.values());
    return {
      total: commands.length,
      pending: commands.filter((c) => c.status === 'pending').length,
      sent: commands.filter((c) => c.status === 'sent').length,
      success: commands.filter((c) => c.status === 'success').length,
      failed: commands.filter((c) => c.status === 'failed').length,
      timeout: commands.filter((c) => c.status === 'timeout').length,
    };
  }

  cancelCommand(commandId: string): boolean {
    const cmd = this.commands.get(commandId);
    if (!cmd || cmd.status !== 'pending') return false;

    cmd.status = 'failed';
    cmd.error = 'Cancelled';
    cmd.completedAt = Date.now();
    this.emit('command-failed', cmd);
    return true;
  }

  clear(): void {
    for (const handle of this.timeoutHandles.values()) {
      clearTimeout(handle);
    }
    this.timeoutHandles.clear();
    this.commands.clear();
  }
}
