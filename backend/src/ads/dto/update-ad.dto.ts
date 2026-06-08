import { IsString, IsBoolean, IsNumber, IsOptional, IsISO8601, Min } from 'class-validator';

export class UpdateAdDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

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
}
