import { Controller, Get, HttpException, HttpStatus, Query } from '@nestjs/common';
import { collection, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
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

  @Get('info')
  async getChatInfo(@Query('chatId') chatId?: string) {
    if (!chatId) {
      throw new HttpException({ error: 'Missing chatId' }, HttpStatus.BAD_REQUEST);
    }

    try {
      const ref = doc(db, 'chats', chatId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        throw new HttpException({ success: false, error: 'Chat not found' }, HttpStatus.NOT_FOUND);
      }

      const data: any = snap.data();

      const toIso = (v: any): string | undefined => {
        // supports Firestore Timestamp or {seconds,nanoseconds} objects
        if (v?.toDate) return v.toDate().toISOString();
        if (v?.seconds !== undefined) {
          return new Timestamp(v.seconds, v.nanoseconds ?? 0).toDate().toISOString();
        }
        return undefined;
        };

      return {
        success: true,
        chatId: snap.id,
        initialPrompt: data?.initial_prompt,
        appDescription: data?.app_description,
        appDesignLanguage: data?.app_design_language,
        createdAt: toIso(data?.created_at),
        updatedAt: toIso(data?.updated_at),
      };
    } catch (err) {
      throw new HttpException(
        { error: 'Server error', details: String(err) },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
