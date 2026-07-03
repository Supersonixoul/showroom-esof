import { IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClientNoteDto {
  @IsString()
  @IsNotEmpty()
  note: string;

  @IsOptional()
  @IsISO8601()
  visitDate?: string;
}
