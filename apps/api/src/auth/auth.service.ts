import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto, LoginDto, CreateApiKeyDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async signup(dto: SignupDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const isFirstUser = (await this.prisma.user.count()) === 0;

    if (!isFirstUser && !dto.inviteToken) {
      throw new BadRequestException('Invite token required');
    }

    let invite: any = null;
    if (dto.inviteToken) {
      invite = await this.prisma.invite.findUnique({ where: { token: dto.inviteToken } });
      if (!invite || invite.expiresAt < new Date()) {
        throw new BadRequestException('Invalid or expired invite');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, name: dto.name },
    });

    if (isFirstUser) {
      const team = await this.prisma.team.create({
        data: { slug: 'default', name: 'Default Team' },
      });
      await this.prisma.teamMember.create({
        data: { teamId: team.id, userId: user.id, role: 'owner' },
      });
    } else if (invite) {
      await this.prisma.teamMember.create({
        data: { teamId: invite.teamId, userId: user.id, role: invite.role },
      });
      await this.prisma.invite.delete({ where: { id: invite.id } });
    }

    return this.issueToken(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueToken(user.id);
  }

  async validateApiKey(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!apiKey) throw new UnauthorizedException('Invalid API key');
    return apiKey.user;
  }

  async createApiKey(userId: string, dto: CreateApiKeyDto) {
    const rawToken = `qk_${crypto.randomBytes(32).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const prefix = rawToken.slice(0, 11);

    await this.prisma.apiKey.create({
      data: { userId, tokenHash, label: dto.label, prefix },
    });

    return { token: rawToken, prefix, label: dto.label };
  }

  async listApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: { id: true, label: true, prefix: true, createdAt: true },
    });
  }

  async revokeApiKey(userId: string, keyId: string) {
    await this.prisma.apiKey.deleteMany({ where: { id: keyId, userId } });
  }

  private issueToken(userId: string) {
    const token = this.jwt.sign({ sub: userId });
    return { token };
  }
}
