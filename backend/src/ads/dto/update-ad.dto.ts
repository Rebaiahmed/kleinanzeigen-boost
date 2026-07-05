import { IsString, IsBoolean, IsNumber, IsOptional, IsISO8601, Min, IsIn, ValidateNested, IsArray, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SmartVariationDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  titleVariants?: string[];

  @IsOptional()
  @IsBoolean()
  rotatePhotos?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(90)
  priceStepPercent?: number;
}

export class UpdateAdDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  repostIntervalMinutes?: number;

  @IsOptional()
  @IsISO8601()
  nextRepostAt?: string;

  @IsOptional()
  @IsBoolean()
  autoRepost?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  trackedRepostsCount?: number;

  @IsOptional()
  @IsIn(['smart', 'manual'])
  repostMode?: 'smart' | 'manual';

  @IsOptional()
  @ValidateNested()
  @Type(() => SmartVariationDto)
  smartVariation?: SmartVariationDto;
}
