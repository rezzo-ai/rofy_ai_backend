import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class RegisterUserDto {
    @IsOptional()
    @IsEmail({}, { message: 'Please provide a valid email address' })
    @MaxLength(255, { message: 'Email must be less than 255 characters' })
    email?: string;
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
