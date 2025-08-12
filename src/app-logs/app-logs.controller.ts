import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { publish } from 'src/lib/sessionHub';
import stripAnsi from 'strip-ansi';

type LogsDto = {
  // const { sessionId, level = 'error', message, stack } = await req.json();
    sessionId: string;
  data: string;
};

@Controller('logs')
export class AppLogsController {
  @Post()
  async postLogs(@Body() body: LogsDto) {
    try {
      const { sessionId, data } = body;
    //   const { data } = body;

      if (!sessionId) {
        return new HttpException(
          { error: 'Missing sessionId' },
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!data) {
        return new HttpException(
          { error: 'Missing log message' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // 1) Broadcast the log so the UI can show it immediately
      publish(sessionId, 'log', {
        level: 'error',
        message: stripAnsi(data),
        stack: null,
        ts: Date.now(),
      });

      // 2) (Optional) Nudge the UI that an auto-fix could be started
      publish(sessionId, 'notice', { message: 'auto-fix-available' });

      return { ok: true };
    } catch (err: any) {
      throw new HttpException({ error: String(err) }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
