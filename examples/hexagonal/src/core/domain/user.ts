/** Value object representing a validated email address */
interface Email {
  readonly value: string;
}

/** Value object representing a user's unique identifier */
interface UserId {
  readonly value: string;
}

/** User entity — the core aggregate root of the user domain */
interface User {
  readonly id: UserId;
  readonly name: string;
  readonly email: Email;
  readonly createdAt: Date;
}

/** Validate and create an Email value object from a raw string */
function createEmail(raw: string): Email {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed.includes('@')) {
    throw new Error(`Invalid email: ${raw}`);
  }
  return { value: trimmed };
}

/** Generate a new UserId backed by a random UUID */
function createUserId(): UserId {
  return { value: crypto.randomUUID() };
}

/** Create a new User entity with generated ID and current timestamp */
function createUser(name: string, rawEmail: string): User {
  return {
    id: createUserId(),
    name,
    email: createEmail(rawEmail),
    createdAt: new Date(),
  };
}

export { createUser, createEmail, createUserId };
export type { User, UserId, Email };
