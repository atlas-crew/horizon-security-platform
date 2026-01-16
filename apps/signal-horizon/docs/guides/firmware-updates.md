# Firmware Updates User Guide

This guide provides step-by-step instructions for managing Synapse sensor firmware releases and deploying updates across your fleet using Signal Horizon.

## Introduction

### Release Management Overview

Signal Horizon provides centralized firmware management for your entire Synapse sensor fleet. The release management system allows you to:

- **Upload releases**: Store firmware packages with version metadata and changelogs
- **Plan rollouts**: Define deployment strategies tailored to your risk tolerance
- **Execute updates**: Deploy firmware to sensors individually or in batches
- **Monitor progress**: Track deployment status in real-time
- **Rollback**: Revert to previous versions when issues arise

All firmware operations are tracked in the audit log for compliance and troubleshooting.

### Rollout Strategies Explained

Signal Horizon supports three rollout strategies to balance speed and safety:

#### Immediate Rollout

Deploy to all target sensors simultaneously.

**Best for:**
- Small fleets (< 20 sensors)
- Critical security patches requiring urgent deployment
- Development/staging environments

**Trade-offs:**
- Fastest deployment
- Highest risk if issues are discovered

#### Canary Rollout

Deploy to a small percentage first, then expand after validation.

**Best for:**
- Medium to large fleets
- New features requiring real-world validation
- Risk-averse organizations

**How it works:**
1. Deploy to 10% of targets (canary group)
2. Monitor for a configured duration (e.g., 15 minutes)
3. If no issues detected, proceed to remaining sensors
4. If issues detected, halt and optionally rollback canaries

**Trade-offs:**
- Catches issues before wide deployment
- Slower overall deployment time
- Requires monitoring during canary phase

#### Rolling Rollout

Deploy in sequential batches with configurable delays.

**Best for:**
- Large fleets (100+ sensors)
- Geographic distribution (batch by region)
- Minimizing blast radius

**How it works:**
1. Divide targets into batches (e.g., 10 sensors each)
2. Deploy to first batch
3. Wait for configured delay (e.g., 5 minutes)
4. Proceed to next batch
5. Repeat until complete

**Trade-offs:**
- Most controlled deployment
- Slowest total time
- Issues may affect multiple batches before detection

## Uploading a Release

### Step-by-Step Upload Process

1. Navigate to **Fleet → Updates** in the main navigation

![Screenshot: Updates navigation](screenshot-placeholder.png)

2. Click the **Upload Release** button in the top-right corner

3. Fill in the release details:

![Screenshot: Upload Release form](screenshot-placeholder.png)

**Required fields:**

| Field | Description | Example |
|-------|-------------|---------|
| Version | Semantic version number | `2.4.1` |
| Package | Firmware binary file | `synapse-2.4.1-linux-amd64.tar.gz` |
| Changelog | Release notes (Markdown) | See format below |

**Optional fields:**

| Field | Description | Example |
|-------|-------------|---------|
| SHA-256 | Hash for verification | `a3b2c1d4e5f6...` |
| Minimum Version | Required previous version | `2.3.0` |
| Release Notes URL | Link to full documentation | `https://docs.example.com/releases/2.4.1` |

4. Click **Upload** to submit the release

5. Wait for upload and verification to complete

6. The release appears in the releases list with status **Available**

### Version Naming Conventions

Follow semantic versioning (SemVer) for consistent release management:

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
```

**Components:**

- **MAJOR**: Breaking changes or major features (2.0.0, 3.0.0)
- **MINOR**: New features, backward compatible (2.1.0, 2.2.0)
- **PATCH**: Bug fixes, backward compatible (2.1.1, 2.1.2)
- **PRERELEASE**: Optional pre-release identifier (2.2.0-beta.1, 2.2.0-rc.1)
- **BUILD**: Optional build metadata (2.1.1+build.123)

**Examples:**

| Version | Meaning |
|---------|---------|
| `2.4.1` | Patch release with bug fixes |
| `2.5.0` | Minor release with new features |
| `3.0.0` | Major release with breaking changes |
| `2.5.0-beta.1` | Beta pre-release for testing |
| `2.5.0-rc.1` | Release candidate for final validation |

> **Tip**: Use consistent versioning to enable automatic version comparison and upgrade path validation.

### Changelog Format

Write changelogs in Markdown for proper rendering in the dashboard:

```markdown
## What's New

### Features
- Added support for custom blocklist sources
- Improved geographic IP detection accuracy
- New metrics endpoint for Prometheus integration

### Improvements
- Reduced memory usage by 15% under high load
- Faster startup time (now < 5 seconds)
- Better error messages for configuration issues

