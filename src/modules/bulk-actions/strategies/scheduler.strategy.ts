import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { BulkAction } from '../schemas/bulk-action.schema';
import { BulkActionStatus, BULK_ACTION_QUEUE, QUEUE_RETRY_ATTEMPTS, QUEUE_BACKOFF_DELAY } from '../../../shared/constants';

@Injectable()
export class SchedulerStrategy {
  constructor(
    @InjectModel(BulkAction.name) private bulkActionModel: Model<BulkAction>,
    @InjectQueue(BULK_ACTION_QUEUE) private readonly bulkActionQueue: Queue,
  ) {}

  @Cron('0 * * * * *') // Every minute
  async handleScheduledTask() {
    console.log('Running scheduled task check...');
    
    // Find all pending actions that are scheduled for now or in the past
    const now = new Date();
    const pendingActions = await this.bulkActionModel.find({
      status: BulkActionStatus.PENDING,
      scheduledFor: { $lte: now }
    });
    
    console.log(`Found ${pendingActions.length} scheduled jobs to process`);
    
    // Queue each action and update its status
    for (const action of pendingActions) {
      await this.bulkActionQueue.add(
        'process-action',
        { actionId: action._id.toString() },
        { 
          attempts: QUEUE_RETRY_ATTEMPTS,
          backoff: {
            type: 'exponential',
            delay: QUEUE_BACKOFF_DELAY
          }
        }
      );
      
      action.status = BulkActionStatus.QUEUED;
      await action.save();
      
      console.log(`Queued scheduled action: ${action._id}`);
    }
  }
}
