import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Audit, AuditInterceptor } from '../audit/audit.guard';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';

class CreateUserBody {
  username?: string;
  email?: string;
  name: string;
  password: string;
  role?: string;
}

class ChangeRoleBody {
  role: string;
}

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, AuditInterceptor)
@Roles(Role.ADMIN, Role.TEACHER)
@ApiBearerAuth()
export class AdminUsersController {
  private readonly logger = new Logger(AdminUsersController.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Post('users')
  @ApiOperation({ summary: 'Create a user (admin/teacher only)' })
  @ApiResponse({ status: 201, description: 'User created' })
  @Audit('CREATE_USER', 'user')
  async createUser(@CurrentUser() actor: JwtPayload, @Body() dto: CreateUserBody) {
    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      name: dto.name,
      password: await this.hashPassword(dto.password),
      role: dto.role || 'student',
    });

    await this.auditService.log(actor.username || actor.sub, 'CREATE_USER', 'user', user.id, null, {
      username: user.username,
      role: user.role,
    });

    return { id: user.id, username: user.username, email: user.email, role: user.role };
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Change a user role (admin/teacher only)' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @Audit('CHANGE_ROLE', 'user', 'id')
  async changeRole(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: ChangeRoleBody,
  ) {
    const existing = await this.usersService.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }

    await this.usersService.updateRole(id, dto.role);

    await this.auditService.log(
      actor.username || actor.sub,
      'CHANGE_ROLE',
      'user',
      id,
      { role: existing.role },
      { role: dto.role },
    );

    return { id, role: dto.role };
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'View audit logs (admin/teacher only)' })
  @ApiResponse({ status: 200, description: 'Audit logs' })
  @Audit('VIEW_AUDIT_LOGS', 'audit_logs')
  async getAuditLogs(@Query('limit') limit = 100, @Query('offset') offset = 0) {
    return this.auditService.list(Number(limit), Number(offset));
  }

  private async hashPassword(password: string): Promise<string> {
    // Lazy import to avoid circular dependency at module top-level
    const bcrypt = await import('bcrypt');
    return bcrypt.default.hash(password, 12);
  }
}
