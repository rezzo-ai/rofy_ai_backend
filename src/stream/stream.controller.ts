import {
  Controller,
  Get,
  Query,
  Req,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { subscribe } from 'src/lib/sessionHub';

@Controller('stream')
export class StreamController {
  @Get('')
  stream(
    @Query('sessionId') sessionId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!sessionId) {
      throw new HttpException('Missing sessionId', HttpStatus.BAD_REQUEST);
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Some proxies need this to start streaming immediately
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    const write = (chunk: string) => {
      res.write(chunk);
    };

    const sendEvent = (event: string, data: unknown) => {
      write(`event: ${event}\n`);
      write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Initial control + bootstrap events
    write(`retry: 1000\n\n`);
    sendEvent('session', { sessionId });

    // Keep-alive ping every 25s
    const ping = setInterval(() => {
      sendEvent('ping', {});
    }, 25_000);

    // Subscribe to your hub and forward events
    const unsubscribe = subscribe(sessionId, ({ event, data }) => {
      sendEvent(event, data);
    });

    const cleanup = () => {
      clearInterval(ping);
      try {
        unsubscribe?.();
      } catch {}
      try {
        res.end();
      } catch {}
    };

    // Clean up on client disconnect/abort
    req.on('close', cleanup);
    req.on('aborted', cleanup);

    // Do NOT return anything—Nest will keep the response open
  }
}
