import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BulkAction } from '../schemas/bulk-action.schema';
import { BulkActionStatus } from '../../../shared/constants';

@Injectable()
export class BulkActionStatusService {
  constructor(
    @InjectModel(BulkAction.name) private bulkActionModel: Model<BulkAction>
  ) {}

  async getActionsByStatus(
    status?: BulkActionStatus,
    accountId?: string
  ): Promise<BulkAction[]> {
    const query: any = {};
    
    if (status) {
      query.status = status;
    }
    
    if (accountId) {
      query.accountId = accountId;
    }
    
    return this.bulkActionModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();
  }

  async getStatusSummary(accountId?: string): Promise<Record<string, number>> {
    const matchStage: any = {};
    if (accountId) {
      matchStage.accountId = accountId;
    }

    const results = await this.bulkActionModel.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const summary: Record<BulkActionStatus, number> = {
      [BulkActionStatus.PENDING]: 0,
      [BulkActionStatus.QUEUED]: 0,
      [BulkActionStatus.PROCESSING]: 0,
      [BulkActionStatus.COMPLETED]: 0,
      [BulkActionStatus.FAILED]: 0,
      [BulkActionStatus.COMPLETED_WITH_ERR]: 0
    };

    results.forEach(result => {
      if (result._id in summary) {
        summary[result._id as BulkActionStatus] = result.count;
      }
    });

    return summary;
  }
}
