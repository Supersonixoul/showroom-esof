import { IsIn } from 'class-validator';

export class MoveProductDto {
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
