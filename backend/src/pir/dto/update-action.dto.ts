import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateActionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  owner?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsBoolean()
  @IsOptional()
  done?: boolean;
}
