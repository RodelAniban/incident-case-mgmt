import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideShareRequestDto {
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  reason?: string;
}
