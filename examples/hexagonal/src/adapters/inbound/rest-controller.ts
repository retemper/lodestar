import type { UserInputPort } from '../../core/ports/user-port';

/** Minimal HTTP request shape for demonstration purposes */
interface HttpRequest {
  readonly body: Readonly<Record<string, unknown>>;
  readonly params: Readonly<Record<string, string>>;
}

/** Minimal HTTP response shape for demonstration purposes */
interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

/**
 * REST controller — an inbound adapter that translates HTTP requests into domain operations.
 * Depends only on the UserInputPort interface, never on concrete use-case implementations.
 */
function createUserController(userService: UserInputPort) {
  return {
    /** Handle POST /users — register a new user */
    async register(req: HttpRequest): Promise<HttpResponse> {
      const { name, email } = req.body;
      if (typeof name !== 'string' || typeof email !== 'string') {
        return { status: 400, body: { error: 'name and email are required' } };
      }

      try {
        const user = await userService.register(name, email);
        return { status: 201, body: user };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Internal error';
        return { status: 409, body: { error: message } };
      }
    },
  };
}

export { createUserController };
export type { HttpRequest, HttpResponse };
