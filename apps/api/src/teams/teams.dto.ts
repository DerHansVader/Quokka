import { IsString, IsOptional, IsEmail, IsIn } from 'class-validator';

export const TEAM_ROLES = ['owner', 'admin', 'member'] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;
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
