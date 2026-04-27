import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TEAM_ROLES, TeamRole } from '../teams/teams.dto';

export class UpdateSuperAdminDto {
  @IsBoolean()
  isSuperAdmin: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class AdminMembershipDto {
  @IsString()
  teamId: string;

  @IsString()
  @IsIn(TEAM_ROLES as unknown as string[])
  @IsOptional()
  role?: TeamRole;
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsBoolean()
  @IsOptional()
  isSuperAdmin?: boolean;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdminMembershipDto)
  memberships?: AdminMembershipDto[];
}

export class SetMembershipDto {
  @IsString()
  @IsIn(TEAM_ROLES as unknown as string[])
  role: TeamRole;
}
