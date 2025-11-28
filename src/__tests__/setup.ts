/**
 * Vitest setup file.
 * Configures testing environment and global matchers.
 */

import "@testing-library/jest-dom/vitest";

// Mock next/navigation for components that use it
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
