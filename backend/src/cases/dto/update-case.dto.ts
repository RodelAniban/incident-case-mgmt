import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CaseCategory, CaseSeverity, CaseStatus } from '../../entities/case.entity';

export class UpdateCaseDto {
  @IsString()
  @MinLength(3)
  @IsOptional()
  title?: string;

  /** Rich-text HTML from the narrative editor — sanitized server-side before it's ever stored. */
  @IsString()
  @MaxLength(20000)
  @IsOptional()
  description?: string;

  @IsEnum(CaseSeverity)
  @IsOptional()
  severity?: CaseSeverity;

  @IsEnum(CaseCategory)
  @IsOptional()
  category?: CaseCategory;

  @IsEnum(CaseStatus)
  @IsOptional()
  status?: CaseStatus;

  @IsInt()
  @IsOptional()
  assigneeId?: number;
}
