import { IsString, IsOptional, IsEmail, IsIn, MaxLength, Matches } from 'class-validator';

// Roles within a single team. Instance-wide control sits on User.isSuperAdmin.
export const TEAM_ROLES = ['owner', 'team_admin', 'member'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;
}

export class UpdateTeamDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  // url-safe slug; allow simple kebab-case
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]*$/, { message: 'slug must be kebab-case' })
  @MaxLength(60)
  slug?: string;

  // single emoji or short label, or empty string to clear
  @IsOptional()
  @IsString()
  @MaxLength(8)
  icon?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsIn(TEAM_ROLES as unknown as string[])
  @IsOptional()
  role?: TeamRole;
}

export class JoinTeamDto {
  @IsString()
  inviteKey: string;
}

export class UpdateRoleDto {
  @IsString()
  @IsIn(TEAM_ROLES as unknown as string[])
  role: TeamRole;
}

export class AddMemberDto {
  @IsString()
  userId: string;

  @IsString()
  @IsIn(TEAM_ROLES as unknown as string[])
  @IsOptional()
  role?: TeamRole;
}
