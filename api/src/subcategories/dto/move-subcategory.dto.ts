import { IsIn } from 'class-validator';

export class MoveSubcategoryDto {
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
