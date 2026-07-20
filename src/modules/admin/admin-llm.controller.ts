import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Audit, AuditInterceptor } from '../audit/audit.guard';
import { LlmService, CreateProviderDto, UpdateProviderDto, LlmProvider } from '../llm/llm.service';

@ApiTags('LLM Providers')
@Controller('admin/llm-providers')
@UseGuards(JwtAuthGuard, RolesGuard, AuditInterceptor)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminLlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an LLM provider (admin only)' })
  @ApiResponse({ status: 201, description: 'Provider created' })
  @Audit('CREATE_LLM_PROVIDER', 'llm_provider')
  async create(@Body() dto: CreateProviderDto): Promise<LlmProvider> {
    return this.llmService.addProvider(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List LLM providers (admin only)' })
  @ApiResponse({ status: 200, description: 'Providers list' })
  @Audit('LIST_LLM_PROVIDERS', 'llm_provider')
  async list(): Promise<LlmProvider[]> {
    return this.llmService.getProviders();
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an LLM provider (admin only)' })
  @ApiResponse({ status: 200, description: 'Provider updated' })
  @Audit('UPDATE_LLM_PROVIDER', 'llm_provider', 'id')
  async update(@Param('id') id: string, @Body() dto: UpdateProviderDto): Promise<LlmProvider> {
    return this.llmService.updateProvider(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an LLM provider (admin only)' })
  @ApiResponse({ status: 204, description: 'Provider deleted' })
  @Audit('DELETE_LLM_PROVIDER', 'llm_provider', 'id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.llmService.deleteProvider(id);
  }
}
