import { IsBoolean, IsString, MinLength } from 'class-validator';

export class UpdateSuperAdminDto {
  @IsBoolean()
  isSuperAdmin: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(8)
  newPassword: string;
}
