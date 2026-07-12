import { IsBoolean, IsIn, IsString } from 'class-validator';
import { CREDIT_COSTS } from '../../config/credit-costs.constants';
import { CREDIT_PACKS } from '../../config/credit-packs.constants';

const ACTION_TYPES = Object.keys(CREDIT_COSTS);
const PACK_IDS = Object.keys(CREDIT_PACKS);

export class ReserveCreditsDto {
  @IsIn(ACTION_TYPES)
  actionType: string;

  @IsString()
  relatedActionId: string;
}

export class ConfirmCreditsDto {
  @IsString()
  relatedActionId: string;

  @IsBoolean()
  success: boolean;
}

export class CreateCheckoutDto {
  @IsIn(PACK_IDS)
  packId: string;
}
