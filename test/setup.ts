// Vitest setup — MSW server lifecycle for the fast (Docker-free) HTTP-mocked lane.
// The MSW server is started/stopped here so individual test files only register handlers.
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./msw/server.js";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
