"use client";

import type React from "react";
import DragDropUpload from "@/components/drag-drop-upload";
import ExportManager from "@/components/export-manager";
import { useToast } from "@/hooks/use-toast";
import ApiStatusMonitor from "@/components/api-status-monitor";
import { apiCall, API_CONFIG } from "@/lib/api-config";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Moon,
  Sun,
  Upload,
  ImageIcon,
  Target,
  Zap,
  Settings,
  Download,
  FileText,
  Brain,
} from "lucide-react";
import ImageGallery from "@/components/image-gallery";
import LabelingWorkspace from "@/components/labeling-workspace";
import Link from "next/link";

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadedClasses, setUploadedClasses] = useState<any[] | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [annotations, setAnnotations] = useState<Record<string, any[]>>({});
  const [activeTab, setActiveTab] = useState("gallery");
  const [galleryPage, setGalleryPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const { toast } = useToast();

  // Dark mode initialization
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode.toString());
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Load images
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

        const imageName = resolveImageNameFromPayload(data, filename);
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
    } finally {
      // no-op
    }
  }, [toast, images]);

  // Load annotations from localStorage first for instant UI
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

  // Re-sync from server whenever Export 탭을 열 때마다 최신 상태로 갱신
  useEffect(() => {
    if (!selectedImage && activeTab === "export") {
      syncAnnotationsFromServer();
    }
  }, [activeTab, selectedImage, syncAnnotationsFromServer]);

  // Initial sync on mount to ensure gallery is up to date
  useEffect(() => {
    syncAnnotationsFromServer();
  }, [syncAnnotationsFromServer]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const filteredImages = images
    .filter((img) => img.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === "asc") {
        return a.localeCompare(b);
      } else {
        return b.localeCompare(a);
      }
    });

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

  const handleClassUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const classes = JSON.parse(e.target?.result as string);
        setUploadedClasses(classes);
        setShowClassModal(false);
        toast({
          title: "Classes Uploaded",
          description: `Successfully loaded ${classes.length} classes. They will be applied when you open an image.`,
        });
      } catch (error) {
        alert("Invalid JSON format. Please check your file.");
      }
    };
    reader.readAsText(file);
  };

  const handleClassDownload = () => {
    const savedClasses = localStorage.getItem("ketilabel_classes");
    if (!savedClasses) {
      toast({
        variant: "destructive",
        title: "No classes found",
        description: "You haven't defined any classes yet.",
      });
      return;
    }

    try {
      const blob = new Blob([savedClasses], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "classes.json";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Classes Downloaded",
        description: "Your class definitions have been saved to classes.json",
      });
    } catch (error) {
      console.error("Failed to download classes:", error);
    }
  };

  const handleImageUpload = async (files: File[]) => {
    setUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await apiCall(API_CONFIG.ENDPOINTS.UPLOAD_IMAGE, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        return { success: true, filename: file.name };
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        return {
          success: false,
          filename: file.name,
          error: (error as Error).message,
        };
      }
    });

    const results = await Promise.all(uploadPromises);
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length > 0) {
      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${successful.length} images`,
      });

      // Refresh image list
      const response = await apiCall(API_CONFIG.ENDPOINTS.IMAGES);
      const data = await response.json();
      setImages(data);
    }

    if (failed.length > 0) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: `Failed to upload ${failed.length} images`,
      });
    }

    setUploading(false);
    setShowUploadModal(false);
  };

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-sans">KETIlabel</h1>
                  <p className="text-xs text-muted-foreground font-mono">
                    AI-Powered Annotation
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Link href="/training">
                <Button variant="outline">
                  <Brain className="mr-2 h-4 w-4" />
                  Model Training
                </Button>
              </Link>

              <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
                {isDarkMode ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>

              <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
                <DialogTrigger asChild>
                  <Button className="font-medium">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Images
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload Images</DialogTitle>
                    <DialogDescription>
                      Select one or more image files to upload. Supported
                      formats: JPG, PNG, GIF, WebP.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="image-upload">Choose Images</Label>
                      <Input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) =>
                          handleImageUpload(Array.from(e.target.files || []))
                        }
                        disabled={uploading}
                        className="mt-2"
                      />
                    </div>
                    {uploading && (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span>Uploading images...</span>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/10 p-6 md:p-10 text-center mb-10 mt-2">
          <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="inline-flex items-center rounded-full border bg-background/50 backdrop-blur px-4 py-2 text-sm font-medium mb-6 shadow-sm">
              <Zap className="mr-2 h-4 w-4 text-primary" />
              Powered by SAM2 AI Technology
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5 bg-clip-text text-transparent bg-gradient-to-r from-primary to-blue-600 dark:from-primary dark:to-blue-400 pb-1.5">
              AI-Powered Image Labeling
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-6 leading-relaxed">
              Experience the future of data annotation. Fast, accurate, and
              intuitive labeling for your computer vision projects.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <Button
                size="lg"
                className="h-12 px-8 text-lg"
                onClick={() => {
                  setActiveTab("gallery");
                  setTimeout(() => {
                    document
                      .getElementById("gallery-section")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
              >
                Start Labeling
                <Target className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 px-8 text-lg bg-background/50 backdrop-blur"
                onClick={() => setShowUploadModal(true)}
              >
                Upload Images
                <Upload className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Advanced Features Tabs */}
        <div id="gallery-section">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-8"
          >
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger
                value="gallery"
                id="gallery-trigger"
                className="flex items-center"
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                Gallery
              </TabsTrigger>
              <TabsTrigger value="export" className="flex items-center">
                <Download className="mr-2 h-4 w-4" />
                Export
              </TabsTrigger>
              <TabsTrigger value="upload" className="flex items-center">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </TabsTrigger>
              <TabsTrigger value="model-training" className="flex items-center">
                <Brain className="mr-2 h-4 w-4" />
                Model Training
              </TabsTrigger>
              <TabsTrigger value="api-status" className="flex items-center">
                <Settings className="mr-2 h-4 w-4" />
                API Status
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gallery" className="space-y-8">
              {/* Statistics Cards Removed */}

              {/* Image Gallery */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Image Gallery</CardTitle>
                      <CardDescription>
                        Select an image to start labeling
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">{images.length} images</Badge>
                  </div>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="export">
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
            </TabsContent>

            <TabsContent value="upload">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Upload className="mr-2 h-5 w-5 text-primary" />
                    Upload Images
                  </CardTitle>
                  <CardDescription>
                    Drag and drop images or click to select files
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DragDropUpload
                    onUpload={handleImageUpload}
                    maxFiles={20}
                    maxSize={50 * 1024 * 1024} // 50MB
                  />
                </CardContent>
              </Card>

              {/* Class Upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="mr-2 h-5 w-5 text-primary" />
                    Manage Classes
                  </CardTitle>
                  <CardDescription>
                    Upload or edit label classes for your annotations
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Dialog
                    open={showClassModal}
                    onOpenChange={setShowClassModal}
                  >
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Class Definitions
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Upload Class List</DialogTitle>
                        <DialogDescription>
                          Upload a JSON file with your class definitions. This
                          will replace all existing classes.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="rounded-lg bg-muted p-4">
                          <p className="text-sm font-medium mb-2">
                            Expected JSON format:
                          </p>
                          <pre className="text-xs text-muted-foreground overflow-x-auto">
                            {`[
  {
    "id": "person",
    "name": "Person",
    "color": "#0891b2"
  },
  {
    "id": "vehicle",
    "name": "Vehicle", 
    "color": "#ef4444"
  }
]`}
                          </pre>
                        </div>
                        <div>
                          <Label htmlFor="class-upload">Choose JSON File</Label>
                          <Input
                            id="class-upload"
                            type="file"
                            accept=".json"
                            onChange={handleClassUpload}
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Button
                    variant="outline"
                    className="w-full bg-transparent mt-2"
                    onClick={handleClassDownload}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Class Definitions
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="model-training">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="mr-2 h-5 w-5 text-primary" />
                    Model Training
                  </CardTitle>
                  <CardDescription>
                    Launch end-to-end training jobs using your freshly labeled
                    datasets.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground max-w-2xl">
                    Fine-tune SAM2-powered models, monitor job progress, and
                    download checkpoints directly from the training console.
                  </div>
                  <Link href="/training">
                    <Button size="lg" className="w-full sm:w-auto">
                      Go to Training
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api-status">
              <ApiStatusMonitor />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
