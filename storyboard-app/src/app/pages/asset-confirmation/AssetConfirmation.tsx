import { Navigate, useSearchParams } from "react-router";

import { legacyAssetsPath } from "../../lib/projectPosition";

export default function AssetConfirmation() {
  const [searchParams] = useSearchParams();
  return <Navigate to={legacyAssetsPath(searchParams, true)} replace />;
}
