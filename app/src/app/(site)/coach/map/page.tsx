import { redirect } from "next/navigation";

// The map is now a view inside Squad. Old links and bookmarks still land on it.
export default function MapRedirect() {
  redirect("/coach/squad?view=map");
}
