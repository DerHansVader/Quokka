import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateViewDto {
  @IsString()
  scope: string;

  @IsString()
  scopeId: string;

  @IsString()
  title: string;

  @IsOptional()
  layout?: any[];
}

export class UpdateViewDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsOptional()
  layout?: any[];
}
