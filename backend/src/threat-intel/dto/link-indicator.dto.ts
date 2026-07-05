import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IndicatorType, Tlp } from '../../entities/threat-indicator.entity';

/** Either `indicatorId` (link an existing IOC) or `type`+`value` (record a new one and link it). */
export class LinkIndicatorDto {
  @IsInt()
  @IsOptional()
  indicatorId?: number;

  @IsEnum(IndicatorType)
  @IsOptional()
  type?: IndicatorType;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @IsOptional()
  value?: string;

  @IsEnum(Tlp)
  @IsOptional()
  tlp?: Tlp;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  note?: string;
}
