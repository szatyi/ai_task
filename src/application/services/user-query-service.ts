import type { User, UserRepository } from "@/domain/repositories/user-repository";

export class UserQueryService {
  constructor(private readonly userRepository: UserRepository) {}

  async getUser(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }
}
