import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { Role } from '../../common/roles.enum';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  /** Explicit null clears the team assignment; omit the field entirely to leave it unchanged. */
  @IsOptional()
  @IsInt()
  teamId?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
