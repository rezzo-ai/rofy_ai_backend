import { Module } from '@nestjs/common';

import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { PlanModule } from './plan/plan.module';

@Module({
    imports: [UsersModule, HealthModule, PlanModule],
})
export class AppModule { }
