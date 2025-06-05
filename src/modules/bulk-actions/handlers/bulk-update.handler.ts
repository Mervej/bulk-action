import { IBulkActionHandler } from '../interfaces/bulk-action-handler.interface';
import { Injectable } from '@nestjs/common';
import { isDuplicate } from '../../../shared/utils/deduplication.util';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActionType } from '../../../shared/constants';

@Injectable()
export class BulkUpdateHandler implements IBulkActionHandler {
  actionType = ActionType.UPDATE;

  constructor(
    @InjectModel('Contact') private readonly contactModel: Model<any>,
  ) { }

  async validatePayload(payload: any): Promise<boolean> {

    try {
      // Check if payload exists
      if (!payload) {
        throw new Error('Payload is required');
      }

      // Validate config and fieldsToUpdate
      if (!payload.config || !payload.config.fieldsToUpdate) {
        throw new Error('config.fieldsToUpdate is required');
      }

      return true;
    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
  }

  async processEntity(entity: any, actionConfig: any): Promise<any> {
    try {

      if (!entity.email) {
        throw new Error("No email id found for the entity");
      }
      // Check for duplicates based on email
      if (entity.email && isDuplicate(entity.email)) {
        return {
          success: false,
          skipped: true,
          entity,
          message: 'Duplicate email detected'
        };
      }

      // Update the entity in the database
      await this.contactModel.findOneAndUpdate(
        { email: entity.email },
        {
          ...(entity.name && { name: entity.name }),
          ...(entity.age && { age: entity.age }),
          ...(actionConfig.fieldsToUpdate && actionConfig.fieldsToUpdate)
        }
      );

      return {
        success: true,
        entity,
        message: 'Entity updated successfully'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        entity,
        message: `Failed to update: ${error.message}`
      };
    }
  }

  getConfigSchema() {
    return {
      type: 'object',
      properties: {
        fieldsToUpdate: { type: 'object' },
        actionId: { type: 'string' }
      },
      required: ['fieldsToUpdate', 'actionId']
    };
  }
}
