import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Sent as plain JSON — images never reach the backend. They're stored
// client-side (IndexedDB, keyed by draft id) and never leave the browser.
export class VintedDraftDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  size?: string | null;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsString()
  color?: string | null;

  @IsOptional()
  @IsString()
  material?: string | null;
}

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
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  brand?: string | null;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keyFeatures?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => VintedDraftDto)
  vinted?: VintedDraftDto;

  @IsOptional()
  @IsBoolean()
  autoRepost?: boolean;

  @IsOptional()
  @IsNumber()
  repostIntervalMinutes?: number;
}
