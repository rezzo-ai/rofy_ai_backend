# Updated Register API Documentation

## Overview
The register function has been updated to automatically fetch the user's email from Clerk instead of requiring it in the request body.

## Changes Made

### 1. DTO Updates (`src/users/dto/user.dto.ts`)
- Made `email` field optional in `RegisterUserDto`
- Added `@IsOptional()` decorator
- Removed `@IsNotEmpty()` requirement

### 2. Service Updates (`src/users/users.service.ts`)
- Changed method signature from `registerUser(authorization: string, email: string)` to `registerUser(clerkUserId: string, providedEmail?: string)`
- Added Clerk API call to fetch user details: `this.clerk.users.getUser(clerkUserId)`
- Automatically retrieves primary email address from Clerk user profile
- Falls back to provided email if Clerk email is not available
- Enhanced error handling for Clerk API failures

### 3. Controller Updates (`src/users/users.controller.ts`)
- Updated to pass `req.user.sub` (Clerk user ID) instead of authorization token
- Email from request body is now optional and used as fallback

## API Usage

### Before (Required email in body):
```bash
POST /users/register
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

### After (Email automatically fetched from Clerk):
```bash
POST /users/register
Authorization: Bearer <jwt_token>
Content-Type: application/json

{}
```

Or with optional email override:
```bash
POST /users/register
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "email": "override@example.com"
}
```

## Benefits

1. **Simplified Frontend**: No need to collect email separately if user is already authenticated
2. **Data Consistency**: Email is fetched directly from Clerk's authoritative source
3. **Better UX**: Automatic registration without additional form fields
4. **Fallback Support**: Still accepts email in request body if needed

## Error Handling

- **No Clerk User Found**: Returns 401 with "User not found in Clerk"
- **No Email Available**: Returns 401 with "No email address found for user"
- **Invalid Email Format**: Returns 401 with "Invalid email format"
- **Database Errors**: Returns 500 with appropriate error message

## Authentication Flow

1. Client sends JWT token in Authorization header
2. Middleware verifies token and extracts user ID (`req.user.sub`)
3. Service calls Clerk API to get user details
4. Primary email is extracted from Clerk user profile
5. User is registered/updated in local database with Clerk email
