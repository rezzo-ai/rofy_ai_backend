import { Controller, Post, Get, Body, Req, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from './users.service';
import { RegisterUserDto, UserResponseDto } from './dto/user.dto';

interface AuthenticatedRequest extends Request {
    user?: {
        sub: string;
        email?: string;
        [key: string]: any;
    };
}

@Controller('users')
export class UsersController {
    private readonly logger = new Logger(UsersController.name);

    constructor(private readonly usersService: UsersService) { }

    @Post('register')
    async registerUser(@Body() registerUserDto: RegisterUserDto, @Req() req: AuthenticatedRequest): Promise<UserResponseDto> {

        if (!req.user?.sub) {
            throw new HttpException(
                { success: false, message: 'User authentication required' },
                HttpStatus.UNAUTHORIZED
            );
        }

        try {
            const result = await this.usersService.registerUser(
                req.user.sub,
                registerUserDto.email // Optional: can be undefined
            );

            this.logger.log(`User registration successful: ${req.user.sub}`);
            return result;
        } catch (error: any) {
            this.logger.error(`User registration failed: ${error.message}`);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                { success: false, message: error.message || 'Registration failed' },
                HttpStatus.BAD_REQUEST
            );
        }
    }

    @Get('profile')
    async getUserProfile(@Req() req: AuthenticatedRequest): Promise<UserResponseDto> {
        if (!req.user?.sub) {
            throw new HttpException(
                { success: false, message: 'User authentication required' },
                HttpStatus.UNAUTHORIZED
            );
        }

        try {
            const result = await this.usersService.getUserByClerkId(req.user.sub);

            if (!result) {
                throw new HttpException(
                    { success: false, message: 'User not found' },
                    HttpStatus.NOT_FOUND
                );
            }

            return result;
        } catch (error: any) {
            this.logger.error(`Failed to fetch user profile: ${error.message}`);

            if (error instanceof HttpException) {
                throw error;
            }

            throw new HttpException(
                { success: false, message: 'Failed to fetch user profile' },
                HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    @Get('health')
    healthCheck() {
        return {
            success: true,
            message: 'Users service is healthy',
            timestamp: new Date().toISOString()
        };
    }
}
