import { IsOptional, IsUUID } from 'class-validator';

export class FindGammesQueryDto {
  @IsOptional()
  @IsUUID()
  brandId?: string;
}
