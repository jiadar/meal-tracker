import { defineConfig } from "orval";

export default defineConfig({
  mealTracker: {
    input: {
      target: "http://localhost:8000/api/v1/schema/",
    },
    output: {
      mode: "tags-split",
      target: "src/api/generated/endpoints",
      schemas: "src/api/generated/models",
      client: "react-query",
      httpClient: "fetch",
      clean: true,
      override: {
        mutator: {
          path: "./src/lib/apiClient.ts",
          name: "apiClient",
        },
        query: {
          useQuery: true,
          useMutation: true,
          signal: true,
          version: 5,
        },
      },
    },
  },
});
