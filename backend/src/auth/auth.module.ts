import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET || 'fallback_secret_for_dev',
        signOptions: { expiresIn: '7d' },
      }),
    }),
    AutomationModule,
  ],
  providers: [AuthService, SessionService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
