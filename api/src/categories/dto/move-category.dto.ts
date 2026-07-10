import { IsIn } from 'class-validator';

export class MoveCategoryDto {
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
