import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { EvidenceType } from '../../entities/evidence-item.entity';

/** Fields arrive as multipart/form-data strings alongside the file; caseId is coerced to a number. */
export class CreateEvidenceDto {
  @Type(() => Number)
  @IsInt()
  caseId: number;

  @IsEnum(EvidenceType)
  type: EvidenceType;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  tags?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
