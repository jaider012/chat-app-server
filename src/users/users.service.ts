import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    await this.userRepository.update(id, userData);
    const user = await this.findById(id);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find();
  }

  async findAvailableUsers(currentUserId: string): Promise<User[]> {
    // Get users excluding current user and users with existing conversations
    return this.userRepository
      .createQueryBuilder("user")
      .where("user.id != :currentUserId", { currentUserId })
      .andWhere(
        'user.id NOT IN ' +
          '(SELECT DISTINCT cp."userId" ' +
          'FROM conversation_participants cp ' +
          'INNER JOIN conversation_participants cp2 ON cp2."conversationId" = cp."conversationId" ' +
          'WHERE cp2."userId" = :currentUserId AND cp."userId" != :currentUserId)',
        { currentUserId }
      )
      .getMany();
  }
}
