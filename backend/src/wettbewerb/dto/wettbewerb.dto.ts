import { IsString, IsIn, MinLength } from 'class-validator';
import { RADIUS_OPTIONS_KM, CHECK_INTERVAL_OPTIONS_DAYS } from '../../config/wettbewerb.constants';

export class CreateSavedSearchDto {
  @IsString()
  @MinLength(1)
  keyword!: string;

  @IsString()
  plz!: string;

  // Real server-side enforcement of "reject any radius value other than
  // Kleinanzeigen's actual allowed options" — a frontend <select> can be
  // bypassed by a direct API call, this decorator can't.
  @IsIn(RADIUS_OPTIONS_KM)
  radiusKm!: number;

  @IsIn(CHECK_INTERVAL_OPTIONS_DAYS)
  checkIntervalDays!: number;
}

export class AdIdBodyDto {
  @IsString()
  @MinLength(1)
  adId!: string;
}
