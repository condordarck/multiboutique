import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sans globals Vitest, Testing Library ne nettoie pas le DOM entre deux tests.
afterEach(cleanup);
