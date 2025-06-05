import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RateLimiterMiddleware } from './shared/utils/rate-limiter.middleware';
import { SharedModule } from './shared/shared.module';
import { DatabaseConfigService } from './core/database/database-config.service';
import { DatabaseModule } from './core/database/database.module';
import { BulkActionsModule } from './modules/bulk-actions/bulk-actions.module';
import { LogsModule } from './modules/logs/logs.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { BulkUpdateHandler } from './modules/bulk-actions/handlers/bulk-update.handler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [DatabaseModule],
      inject: [DatabaseConfigService],
      useFactory: async (dbConfigService: DatabaseConfigService) => ({
        uri: await dbConfigService.getUri(),
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: parseInt(configService.get('REDIS_PORT', '6379')),
        },
      }),
    }),
    ScheduleModule.forRoot(),
    SharedModule,
    ContactsModule,
    BulkActionsModule.register([BulkUpdateHandler]),
    LogsModule,
    DatabaseModule
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimiterMiddleware)
      .forRoutes('bulk-actions');
  }
}
