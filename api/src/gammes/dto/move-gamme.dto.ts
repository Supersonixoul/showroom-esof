import { IsIn } from 'class-validator';

export class MoveGammeDto {
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
