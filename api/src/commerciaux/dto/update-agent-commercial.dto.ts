import { PartialType } from '@nestjs/mapped-types';
import { CreateAgentCommercialDto } from './create-agent-commercial.dto';

export class UpdateAgentCommercialDto extends PartialType(CreateAgentCommercialDto) {}
