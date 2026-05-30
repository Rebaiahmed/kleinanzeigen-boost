import { Controller, Get } from '@nestjs/common';

@Controller('support')
export class SupportController {
  @Get('config')
  getSupportConfig() {
    return {
      paypalDonateUrl: process.env.PAYPAL_DONATE_URL,
      githubUrl: process.env.GITHUB_URL || 'https://github.com/yourusername/anzeigenboost',
      kofiUrl: process.env.KOFI_URL,
      message: 'AnzeigenBoost ist ein Einzelprojekt. Wenn das Tool dir hilft, freue ich mich über eine kleine Unterstützung! ☕',
    };
  }
}
