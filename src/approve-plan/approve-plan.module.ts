import { Module } from '@nestjs/common';
import { ApprovePlanController } from './approve-plan.controller';

@Module({
    controllers: [ApprovePlanController],
})
export class ApprovePlanModule { }
