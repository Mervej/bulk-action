import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';

@Injectable()
export class DatabaseConfigService implements OnModuleInit, OnModuleDestroy {
  private mongoMemoryServer: MongoMemoryServer;

  async onModuleInit() {
    this.mongoMemoryServer = await MongoMemoryServer.create();
    console.log(`MongoDB Memory Server started at: ${await this.getUri()}`);
  }

  async onModuleDestroy() {
    if (this.mongoMemoryServer) {
      await this.mongoMemoryServer.stop();
      console.log('MongoDB Memory Server stopped');
    }
  }

  async getUri(): Promise<string> {
    if (!this.mongoMemoryServer) {
      this.mongoMemoryServer = await MongoMemoryServer.create();
    }
    return this.mongoMemoryServer.getUri();
  }
}
