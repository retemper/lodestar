/** User entity representing a registered user in the system */
interface User {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
}

/** Create a new user entity with a generated ID and current timestamp */
function createUser(name: string, email: string): User {
  return {
    id: crypto.randomUUID(),
    name,
    email,
    createdAt: new Date(),
  };
}

export { createUser };
export type { User };
