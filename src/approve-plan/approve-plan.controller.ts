import { Body, Controller, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApprovePlanDto } from './dto/approve-plan.dto';

import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from 'src/utils/firebase';

@Controller('approve-plan')
export class ApprovePlanController {
  @Post('')
  async approvePlan(@Body() body: ApprovePlanDto) {
    const { chatId } = body;

    try {
      if (!chatId) {
        throw new HttpException(
          { success: false, error: 'chatId is required' },
          HttpStatus.BAD_REQUEST,
        );
      }

      const docRef = doc(db, 'chats', chatId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        throw new HttpException(
          { success: false, error: 'Chat not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      await updateDoc(docRef, {
        updated_at: serverTimestamp(),
        plan_approved: true,
      });

      return { success: true };
    } catch (err: any) {
      // Preserve your original 400 on unexpected errors
      if (err instanceof HttpException) throw err;

      throw new HttpException(
        { success: false, error: err?.message ?? 'Unknown error' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
