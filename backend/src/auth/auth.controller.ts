import { Controller, Post, Body, Get, Param, UseGuards, Req, Res, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Response } from 'express';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login
   * Starts a visible Playwright browser session on the server so the user can
   * complete any CAPTCHA challenge themselves. Returns 202 + jobId immediately.
   * The frontend polls GET /api/auth/login-status/:jobId every 3 seconds.
   */
  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { email } = body;
    const { jobId } = await this.authService.initiateVisibleLogin(email);
    res.status(HttpStatus.ACCEPTED);
    return { accepted: true, jobId };
  }

  /**
   * GET /api/auth/login-status/:jobId
   * Polls the automation worker for the current status of the visible login job.
   * When status === 'success', also sets the session cookie and returns accessToken.
   */
  @Get('login-status/:jobId')
  async loginStatus(
    @Param('jobId') jobId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.getLoginJobStatus(jobId);

    if (result.status === 'success' && result.accessToken) {
      res.cookie('kb_session', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      // Store in localStorage-friendly response field too
      return { status: 'success', accessToken: result.accessToken };
    }

    return result;
  }

  @Post('login/2fa')
  async login2FA(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { email, sessionId, code } = body;
    const { accessToken } = await this.authService.submit2FA(email, sessionId, code);

    res.cookie('kb_session', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return { success: true, accessToken };
  }

  @Post('login/cookie')
  async loginCookie(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { email, cookies } = body;
    const { accessToken } = await this.authService.loginWithCookie(email, cookies);

    res.cookie('kb_session', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return { success: true, accessToken };
  }

  @Post('handshake-token')
  async generateHandshake(@Body() body: any) {
    const { cookies } = body;
    const token = await this.authService.generateHandshakeToken(cookies);
    return { token };
  }

  @Post('exchange-token')
  async exchangeHandshake(@Body() body: any, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const { token } = body;
    // Forward the caller's existing auth (if logged in) so the handshake can link
    // the marketplace cookies to that user id too.
    const { accessToken, userId } = await this.authService.exchangeHandshakeToken(token, req.headers?.authorization);

    res.cookie('kb_session', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return { success: true, accessToken, userId };
  }

  @UseGuards(JwtAuthGuard)
  @Get('status')
  async status(@Req() req: any) {
    return this.authService.getStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(req.user.userId);
    res.clearCookie('kb_session');
    return { success: true };
  }
}

