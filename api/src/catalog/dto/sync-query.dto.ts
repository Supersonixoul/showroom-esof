import { IsISO8601 } from 'class-validator';

export class SyncQueryDto {
  @IsISO8601()
  since: string;
}
