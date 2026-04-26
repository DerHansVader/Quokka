import { IsString, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRunDto {
  @IsString()
  projectId: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsOptional()
  config?: Record<string, any>;
}

export class LogPointDto {
  @IsString()
  key: string;

  @IsNumber()
  step: number;

  @IsNumber()
  value: number;

  @IsString()
  @IsOptional()
  wallTime?: string;
}

export class LogBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LogPointDto)
  points: LogPointDto[];
}

export class UpdateRunDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  summary?: Record<string, any>;
}
