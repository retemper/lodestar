// INTENTIONAL VIOLATION: This file demonstrates what happens when domain imports from infra.
// In a clean architecture, the domain layer must never depend on infrastructure details.
// Running `lodestar check` on this project will flag this import as an architecture/layers violation.

import type { User } from '../domain/user';
import { createPrismaUserRepository } from '../infra/prisma-user-repo';

/**
 * Bad example: domain-level logic that directly depends on an infra implementation.
 * The correct approach is to depend on the UserRepository port (interface) defined in domain,
 * and let the infra layer provide the concrete implementation.
 */
async function findUserDirectly(email: string): Promise<User | null> {
  const repo = createPrismaUserRepository();
  return repo.findByEmail(email);
}

export { findUserDirectly };
