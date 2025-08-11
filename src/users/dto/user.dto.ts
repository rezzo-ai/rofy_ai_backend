import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterUserDto {
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @IsNotEmpty({ message: 'Email is required' })
    @MaxLength(255, { message: 'Email must be less than 255 characters' })
    email: string;
}

export class UserResponseDto {
    success: boolean;
    message: string;
    user?: {
        id: number;
        clerkId: string;
        email: string;
        createdAt?: Date;
        updatedAt?: Date;
    };
}
