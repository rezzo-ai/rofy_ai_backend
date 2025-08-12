import { Module, MiddlewareConsumer } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { ClerkAuthMiddleware } from '../clerk-auth.middleware';

@Module({
    controllers: [PlanController],
})
export class PlanModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(ClerkAuthMiddleware).forRoutes(PlanController);
    }
}
