import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateOAuthUser(userData: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  }): Promise<User> {
    try {
      let user = await this.usersService.findByGoogleId(userData.googleId);

      if (user) {
        user = await this.usersService.updateUser(user.id, {
          firstName: userData.firstName,
          lastName: userData.lastName,
          profilePicture: userData.profilePicture,
        });
      } else {
        user = await this.usersService.createUser(userData);
      }

      return user;
    } catch (error) {
      console.error('Error validating OAuth user:', error);
      throw new Error('Failed to validate OAuth user');
    }
  }

  public login(user: User) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
      },
    };
  }
}
