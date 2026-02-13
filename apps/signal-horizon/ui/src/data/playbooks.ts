import { z } from 'zod';

export const PlaybookStepTypeSchema = z.enum(['action', 'approval', 'notification']);
export type PlaybookStepType = z.infer<typeof PlaybookStepTypeSchema>;

export const PlaybookStepSchema = z.object({
  name: z.string().min(1),
  type: PlaybookStepTypeSchema,
});
export type PlaybookStep = z.infer<typeof PlaybookStepSchema>;

export const PlaybookSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  steps: z.array(PlaybookStepSchema).min(1),
});
export type Playbook = z.infer<typeof PlaybookSchema>;

const PLAYBOOKS_DATA: Playbook[] = [
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
      { name: 'Block Sensor IP', type: 'approval' },
      { name: 'Flush Fleet Cache', type: 'action' },
    ]
  },
  {
    id: 'pb-3',
    name: 'Active Exploitation Response (SQLi/XSS)',
    description: 'Contain targeted application-layer attacks.',
    steps: [
      { name: 'Enable Strict WAF Mode', type: 'approval' },
      { name: 'Deploy Virtual Patch (Regex)', type: 'action' },
      { name: 'Post-Mortem Impact Search', type: 'action' },
      { name: 'Escalate to AppSec', type: 'notification' },
    ]
  },
  {
    id: 'pb-4',
    name: 'DDoS / Volumetric Mitigation',
    description: 'Protect sensor availability during traffic surges.',
    steps: [
      { name: 'Enable Regional Geofencing', type: 'approval' },
      { name: 'Trigger Cluster Auto-Scale', type: 'action' },
      { name: 'Rate-Limit Unauthenticated APIs', type: 'action' },
      { name: 'Update Status Page', type: 'notification' },
    ]
  },
  {
    id: 'pb-5',
    name: 'API Data Exfiltration Containment',
    description: 'Stop large-scale data theft via compromised credentials.',
    steps: [
      { name: 'Identify High-Egress Sessions', type: 'action' },
      { name: 'Enable Deep Packet Inspection', type: 'action' },
      { name: 'Suspend Suspected API Keys', type: 'approval' },
      { name: 'Notify Legal & Compliance', type: 'notification' },
    ]
  },
  {
    id: 'pb-6',
    name: 'Zero-Day Vulnerability "Hotpatch"',
    description: 'Rapidly deploy fleet-wide protection for new CVEs.',
    steps: [
      { name: 'Pull Threat Intelligence Feed', type: 'action' },
      { name: 'Propagate Global Block Rule', type: 'approval' },
      { name: 'Monitor Dry-Run Hits', type: 'action' },
      { name: 'Enforce Block Mode', type: 'approval' },
    ]
  },
  {
    id: 'pb-7',
    name: 'Internal Reconnaissance Response',
    description: 'Identify and isolate lateral movement attempts.',
    steps: [
      { name: 'Correlate Source with IdP Logs', type: 'action' },
      { name: 'Isolate Host at Network Edge', type: 'approval' },
      { name: 'Alert SOC / IT Security', type: 'notification' },
    ]
  },
];

// Validate unique IDs
const ids = new Set();
for (const pb of PLAYBOOKS_DATA) {
  if (ids.has(pb.id)) {
    throw new Error(`Duplicate playbook ID: ${pb.id}`);
  }
  ids.add(pb.id);
}

// Export validated data
export const PLAYBOOKS = z.array(PlaybookSchema).parse(PLAYBOOKS_DATA);
