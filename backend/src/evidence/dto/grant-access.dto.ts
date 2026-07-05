import { IsEmail, IsOptional, IsString } from 'class-validator';

export class GrantAccessDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
