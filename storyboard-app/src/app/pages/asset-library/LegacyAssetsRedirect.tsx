import { Navigate, useSearchParams } from "react-router";

import { legacyAssetsPath } from "../../lib/projectPosition";

export default function LegacyAssetsRedirect() {
  const [query] = useSearchParams();
  return <Navigate to={legacyAssetsPath(query)} replace />;
}
