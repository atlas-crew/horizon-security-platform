# Remote Shell User Guide

This guide provides step-by-step instructions for using Signal Horizon's browser-based remote shell feature to access and manage your distributed Synapse sensors.

## Introduction

### What is Remote Shell?

Remote Shell is a browser-based terminal that allows you to access your Synapse sensors directly from the Signal Horizon dashboard. It provides a secure, interactive command-line interface without requiring direct SSH access or VPN connections.

The shell sessions run through Signal Horizon's tunnel broker, which establishes secure WebSocket connections between your browser and the sensor. This means:

- No inbound firewall ports required on sensors
- All traffic is encrypted with TLS
- Sessions are authenticated and isolated per user
- All activities are logged for compliance and auditing

### When to Use Remote Shell

Remote shell is ideal for:

- **Diagnostics**: Checking sensor health, logs, and system status
- **Troubleshooting**: Investigating connectivity issues or unexpected behavior
- **Quick inspections**: Verifying configuration files or service status
- **Emergency access**: When other access methods are unavailable

Remote shell is **not recommended** for:

- Making configuration changes (use Config Manager instead)
- Long-running operations (sessions timeout after inactivity)
- Automated scripting (use the Fleet Commander API)
- File transfers (use dedicated SCP/SFTP tooling)

### Security Considerations

Before using remote shell, understand these security principles:

- **Audit trail**: Every command you execute is logged
- **Session isolation**: Your session cannot be accessed by other users
- **Timeout enforcement**: Inactive sessions automatically terminate
- **Permission-based access**: Only users with `fleet:write` scope can access shells
- **Tenant boundaries**: You can only access sensors belonging to your organization

> **Warning**: Treat shell access as privileged access. Avoid running commands that could destabilize the sensor or expose sensitive data.

## Getting Started

### Prerequisites

Before accessing remote shell, ensure you have:

1. **User account**: Active Signal Horizon account with appropriate permissions
2. **Required scope**: `fleet:write` permission (check with your administrator)
3. **Connected sensor**: The target sensor must be online with tunnel established
4. **Shell capability**: The sensor must have the `shell` capability enabled

To verify your permissions, check your profile page or contact your tenant administrator.

### Navigating to the Sensor Detail Page

1. Log into Signal Horizon at your organization's URL
2. Navigate to **Fleet** in the main navigation
3. Click **Sensors** to view the sensor list

![Screenshot: Fleet Sensors navigation](screenshot-placeholder.png)

4. Locate your target sensor using:
   - **Search**: Type the sensor name or ID in the search box
   - **Filters**: Filter by region, status, or tags
   - **Sort**: Click column headers to sort by name, status, or last heartbeat

5. Click on the sensor row to open the sensor detail page

![Screenshot: Sensor list with search](screenshot-placeholder.png)

### Opening a Shell Session

From the sensor detail page:

1. Verify the sensor status shows **Connected** (green indicator)
2. Locate the **Remote Access** section in the detail panel
3. Click the **Open Shell** button

![Screenshot: Open Shell button on sensor detail](screenshot-placeholder.png)

4. A new terminal window opens within the dashboard
5. Wait for the connection to establish (typically 1-2 seconds)
6. You should see a shell prompt when ready

```
Connecting to sensor edge-us-east-1-prod-01...
Connection established.

synapse@edge-us-east-1-prod-01:~$
```

> **Tip**: If the Open Shell button is disabled, hover over it to see why (e.g., sensor offline, no shell capability, insufficient permissions).

## Using the Terminal

### Basic Navigation

Once connected, you have a fully functional terminal. The default shell is typically `bash` or `sh` depending on the sensor's operating system.

Common navigation commands:

```bash
# Check current directory
pwd

# List files
ls -la

# Navigate to Synapse logs
cd /var/log/synapse

# View system information
uname -a
```

### Keyboard Shortcuts

The web terminal supports standard terminal shortcuts:

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Interrupt current command |
| `Ctrl+D` | Exit shell (end session) |
| `Ctrl+L` | Clear terminal screen |
| `Ctrl+Z` | Suspend current process |
| `Ctrl+Shift+C` | Copy selected text |
| `Ctrl+Shift+V` | Paste from clipboard |
| `Tab` | Command/path auto-completion |
| `Up/Down` | Navigate command history |
| `Ctrl+R` | Reverse search command history |

> **Note**: Some shortcuts may vary depending on your browser and operating system. Mac users can use `Cmd` instead of `Ctrl` for copy/paste.

### Terminal Resize Behavior

The terminal automatically adapts to your browser window size:

- **Automatic resize**: Terminal dimensions update when you resize the browser
- **Minimum size**: 80 columns x 24 rows
- **Maximum size**: Limited by your screen resolution

To manually trigger a resize (if output appears misaligned):

1. Resize your browser window slightly
2. Or refresh the terminal panel (without disconnecting)

If running applications with fixed layouts (like `htop` or `vim`), resize your window first before launching them.

### Session Timeout Warnings

Sessions automatically terminate after a period of inactivity (default: 30 minutes). The terminal displays warnings before timeout:

```
⚠ Session will timeout in 5 minutes due to inactivity.
   Press any key to keep the session active.
```

When you see this warning:

1. Press any key or run a command to reset the timeout timer
2. If you're actively working, the timer resets automatically with each command

After timeout, you'll see:

```
Session terminated due to inactivity.
Connection closed.
```

To reconnect, click **Open Shell** again from the sensor detail page.

### Exiting the Session

To properly close your shell session:

**Method 1: Exit command**
```bash
exit
```

**Method 2: Keyboard shortcut**
Press `Ctrl+D` at an empty prompt.

**Method 3: Close button**
Click the **X** button on the terminal panel header.

