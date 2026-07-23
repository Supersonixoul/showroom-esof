import { IsBoolean } from 'class-validator';

export class SetVisibilityDto {
  @IsBoolean()
  isActive: boolean;
}
