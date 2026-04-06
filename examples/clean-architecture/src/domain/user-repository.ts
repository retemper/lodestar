import type { User } from './user';

/** Port for user persistence -- implemented by the infra layer */
interface UserRepository {
  /** Persist a user entity */
  save(user: User): Promise<void>;
  /** Look up a user by their unique ID */
  findById(id: string): Promise<User | null>;
  /** Look up a user by their email address */
  findByEmail(email: string): Promise<User | null>;
}

export type { UserRepository };
