import { useEffect, useState } from "react";
import { Server, Waypoints } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { getApiBackendTarget, setApiBackendTarget, subscribeApiBackendTarget, type ApiBackendTarget } from "../api/client";

const TARGET_META: Record<ApiBackendTarget, { label: string; port: string }> = {
  go: { label: "Go", port: "8082" },
  node: { label: "Node", port: "8083" },
};

export function ApiBackendSwitcher() {
  const [target, setTarget] = useState<ApiBackendTarget>(getApiBackendTarget());

  useEffect(() => {
    return subscribeApiBackendTarget(setTarget);
  }, []);

  return (
    <div className="fixed right-4 top-4 z-[80] flex items-center gap-2 rounded-md border border-border/70 bg-background/95 px-2 py-2 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Server className="h-3.5 w-3.5" />
        <span>API</span>
        <Badge variant="secondary" className="h-5 rounded-sm px-1.5 text-[11px] font-medium">
          {TARGET_META[target].port}
        </Badge>
      </div>
      <div className="flex items-center gap-1">
        {(["go", "node"] as ApiBackendTarget[]).map((item) => {
          const active = item === target;
          return (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className="h-8 gap-1.5 px-2.5 text-xs"
              onClick={() => {
                setApiBackendTarget(item);
                setTarget(item);
              }}
            >
              <Waypoints className="h-3.5 w-3.5" />
              <span>{TARGET_META[item].label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
