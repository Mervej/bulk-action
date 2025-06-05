import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, ObjectId } from 'mongoose';
import { BulkActionStatus } from '../../../shared/constants';

export type BulkActionDocument = BulkAction & Document;

@Schema({ timestamps: true })
export class BulkAction {
  _id: ObjectId;
  
  @Prop({ required: true })
  actionType: string;

  @Prop({ default: BulkActionStatus.PENDING })
  status: BulkActionStatus;

  @Prop()
  scheduledFor: Date;

  @Prop({ default: 'default' })
  accountId: string;

  @Prop({ 
    type: {
      total: { type: Number, default: 0 },
      success: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 }
    }
  })
  stats: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };

  // Remove the entities array since entities will be stored in a separate collection
  // Instead, add configuration details for the bulk action
  @Prop({ type: Object })
  config: Record<string, any>;
}

export const BulkActionSchema = SchemaFactory.createForClass(BulkAction);
