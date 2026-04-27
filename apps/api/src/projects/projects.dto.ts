import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ArrayUnique,
} from 'class-validator';

export const PROJECT_VISIBILITIES = ['team', 'private'] as const;
export type ProjectVisibility = (typeof PROJECT_VISIBILITIES)[number];

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsIn(PROJECT_VISIBILITIES as unknown as string[])
  visibility?: ProjectVisibility;

  // For private projects: which existing team members can access it.
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  accessUserIds?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(PROJECT_VISIBILITIES as unknown as string[])
  visibility?: ProjectVisibility;
}

export class SetAccessDto {
  @IsString()
  userId: string;
}
