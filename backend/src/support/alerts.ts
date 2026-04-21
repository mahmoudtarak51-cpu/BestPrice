import { createLogger } from './logger.js';

const logger = createLogger('Alerts');

/**
 * Alert types and severity levels
 */
export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  adapterId?: string;
  createdAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Alert management service
 * Handles creation and tracking of operational alerts
 */
export class AlertService {
  private alerts: Map<string, Alert> = new Map();
  private alertListeners: ((alert: Alert) => void)[] = [];

  /**
   * Create a new alert
   */
  createAlert(data: {
    severity: AlertSeverity;
    type: string;
    message: string;
    adapterId?: string;
    metadata?: Record<string, unknown>;
  }): Alert {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      severity: data.severity,
      type: data.type,
      message: data.message,
      adapterId: data.adapterId,
      createdAt: new Date(),
      metadata: data.metadata,
    };

    this.alerts.set(alert.id, alert);

    logger.info({
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      adapterId: alert.adapterId,
      message: alert.message,
    }, 'Alert created');

    // Notify listeners
    this.alertListeners.forEach((listener) => listener(alert));

    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): Alert | null {
    const alert = this.alerts.get(alertId);
    if (!alert) return null;

    alert.resolvedAt = new Date();
    this.alerts.set(alertId, alert);

    logger.info({
      alertId,
      type: alert.type,
      durationMs: alert.resolvedAt.getTime() - alert.createdAt.getTime(),
    }, 'Alert resolved');

    return alert;
  }

  /**
   * Get active alerts (unresolved)
   */
  getActiveAlerts(filter?: {
    severity?: AlertSeverity;
    type?: string;
    adapterId?: string;
  }): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => {
      if (alert.resolvedAt) return false;
      if (filter?.severity && alert.severity !== filter.severity) return false;
      if (filter?.type && alert.type !== filter.type) return false;
      if (filter?.adapterId && alert.adapterId !== filter.adapterId) return false;
      return true;
    });
  }

  /**
   * Subscribe to alert events
   */
  onAlert(listener: (alert: Alert) => void): () => void {
    this.alertListeners.push(listener);
    return () => {
      this.alertListeners = this.alertListeners.filter(l => l !== listener);
    };
  }
}

/**
 * Common alert scenarios
 */
export function createStaleDataAlert(adapterId: string, hoursStale: number): Alert {
  return {
    id: `stale-${adapterId}-${Date.now()}`,
    severity: AlertSeverity.WARNING,
    type: 'STALE_DATA',
    message: `Source ${adapterId} has no successful crawl in the last ${hoursStale} hours`,
    adapterId,
    createdAt: new Date(),
  };
}

export function createCrawlFailureAlert(adapterId: string, reason: string): Alert {
  return {
    id: `failure-${adapterId}-${Date.now()}`,
    severity: AlertSeverity.ERROR,
    type: 'CRAWL_FAILURE',
    message: `Crawl failed for source ${adapterId}: ${reason}`,
    adapterId,
    createdAt: new Date(),
    metadata: {
      failureReason: reason,
    },
  };
}

export function createUnmatchedProductAlert(count: number, adapterId?: string): Alert {
  return {
    id: `unmatched-${adapterId || 'all'}-${Date.now()}`,
    severity: AlertSeverity.INFO,
    type: 'UNMATCHED_PRODUCTS',
    message: `${count} products could not be matched to canonical products${adapterId ? ` for ${adapterId}` : ''}`,
    adapterId,
    createdAt: new Date(),
    metadata: {
      unmatchedCount: count,
    },
  };
}
