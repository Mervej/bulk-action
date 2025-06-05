import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ActionType } from 'src/shared/constants';

export class CreateBulkActionFromFileDto {
  @ApiProperty({ description: 'Type of bulk action to perform' })
  @IsString()
  actionType: ActionType;

  @ApiProperty({ description: 'Fields to update for each entity', required: false })
  @IsOptional()
  fieldsToUpdate?: Record<string, any>;

  @ApiProperty({ description: 'Schedule the bulk action for later', required: false })
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}