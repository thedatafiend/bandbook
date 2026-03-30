import { vi } from "vitest";

type SupabaseQuery = {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

export function createMockSupabase() {
  const query: SupabaseQuery = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
  };

  // Each method returns the query object for chaining
  for (const key of Object.keys(query) as (keyof SupabaseQuery)[]) {
    query[key].mockReturnValue(query);
  }

  const storage = {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ error: null })),
      createSignedUrl: vi.fn(() =>
        Promise.resolve({ data: { signedUrl: "https://signed.url" } })
      ),
    })),
  };

  const client = {
    from: vi.fn(() => query),
    storage,
  };

  return { client, query };
}
