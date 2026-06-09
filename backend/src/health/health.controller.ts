import { Controller, Get } from '@nestjs/common';

/** Lightweight liveness probe — no auth, no external calls.
 *  Used by deploy verification and uptime monitors. */
@Controller('api/health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
