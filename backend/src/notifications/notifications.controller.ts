import { Controller, Sse, Query, Post, Req, UseGuards, UnauthorizedException, MessageEvent } from '@nestjs/common';
import { Observable, merge, interval, map } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * SSE stream — the dashboard connects with EventSource. EventSource can't send
   * an auth header, so the JWT comes via query param and is verified here.
   * A 25s heartbeat keeps the connection alive through proxies.
   */
  @Sse('stream')
  stream(@Query('token') token: string): Observable<MessageEvent> {
    let userId: string | undefined;
    try { userId = this.jwt.verify(token)?.sub; } catch { /* invalid */ }
    if (!userId) throw new UnauthorizedException('invalid token');

    const events = this.notifications.stream(userId).pipe(map((data) => ({ data }) as MessageEvent));
    const heartbeat = interval(25000).pipe(map(() => ({ data: { type: 'ping' } }) as MessageEvent));
    return merge(events, heartbeat);
  }

  /** Instant test — pushes a notification to the caller's live stream. */
  @UseGuards(JwtAuthGuard)
  @Post('test')
  async test(@Req() req: any) {
    await this.notifications.emit(req.user.userId, {
      type: 'test',
      message: '🔔 Test-Benachrichtigung — die Verbindung funktioniert!',
    });
    return { success: true };
  }
}
