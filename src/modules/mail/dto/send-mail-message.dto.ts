import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMailMessageDto {
  @IsEmail()
  @MaxLength(320)
  to!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10_000)
  body!: string;
}
