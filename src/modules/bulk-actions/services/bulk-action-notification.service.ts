import { Injectable } from '@nestjs/common';
import { BulkAction } from '../schemas/bulk-action.schema';
import { BulkActionGateway } from '../gateways/bulk-action.gateway';

@Injectable()
export class BulkActionNotificationService {
  constructor(private readonly bulkActionGateway: BulkActionGateway) {}

  notifyActionUpdate(action: BulkAction) {
    this.bulkActionGateway.broadcastActionUpdate(action);
  }
}