### Bug Fixes
- Fixed race condition in rule evaluation (#1234)
- Resolved memory leak when processing large payloads (#1256)
- Corrected timezone handling in log timestamps (#1278)

### Security
- Updated TLS library to address CVE-2025-1234
- Improved input validation for API endpoints

### Breaking Changes
- Removed deprecated `legacy_mode` configuration option
- Changed default port from 8080 to 8443

### Upgrade Notes
- Requires minimum version 2.3.0 to upgrade
- Review changed default port in deployment configurations
```

> **Tip**: Link to issue numbers in your bug tracker for traceability.

### SHA-256 Verification

Always provide SHA-256 checksums for firmware packages. This ensures:

- Package integrity during transfer
- Protection against tampering
- Verification before sensor applies update

**Generating SHA-256:**

Linux/macOS:
```bash
sha256sum synapse-2.4.1-linux-amd64.tar.gz
# Output: a3b2c1d4e5f6g7h8... synapse-2.4.1-linux-amd64.tar.gz
```

Windows (PowerShell):
```powershell
Get-FileHash synapse-2.4.1-linux-amd64.tar.gz -Algorithm SHA256
```

**Verification process:**
1. Signal Horizon stores the provided SHA-256 with the release
2. Sensors download the package
3. Sensors compute SHA-256 of downloaded package
4. Update only proceeds if hashes match

## Planning a Rollout

### Choosing a Strategy

Select the appropriate strategy based on your fleet size and risk tolerance:

| Fleet Size | Risk Tolerance | Recommended Strategy |
|------------|---------------|---------------------|
| 1-20 sensors | Any | Immediate |
| 20-100 sensors | Low | Canary |
| 20-100 sensors | Medium/High | Rolling |
| 100+ sensors | Any | Rolling or Canary |

**Additional considerations:**

- **Critical security patch**: Use Immediate with close monitoring
- **New major version**: Use Canary with extended validation period
- **Routine update**: Use Rolling with standard batch size

### Creating a Rollout Plan

1. From the **Updates** page, select the release you want to deploy

2. Click **Plan Rollout**

![Screenshot: Plan Rollout button](screenshot-placeholder.png)

3. Select the rollout strategy:

![Screenshot: Strategy selection](screenshot-placeholder.png)

4. Configure strategy-specific options (see sections below)

5. Select target sensors

6. Review and confirm the plan

### Immediate Rollout Configuration

For immediate rollouts, configure:

| Option | Description | Default |
|--------|-------------|---------|
| Timeout | Max time to wait for each sensor | 10 minutes |
| Fail threshold | Abort if X sensors fail | 3 |

![Screenshot: Immediate rollout options](screenshot-placeholder.png)

### Canary Rollout Configuration

For canary rollouts, configure:

| Option | Description | Default |
|--------|-------------|---------|
| Canary percentage | Initial deployment size | 10% |
| Validation period | Time to monitor canaries | 15 minutes |
| Auto-proceed | Continue automatically if no issues | Enabled |
| Success criteria | Metrics to evaluate | Health score > 90 |

![Screenshot: Canary rollout options](screenshot-placeholder.png)

### Rolling Rollout Configuration

For rolling rollouts, configure:

| Option | Description | Default |
|--------|-------------|---------|
| Batch size | Sensors per batch | 10 |
| Batch delay | Wait between batches | 5 minutes |
| Fail threshold | Failures to halt rollout | 2 per batch |
| Batch order | How to group sensors | By region |

![Screenshot: Rolling rollout options](screenshot-placeholder.png)

### Selecting Target Sensors

Filter and select sensors for the rollout:

**By Tags:**
- Select sensors with specific tags (e.g., `environment:production`, `region:us-east`)
- Combine tags with AND/OR logic

![Screenshot: Tag-based sensor selection](screenshot-placeholder.png)

**By Version:**
- Target sensors on a specific current version
- Useful for incremental upgrades

**By Region:**
- Select all sensors in specific regions
- Useful for geographic phased rollouts

**Manual Selection:**
- Individually select sensors from the list
- Best for targeted updates to specific sensors

**Selection Preview:**
- Review the final list of selected sensors
- Verify count matches expectations
- Check for any sensors that should be excluded

### Batch Size and Delay Configuration

For rolling rollouts, tune these parameters:

**Batch Size Guidance:**

| Fleet Size | Recommended Batch Size |
|------------|----------------------|
| 20-50 | 5-10 sensors |
| 50-100 | 10-15 sensors |
| 100-500 | 20-30 sensors |
| 500+ | 50 sensors |

**Delay Guidance:**

| Risk Level | Recommended Delay |
|------------|------------------|
| Low | 2-3 minutes |
| Medium | 5-10 minutes |
| High | 15-30 minutes |

> **Tip**: Longer delays allow more time to detect issues but increase total rollout duration. Balance based on your monitoring capabilities and incident response speed.

## Executing a Rollout

### Starting the Rollout

Once your plan is configured:

1. Review the rollout summary:
   - Target sensors count
   - Strategy and configuration
   - Estimated completion time

2. Click **Start Rollout**

![Screenshot: Start Rollout confirmation](screenshot-placeholder.png)

3. Confirm the action in the dialog

4. The rollout begins and you're taken to the progress page

### Monitoring Progress

The progress page shows real-time status:

![Screenshot: Rollout progress page](screenshot-placeholder.png)

**Overall Progress:**
- Progress bar showing completion percentage
- Estimated time remaining
- Current phase (for canary/rolling)

**Sensor Status Table:**

| Status | Meaning | Icon |
|--------|---------|------|
| Pending | Waiting for deployment | ⏳ |
| Downloading | Fetching package | ⬇️ |
| Verifying | Checking SHA-256 | 🔍 |
| Installing | Applying update | ⚙️ |
| Restarting | Service restarting | 🔄 |
| Completed | Successfully updated | ✅ |
| Failed | Update failed | ❌ |
| Skipped | Excluded from rollout | ⏭️ |

**For Canary Rollouts:**
- Canary phase progress
- Validation countdown timer
- Health metrics of canary sensors
- "Proceed" or "Abort" buttons after validation period

**For Rolling Rollouts:**
- Current batch number (e.g., "Batch 3 of 10")
- Delay countdown between batches
- Per-batch success/failure counts

### Interpreting Status Indicators

**Health Indicators:**

| Indicator | Meaning |
|-----------|---------|
| 🟢 Green | All systems healthy |
| 🟡 Yellow | Minor issues detected |
| 🔴 Red | Critical issues, attention needed |

**Rollout Status:**

| Status | Description |
|--------|-------------|
| In Progress | Rollout actively deploying |
| Paused | Manually paused or waiting for validation |
| Completed | All sensors successfully updated |
| Completed with Errors | Some sensors failed but rollout finished |
| Aborted | Rollout stopped due to failures or manual abort |
| Rolled Back | Rollout reverted to previous version |

### Handling Failures

When a sensor fails to update:

1. **View error details**: Click on the failed sensor row to see:
   - Error message
   - Failed phase (download, verify, install, restart)
   - Sensor logs snippet

2. **Decide action**:
   - **Retry**: Attempt the update again
   - **Skip**: Exclude this sensor and continue
   - **Investigate**: Open shell to diagnose manually

3. **Threshold behavior**:
   - If failures exceed the configured threshold, rollout pauses automatically
   - You can choose to continue, abort, or investigate

**Common failure actions:**

| Error Type | Recommended Action |
|------------|-------------------|
| Download failed | Check network, retry |
| Verification failed | Re-upload package, retry |
| Installation failed | Investigate logs, may need manual intervention |
| Restart failed | Check sensor health, may need manual restart |

## Rollback Procedures

### When to Rollback

Consider rollback when:

- **Health degradation**: Fleet health score drops significantly after update
- **Functional issues**: Core features not working correctly
- **Performance problems**: Increased latency or resource usage
- **Widespread failures**: Multiple sensors reporting errors

> **Warning**: Always investigate the root cause before rolling back. Rollback doesn't fix underlying issues, it temporarily restores service.

### Automatic Rollback

Automatic rollback can be configured during rollout planning:

**Canary Auto-Rollback:**
- Triggers if canary health drops below threshold
- Reverts canary sensors to previous version
- Halts further deployment

**Rolling Auto-Rollback:**
- Triggers if batch failure rate exceeds threshold
- Can rollback completed batches
- Prevents further batches

**Configuration:**

| Option | Description | Default |
|--------|-------------|---------|
| Auto-rollback enabled | Enable automatic rollback | Enabled |
| Health threshold | Minimum health score | 80 |
| Failure threshold | Max failures before rollback | 20% |
| Rollback scope | What to revert | Failed sensors only |

### Manual Rollback

To manually initiate rollback:

1. Navigate to **Fleet → Updates**

2. Find the active or completed rollout

3. Click **Rollback**

![Screenshot: Rollback button](screenshot-placeholder.png)

4. Select rollback scope:
   - **All updated sensors**: Revert entire rollout
   - **Failed sensors only**: Revert sensors showing issues
   - **Select sensors**: Choose specific sensors

5. Confirm the rollback

6. Monitor rollback progress

### Verifying Rollback Success

After rollback completes:

1. **Check version distribution**:
   - Fleet Overview should show sensors on previous version
   - No sensors should remain on rolled-back version

2. **Verify health metrics**:
   - Health scores should return to pre-update levels
   - No ongoing errors related to the update

3. **Test functionality**:
   - Verify core features are working
   - Check logs for any persistent issues

4. **Document the incident**:
   - Record what went wrong
   - Create an issue for investigation
   - Plan remediation before next attempt

## Troubleshooting

### Download Failures

**Error: "Failed to download firmware package"**

**Causes:**
- Network connectivity issues between sensor and Signal Horizon
- Firewall blocking download URL
- Package storage temporarily unavailable

**Solutions:**
1. Verify sensor network connectivity:
   ```bash
   curl -I https://signal-horizon.com/releases/synapse-2.4.1.tar.gz
   ```

2. Check firewall rules allow HTTPS to Signal Horizon

3. Retry the download:
   - From the rollout progress page, click **Retry** on the failed sensor

4. If persistent, download manually and verify package is accessible

### Verification Failures

**Error: "SHA-256 verification failed"**

**Causes:**
- Package corrupted during transfer
- Incorrect SHA-256 provided during upload
- Man-in-the-middle attack (rare)

**Solutions:**
1. **Verify the source package**:
   ```bash
   sha256sum synapse-2.4.1-linux-amd64.tar.gz
   ```
   Compare with the SHA-256 in Signal Horizon

2. **Re-upload if mismatch**:
   - Delete the incorrect release
   - Upload again with correct SHA-256

3. **Retry the download**:
   - Network corruption may have occurred
   - Sensor will re-download and verify

4. **Check for tampering**:
   - If verification repeatedly fails with correct SHA, investigate network path
   - Consider enabling additional security measures

### Activation Failures

**Error: "Failed to activate new version"**

**Causes:**
- Insufficient disk space
- Permission issues
- Incompatible system requirements
- Corrupted installation

**Solutions:**
1. **Check disk space**:
   ```bash
   df -h /opt/synapse
   ```
   Ensure at least 500MB free for update

2. **Verify permissions**:
   ```bash
   ls -la /opt/synapse/
   ```
   Update user must have write access

3. **Check system requirements**:
   - Verify CPU architecture matches package
   - Ensure required dependencies are present

4. **Review installation logs**:
   ```bash
   journalctl -u synapse-updater -n 100
   ```

5. **Manual intervention**:
   - Open shell session to sensor
   - Manually run update with verbose logging
   - Contact support if issue persists

### Sensor Not Responding

**Error: "Sensor not responding to update command"**

**Causes:**
- Sensor tunnel disconnected
- Sensor agent not running
- Command queue full or blocked

**Solutions:**
1. **Check sensor status**:
   - View sensor in Fleet Overview
   - Verify tunnel status shows Connected

2. **Wait and retry**:
   - Sensor may be temporarily busy
   - Retry after a few minutes

3. **Restart sensor agent**:
   - Use Fleet Commander to send restart command
   - Or manually via alternative access method

4. **Check sensor logs**:
   ```bash
   journalctl -u signal-horizon-sensor -n 100
   ```

5. **Verify heartbeats**:
   - Check last heartbeat timestamp
   - If stale, sensor may need physical intervention

### Rollout Stuck

**Error: Rollout shows "In Progress" but no sensors updating**

**Causes:**
- All sensors offline or unavailable
- Scheduling conflict with maintenance window
- Backend service issue

**Solutions:**
1. **Check target sensors**:
   - Are selected sensors online?
   - Do they meet minimum version requirements?

2. **Review rollout logs**:
   - Click on rollout to view detailed logs
   - Look for scheduling or queue messages

3. **Cancel and restart**:
   - Abort the stuck rollout
   - Create a new rollout plan
   - Verify sensor availability before starting

4. **Contact support**:
   - If rollout system appears to be malfunctioning
   - Include rollout ID and timestamps

## Related Documentation

- [Fleet Management](../features/fleet-management.md) - Overview of fleet operations
- [Remote Shell Guide](./remote-shell.md) - Accessing sensors for diagnostics
- [Sensor Protocol Guide](../sensor-protocol.md) - How sensors communicate with Signal Horizon
- [Config Manager](../features/fleet-management.md#3-configuration-management) - Managing sensor configurations

## Quick Reference Card

| Task | Location |
|------|----------|
| Upload release | Fleet → Updates → Upload Release |
| Plan rollout | Fleet → Updates → [Select Release] → Plan Rollout |
| Monitor rollout | Fleet → Updates → [Active Rollout] |
| Rollback | Fleet → Updates → [Rollout] → Rollback |
| View sensor status | Fleet → Sensors → [Sensor] |
| Check version | Fleet → Sensors → Version column |

| Strategy | Use When |
|----------|----------|
| Immediate | Small fleet, critical patch |
| Canary | New features, medium fleet |
| Rolling | Large fleet, controlled deployment |

| Status | Action |
|--------|--------|
| Download failed | Check network, retry |
| Verify failed | Check SHA-256, re-upload |
| Install failed | Check logs, disk space |
| Sensor offline | Wait for reconnection, investigate |
