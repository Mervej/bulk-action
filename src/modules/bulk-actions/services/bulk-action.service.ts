import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BulkAction } from '../schemas/bulk-action.schema';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { IBulkActionHandler } from '../interfaces/bulk-action-handler.interface';
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { BulkActionStatus, BULK_ACTION_QUEUE, FILE_PROCESSING_BATCH_SIZE } from '../../../shared/constants';
import { BulkActionEntityService } from './bulk-action-entity.service';

@Injectable()
export class BulkActionService {
  private readonly actionHandlers: Map<string, IBulkActionHandler> = new Map();

  constructor(
    @InjectModel(BulkAction.name) private bulkActionModel: Model<BulkAction>,
    @InjectQueue(BULK_ACTION_QUEUE) private bulkActionQueue: Queue,
    @Inject('BULK_ACTION_HANDLERS') private readonly handlers: IBulkActionHandler[],
    private readonly bulkActionEntityService: BulkActionEntityService
  ) {
    // Register all handlers by their type
    handlers.forEach(handler => {
      this.actionHandlers.set(handler.actionType, handler);
    });
  }

  async createBulkAction(actionType: string, data: any): Promise<BulkAction> {
    try {
      const handler = this.actionHandlers.get(actionType);
      if (!handler) {
        throw new Error(`Unsupported bulk action type: ${actionType}`);
      }

      // Validate the input data
      const isValid = await handler.validatePayload(data);
      if (!isValid) {
        throw new Error('Invalid data for this bulk action type');
      }

      // Create a new bulk action record with account ID from header
      const bulkAction = await this.bulkActionModel.create({
        actionType,
        status: BulkActionStatus.PENDING,
        scheduledFor: data.config?.scheduledFor || null,
        accountId: data.accountId || 'default',
        config: data.config || {},
        stats: {
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0
        }
      });

      // Process entities if they're provided
      if (data.entities && Array.isArray(data.entities) && data.entities.length > 0) {
        // Transform entities to the format expected by bulk action entity service
        const formattedEntities = data.entities.map(entity => ({
          entityId: entity.id || entity._id,
          entityData: entity
        }));

        await this.bulkActionEntityService.createEntities(bulkAction.id, formattedEntities);

        // Update the stats to reflect the total entities
        await this.bulkActionModel.findByIdAndUpdate(bulkAction._id, {
          'stats.total': formattedEntities.length
        });
      }

      // Check if this is a scheduled bulk action
      if (data.config?.scheduledFor) {
        // If scheduled for future, don't add to queue now
        console.log(`Bulk action ${bulkAction._id} scheduled for ${data.config?.scheduledFor}`);
        return bulkAction;
      } else {
        // Add to queue for processing
        await this.bulkActionQueue.add(
          'process-action',
          {
            actionId: bulkAction._id,
          }
        );
      }


      return bulkAction;
    }
    catch (err) {
      console.log(err);
      throw err;
    }
  }

  async createBulkActionFromFile(
    actionType: string,
    fileStream: Readable,
    config: any
  ): Promise<BulkAction> {
    try {
      const handler = this.actionHandlers.get(actionType);
      if (!handler) {
        throw new Error(`Unsupported bulk action type: ${actionType}`);
      }

      // Create bulk action record without entities, including accountId from header
      const bulkAction = await this.bulkActionModel.create({
        actionType,
        status: BulkActionStatus.PENDING,
        scheduledFor: config.scheduledFor || null,
        accountId: config.accountId || 'default',
        config,
        stats: {
          total: 0,
          success: 0,
          failed: 0,
          skipped: 0
        }
      });

      // Process file stream in chunks
      await this.processFileStream(fileStream, bulkAction.id);

      // Check if this is a scheduled bulk action
      if (config.scheduledFor) {
        // If scheduled for future, don't add to queue now
        console.log(`Bulk action ${bulkAction._id} scheduled for ${config.scheduledFor}`);
      } else {
        // Add to queue for processing
        await this.bulkActionQueue.add(
          'process-action',
          { actionId: bulkAction._id }
        );
      }

      return bulkAction;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  private async processFileStream(
    fileStream: Readable,
    actionId: string
  ): Promise<void> {
    const batchSize = FILE_PROCESSING_BATCH_SIZE;
    let batch = [];
    let totalProcessed = 0;
    let processingPromise = Promise.resolve(); // Track ongoing batch processing

    return new Promise((resolve, reject) => {
      // csv parser setup
      const parser = csv({
        headers: ['id', 'name', 'email', 'age', 'status'],
        skipLines: 1
      });

      parser.on('data', async (row) => {
        // push the entity data into batch row for processing
        batch.push({
          entityId: row.id,
          entityData: {
            id: row.id,
            name: row.name,
            email: row.email,
            age: parseInt(row.age),
            status: row.status
          }
        });

        // check if current batch is of batch size, update the data to the database
        if (batch.length >= batchSize) {
          parser.pause();

          const currentBatch = [...batch]; // Create a copy of the current batch
          batch = []; // Clear the batch immediately

          // Update our processing promise
          processingPromise = processingPromise
            .then(() => this.saveBatch(currentBatch, actionId))
            .then(() => {
              totalProcessed += currentBatch.length;
              parser.resume();
            })
            .catch(err => {
              parser.emit('error', err);
            });
        }
      });

      parser.on('end', async () => {
        try {
          // Wait for any pending batch operations to complete
          await processingPromise;

          // Process any remaining items in the batch
          if (batch.length > 0) {
            await this.saveBatch(batch, actionId);
            totalProcessed += batch.length;
          }

          await this.bulkActionModel.findByIdAndUpdate(actionId, {
            'stats.total': totalProcessed
          });

          console.log(`Processed ${totalProcessed} entities for file bulk action ${actionId}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      parser.on('error', reject);
      fileStream.pipe(parser);
    });
  }

  private async saveBatch(batch: any[], actionId: string): Promise<void> {
    // Save entities to the separate collection instead of appending to the bulk action
    await this.bulkActionEntityService.createEntities(actionId, batch);
  }

  async getAllActions(status?: string, accountId?: string): Promise<BulkAction[]> {
    try {
      const validStatuses = [
        BulkActionStatus.PENDING,
        BulkActionStatus.PROCESSING,
        BulkActionStatus.COMPLETED,
        BulkActionStatus.FAILED
      ];

      // Build query with status and accountId if provided
      const query: any = {};

      if (status && validStatuses.includes(status as BulkActionStatus)) {
        query.status = status;
      }

      if (accountId) {
        query.accountId = accountId;
      }

      // fetch the data from the database
      return await this.bulkActionModel
        .find(query)
        .sort({ createdAt: -1 })
        .exec();
    } catch (error) {
      console.error('Error fetching bulk actions:', error);
      throw error;
    }
  }

  async getActionById(id: string): Promise<BulkAction | null> {
    return this.bulkActionModel.findById(id).exec();
  }
}
