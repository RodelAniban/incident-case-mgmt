import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IndicatorType, Tlp } from '../../entities/threat-indicator.entity';

class ImportIndicatorDto {
  @IsEnum(IndicatorType)
  type: IndicatorType;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  value: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  confidence?: number;

  @IsEnum(Tlp)
  @IsOptional()
  tlp?: Tlp;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  source: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  threatActor?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  campaign?: string;
}

/** Simplified normalized shape — a real integration would translate a STIX 2.1 bundle into this. */
export class ImportIndicatorsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ImportIndicatorDto)
  indicators: ImportIndicatorDto[];
}
