import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SpecialService } from './special.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../../common/decorators';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { Role } from '../../../common/decorators/roles.decorator';

@ApiTags('RPG - Special')
@Controller('rpg/special')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SpecialController {
  constructor(private readonly specialService: SpecialService) {}

  @Get('revision-centre')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Revision Centre funds and streak' })
  getRevisionCentre(@CurrentUser() user: JwtPayload) {
    return this.specialService.getRevisionCentre(user.sub);
  }

  @Post('revision-centre/apply')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply for Revision Centre session' })
  applyRevisionCentre(@CurrentUser() user: JwtPayload, @Body() body: { topic: string }) {
    return this.specialService.applyRevisionCentre(user.sub, body.topic);
  }

  @Post('revision-centre/quiz/:sessionId/submit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit Revision Centre quiz answers' })
  submitRevisionQuiz(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
    @Body() body: { answers: unknown[] },
  ) {
    return this.specialService.submitRevisionQuiz(user.sub, sessionId, body.answers);
  }

  @Post('programmes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a study programme' })
  createProgramme(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.specialService.createProgramme(user.sub, body);
  }

  @Get('programmes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user programmes' })
  getUserProgrammes(@CurrentUser() user: JwtPayload, @Query('status') status?: string) {
    return this.specialService.getUserProgrammes(user.sub, status);
  }

  @Post('programmes/:id/submit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit programme for approval' })
  submitProgramme(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.specialService.submitProgramme(user.sub, id);
  }

  @Post('cbt/start')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start a CBT session' })
  startCbt(@CurrentUser() user: JwtPayload, @Body() body: { subject: string }) {
    return this.specialService.startCbt(user.sub, body.subject);
  }

  @Post('cbt/:sessionId/submit')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit CBT answers' })
  submitCbt(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
    @Body() body: { answers: unknown[] },
  ) {
    return this.specialService.submitCbt(user.sub, sessionId, body.answers);
  }

  @Post('cbt/vote')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Vote for next week CBT subject' })
  voteCbtSubject(@CurrentUser() user: JwtPayload, @Body() body: { subject: string }) {
    return this.specialService.voteCbtSubject(user.sub, body.subject);
  }

  @Get('cbt/votes')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get CBT subject votes' })
  getCbtVotes() {
    return this.specialService.getCbtVotes();
  }

  @Get('cbt/leaderboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get CBT leaderboard' })
  getCbtLeaderboard(@Query('subject') subject?: string) {
    return this.specialService.getCbtLeaderboard(subject);
  }

  @Get('admin/revision-centre')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: View all Revision Centre funds' })
  adminGetRevisionCentre() {
    return this.specialService.adminGetRevisionCentre();
  }

  @Get('admin/programmes')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: View pending programmes' })
  adminGetProgrammes(@Query('status') status?: string) {
    return this.specialService.adminGetProgrammes(status);
  }

  @Post('admin/programmes/:id/approve')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Approve a programme' })
  approveProgramme(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body?: { feedback?: string },
  ) {
    return this.specialService.approveProgramme(user.sub, id, body?.feedback);
  }

  @Post('admin/programmes/:id/reject')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Reject a programme' })
  rejectProgramme(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { feedback: string },
  ) {
    return this.specialService.rejectProgramme(user.sub, id, body.feedback);
  }
}
