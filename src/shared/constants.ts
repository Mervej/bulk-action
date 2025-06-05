// Bulk Action Status types
export enum BulkActionStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED_WITH_ERR = 'completed_with_err',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Action Types
export enum ActionType {
  UPDATE = 'bulk-update',
  DELETE = 'bulk-delete'
}

// Log Types
export enum LogType {
  SUCCESS = 'success',
  FAILURE = 'failure',
  SKIPPED = 'skipped',
  PENDING = 'pending'
}

// Constants for queues
export const BULK_ACTION_QUEUE = 'bulk-action';

// Batch processing constants
export const DEFAULT_BATCH_SIZE = 100;
export const FILE_PROCESSING_BATCH_SIZE = 1000;

// Rate limiting constants
export const RATE_LIMIT_PER_MINUTE = 100;
export const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Queue settings
export const QUEUE_RETRY_ATTEMPTS = 3;
export const QUEUE_BACKOFF_DELAY = 2000;
