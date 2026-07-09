import { IsIn } from 'class-validator';

export class MoveVideoDto {
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
