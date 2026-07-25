import { PartialType } from '@nestjs/mapped-types';
import { CreateProfessionnelDto } from './create-professionnel.dto';

/// motDePasse hérite de @IsOptional() via PartialType : si absent du PATCH,
/// le service ne touche pas au mot de passe actuel (voir ProfessionnelsService.update).
export class UpdateProfessionnelDto extends PartialType(CreateProfessionnelDto) {}