> **Important**: Always exit sessions properly. While the system handles disconnections gracefully, proper exit ensures clean resource cleanup.

## Troubleshooting

### Connection Issues

**Error: "Sensor tunnel not found"**

This error indicates the sensor's WebSocket tunnel is not connected.

**Causes:**
- Sensor is powered off or rebooting
- Network connectivity issue between sensor and Signal Horizon
- Sensor agent service not running

**Solutions:**
1. Check the sensor status on the Fleet Overview page
2. Wait a few minutes if the sensor recently came online
3. Contact your infrastructure team to verify sensor health
4. Check sensor-side logs if you have alternative access

**Error: "Connection timeout"**

**Causes:**
- High network latency
- Signal Horizon server under heavy load
- Browser network restrictions

**Solutions:**
1. Refresh the page and try again
2. Check your internet connection
3. Try a different browser
4. Contact support if the issue persists

**Error: "WebSocket connection failed"**

**Causes:**
- Corporate firewall blocking WebSocket connections
- Browser extensions interfering with connections
- Proxy not configured for WebSocket upgrade

**Solutions:**
1. Verify WebSocket connections are allowed through your firewall
2. Disable browser extensions temporarily
3. Configure your proxy to allow WebSocket upgrades for Signal Horizon

### Session Timeout

**Problem: Session ends unexpectedly**

If your session terminates sooner than expected:

1. Check if you were inactive for the timeout period
2. Verify the sensor didn't disconnect (check Fleet Overview)
3. Check your JWT token hasn't expired (re-login if needed)

**Prevention:**
- Keep an idle process running: `watch -n 60 date` (sends activity every 60 seconds)
- Use `tmux` or `screen` for long-running work (sessions persist on sensor)

### Permission Denied Errors

**Error: "Forbidden - insufficient permissions"**

**Cause:** Your user account lacks the required `fleet:write` scope.

**Solution:**
1. Contact your tenant administrator
2. Request the `fleet:write` permission
3. Log out and back in after permissions are granted

**Error: "Forbidden - tenant mismatch"**

**Cause:** Attempting to access a sensor belonging to a different organization.

**Solution:**
1. Verify you're logged into the correct tenant
2. Check the sensor ID is correct
3. Contact support if you believe this is an error

### Common Commands for Debugging Synapse

When troubleshooting Synapse sensor issues, these commands are particularly useful:

**Check Synapse service status:**
```bash
systemctl status synapse
```

**View recent Synapse logs:**
```bash
journalctl -u synapse -n 100 --no-pager
```

**Check Synapse configuration:**
```bash
cat /etc/synapse/config.yaml
```

**Verify Synapse is listening:**
```bash
ss -tlnp | grep synapse
```

**Check resource usage:**
```bash
top -bn1 | head -20
free -h
df -h
```

**Test connectivity to Signal Horizon:**
```bash
curl -I https://your-signal-horizon.com/health
```

**View current connections:**
```bash
netstat -an | grep ESTABLISHED | wc -l
```

**Check Synapse version:**
```bash
synapse --version
```

## Best Practices

### Security Hygiene

1. **Don't run as root**: Unless absolutely necessary, avoid using `sudo` or logging in as root. Most diagnostic commands work without elevated privileges.

2. **Avoid modifying configuration files**: Use the Config Manager in Signal Horizon for configuration changes. Manual edits bypass version control and drift detection.

3. **Don't install packages**: Avoid using `apt`, `yum`, or other package managers during shell sessions. Use proper change management processes.

4. **Never expose credentials**: Don't run commands that display API keys, passwords, or other secrets. If you must check credentials, use redacted views.

### Session Management

1. **Keep sessions short**: Open a session, perform your task, and exit. Don't leave sessions open indefinitely.

2. **One task per session**: For clarity and audit purposes, focus each session on a specific diagnostic task.

3. **Use screen/tmux for long operations**: If you need to run a command that takes time:
   ```bash
   screen -S mywork
   # Run your long command
   # Press Ctrl+A, then D to detach
   ```
   Reconnect later with `screen -r mywork`

### Diagnostic-First Approach

1. **Read before write**: Always check the current state before making changes:
   - Check logs first
   - Review configuration files
   - Understand what's running

2. **Use non-destructive commands**: Prefer commands that read data over those that modify:
   - `cat` over `echo >`
   - `grep` over `sed -i`
   - `systemctl status` over `systemctl restart`

3. **Document your findings**: Take notes of what you discover for tickets and incident reports.

### When to Escalate

Use shell access for initial diagnostics, but escalate to proper change management when:

- You identify a configuration change is needed
- You need to restart services (use Fleet Commander)
- You find a bug that requires a software update
- You need to access multiple sensors for the same issue (use automation)

## Related Documentation

- [Remote Access Architecture](../tutorials/remote-access.md) - Technical details of the tunnel system
- [Fleet Management](../features/fleet-management.md) - Overview of fleet operations
- [Sensor Protocol Guide](../sensor-protocol.md) - How sensors communicate with Signal Horizon
- [API Key Management](../tutorials/api-key-management.md) - Managing access credentials

## Quick Reference Card

| Task | Command |
|------|---------|
| Open shell | Fleet → Sensors → [Select Sensor] → Open Shell |
| Exit session | `exit` or `Ctrl+D` |
| Copy text | `Ctrl+Shift+C` |
| Paste text | `Ctrl+Shift+V` |
| Clear screen | `Ctrl+L` |
| Cancel command | `Ctrl+C` |
| Check Synapse | `systemctl status synapse` |
| View logs | `journalctl -u synapse -n 100` |
| Check resources | `top` or `htop` |
| Test connectivity | `curl -I https://signal-horizon.com/health` |
