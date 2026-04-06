import type { Email, User, UserId } from '../../core/domain/user';
import type { UserOutputPort } from '../../core/ports/user-port';

/** In-memory store simulating a Postgres database for demonstration */
const store = new Map<string, User>();

/**
 * Postgres repository — an outbound adapter implementing the UserOutputPort.
 * Depends on core/ports (UserOutputPort) and core/domain (User, Email, UserId) only.
 * In a real application this would use a database driver.
 */
function createPostgresUserRepository(): UserOutputPort {
  return {
    async save(user: User): Promise<User> {
      store.set(user.id.value, user);
      return user;
    },

    async findById(id: UserId): Promise<User | null> {
      return store.get(id.value) ?? null;
    },

    async findByEmail(email: Email): Promise<User | null> {
      for (const user of store.values()) {
        if (user.email.value === email.value) {
          return user;
        }
      }
      return null;
    },

    async existsByEmail(email: Email): Promise<boolean> {
      for (const user of store.values()) {
        if (user.email.value === email.value) {
          return true;
        }
      }
      return false;
    },
  };
}

export { createPostgresUserRepository };
