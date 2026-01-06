"use client";

import type React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiCall, API_CONFIG } from "@/lib/api-config";
import ImageGallery from "@/components/image-gallery";
import ImageGalleryFilter, { type FilterType } from "@/components/image-gallery-filter";
import LabelingWorkspace from "@/components/labeling-workspace";
import MainHeader from "@/components/main-header";
import BatchAutoLabelDialog from "@/components/batch-auto-label-dialog";
import { Bot } from "lucide-react";

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadedClasses, setUploadedClasses] = useState<any[] | null>(null);
  const [galleryPage, setGalleryPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();
  const [annotations, setAnnotations] = useState<Record<string, any[]>>({});
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [needsReviewImages, setNeedsReviewImages] = useState<string[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

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
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const convertCocoAnnotationsToPolygons = (annotations: any[], categories: any[] = []) => {
    const categoryMap: Record<number, string> = {};
    categories.forEach((cat: any) => {
      categoryMap[cat.id] = cat.name;
    });
    
    return annotations.map((ann: any, index: number) => {
      let segmentation: number[] = [];
      if (Array.isArray(ann.segmentation) && ann.segmentation.length > 0) {
        segmentation = Array.isArray(ann.segmentation[0]) 
          ? ann.segmentation[0] 
          : ann.segmentation;
      }
      
      return {
        id: `polygon-${ann.id || index}`,
        segmentation,
        bbox: ann.bbox || [],
        area: ann.area || 0,
        predicted_iou: ann.predicted_iou,
        stability_score: ann.stability_score,
        label: categoryMap[ann.category_id] || `Object ${index + 1}`,
        visible: true,
      };
    });
  };

  const normalizePolygonData = (polygon: any, index: number): any => {
    const points = polygon.points || polygon.segmentation || [];
    
    let bbox = polygon.bbox;
    if ((!bbox || bbox.length === 0) && points.length >= 4) {
      const xs: number[] = [];
      const ys: number[] = [];
      for (let i = 0; i < points.length; i += 2) {
        xs.push(points[i]);
        ys.push(points[i + 1]);
      }
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      bbox = [minX, minY, maxX - minX, maxY - minY];
    }

    return {
      ...polygon,
      id: polygon.id || `polygon-${index}`,
      segmentation: points,
      bbox: bbox || [],
      visible: polygon.visible !== undefined ? polygon.visible : true,
    };
  };

  const extractPolygonsFromPayload = (payload: any): any[] => {
    if (Array.isArray(payload?.polygons)) {
      return payload.polygons.map((p: any, i: number) => normalizePolygonData(p, i));
    }
    if (Array.isArray(payload?.data?.polygons)) {
      return payload.data.polygons.map((p: any, i: number) => normalizePolygonData(p, i));
    }
    
    if (Array.isArray(payload?.annotations)) {
      return convertCocoAnnotationsToPolygons(payload.annotations, payload.categories);
    }
    
    return [];
  };

  const resolveImageNameFromPayload = (payload: any, filename: string, imageList: string[]) => {
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
      const matched = imageList.find(
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
        localStorage.removeItem("ketilabel_annotations");
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

        const imageName = resolveImageNameFromPayload(data, filename, images);
        if (!imageName) return;

        nextAnnotations[imageName] = polygons;
      });

      setAnnotations(nextAnnotations);
      if (Object.keys(nextAnnotations).length > 0) {
        localStorage.setItem(
          "ketilabel_annotations",
          JSON.stringify(nextAnnotations)
        );
      } else {
        localStorage.removeItem("ketilabel_annotations");
      }
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
    const savedAnnotations = localStorage.getItem("ketilabel_annotations");
    if (savedAnnotations) {
      try {
        setAnnotations(JSON.parse(savedAnnotations));
      } catch (error) {
        console.error("Failed to load annotations:", error);
      }
    }
  }, []);

  useEffect(() => {
    syncAnnotationsFromServer();
  }, [syncAnnotationsFromServer]);

  const fetchLabelingStatus = useCallback(async () => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.LABELING_STATUS);
      if (response.ok) {
        const data = await response.json();
        setNeedsReviewImages(data.needs_review_images || []);
      }
    } catch (error) {
      console.error("Failed to fetch labeling status:", error);
    }
  }, []);

  useEffect(() => {
    fetchLabelingStatus();
  }, [fetchLabelingStatus]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const labeledImages = useMemo(() => {
    return images.filter((img) => 
      annotations[img]?.length > 0 && !needsReviewImages.includes(img)
    );
  }, [images, annotations, needsReviewImages]);

  const unlabeledImages = useMemo(() => {
    return images.filter((img) => 
      (!annotations[img] || annotations[img].length === 0) && !needsReviewImages.includes(img)
    );
  }, [images, annotations, needsReviewImages]);

  const filteredImages = useMemo(() => {
    let result = images;

    switch (filterType) {
      case "labeled":
        result = labeledImages;
        break;
      case "unlabeled":
        result = unlabeledImages;
        break;
      case "needs-review":
        result = needsReviewImages.filter((img) => images.includes(img));
        break;
      default:
        result = images;
    }

    return result
      .filter((img) => img.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        if (sortOrder === "asc") {
          return a.localeCompare(b);
        } else {
          return b.localeCompare(a);
        }
      });
  }, [images, filterType, labeledImages, unlabeledImages, needsReviewImages, searchTerm, sortOrder]);

  const handleImageSelect = (image: string) => {
    setSelectedImage(image);
  };

  const handleBackToGallery = () => {
    setSelectedImage(null);
  };

  const handleNextImage = () => {
    if (!selectedImage) return;
    const currentIndex = filteredImages.indexOf(selectedImage);
    if (currentIndex < filteredImages.length - 1) {
      setSelectedImage(filteredImages[currentIndex + 1]);
    }
  };

  const handlePreviousImage = () => {
    if (!selectedImage) return;
    const currentIndex = filteredImages.indexOf(selectedImage);
    if (currentIndex > 0) {
      setSelectedImage(filteredImages[currentIndex - 1]);
    }
  };

  const hasNext = selectedImage
    ? filteredImages.indexOf(selectedImage) < filteredImages.length - 1
    : false;
  const hasPrevious = selectedImage
    ? filteredImages.indexOf(selectedImage) > 0
    : false;

  if (selectedImage) {
    return (
      <LabelingWorkspace
        selectedImage={selectedImage}
        onBack={handleBackToGallery}
        uploadedClasses={uploadedClasses}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
        onNext={handleNextImage}
        onPrevious={handlePreviousImage}
        hasNext={hasNext}
        hasPrevious={hasPrevious}
        hasExistingAnnotations={
          !!(selectedImage && annotations[selectedImage] && annotations[selectedImage].length > 0)
        }
        initialAnnotations={selectedImage ? annotations[selectedImage] || [] : []}
        onAnnotationsSave={(imageId, updatedPolygons) => {
          setAnnotations((prev) => {
            const next = { ...prev };
            if (!updatedPolygons || updatedPolygons.length === 0) {
              delete next[imageId];
            } else {
              next[imageId] = updatedPolygons;
            }
            return next;
          });
        }}
      />
    );
  }

  const handleBatchComplete = async () => {
    await syncAnnotationsFromServer();
    await fetchLabelingStatus();
    toast({
      title: "Batch labeling complete",
      description: "Gallery has been refreshed with new annotations.",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MainHeader isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />

      <main className="container mx-auto px-4 py-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Dataset Gallery</h2>
              <p className="text-sm text-muted-foreground">
                Manage and annotate your image dataset.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBatchDialogOpen(true)}
                disabled={unlabeledImages.length === 0}
                className="gap-2"
              >
                <Bot className="h-4 w-4" />
                Auto-Label ({unlabeledImages.length})
              </Button>
              <Badge variant="outline" className="px-3 py-1">
                {images.length} Images
              </Badge>
            </div>
          </div>

          <ImageGalleryFilter
            onFilterChange={setFilterType}
            onSearchChange={setSearchTerm}
            onSortChange={setSortOrder}
            currentFilter={filterType}
            currentSearch={searchTerm}
            currentSort={sortOrder}
            totalCount={images.length}
            labeledCount={labeledImages.length}
            unlabeledCount={unlabeledImages.length}
            needsReviewCount={needsReviewImages.length}
          />

          <ImageGallery
            images={filteredImages}
            loading={loading}
            error={error}
            onImageSelect={handleImageSelect}
            annotations={annotations}
            currentPage={galleryPage}
            onPageChange={setGalleryPage}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
          />
        </div>
      </main>

      <BatchAutoLabelDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        unlabeledCount={unlabeledImages.length}
        unlabeledImages={unlabeledImages}
        onComplete={handleBatchComplete}
      />
    </div>
  );
}
