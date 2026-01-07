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
import WorkflowSummaryCard from "@/components/workflow-summary-card";
import ClassSetupOnboarding, { type ClassDefinition } from "@/components/class-setup-onboarding";
import { useWorkflowStatus } from "@/hooks/use-workflow-status";
import { Bot, Brain, Settings } from "lucide-react";

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadedClasses, setUploadedClasses] = useState<ClassDefinition[] | null>(null);
  const [galleryPage, setGalleryPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();
  const [annotations, setAnnotations] = useState<Record<string, any[]>>({});
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [needsReviewImages, setNeedsReviewImages] = useState<string[]>([]);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [classes, setClasses] = useState<ClassDefinition[]>([]);
  
  const { summary: workflowSummary, loading: workflowLoading } = useWorkflowStatus(15000);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    const savedClasses = localStorage.getItem("ketilabel_classes");
    if (savedClasses) {
      try {
        const parsedClasses = JSON.parse(savedClasses);
        if (Array.isArray(parsedClasses) && parsedClasses.length > 0) {
          setClasses(parsedClasses);
          setUploadedClasses(parsedClasses);
          setShowOnboarding(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse saved classes:", e);
      }
    }
    setShowOnboarding(true);
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
        predicted_iou: ann.predicted_iou ?? ann.confidence,
        stability_score: ann.stability_score ?? ann.confidence,
        confidence: ann.confidence,
        label: categoryMap[ann.category_id] || `Object ${index + 1}`,
        visible: true,
        source: ann.auto_labeled ? "yolo" : undefined,
        needs_review: ann.needs_review,
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

    return result.sort((a, b) => {
      if (sortOrder === "asc") {
        return a.localeCompare(b);
      } else {
        return b.localeCompare(a);
      }
    });
  }, [images, filterType, labeledImages, unlabeledImages, needsReviewImages, sortOrder]);

  const handleImageSelect = (image: string) => {
    setSelectedImage(image);
  };

  const handleOnboardingComplete = (newClasses: ClassDefinition[]) => {
    setClasses(newClasses);
    setUploadedClasses(newClasses);
    setShowOnboarding(false);
    toast({
      title: "Setup complete!",
      description: `${newClasses.length} classes configured. You're ready to start labeling.`,
    });
  };

  const handleStartLabeling = () => {
    if (unlabeledImages.length > 0) {
      setSelectedImage(unlabeledImages[0]);
    } else if (needsReviewImages.length > 0) {
      setSelectedImage(needsReviewImages[0]);
    } else if (images.length > 0) {
      setSelectedImage(images[0]);
    }
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

  if (showOnboarding === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return (
      <ClassSetupOnboarding
        onComplete={handleOnboardingComplete}
        isDarkMode={isDarkMode}
      />
    );
  }

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
        currentPhase={workflowSummary?.current_phase ?? 1}
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
          fetchLabelingStatus();
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
          <WorkflowSummaryCard 
            summary={workflowSummary} 
            loading={workflowLoading} 
            compact={true}
            onGoToLabeling={handleStartLabeling}
          />

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Dataset Gallery</h2>
              <p className="text-sm text-muted-foreground">
                Manage and annotate your image dataset.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {workflowSummary && workflowSummary.queues.reviewed_since_last_train >= 10 && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => window.location.href = '/training'}
                  className="gap-2"
                >
                  <Brain className="h-4 w-4" />
                  Retrain ({workflowSummary.queues.reviewed_since_last_train} reviewed)
                </Button>
              )}
              {(workflowSummary?.current_phase ?? 1) >= 2 && (
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
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOnboarding(true)}
                className="gap-2"
                title="Configure classes"
              >
                <Settings className="h-4 w-4" />
                Classes ({classes.length})
              </Button>
              <Badge variant="outline" className="px-3 py-1">
                {images.length} Images
              </Badge>
            </div>
          </div>

          <ImageGalleryFilter
            onFilterChange={setFilterType}
            currentFilter={filterType}
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
