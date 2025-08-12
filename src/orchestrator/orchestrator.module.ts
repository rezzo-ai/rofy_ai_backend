import { Module } from '@nestjs/common';
import { OrchestratorController } from './orchestrator.controller';

@Module({
  controllers: [OrchestratorController],
})
export class OrchestratorModule {}
