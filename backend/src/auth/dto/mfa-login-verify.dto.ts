import { IsString, Matches } from 'class-validator';

export class MfaLoginVerifyDto {
  @IsString()
  mfaToken: string;

  @Matches(/^[0-9]{6}$/, { message: 'code must be a 6-digit authenticator code' })
  code: string;
}
