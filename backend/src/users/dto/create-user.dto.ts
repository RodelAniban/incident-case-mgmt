import { IsEmail, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '../../common/roles.enum';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsInt()
  teamId?: number;
}
