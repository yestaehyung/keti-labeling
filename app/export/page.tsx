"use client";

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiCall, API_CONFIG } from "@/lib/api-config";
import ExportManager from "@/components/export-manager";
import MainHeader from "@/components/main-header";

export default function ExportPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [annotations, setAnnotations] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode.toString());
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  useEffect(() => {
    apiCall(API_CONFIG.ENDPOINTS.IMAGES)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load images");
        return res.json();
      })
      .then((data) => {
        setImages(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const extractPolygonsFromPayload = (payload: any): any[] => {
    if (Array.isArray(payload?.polygons)) return payload.polygons;
    if (Array.isArray(payload?.data?.polygons)) return payload.data.polygons;
    if (Array.isArray(payload?.annotations)) return payload.annotations;
    return [];
  };

  const resolveImageNameFromPayload = (payload: any, filename: string) => {
    const raw =
      payload?.image?.url ||
      payload?.image?.file_name ||
      payload?.image?.filename ||
      payload?.image?.name ||
      "";

    if (typeof raw === "string" && raw.trim().length > 0) {
      const parts = raw.trim().split("/");
      const fromPath = parts[parts.length - 1];
      if (fromPath) return fromPath;
    }

    if (filename.endsWith("_coco.json")) {
      const base = filename.replace(/_coco\.json$/i, "");
      const matched = images.find(
        (img) => img.replace(/\.[^/.]+$/, "") === base
      );
      if (matched) return matched;
      return `${base}.jpg`;
    }

    return filename;
  };

  const syncAnnotationsFromServer = useCallback(async () => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.ANNOTATIONS);
      if (!response.ok) {
        throw new Error(`Failed to load annotations: ${response.status}`);
      }
      const payload = await response.json().catch(() => null);

      let filenames: string[] = [];
      if (Array.isArray(payload)) {
        filenames = payload.filter(
          (item): item is string => typeof item === "string"
        );
      } else if (Array.isArray(payload?.files)) {
        filenames = payload.files
          .filter((item: any) => typeof item?.filename === "string")
          .map((item: any) => item.filename);
      }

      if (filenames.length === 0) {
        setAnnotations({});
        return;
      }

      const detailResults = await Promise.allSettled(
        filenames.map(async (name) => {
          const res = await apiCall(
            `${API_CONFIG.ENDPOINTS.ANNOTATIONS}/${encodeURIComponent(name)}`
          );
          if (!res.ok) throw new Error(`Failed to load ${name}: ${res.status}`);
          const data = await res.json();
          return { filename: name, data };
        })
      );

      const nextAnnotations: Record<string, any[]> = {};

      detailResults.forEach((result) => {
        if (result.status !== "fulfilled") {
          console.error(result.reason);
          return;
        }

        const { filename, data } = result.value;
        const polygons = extractPolygonsFromPayload(data);

        if (!Array.isArray(polygons)) return;

        const imageName = resolveImageNameFromPayload(data, filename);
        if (!imageName) return;

        nextAnnotations[imageName] = polygons;
      });

      setAnnotations(nextAnnotations);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Failed to load annotations",
        description:
          error instanceof Error ? error.message : "Unexpected error occurred.",
      });
    }
  }, [toast, images]);

  useEffect(() => {
    if (images.length > 0) {
      syncAnnotationsFromServer();
    }
  }, [images, syncAnnotationsFromServer]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MainHeader isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight mb-2">Export Data</h2>
              <p className="text-sm text-muted-foreground">
                Download annotations in various formats.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading...
            </div>
          ) : (
            <ExportManager
              images={images}
              annotations={annotations}
              onExport={async (format, options) => {
                console.log("Exporting:", format, options);
              }}
              onDeleteAnnotation={(imageId) => {
                setAnnotations((prev) => {
                  const next = { ...prev };
                  delete next[imageId];
                  return next;
                });
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
