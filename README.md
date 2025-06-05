# Bulk Action Platform

A highly scalable and efficient platform for performing bulk operations on CRM entities, built with NestJS.

## Table of Contents

1. [Project Overview](#project-overview)
2. [Getting Started](#getting-started)
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)
   - [Configuration](#configuration)
   - [Running the Application](#running-the-application)
   - [Testing](#testing)
3. [Project Structure](#project-structure)
4. [Entity-Agnostic Architecture](#entity-agnostic-architecture)
   - [Strategy Pattern for Handlers](#strategy-pattern-for-handlers)
   - [Dynamic Registration](#dynamic-registration)
   - [Adding New Entities](#adding-new-entities)
   - [Adding New Bulk Actions](#adding-new-bulk-actions)
5. [Performance and Scalability](#performance-and-scalability)
   - [Batch Processing](#batch-processing)
   - [Asynchronous Processing](#asynchronous-processing)
   - [Scheduling](#scheduling)
   - [Rate Limiting](#rate-limiting)
   - [Monitoring and Statistics](#monitoring-and-statistics)
6. [Error Handling and Logging](#error-handling-and-logging)
7. [API Documentation](#api-documentation)
8. [Real-time Updates](#real-time-updates)

## Project Overview

The Bulk Action Platform is designed to perform various bulk operations on CRM entities (Contacts, Companies, Leads, etc.). It provides a robust, scalable, and extendable framework for processing thousands to millions of entities with features like:

- Batch processing for efficiency
- Real-time progress tracking via WebSockets
- Detailed logging and error handling
- Scheduling for off-peak processing
- Rate limiting to prevent system overload
- Entity de-duplication

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Redis (for Bull queue)
- MongoDB (or use the in-memory MongoDB server for development)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bulk-action

# Install dependencies
npm install --legacy-peer-deps
```

### Configuration

Create a `.env` file in the root directory:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/bulk-actions

# Redis for Bull queue
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod

# Seed the database with sample data
npm run seed
```

### Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Load testing (requires the application to be running)
npm run loadtest
```

## Project Structure

The project follows a modular, domain-driven design pattern:

```
src/
├── core/                  # Core application components
│   ├── constants/         # Application-wide constants
│   └── database/          # Database configuration
├── modules/               # Feature modules
│   ├── bulk-actions/      # Bulk action processing module
│   │   ├── controllers/   # API endpoints controllers
│   │   ├── dtos/          # Data transfer objects
│   │   ├── gateways/      # WebSocket gateways
│   │   ├── handlers/      # Bulk action handler implementations
│   │   ├── interfaces/    # Type definitions and interfaces
│   │   ├── processors/    # Queue processors
│   │   ├── schemas/       # Database schemas
│   │   ├── services/      # Business logic services
│   │   └── strategies/    # Processing strategies (e.g., scheduler)
│   ├── contacts/          # Contact entity module
│   │   ├── schemas/       # Contact schema definition
│   │   └── ...
│   └── logs/              # Logging module
├── shared/                # Shared utilities and services
│   ├── logger/            # Custom logger implementation
│   └── utils/             # Utility functions
└── main.ts                # Application entry point
```

## Entity-Agnostic Architecture

The platform is designed with a modular, entity-agnostic architecture that makes it easy to add new entities and bulk action types without modifying the core codebase.

### Strategy Pattern for Handlers

The system uses the Strategy Pattern to support different types of bulk actions:

- Each bulk action type is implemented as a handler class that implements the `IBulkActionHandler` interface
- Handlers are registered dynamically through the `BulkActionsModule.register()` method
- This allows new action types to be added without modifying existing code

```typescript
// Example handler interface
export interface IBulkActionHandler {
  actionType: string;
  validatePayload(payload: any): Promise<boolean>;
  processEntity(entity: any, actionConfig: any): Promise<any>;
  getConfigSchema(): any;
}
```

### Dynamic Registration

Handlers are registered using NestJS's dynamic module system:

```typescript
@Module({})
export class BulkActionsModule {
  static register(handlers: any[] = []): DynamicModule {
    return {
      module: BulkActionsModule,
      // ...
      providers: [
        // Register each handler as a provider
        ...handlers.map((handler) => ({
          provide: handler,
          useClass: handler,
        })),
        // Create a token that provides all handlers
        {
          provide: 'BULK_ACTION_HANDLERS',
          useFactory: (...instances) => instances,
          inject: handlers,
        },
      ],
    };
  }
}
```

### Adding New Entities

To add a new entity to the system:

1. **Create Entity Schema**: Define the Mongoose schema for your entity
   ```typescript
   @Schema()
   export class NewEntity {
     @Prop({ required: true })
     name: string;
     // Add entity-specific properties
   }
   ```

2. **Create Entity Module**: Register the schema with Mongoose
   ```typescript
   @Module({
     imports: [
       MongooseModule.forFeature([
         { name: NewEntity.name, schema: NewEntitySchema },
       ]),
     ],
     exports: [MongooseModule],
   })
   export class NewEntityModule {}
   ```

3. **Update DTOs**: Extend the existing DTOs or create new ones for your entity
   ```typescript
   export class NewEntityUpdateDto {
     @IsNotEmpty()
     id: string;
     
     @IsOptional()
     name?: string;
     
     // Add entity-specific fields
   }
   ```

4. **Import in App Module**: Add the new entity module to the app imports

### Adding New Bulk Actions

To add a new bulk action type:

1. **Create Handler**: Implement the `IBulkActionHandler` interface
   ```typescript
   export class NewActionHandler implements IBulkActionHandler {
     actionType = 'new-action';
     
     async validatePayload(payload: any): Promise<boolean> {
       // Custom validation logic
       return true;
     }
     
     async processEntity(entity: any, actionConfig: any): Promise<any> {
       // Custom processing logic
       return { success: true };
     }
     
     getConfigSchema() {
       return {
         // JSON schema for configuration validation
       };
     }
   }
   ```

2. **Register Handler**: Add the handler to the module registration
   ```typescript
   BulkActionsModule.register([
     BulkUpdateHandler,
     NewActionHandler, // Add your new handler here
   ])
   ```

3. **Add Processor** (if needed): Create a new Bull queue processor for complex actions

This architecture ensures that the system can be extended with new entities and action types while maintaining the core processing infrastructure, error handling, scheduling, and monitoring capabilities.

## Performance and Scalability

The platform is designed to handle large volumes of data (up to a million entities) efficiently with minimal system resource usage. Several architectural decisions contribute to this capability:

### Batch Processing

The system processes entities in configurable batches rather than individually, which provides several benefits:

```typescript
// Example from bulk-update.processor.ts
const batchSize = 100;
const entities = bulkAction.entities;
const totalEntities = entities.length;

for (let i = 0; i < totalEntities; i += batchSize) {
  const batch = entities.slice(i, i + batchSize);
  await this.processBatch(batch, actionId);
  
  // Update progress and send real-time updates after each batch
  // ...
}
```

- **Reduced Database Load**: Instead of making thousands of individual database calls, batching combines multiple operations
- **Transaction Efficiency**: Each batch can be processed in a transaction if needed
- **Progress Reporting**: After each batch completes, progress is updated and reported to clients
- **Memory Management**: Processing in batches prevents memory issues when dealing with millions of entities

### Asynchronous Processing

All bulk actions are processed asynchronously using Bull queue powered by Redis:

- **Background Processing**: Long-running operations don't block the API
- **Job Persistence**: If the server restarts, in-progress jobs are not lost
- **Automatic Retries**: Failed jobs can be automatically retried with configurable backoff
- **Prioritization**: Jobs can be prioritized based on business requirements
- **Concurrency Control**: Limits can be set on concurrent job execution to prevent system overload

### Scheduling

For extremely large operations that might impact system performance, the platform supports scheduling bulk actions for off-peak hours:

- **Time-Based Execution**: Actions can be scheduled for specific times
- **Cron-Based Scheduling**: The `SchedulerStrategy` checks for pending actions every minute:

```typescript
@Cron('0 * * * * *') // Every minute
async handleScheduledTask() {
  // Find all pending actions that are scheduled for now or in the past
  const now = new Date();
  const pendingActions = await this.bulkActionModel.find({
    status: 'pending',
    scheduledFor: { $lte: now }
  });
  
  // Queue actions for processing
  // ...
}
```

### Rate Limiting

To prevent system overload from excessive API calls, a rate limiting middleware is implemented:

- **Account-Based Limits**: Each account has its own rate limit counter
- **Sliding Window**: Rate limits reset on a rolling time window
- **Configurable Thresholds**: The default limit is 10,000 requests per minute but can be adjusted

### Error Handling and Recovery

The system includes robust error handling mechanisms to ensure reliability even when processing millions of records:

- **Granular Error Tracking**: Errors are tracked at the individual entity level, not just the bulk action level
- **Detailed Logging**: All errors are logged with context for debugging
- **Failure Isolation**: A failure in one entity doesn't affect others in the batch
- **Statistics Aggregation**: Real-time stats show success/failure/skipped counts

### Monitoring and Statistics

Real-time monitoring provides visibility into system performance:

- **Progress Tracking**: Each bulk action maintains statistics on processed items
- **WebSocket Updates**: Clients can subscribe to real-time updates via WebSockets
- **Queryable Logs**: Logs can be filtered by type (success/failure/skipped) and paginated

### Database Optimization

The MongoDB schema is designed for performance with large datasets:

- **Lean Queries**: Only necessary fields are returned from database queries
- **Indexing**: Appropriate indexes are created for frequently queried fields
- **Document Structure**: The schema is designed to minimize document size

This architecture allows the system to scale horizontally by adding more worker processes or nodes to handle increased load, making it suitable for processing millions of entities efficiently.

## Error Handling and Logging

The platform includes robust error handling and logging mechanisms to ensure reliability and ease of debugging. Errors are tracked at the individual entity level, and detailed logs are maintained for each bulk action.

### Error Tracking

Errors are tracked at the individual entity level, not just the bulk action level. This ensures that a failure in one entity doesn't affect others in the batch.

### Detailed Logging

All errors are logged with context for debugging. Logs can be filtered by type (success, failure, skipped) and paginated for easy querying.

### Failure Isolation

A failure in one entity doesn't affect others in the batch. This ensures that the bulk action can continue processing other entities even if some fail.

### Statistics Aggregation

Real-time stats show success, failure, and skipped counts. This provides visibility into the performance of each bulk action.

## API Documentation

The platform provides a comprehensive RESTful API for interacting with bulk actions. All API endpoints are automatically documented using Swagger, which is accessible at `/api` when the application is running.

### Core Endpoints

#### Bulk Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/bulk-actions` | List all bulk actions |
| `POST` | `/bulk-actions` | Create a new bulk action |
| `GET` | `/bulk-actions/:id` | Get details of a specific bulk action |
| `GET` | `/bulk-actions/:id/stats` | Get statistics for a specific bulk action |

#### Bulk Action Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/bulk-actions/status` | Get bulk actions filtered by status |
| `GET` | `/bulk-actions/status?status=processing` | Filter actions by specific status |
| `GET` | `/bulk-actions/status?accountId=123` | Filter actions by account ID |
| `GET` | `/bulk-actions/status/summary` | Get summary count of actions by status |

#### Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/bulk-actions/:actionId/logs` | Get logs for a specific bulk action |
| `GET` | `/bulk-actions/:actionId/logs?type=success` | Filter logs by type (success, failure, skipped) |
| `GET` | `/bulk-actions/:actionId/logs/summary` | Get summary of logs for a bulk action |

### Creating a Bulk Action

To create a new bulk action, send a POST request to `/bulk-actions` with a payload like:

```json
{
  "actionType": "update",
  "entities": [
    {
      "id": "60d21b4967d0d8992e610c85",
      "name": "Updated Name",
      "email": "new.email@example.com"
    },
    {
      "id": "60d21b4967d0d8992e610c86",
      "age": 35
    }
  ],
  "scheduledFor": "2023-12-31T23:59:59Z",
  "accountId": "account-123"
}
```

### Scheduling Bulk Actions

To schedule a bulk action for future execution, include the `scheduledFor` field with an ISO datetime string in your request. The system will automatically pick up and process scheduled actions when their time arrives.

### WebSocket API

The platform also provides real-time updates via WebSockets:

1. Connect to the WebSocket server at the root URL
2. Subscribe to updates for a specific action:
   ```javascript
   socket.emit('subscribe', actionId);
   ```
3. Listen for updates:
   ```javascript
   socket.on('actionUpdate', (data) => {
     console.log('Action update:', data);
   });
   ```
4. Unsubscribe when done:
   ```javascript
   socket.emit('unsubscribe', actionId);
   ```

### Rate Limiting

API requests are subject to rate limiting based on the `x-account-id` header. The default limit is 10,000 requests per minute per account.

### API Standards

- All responses follow a standard format with `success` and `data` properties
- Error responses include appropriate HTTP status codes and error messages
- Pagination is available for collection endpoints using `limit` and `skip` query parameters
- Sorting is available using the `sort` query parameter

For a complete interactive API documentation, run the application and navigate to `/api` in your browser to access the Swagger UI.

## Real-time Updates

The platform supports real-time updates via WebSockets. Clients can subscribe to updates for specific bulk actions and receive notifications when the status of the action changes.

### WebSocket Connection

To connect to the WebSocket server, use the following URL:

```
ws://<server-url>
```

### Subscribing to Updates

To subscribe to updates for a specific bulk action, send a `subscribe` event with the action ID:

```javascript
socket.emit('subscribe', actionId);
```

### Receiving Updates

Once subscribed, you will receive `actionUpdate` events with the latest status of the bulk action:

```javascript
socket.on('actionUpdate', (data) => {
  console.log('Action update:', data);
});
```

### Unsubscribing from Updates

To unsubscribe from updates, send an `unsubscribe` event with the action ID:

```javascript
socket.emit('unsubscribe', actionId);
```

