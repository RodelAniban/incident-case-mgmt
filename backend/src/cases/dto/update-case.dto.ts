import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { CaseCategory, CaseSeverity, CaseStatus } from '../../entities/case.entity';

export class UpdateCaseDto {
  @IsString()
  @MinLength(3)
  @IsOptional()
  title?: string;

  @IsString()
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
