import { Module } from '@nestjs/common';
import { AppLogsController } from './app-logs.controller';

@Module({
  controllers: [AppLogsController],
})
export class AppLogsModule {}
