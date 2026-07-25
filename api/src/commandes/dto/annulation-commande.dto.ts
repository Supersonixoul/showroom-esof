import { IsNotEmpty, IsString } from 'class-validator';

export class AnnulationCommandeDto {
  @IsString()
  @IsNotEmpty()
  motif: string;
}
