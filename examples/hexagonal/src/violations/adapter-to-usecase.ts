// INTENTIONAL VIOLATION: This file demonstrates what lodestar catches.
// In hexagonal architecture, adapters must only depend on ports — never on use-cases directly.
// The adapter layer should be decoupled from application logic; it communicates through port interfaces.
// Running `lodestar check` on this project will flag the import below as an architecture/layers violation:
//   Layer "adapters" cannot import from "core/use-cases" — not listed in canImport

import type { User } from '../core/domain/user';
import { createRegisterUserUseCase } from '../core/use-cases/register-user';
import { createPostgresUserRepository } from '../adapters/outbound/postgres-repo';

/**
 * Bad example: an outbound adapter that directly imports a use-case implementation,
 * bypassing the port boundary. The correct approach is to depend only on UserInputPort
 * and let the composition root (config layer) wire the use-case to the adapter.
 */
async function registerUserDirectly(name: string, email: string): Promise<User> {
  const repo = createPostgresUserRepository();
  const useCase = createRegisterUserUseCase(repo);
  return useCase.register(name, email);
}

export { registerUserDirectly };
