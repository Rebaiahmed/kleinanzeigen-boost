import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ReplyTemplatesService, ReplyTemplate } from './reply-templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/reply-templates')
@UseGuards(JwtAuthGuard)
export class ReplyTemplatesController {
  constructor(private readonly templatesService: ReplyTemplatesService) {}

  @Get()
  async getTemplates(@Req() req: any) {
    return this.templatesService.getTemplates(req.user.userId);
  }

  @Post()
  async createTemplate(@Req() req: any, @Body() body: Partial<ReplyTemplate>) {
    return this.templatesService.createTemplate(req.user.userId, body);
  }

  @Put(':id')
  async updateTemplate(@Req() req: any, @Param('id') id: string, @Body() body: Partial<ReplyTemplate>) {
    return this.templatesService.updateTemplate(req.user.userId, id, body);
  }

  @Delete(':id')
  async deleteTemplate(@Req() req: any, @Param('id') id: string) {
    await this.templatesService.deleteTemplate(req.user.userId, id);
    return { success: true };
  }

  @Post(':id/copy')
  async copyTemplate(@Req() req: any, @Param('id') id: string) {
    await this.templatesService.incrementCopyCount(req.user.userId, id);
    return { success: true };
  }

  @Post('generate')
  async generateTemplates(@Req() req: any, @Body() body: { title: string, description: string, price: string, category: string }) {
    return this.templatesService.generateTemplatesFromAd(req.user.userId, body);
  }

  @Post('save-generated')
  async saveGenerated(@Req() req: any, @Body() body: { templates: Partial<ReplyTemplate>[] }) {
    return this.templatesService.saveGeneratedTemplates(req.user.userId, body.templates);
  }
}
