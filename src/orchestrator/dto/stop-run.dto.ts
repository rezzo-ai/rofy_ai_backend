// src/orchestrator/dto/stop-run.dto.ts
import { IsString } from 'class-validator';
export class StopRunDto {
  @IsString()
  sessionId!: string;
}
