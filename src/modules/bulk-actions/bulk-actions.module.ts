import { Module, DynamicModule } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { BulkActionController } from './controllers/bulk-action.controller';
import { BulkActionStatusController } from './controllers/bulk-action-status.controller';
import { BulkActionService } from './services/bulk-action.service';
import { BulkActionStatusService } from './services/bulk-action-status.service';
import { BulkActionEntityService } from './services/bulk-action-entity.service';
import { StatsService } from './services/stats.service';
import { SchedulerStrategy } from './strategies/scheduler.strategy';
import { BulkUpdateProcessor } from './processors/bulk-update.processor';
import { Contact, ContactSchema } from '../contacts/schemas/contact.schema';
import { BulkAction, BulkActionSchema } from './schemas/bulk-action.schema';
import { BulkActionEntity, BulkActionEntitySchema } from './schemas/bulk-action-entity.schema';
import { BulkUpdateHandler } from './handlers/bulk-update.handler';
import { BulkActionGateway } from './gateways/bulk-action.gateway';
import { BulkActionNotificationService } from './services/bulk-action-notification.service';
import { LogsModule } from '../logs/logs.module';
import { BULK_ACTION_QUEUE } from '../../shared/constants';

@Module({})
export class BulkActionsModule {
  static register(handlers: any[] = [BulkUpdateHandler]): DynamicModule {
    return {
      module: BulkActionsModule,
      imports: [
        MongooseModule.forFeature([
          { name: Contact.name, schema: ContactSchema },
          { name: BulkAction.name, schema: BulkActionSchema },
          { name: BulkActionEntity.name, schema: BulkActionEntitySchema },
        ]),
        BullModule.registerQueue({
          name: BULK_ACTION_QUEUE,
        }),
        LogsModule,
      ],
      providers: [
        BulkActionService,
        BulkActionStatusService,
        BulkActionEntityService,
        StatsService,
        SchedulerStrategy,
        BulkUpdateProcessor,
        BulkActionGateway,
        BulkActionNotificationService,
        ...handlers.map((handler) => ({
          provide: handler,
          useClass: handler,
        })),
        {
          provide: 'BULK_ACTION_HANDLERS',
          useFactory: (...instances) => instances,
          inject: handlers,
        },
      ],
      controllers: [
        BulkActionController, 
        BulkActionStatusController
      ],
      exports: [BulkActionService],
    };
  }
}
