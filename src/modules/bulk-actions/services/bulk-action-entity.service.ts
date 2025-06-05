import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, Types } from 'mongoose';
import { BulkActionEntity } from '../schemas/bulk-action-entity.schema';
import { LogType } from 'src/shared/constants';

@Injectable()
export class BulkActionEntityService {
  constructor(
    @InjectModel(BulkActionEntity.name) private bulkActionEntityModel: Model<BulkActionEntity>,
  ) {}

  async createEntities(
    bulkActionId: Types.ObjectId | string,
    entities: { entityId: string; entityData: any }[],
  ): Promise<void> {
    const bulkEntities = entities.map(entity => ({
      bulkActionId,
      entityId: entity.entityId,
      entityData: entity.entityData,
      status: LogType.PENDING,
    }));

    // Use bulk insert for better performance
    if (bulkEntities.length > 0) {
      await this.bulkActionEntityModel.insertMany(bulkEntities, { ordered: false });
    }
  }

  async getEntitiesForProcessing(bulkActionId: ObjectId | string, batchSize = 100): Promise<BulkActionEntity[]> {
    return this.bulkActionEntityModel
      .find({ bulkActionId, status: LogType.PENDING })
      .limit(batchSize)
      .exec();
  }

  async updateEntityStatus(
    id: ObjectId | string,
    status: LogType,
    errorMessage?: string,
  ): Promise<void> {
    const update: any = { status };
    if (errorMessage) {
      update.errorMessage = errorMessage;
    }
    await this.bulkActionEntityModel.updateOne({ _id: id }, update);
  }

  async getEntitiesStats(bulkActionId: Types.ObjectId | string) {
    const stats = await this.bulkActionEntityModel.aggregate([
      { $match: { bulkActionId: new Types.ObjectId(bulkActionId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const result = {
      total: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    };

    stats.forEach(item => {
      result[item._id] = item.count;
      result.total += item.count;
    });

    return result;
  }

}
