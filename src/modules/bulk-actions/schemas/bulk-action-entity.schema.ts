import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, ObjectId } from 'mongoose';

export type BulkActionEntityDocument = BulkActionEntity & Document;

@Schema({ timestamps: true })
export class BulkActionEntity {
  _id: ObjectId;
  
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'BulkAction', required: true, index: true })
  bulkActionId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  entityId: string;

  @Prop({ type: Object })
  entityData: Record<string, any>;

  @Prop({ type: String, enum: ['pending', 'processed', 'failed', 'skipped'], default: 'pending' })
  status: string;

  @Prop()
  errorMessage?: string;
}

export const BulkActionEntitySchema = SchemaFactory.createForClass(BulkActionEntity);

// Create indexes for efficient queries
BulkActionEntitySchema.index({ bulkActionId: 1, status: 1 });
BulkActionEntitySchema.index({ bulkActionId: 1, entityId: 1 }, { unique: true });
