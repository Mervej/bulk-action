import { Injectable } from '@nestjs/common';
import { BulkAction } from '../schemas/bulk-action.schema';
import { BulkActionEntityService } from './bulk-action-entity.service';

@Injectable()
export class StatsService {
  constructor(
    private readonly bulkActionEntityService: BulkActionEntityService
  ) {}

  async getStats(actionId: string) {
    return this.bulkActionEntityService.getEntitiesStats(actionId);
  }

  async recordActionCompletion(
    action: BulkAction, 
    stats: { 
      successCount: number; 
      failedCount: number; 
      skippedCount: number; 
      totalCount: number;
    }
  ) {
    // Additional logic for recording stats can be added here
    console.log(`Bulk action ${action._id} completed with stats:`, stats);
  }
}
