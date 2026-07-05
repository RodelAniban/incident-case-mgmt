import { IsEnum, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CaseCategory, CaseSeverity } from '../../entities/case.entity';

export class CreateCaseDto {
  @IsString()
  @MinLength(3)
  title: string;

  /** Rich-text HTML from the narrative editor — sanitized server-side before it's ever stored. */
  @IsString()
  @MaxLength(20000)
  @IsOptional()
  description?: string;

  @IsEnum(CaseSeverity)
  severity: CaseSeverity;

  @IsEnum(CaseCategory)
  category: CaseCategory;

  @IsInt()
  teamId: number;

  @IsInt()
  @IsOptional()
  assigneeId?: number;
}
