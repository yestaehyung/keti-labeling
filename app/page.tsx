"use client"

import type React from "react"
import DragDropUpload from "@/components/drag-drop-upload"
import ExportManager from "@/components/export-manager"
import { useToast } from "@/hooks/use-toast"
import ApiStatusMonitor from "@/components/api-status-monitor"
import { apiCall, API_CONFIG } from "@/lib/api-config"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
} from "lucide-react"
import ImageGallery from "@/components/image-gallery"
import LabelingWorkspace from "@/components/labeling-workspace"
import Link from "next/link"

export default function Home() {
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadedClasses, setUploadedClasses] = useState<any[] | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showClassModal, setShowClassModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [annotations, setAnnotations] = useState<Record<string, any[]>>({})
  const { toast } = useToast()

  // Dark mode initialization
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true"
    setIsDarkMode(savedDarkMode)
    if (savedDarkMode) {
      document.documentElement.classList.add("dark")
    }
  }, [])

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode.toString())
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  // Load images
  useEffect(() => {
    apiCall(API_CONFIG.ENDPOINTS.IMAGES)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load images")
        return res.json()
      })
      .then((data) => {
        setImages(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  // Load annotations
  useEffect(() => {
    const savedAnnotations = localStorage.getItem("ketilabel_annotations")
    if (savedAnnotations) {
      try {
        setAnnotations(JSON.parse(savedAnnotations))
      } catch (error) {
        console.error("Failed to load annotations:", error)
      }
    }
  }, [])

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
  }

  const handleImageSelect = (image: string) => {
    setSelectedImage(image)
  }

  const handleBackToGallery = () => {
    setSelectedImage(null)
  }

  const handleClassUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const classes = JSON.parse(e.target?.result as string)
        setUploadedClasses(classes)
        setShowClassModal(false)
        alert(`Successfully uploaded ${classes.length} classes!`)
      } catch (error) {
        alert("Invalid JSON format. Please check your file.")
      }
    }
    reader.readAsText(file)
  }

  const handleImageUpload = async (files: File[]) => {
    setUploading(true)
    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData()
      formData.append("file", file)

      try {
        const response = await apiCall(API_CONFIG.ENDPOINTS.UPLOAD_IMAGE, {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`)
        }

        return { success: true, filename: file.name }
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
        return { success: false, filename: file.name, error: (error as Error).message }
      }
    })

    const results = await Promise.all(uploadPromises)
    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    if (successful.length > 0) {
      toast({
        title: "Upload Successful",
        description: `Successfully uploaded ${successful.length} images`,
      })

      // Refresh image list
      const response = await apiCall(API_CONFIG.ENDPOINTS.IMAGES)
      const data = await response.json()
      setImages(data)
    }

    if (failed.length > 0) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: `Failed to upload ${failed.length} images`,
      })
    }

    setUploading(false)
    setShowUploadModal(false)
  }


  if (selectedImage) {
    return (
      <LabelingWorkspace
        selectedImage={selectedImage}
        onBack={handleBackToGallery}
        uploadedClasses={uploadedClasses}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
    )
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
                  <p className="text-xs text-muted-foreground font-mono">AI-Powered Annotation</p>
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
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
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
                      Select one or more image files to upload. Supported formats: JPG, PNG, GIF, WebP.
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
                        onChange={(e) => handleImageUpload(Array.from(e.target.files || []))}
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
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium mb-4">
            <Zap className="mr-2 h-4 w-4 text-primary" />
            Powered by SAM2 AI Technology
          </div>
          <h1 className="text-4xl font-bold tracking-tight font-sans mb-4">Professional Image Labeling</h1>
          <p className="text-xl text-muted-foreground font-mono max-w-2xl mx-auto">
            Advanced AI-powered annotation tool for computer vision researchers and data scientists
          </p>
        </div>

        {/* Advanced Features Tabs */}
        <Tabs defaultValue="gallery" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="gallery" className="flex items-center">
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
            <TabsTrigger value="api-status" className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              API Status
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gallery" className="space-y-8">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Images</CardTitle>
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{images.length}</div>
                  <p className="text-xs text-muted-foreground">Available for labeling</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Labeled Images</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.keys(annotations).filter((key) => annotations[key]?.length > 0).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Completed annotations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Annotations</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Object.values(annotations).reduce((sum, arr) => sum + (arr?.length || 0), 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">Polygon annotations</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available Classes</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{uploadedClasses ? uploadedClasses.length : 10}</div>
                  <p className="text-xs text-muted-foreground">Label categories</p>
                </CardContent>
              </Card>
            </div>

            {/* Image Gallery */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Image Gallery</CardTitle>
                    <CardDescription>Select an image to start labeling</CardDescription>
                  </div>
                  <Badge variant="secondary">{images.length} images</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ImageGallery images={images} loading={loading} error={error} onImageSelect={handleImageSelect} />
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="export">
            <ExportManager
              images={images}
              annotations={annotations}
              onExport={async (format, options) => {
                console.log("Exporting:", format, options)
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
                <CardDescription>Drag and drop images or click to select files</CardDescription>
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
                <CardDescription>Upload or edit label classes for your annotations</CardDescription>
              </CardHeader>
              <CardContent>
                <Dialog open={showClassModal} onOpenChange={setShowClassModal}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full bg-transparent">
                      <FileText className="mr-2 h-4 w-4" />
                      Upload Class Definitions
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Class List</DialogTitle>
                      <DialogDescription>
                        Upload a JSON file with your class definitions. This will replace all existing classes.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm font-medium mb-2">Expected JSON format:</p>
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api-status">
            <ApiStatusMonitor />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
