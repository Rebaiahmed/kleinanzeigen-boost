import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

// Sent as multipart/form-data (images travel as files, see AdsController#saveDraft).
// keyFeatures/vinted arrive as JSON-encoded strings because multipart form fields
// are always plain strings — AdsService.saveDraft() parses them back into
// string[]/object before writing to Firestore.
export class SaveDraftDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  /** JSON-encoded string[] */
  @IsOptional()
  @IsString()
  keyFeatures?: string;

  /** JSON-encoded { title, description, price, condition, size, brand, color, material } */
  @IsOptional()
  @IsString()
  vinted?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  autoRepost?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  repostIntervalMinutes?: number;
}
