import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppLogger extends Logger {
  logSuccess(entityId: string) {
    this.log(`SUCCESS: Processed entity ${entityId}`);
  }

  logFailure(entityId: string, reason: string) {
    this.error(`FAILURE: Entity ${entityId} failed. Reason: ${reason}`);
  }

  logSkipped(entityId: string) {
    this.warn(`SKIPPED: Duplicate entity ${entityId}`);
  }
}
