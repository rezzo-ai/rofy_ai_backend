import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';

@Module({
    imports: [UsersModule, HealthModule],
})
export class AppModule { }
