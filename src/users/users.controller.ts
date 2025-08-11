import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('register')
    async registerUser(@Body() body: { authorization: string; email: string }) {
        const { authorization, email } = body;
        if (!authorization || !email) {
            throw new HttpException('Authorization and email are required.', HttpStatus.BAD_REQUEST);
        }
        try {
            const result = await this.usersService.registerUser(authorization, email);
            return result;
        } catch (error: any) {
            throw new HttpException(error.message || 'Registration failed.', HttpStatus.BAD_REQUEST);
        }
    }
}
