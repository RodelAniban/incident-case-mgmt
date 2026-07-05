import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { CaseCategory, CaseSeverity } from '../../entities/case.entity';

export class CreateCaseDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
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
