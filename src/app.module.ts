import { Module } from '@nestjs/common';

import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { StreamModule } from './stream/stream.module';
import { ChatsModule } from './chats/chats.module';
import { ApprovePlanModule } from './approve-plan/approve-plan.module';
import { AppLogsModule } from './app-logs/app-logs.module';
import { PlanModule } from './plan/plan.module';

@Module({
    imports: [UsersModule, HealthModule, ApprovePlanModule, ChatsModule, StreamModule, OrchestratorModule, AppLogsModule, PlanModule],
})
export class AppModule { }
