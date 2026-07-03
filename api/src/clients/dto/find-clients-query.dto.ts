import { IsOptional, IsString } from 'class-validator';

export class FindClientsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
