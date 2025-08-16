import { Module, MiddlewareConsumer } from '@nestjs/common';
import { PlanController } from './plan.controller';
import { ClerkAuthMiddleware } from '../clerk-auth.middleware';
import { PlanGateway } from './plan.gateway';

@Module({
    controllers: [PlanController],
    providers: [PlanGateway]
})

export class PlanModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(ClerkAuthMiddleware).forRoutes(PlanController);
    }
}
