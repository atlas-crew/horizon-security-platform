import React from 'react';
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

export const SummaryCards: React.FC<Props> = ({ summary }) => {
  return (
    <div className={styles.summaryCards}>
      <div className={`${styles.card} ${styles.total} card`}>
        <div className={styles.value}>{formatCount(summary.totalEndpoints)}</div>
        <div className={styles.label}>Endpoints</div>
      </div>

      <div className={`${styles.card} ${styles.highRisk} card`}>
        <div className={styles.value}>{formatCount(summary.highRiskCount)}</div>
        <div className={styles.label}>High Risk</div>
      </div>

      <div className={`${styles.card} ${styles.mediumRisk} card`}>
        <div className={styles.value}>{formatCount(summary.mediumRiskCount)}</div>
        <div className={styles.label}>Medium Risk</div>
      </div>

      <div className={`${styles.card} ${styles.lowRisk} card`}>
        <div className={styles.value}>{formatCount(summary.lowRiskCount)}</div>
        <div className={styles.label}>Low Risk</div>
      </div>
    </div>
  );
};
