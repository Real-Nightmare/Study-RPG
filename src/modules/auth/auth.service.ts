import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RedisService } from '../redis/redis.service';
import { LoginDto } from './dto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  username: string | null;
  email: string | null;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Seeds the default admin account if it does not already exist.
   * Should be called on application bootstrap / migration.
   */
  async seedAdmin(): Promise<void> {
    const adminUsername = this.configService.get<string>('ADMIN_USERNAME', 'Nightmare');
    const adminName = this.configService.get<string>('ADMIN_NAME', 'Joshua Martin');
    const adminPassword = this.configService.get<string>('ADMIN_DEFAULT_PASSWORD');
    if (!adminPassword) {
      this.logger.warn(
        'ADMIN_DEFAULT_PASSWORD not set — skipping admin seed. Set it in .env to create the default admin.',
      );
      return;
    }

    const existing = await this.usersService.findByUsername(adminUsername);
    if (existing) {
      this.logger.log('Admin account already exists - skipping seed');
      return;
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await this.usersService.create({
      username: adminUsername,
      name: adminName,
      password: hashedPassword,
      role: 'admin',
    });

    this.logger.log(`Seeded admin account: ${adminUsername}`);
  }

  async login(dto: LoginDto): Promise<{
    user: { id: string; username: string | null; email: string | null };
    tokens: TokenPair;
  }> {
    const identifier = dto.email.trim();

    const user =
      (await this.usersService.findByUsername(identifier)) ||
      (await this.usersService.findByEmail(identifier));

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user.id, user.username, user.email, user.role);

    await this.usersService.updateLastLogin(user.id);

    return {
      user: { id: user.id, username: user.username, email: user.email },
      tokens,
    };
  }

  async refreshToken(dto: { refreshToken: string }): Promise<TokenPair> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const isBlacklisted = await this.redisService.exists(`blacklist:${dto.refreshToken}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      await this.blacklistToken(dto.refreshToken);

      return this.generateTokens(user.id, user.username, user.email, user.role);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.blacklistToken(refreshToken);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.password) {
      throw new BadRequestException('Cannot change password for this account');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.usersService.updatePassword(userId, hashedPassword);
  }

  private async generateTokens(
    userId: string,
    username: string | null,
    email: string | null,
    role: string,
  ): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, username, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d'),
      }),
    ]);

    const accessTtl = this.parseExpirationToSeconds(
      this.configService.get<string>('JWT_ACCESS_EXPIRATION', '15m'),
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: accessTtl,
    };
  }

  private async blacklistToken(token: string): Promise<void> {
    try {
      const payload = this.jwtService.decode(token) as { exp?: number };
      const ttl = payload?.exp ? payload.exp - Math.floor(Date.now() / 1000) : 60 * 60 * 24 * 7;
      if (ttl > 0) {
        await this.redisService.set(`blacklist:${token}`, '1', ttl);
      }
    } catch {
      // Token invalid, no need to blacklist
    }
  }

  private parseExpirationToSeconds(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1), 10);
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }
}
