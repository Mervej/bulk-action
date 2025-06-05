import {
  Controller, Post, Body, Get, Param, NotFoundException, BadRequestException, Query, UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Headers
} from '@nestjs/common';
import { StatsService } from '../services/stats.service';
import { BulkActionService } from '../services/bulk-action.service';
import { CreateBulkActionDto } from '../dtos/create-bulk-action.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateBulkActionFromFileDto } from '../dtos/create-bulk-action-wit-file.dto';
import { Readable } from 'stream';
import { BulkAction } from '../schemas/bulk-action.schema';

@ApiTags('bulk-actions')
@Controller('bulk-actions')
export class BulkActionController {
  constructor(
    private readonly statsService: StatsService,
    private readonly bulkActionService: BulkActionService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a new bulk action' })
  @ApiResponse({ status: 201, description: 'The bulk action has been created' })
  async createBulkAction(
    @Body() data: CreateBulkActionDto, 
    @Headers('x-account-id') accountId: string
  ): Promise<BulkAction> {
    try {
      const { actionType, ...rest } = data;
      // Pass accountId from header
      const result = await this.bulkActionService.createBulkAction(actionType, { ...rest, accountId });
      return result;
    } catch (error) {
      throw new BadRequestException('An error occurred while creating the bulk action: ' + error.message);
    }
  }

  @Post('upload')
  @ApiOperation({ summary: 'Create a bulk action from CSV file' })
  @ApiResponse({ status: 201, description: 'The bulk action has been created from file' })
  @UseInterceptors(FileInterceptor('file', {
    fileFilter: (req, file, callback) => {
      
      const validMimeTypes = [
        'text/csv',
        'application/csv',
        'application/vnd.ms-excel',
        'text/x-csv'
      ];
      
      if (validMimeTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
        callback(null, true);
      } else {
        callback(
          new BadRequestException(
            `Invalid file type. Got ${file.mimetype}, expected CSV file`
          ), 
          false
        );
      }
    }
  }))
  async createBulkActionFromFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 1024 * 1024 * 5 }), // 5MB
          // new FileTypeValidator({ fileType: 'text/csv' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() data: CreateBulkActionFromFileDto,
    @Headers('x-account-id') accountId: string
  ) {
    try {
      const fileStream = Readable.from(file.buffer);
      const result = await this.bulkActionService.createBulkActionFromFile(
        data.actionType,
        fileStream,
        { ...data, accountId }
      );
      return {
        message: 'Bulk action created from file',
        data: result
      };
    } catch (error) {
      throw new BadRequestException(
        'An error occurred while creating the bulk action from file: ' +
        error.message
      );
    }
  }

  @Get()
  @ApiQuery({ name: 'status', required: false })
  @ApiOperation({ summary: 'Get all bulk actions' })
  @ApiResponse({ status: 200, description: 'List of all bulk actions' })
  async getAllActions(
    @Query('status') status?: string,
    @Headers('x-account-id') accountId?: string
  ) {
    try {
      const actions = await this.bulkActionService.getAllActions(status, accountId);
      return { message: 'List of all bulk actions', data: actions };
    } catch (error) {
      throw new BadRequestException('An error occurred while fetch bulk actions: ' + error.message);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a bulk action by ID' })
  @ApiResponse({ status: 200, description: 'Details of the bulk action' })
  @ApiResponse({ status: 404, description: 'Bulk action not found' })
  async getActionById(@Param('id') id: string) {
    const action = await this.bulkActionService.getActionById(id);
    if (!action) {
      throw new NotFoundException(`Bulk action with ID ${id} not found`);
    }
    return { message: `Details for action ${id}`, data: action };
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get statistics for a bulk action' })
  @ApiResponse({ status: 200, description: 'Statistics for the bulk action' })
  async getStats(@Param('id') id: string) {
    return await this.statsService.getStats(id);
  }
}
