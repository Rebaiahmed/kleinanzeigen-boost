import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Response } from 'express';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { email, password } = body;
    const response = await this.authService.login(email, password);
    
    if (response.requires_2fa) {
      return response; // Return { requires_2fa: true, sessionId } directly
    }

    // Set HTTP-only cookie
    res.cookie('kb_session', response.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
    });

    return { success: true };
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

    return { success: true };
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

    return { success: true };
  }

  @Post('handshake-token')
  async generateHandshake(@Body() body: any) {
    const { cookies } = body;
    const token = await this.authService.generateHandshakeToken(cookies);
    return { token };
  }

  @Post('exchange-token')
  async exchangeHandshake(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const { token } = body;
    const { accessToken, userId } = await this.authService.exchangeHandshakeToken(token);
    
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
}
