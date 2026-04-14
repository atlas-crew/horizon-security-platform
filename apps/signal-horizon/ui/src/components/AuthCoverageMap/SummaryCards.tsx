import React from 'react';
import { Panel } from '@/ui';
import styles from './SummaryCards.module.css';

export interface CoverageMapSummary {
  totalEndpoints: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  unknownCount: number;
  lastUpdated: Date;
}

interface Props {
  summary: CoverageMapSummary;
}

const formatCount = (value: number) => value.toLocaleString();

// Panel now owns the card chrome (background, border, shadow). The CSS
// module keeps .summaryCards (grid layout) and the color-accent classes
// (.total, .highRisk, .mediumRisk, .lowRisk) which tint the value text.
// The module's .card rule (padding + text-align) is superseded by
// Panel's own padding + the text-center className on each cell.
export const SummaryCards: React.FC<Props> = ({ summary }) => {
  return (
    <div className={styles.summaryCards}>
      <Panel tone="default" padding="sm" spacing="none" className={`${styles.total} text-center`}>
        <div className={styles.value}>{formatCount(summary.totalEndpoints)}</div>
        <div className={styles.label}>Endpoints</div>
      </Panel>

      <Panel tone="default" padding="sm" spacing="none" className={`${styles.highRisk} text-center`}>
        <div className={styles.value}>{formatCount(summary.highRiskCount)}</div>
        <div className={styles.label}>High Risk</div>
      </Panel>

      <Panel tone="default" padding="sm" spacing="none" className={`${styles.mediumRisk} text-center`}>
        <div className={styles.value}>{formatCount(summary.mediumRiskCount)}</div>
        <div className={styles.label}>Medium Risk</div>
      </Panel>

      <Panel tone="default" padding="sm" spacing="none" className={`${styles.lowRisk} text-center`}>
        <div className={styles.value}>{formatCount(summary.lowRiskCount)}</div>
        <div className={styles.label}>Low Risk</div>
      </Panel>
    </div>
  );
};
