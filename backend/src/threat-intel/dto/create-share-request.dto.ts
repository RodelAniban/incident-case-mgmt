import { IsInt } from 'class-validator';

export class CreateShareRequestDto {
  @IsInt()
  indicatorId: number;
}
