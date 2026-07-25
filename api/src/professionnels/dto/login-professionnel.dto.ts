import { IsNotEmpty, IsString } from 'class-validator';

export class LoginProfessionnelDto {
  @IsString()
  @IsNotEmpty()
  identifiant: string;

  @IsString()
  @IsNotEmpty()
  motDePasse: string;
}
