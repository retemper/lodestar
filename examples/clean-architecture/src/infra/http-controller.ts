import type { CreateUserInput } from '../application/create-user';
import { createUserUseCase } from '../application/create-user';
import { createPrismaUserRepository } from './prisma-user-repo';
import { logger } from '../shared/logger';

/** HTTP request shape for the create-user endpoint */
interface CreateUserRequest {
  readonly body: CreateUserInput;
}

/** HTTP response shape */
interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/** Handle an HTTP request to create a new user */
async function handleCreateUser(req: CreateUserRequest): Promise<HttpResponse> {
  const repository = createPrismaUserRepository();

  try {
    const user = await createUserUseCase(req.body, repository);
    logger.info(`User created: ${user.id}`);
    return { status: 201, body: user };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to create user: ${message}`);
    return { status: 400, body: { error: message } };
  }
}

export { handleCreateUser };
export type { CreateUserRequest, HttpResponse };
