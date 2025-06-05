import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { BulkActionStatusService } from '../services/bulk-action-status.service';
import { BulkActionEntityService } from '../services/bulk-action-entity.service';
import { BulkActionStatus } from 'src/shared/constants';

@ApiTags('bulk-actions-status')
@Controller('bulk-actions/status')
export class BulkActionStatusController {
  constructor(
    private readonly bulkActionStatusService: BulkActionStatusService,
    private readonly bulkActionEntityService: BulkActionEntityService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get bulk actions filtered by status' })
  @ApiResponse({ status: 200, description: 'List of filtered bulk actions' })
  @ApiQuery({ 
    name: 'status', 
    required: false, 
    enum: ['pending', 'queued', 'processing', 'completed', 'failed'],
    description: 'Filter actions by status'
  })
  @ApiQuery({
    name: 'accountId',
    required: false,
    description: 'Filter actions by account ID'
  })
  async getActionsByStatus(
    @Query('status') status?: BulkActionStatus,
    @Query('accountId') accountId?: string
  ) {
    const actions = await this.bulkActionStatusService.getActionsByStatus(status, accountId);
    return {
      success: true,
      data: actions
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get summary of bulk actions by status' })
  @ApiResponse({ status: 200, description: 'Summary of bulk actions by status' })
  @ApiQuery({
    name: 'accountId',
    required: false,
    description: 'Filter summary by account ID'
  })
  async getStatusSummary(@Query('accountId') accountId?: string) {
    const summary = await this.bulkActionStatusService.getStatusSummary(accountId);
    return {
      success: true,
      data: summary
    };
  }

  @Get(':actionId/entities')
  @ApiOperation({ summary: 'Get entities for a specific bulk action' })
  @ApiResponse({ status: 200, description: 'List of entities for the bulk action' })
  @ApiParam({
    name: 'actionId',
    description: 'The ID of the bulk action'
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'processed', 'failed', 'skipped'],
    description: 'Filter entities by status'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number for pagination'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of entities per page'
  })
  async getActionEntities(
    @Param('actionId') actionId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number
  ) {
    const pageNum = page ? parseInt(page.toString(), 10) : 1;
    const pageSize = limit ? parseInt(limit.toString(), 10) : 50;
    
    // This would be implemented in the BulkActionEntityService
    // For now returning a placeholder response
    return {
      success: true,
      data: {
        entities: [],
        pagination: {
          totalEntities: 0,
          totalPages: 0,
          currentPage: pageNum,
          pageSize: pageSize
        }
      }
    };
  }
}
