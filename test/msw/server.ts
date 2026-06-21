// MSW server for the fast (Docker-free) HTTP-mocked test lane.
// Individual test files register handlers via `server.use(...)`; the lifecycle
// (listen/resetHandlers/close) is driven by test/setup.ts.
import { setupServer } from "msw/node";

export const server = setupServer();
