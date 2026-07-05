import { IsIn } from 'class-validator';
import { PIR_TEMPLATE_IDS } from '../pir-templates';

export class CreatePirDto {
  @IsIn(PIR_TEMPLATE_IDS)
  templateId: string;
}
