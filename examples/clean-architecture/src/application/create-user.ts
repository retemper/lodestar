import type { UserRepository } from '../domain/user-repository';
import { createUser } from '../domain/user';
import type { User } from '../domain/user';

/** Input required to register a new user */
interface CreateUserInput {
  readonly name: string;
  readonly email: string;
}

/** Use case: register a new user and persist via the repository port */
async function createUserUseCase(
  input: CreateUserInput,
  repository: UserRepository,
): Promise<User> {
  const existing = await repository.findByEmail(input.email);
  if (existing) {
    throw new Error(`User with email "${input.email}" already exists`);
  }

  const user = createUser(input.name, input.email);
  await repository.save(user);
  return user;
}

export { createUserUseCase };
export type { CreateUserInput };
