import type { UserId } from '../core/domain/user';
import type { UserInputPort } from '../core/ports/user-port';
import { createRegisterUserUseCase } from '../core/use-cases/register-user';
import { createPostgresUserRepository } from '../adapters/outbound/postgres-repo';

/**
 * Composition root — wires adapters to ports and assembles the application.
 * This is the only layer allowed to import from everywhere: domain, ports, use-cases, and adapters.
 */
function bootstrapApplication(): UserInputPort {
  const repository = createPostgresUserRepository();
  const registerUseCase = createRegisterUserUseCase(repository);

  return {
    register: registerUseCase.register,

    async findById(id: UserId) {
      return repository.findById(id);
    },

    async findByEmail(email) {
      return repository.findByEmail(email);
    },
  };
}

export { bootstrapApplication };
