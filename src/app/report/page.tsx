import { Suspense } from "react";
import ReportEditor from "./ReportEditor";

// The report id comes from ?id=, so the page also works as a static site.
export default function ReportPage() {
  return (
    <Suspense>
      <ReportEditor />
    </Suspense>
  );
}
