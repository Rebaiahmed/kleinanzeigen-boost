import { Controller, Get } from '@nestjs/common';
import { FEATURE_FLAGS, getFeatureFlagsForClient } from './feature-flags';

@Controller('api/config')
export class ConfigController {
  @Get('feature-flags')
  getFeatureFlags() {
    return getFeatureFlagsForClient();
  }
}
