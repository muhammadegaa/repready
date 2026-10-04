import { redirect } from "next/navigation";

// The page was renamed Agent. Old links and bookmarks still land in the right place.
export default function Results() {
  redirect("/coach/agent");
}
