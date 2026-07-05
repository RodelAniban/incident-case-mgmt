import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NoteTag } from '../../entities/chat-message.entity';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body: string;

  @IsEnum(NoteTag)
  @IsOptional()
  tag?: NoteTag;
}
