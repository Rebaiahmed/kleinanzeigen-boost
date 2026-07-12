import { Injectable } from '@nestjs/common';
import { isValidGermanPlzFormat, isValidGermanPlzRange } from '../config/plz-ranges.constants';

@Injectable()
export class PlzValidationService {
  validate(plz: string): { valid: boolean; reason?: 'FORMAT' | 'OUT_OF_RANGE' } {
    if (!isValidGermanPlzFormat(plz)) return { valid: false, reason: 'FORMAT' };
    if (!isValidGermanPlzRange(plz)) return { valid: false, reason: 'OUT_OF_RANGE' };
    return { valid: true };
  }
}
