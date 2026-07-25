import { IsNotEmpty, IsString } from 'class-validator';

export class LoginAgentCommercialDto {
  @IsString()
  @IsNotEmpty()
  identifiant: string;

  @IsString()
  @IsNotEmpty()
  motDePasse: string;
}
