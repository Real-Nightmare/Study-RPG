import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminLlmController } from './admin-llm.controller';
import { UsersModule } from '../users';
import { AuditModule } from '../audit';
import { LlmModule } from '../llm';

@Module({
  imports: [UsersModule, AuditModule, LlmModule],
  controllers: [AdminUsersController, AdminLlmController],
})
export class AdminModule {}
