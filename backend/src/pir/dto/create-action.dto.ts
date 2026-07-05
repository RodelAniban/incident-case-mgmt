import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateActionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  owner?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
}
