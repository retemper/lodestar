import type { User } from '../domain/user';
import type { UserRepository } from '../domain/user-repository';

/** In-memory implementation of UserRepository for demonstration purposes */
function createPrismaUserRepository(): UserRepository {
  const store = new Map<string, User>();

  return {
    async save(user: User): Promise<void> {
      store.set(user.id, user);
    },

    async findById(id: string): Promise<User | null> {
      return store.get(id) ?? null;
    },

    async findByEmail(email: string): Promise<User | null> {
      for (const user of store.values()) {
        if (user.email === email) {
          return user;
        }
      }
      return null;
    },
  };
}

export { createPrismaUserRepository };
