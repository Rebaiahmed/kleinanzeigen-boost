import { IsString, IsNumber, IsOptional, IsBoolean, IsArray } from 'class-validator';

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
  @IsArray()
  images?: string[];

  @IsOptional()
  @IsBoolean()
  autoRepost?: boolean;

  @IsOptional()
  @IsNumber()
  repostIntervalMinutes?: number;
}
