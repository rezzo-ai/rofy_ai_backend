import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from 'src/utils/firebase';

@Controller('chats')
export class ChatsController {
  @Get('messages')
  async listMessages(@Query('chatId') chatId?: string) {
    if (!chatId) {
      throw new HttpException({ error: 'Missing chatId' }, HttpStatus.BAD_REQUEST);
    }

    try {
      const queryRef = collection(db, 'chats', chatId, 'messages');
      const querySnap = await getDocs(queryRef);

      if (querySnap.empty) {
        throw new HttpException({ success: false, error: 'No messages found' }, HttpStatus.NOT_FOUND);
      }

      const messages = querySnap.docs.map((d) => {
        const data = d.data() as any;

        // created_at -> millis (handles both Firestore Timestamp and plain object)
        let createdAtMs: number | null = null;
        const ts = data?.created_at;
        if (ts?.toMillis && typeof ts.toMillis === 'function') {
          createdAtMs = ts.toMillis();
        } else if (ts && typeof ts.seconds === 'number' && typeof ts.nanoseconds === 'number') {
          createdAtMs = new Timestamp(ts.seconds, ts.nanoseconds).toMillis();
        }

        return {
          id: d.id,
          ...data,
          created_at: createdAtMs,
        };
      });

      return { success: true, messages };
    } catch (err) {
      throw new HttpException(
        { error: 'Server error', details: String(err) },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
