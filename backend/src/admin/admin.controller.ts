import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** GET /admin/users-usage — all users with current-month AI usage. */
  @Get('users-usage')
  getUsersUsage() {
    return this.adminService.getUsersUsage();
  }

  /** PATCH /admin/users/:id/ai-limit { bonus } — set a user's monthly bonus. */
  @Patch('users/:id/ai-limit')
  setAiLimit(@Param('id') id: string, @Body() body: { bonus: number }) {
    return this.adminService.setAiLimitBonus(id, body?.bonus ?? 0);
  }
}
