import { PartialType } from '@nestjs/mapped-types';
import { CreateGammeDto } from './create-gamme.dto';

export class UpdateGammeDto extends PartialType(CreateGammeDto) {}
