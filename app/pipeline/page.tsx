"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PipelineRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pipeline-status");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to Pipeline Status...</p>
    </div>
  );
}
