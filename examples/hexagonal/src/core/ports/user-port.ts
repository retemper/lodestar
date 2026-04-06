import type { Email, User, UserId } from '../domain/user';

/**
 * Inbound port — defines operations the outside world can invoke on the user domain.
 * Implemented by use-cases, called by inbound adapters (e.g., REST controllers).
 */
interface UserInputPort {
  /** Register a new user and return the created entity */
  register(name: string, email: string): Promise<User>;
  /** Find a user by their unique identifier */
  findById(id: UserId): Promise<User | null>;
  /** Find a user by email address */
  findByEmail(email: Email): Promise<User | null>;
}

/**
 * Outbound port — defines infrastructure operations the core needs from the outside.
 * Implemented by outbound adapters (e.g., database repositories), consumed by use-cases.
 */
interface UserOutputPort {
  /** Persist a user entity and return the saved version */
  save(user: User): Promise<User>;
  /** Retrieve a user by their unique identifier */
  findById(id: UserId): Promise<User | null>;
  /** Retrieve a user by email address */
  findByEmail(email: Email): Promise<User | null>;
  /** Check whether a user with the given email already exists */
  existsByEmail(email: Email): Promise<boolean>;
}

export type { UserInputPort, UserOutputPort };
