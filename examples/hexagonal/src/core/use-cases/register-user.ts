import type { User } from '../domain/user';
import { createEmail, createUser } from '../domain/user';
import type { UserInputPort, UserOutputPort } from '../ports/user-port';

/**
 * Register-user use case — orchestrates the user registration flow.
 * Depends only on ports (UserOutputPort) and domain logic — never on adapters.
 */
function createRegisterUserUseCase(persistence: UserOutputPort): Pick<UserInputPort, 'register'> {
  return {
    async register(name: string, rawEmail: string): Promise<User> {
      const email = createEmail(rawEmail);
      const exists = await persistence.existsByEmail(email);
      if (exists) {
        throw new Error(`User with email ${email.value} already exists`);
      }

      const user = createUser(name, rawEmail);
      return persistence.save(user);
    },
  };
}

export { createRegisterUserUseCase };
