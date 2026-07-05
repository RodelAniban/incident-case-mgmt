import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Each field is rich-text HTML from the same editor/sanitizer as the case narrative. */
export class UpdatePirDto {
  @IsString()
  @MaxLength(20000)
  @IsOptional()
  timelineNotes?: string;

  @IsString()
  @MaxLength(20000)
  @IsOptional()
  rootCause?: string;

  @IsString()
  @MaxLength(20000)
  @IsOptional()
  detectionGapAnalysis?: string;

  @IsString()
  @MaxLength(20000)
  @IsOptional()
  responseEffectiveness?: string;

  @IsString()
  @MaxLength(20000)
  @IsOptional()
  lessonsLearned?: string;
}
