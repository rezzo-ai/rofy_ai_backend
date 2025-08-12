import { IsString } from 'class-validator';

export class ApprovePlanDto {
  @IsString()
  chatId!: string;
}
