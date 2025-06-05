import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bull';
import { Model } from 'mongoose';
import { BulkAction } from '../schemas/bulk-action.schema';
import { BULK_ACTION_QUEUE, BulkActionStatus, LogType } from '../../../shared/constants';
import { BulkUpdateHandler } from '../handlers/bulk-update.handler';
import { AppLogger } from '../../../shared/logger/logger.service';
import { BulkActionEntityService } from '../services/bulk-action-entity.service';
import { StatsService } from '../services/stats.service';
import { LogManagementService } from 'src/modules/logs/services/log-management.service';
import { BulkActionNotificationService } from '../services/bulk-action-notification.service';

@Processor(BULK_ACTION_QUEUE)
@Injectable()
export class BulkUpdateProcessor {
  constructor(
    @InjectModel(BulkAction.name) private bulkActionModel: Model<BulkAction>,
    private readonly bulkUpdateHandler: BulkUpdateHandler,
    private readonly bulkActionEntityService: BulkActionEntityService,
    private readonly logManagementService: LogManagementService,
    private readonly logger: AppLogger,
    private readonly statsService: StatsService,
    private readonly notificationService: BulkActionNotificationService,
  ) { }

  @Process('process-action')
  async handleBulkAction(job: Job<{ actionId: string }>) {
    const { actionId } = job.data;

    try {
      // Mark action as processing
      await this.bulkActionModel.findByIdAndUpdate(
        actionId,
        { status: BulkActionStatus.PROCESSING }
      );

      // Notify clients about the processing status
      const actionData = await this.bulkActionModel.findById(actionId);
      if (!actionData) {
        throw new Error(`Bulk action not found: ${actionId}`);
      }
      this.notificationService.notifyActionUpdate(actionData);

      if (actionData.actionType !== this.bulkUpdateHandler.actionType) {
        throw new Error(`Unsupported action type: ${actionData.actionType}`);
      }

      // Process entities in batches
      const batchSize = 100;
      let processingComplete = false;
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      while (!processingComplete) {
        // Get next batch of entities to process
        const entities = await this.bulkActionEntityService.getEntitiesForProcessing(
          actionId,
          batchSize
        );

        if (entities.length === 0) {
          processingComplete = true;
          continue;
        }

        // Process each entity in the batch
        for (const entity of entities) {
          try {
            // Process the entity and get result
            const result = await this.bulkUpdateHandler.processEntity(
              entity.entityData,
              actionData.config
            );

            if (result.skipped) {
              // Handle skipped entity using Promise.all
              await Promise.all([
                this.bulkActionEntityService.updateEntityStatus(
                  entity._id,
                  LogType.SKIPPED,
                  result.message
                ),
                this.logManagementService.storeLog(
                  actionId,
                  LogType.SKIPPED,
                  entity.entityId,
                  result.message
                )
              ]);
              skippedCount++;
              this.logger.logSkipped(entity.entityId);
            } else if (result.success) {
              // Handle success using Promise.all
              await Promise.all([
                this.bulkActionEntityService.updateEntityStatus(
                  entity._id,
                  LogType.SUCCESS,
                  result.message
                ),
                this.logManagementService.storeLog(
                  actionId,
                  LogType.SUCCESS,
                  entity.entityId,
                  result.message
                )
              ]);
              successCount++;
              this.logger.logSuccess(entity.entityId);
            } else {
              // Handle failure using Promise.all
              await Promise.all([
                this.bulkActionEntityService.updateEntityStatus(
                  entity._id,
                  LogType.FAILURE,
                  result.message
                ),
                this.logManagementService.storeLog(
                  actionId,
                  LogType.FAILURE,
                  entity.entityId,
                  result.message
                )
              ]);
              failedCount++;
              this.logger.logFailure(entity.entityId, result.message);
            }

            // Update stats periodically
            if ((successCount + failedCount + skippedCount) % 10 === 0) {
              await this.updateActionStats(
                actionId,
                successCount,
                failedCount,
                skippedCount
              );
              
              // Notify clients about stats update
              const updatedAction = await this.bulkActionModel.findById(actionId);
              this.notificationService.notifyActionUpdate(updatedAction);
            }
          } catch (error) {
            // Handle unexpected errors using Promise.all
            await Promise.all([
              this.bulkActionEntityService.updateEntityStatus(
                entity._id,
                LogType.FAILURE,
                error.message
              ),
              this.logManagementService.storeLog(
                actionId,
                LogType.FAILURE,
                entity.entityId,
                error.message
              )
            ]);
            failedCount++;
            this.logger.logFailure(entity.entityId, error.message);
          }
        }
      }


      // Mark action as complete
      const finalStatus = failedCount > 0
        ? BulkActionStatus.COMPLETED_WITH_ERR
        : BulkActionStatus.COMPLETED;

      // Update the final status and count
      await Promise.all([
        this.updateActionStats(
          actionId,
          successCount,
          failedCount,
          skippedCount
        ), this.bulkActionModel.findByIdAndUpdate(
          actionId,
          { status: finalStatus }
        ),
        this.statsService.recordActionCompletion(actionData, {
          successCount,
          failedCount,
          skippedCount,
          totalCount: successCount + failedCount + skippedCount
        })
      ]);
      
      // Notify clients about completion
      const finalAction = await this.bulkActionModel.findById(actionId);
      this.notificationService.notifyActionUpdate(finalAction);

    } catch (error) {
      console.error(`Error processing bulk action ${actionId}:`, error);

      // Mark action as failed
      await this.bulkActionModel.findByIdAndUpdate(
        actionId,
        { status: BulkActionStatus.FAILED }
      );
      
      // Notify clients about failure
      const failedAction = await this.bulkActionModel.findById(actionId);
      this.notificationService.notifyActionUpdate(failedAction);

      throw error;
    }
  }

  private async updateActionStats(
    actionId: string,
    successCount: number,
    failedCount: number,
    skippedCount: number
  ): Promise<void> {
    await this.bulkActionModel.findByIdAndUpdate(actionId, {
      'stats.success': successCount,
      'stats.failed': failedCount,
      'stats.skipped': skippedCount
    });
  }
}