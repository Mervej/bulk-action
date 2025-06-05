import { IsString, IsOptional, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

class EntityDto {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  status?: string;
}

class ConfigDto {
  @IsObject()
  fieldsToUpdate: Record<string, any>;
}

export class CreateBulkActionDto {
  @IsString()
  actionType: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsObject()
  config?: ConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EntityDto)
  entities: EntityDto[];
}