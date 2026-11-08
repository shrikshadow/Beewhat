// Session boundary: auth is an httpOnly cookie the backend owns; the frontend's one
// duty is wiping the react-query cache so one account's data never renders for the next.
import { queryClient } from "./queryClient";
import { apiPost } from "./api";

// Call after every successful login/signup. Wipes the previous account's cached data, then seeds
// ["me"] in place — clear() would detach mounted useMe observers so the UI wouldn't re-render.
export function beginSession(me?: unknown): void {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
  if (me === undefined) queryClient.removeQueries({ queryKey: ["me"] });
  else queryClient.setQueryData(["me"], me);
}

// Call from every sign-out control; the hard redirect resets all in-memory state.
export async function endSession(redirectTo: string = "/login"): Promise<void> {
  try {
    await apiPost("/auth/logout");
  } finally {
    queryClient.clear();
    window.location.assign(redirectTo);
  }
}
