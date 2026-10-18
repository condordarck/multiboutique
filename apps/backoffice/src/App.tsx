import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { Introuvable } from "./ecrans/Introuvable";

export const routes: RouteObject[] = [{ path: "*", element: <Introuvable /> }];

const client = new QueryClient();
const routeur = createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={routeur} />
    </QueryClientProvider>
  );
}
