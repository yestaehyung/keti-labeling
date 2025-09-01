"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Download, FileJson, FileText, ImageIcon, Settings, CheckCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { API_CONFIG } from "@/lib/api-config"

interface ExportFormat {
  id: string
  name: string
  description: string
  extension: string
  icon: React.ReactNode
}

interface ExportManagerProps {
  images: string[]
  annotations: Record<string, any[]>
  onExport?: (format: string, options: any) => Promise<void>
}

export default function ExportManager({ images, annotations, onExport }: ExportManagerProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>("coco")
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [includeImages, setIncludeImages] = useState(false)
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const { toast } = useToast()

  // Retrieve stored image dimensions (saved by LabelingWorkspace)
  const getImageMeta = (image: string): { width: number; height: number } | null => {
    try {
      const raw = localStorage.getItem("ketilabel_image_meta")
      if (!raw) return null
      const meta = JSON.parse(raw) as Record<string, { width: number; height: number }>
      return meta[image] || null
    } catch {
      return null
    }
  }

  const exportFormats: ExportFormat[] = [
    {
      id: "coco",
      name: "COCO JSON",
      description: "Microsoft COCO format for object detection",
      extension: ".json",
      icon: <FileJson className="h-4 w-4" />,
    },
    {
      id: "yolo",
      name: "YOLO",
      description: "YOLO format with separate text files",
      extension: ".txt",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: "pascal_voc",
      name: "Pascal VOC",
      description: "Pascal VOC XML format",
      extension: ".xml",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      id: "labelme",
      name: "LabelMe JSON",
      description: "LabelMe annotation format",
      extension: ".json",
      icon: <FileJson className="h-4 w-4" />,
    },
    {
      id: "custom",
      name: "Custom JSON",
      description: "KETIlabel native format",
      extension: ".json",
      icon: <Settings className="h-4 w-4" />,
    },
  ]

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedImages([...images])
    } else {
      setSelectedImages([])
    }
  }

  const handleImageSelect = (image: string, checked: boolean) => {
    if (checked) {
      setSelectedImages((prev) => [...prev, image])
    } else {
      setSelectedImages((prev) => prev.filter((img) => img !== image))
    }
  }

  const generateCocoFormat = (selectedImages: string[], annotations: Record<string, any[]>) => {
    const cocoData = {
      info: {
        description: "KETIlabel Export",
        version: "1.0",
        year: new Date().getFullYear(),
        contributor: "KETIlabel",
        date_created: new Date().toISOString(),
      },
      licenses: [
        {
          id: 1,
          name: "Unknown",
          url: "",
        },
      ],
      images: selectedImages.map((image, index) => {
        const meta = getImageMeta(image)
        const width = meta?.width ?? 800
        const height = meta?.height ?? 600
        return {
          id: index + 1,
          width,
          height,
          file_name: image,
          license: 1,
          flickr_url: "",
          coco_url: "",
          date_captured: new Date().toISOString(),
        }
      }),
      annotations: [],
      categories: [{ id: 1, name: "object", supercategory: "thing" }],
    }

    let annotationId = 1
    selectedImages.forEach((image, imageIndex) => {
      const imageAnnotations = annotations[image] || []
      imageAnnotations.forEach((annotation) => {
        cocoData.annotations.push({
          id: annotationId++,
          image_id: imageIndex + 1,
          category_id: 1,
          segmentation: [annotation.segmentation?.flat() || []],
          area: annotation.area || 0,
          bbox: annotation.bbox || [0, 0, 0, 0],
          iscrowd: 0,
        })
      })
    })

    return cocoData
  }

  const generateYoloFormat = (selectedImages: string[], annotations: Record<string, any[]>) => {
    const yoloData: Record<string, string> = {}

    selectedImages.forEach((image) => {
      const imageAnnotations = annotations[image] || []
      const meta = getImageMeta(image)
      const imgW = meta?.width ?? 800
      const imgH = meta?.height ?? 600
      const yoloAnnotations = imageAnnotations
        .map((annotation) => {
          const [x, y, width, height] = annotation.bbox || [0, 0, 0, 0]
          // Convert to YOLO format (normalized center coordinates)
          const centerX = (x + width / 2) / imgW // Normalize by image width
          const centerY = (y + height / 2) / imgH // Normalize by image height
          const normalizedWidth = width / imgW
          const normalizedHeight = height / imgH

          return `0 ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${normalizedWidth.toFixed(6)} ${normalizedHeight.toFixed(6)}`
        })
        .join("\n")

      yoloData[image.replace(/\.[^/.]+$/, ".txt")] = yoloAnnotations
    })

    return yoloData
  }

  const handleExport = async () => {
    if (selectedImages.length === 0) {
      toast({
        variant: "destructive",
        title: "No Images Selected",
        description: "Please select at least one image to export.",
      })
      return
    }

    setIsExporting(true)
    setExportProgress(0)

    try {
      const format = exportFormats.find((f) => f.id === selectedFormat)
      if (!format) throw new Error("Invalid export format")

      // Simulate export progress
      for (let i = 0; i <= 100; i += 10) {
        setExportProgress(i)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      let exportData: any
      let filename: string

      switch (selectedFormat) {
        case "coco":
          exportData = generateCocoFormat(selectedImages, annotations)
          filename = `coco_annotations_${Date.now()}.json`
          break
        case "yolo":
          exportData = generateYoloFormat(selectedImages, annotations)
          filename = `yolo_annotations_${Date.now()}.zip`
          break
        case "custom":
        default:
          exportData = {
            format: "KETIlabel",
            version: "1.0",
            exported_at: new Date().toISOString(),
            images: selectedImages,
            annotations: Object.fromEntries(selectedImages.map((img) => [img, annotations[img] || []])),
            metadata: includeMetadata
              ? {
                  total_images: selectedImages.length,
                  total_annotations: selectedImages.reduce((sum, img) => sum + (annotations[img]?.length || 0), 0),
                  export_options: {
                    include_images: includeImages,
                    include_metadata: includeMetadata,
                  },
                }
              : undefined,
          }
          filename = `ketilabel_export_${Date.now()}.json`
      }

      // Create and download file
      if (selectedFormat === "yolo") {
        // For YOLO, create a zip file with multiple text files
        // This is a simplified version - in real implementation, you'd use a zip library
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

      if (onExport) {
        await onExport(selectedFormat, {
          images: selectedImages,
          includeImages,
          includeMetadata,
        })
      }

      toast({
        title: "Export Successful",
        description: `Exported ${selectedImages.length} images in ${format.name} format`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Export Failed",
        description: error instanceof Error ? error.message : "An error occurred during export",
      })
    } finally {
      setIsExporting(false)
      setExportProgress(0)
    }
  }

  const selectedFormat_obj = exportFormats.find((f) => f.id === selectedFormat)
  const annotatedImages = images.filter((img) => annotations[img]?.length > 0)
  const totalAnnotations = selectedImages.reduce((sum, img) => sum + (annotations[img]?.length || 0), 0)

  return (
    <div className="space-y-6">
      {/* Export Format Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="mr-2 h-5 w-5 text-primary" />
            Export Annotations
          </CardTitle>
          <CardDescription>Export your annotations in various formats for different ML frameworks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
              <SelectTrigger>
                <SelectValue placeholder="Select export format" />
              </SelectTrigger>
              <SelectContent>
                {exportFormats.map((format) => (
                  <SelectItem key={format.id} value={format.id}>
                    <div className="flex items-center space-x-2">
                      {format.icon}
                      <div>
                        <div className="font-medium">{format.name}</div>
                        <div className="text-xs text-muted-foreground">{format.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFormat_obj && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                {selectedFormat_obj.icon}
                <span className="font-medium">{selectedFormat_obj.name}</span>
                <Badge variant="secondary">{selectedFormat_obj.extension}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{selectedFormat_obj.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Images</CardTitle>
          <CardDescription>Choose which images to include in the export</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="select-all"
                checked={selectedImages.length === images.length}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="select-all">Select All Images</Label>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>{selectedImages.length} selected</span>
              <span>{annotatedImages.length} annotated</span>
              <span>{totalAnnotations} annotations</span>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {images.map((image) => {
              const hasAnnotations = annotations[image]?.length > 0
              const isSelected = selectedImages.includes(image)

              return (
                <div
                  key={image}
                  className={`flex items-center space-x-3 p-2 rounded-lg border transition-colors ${
                    isSelected ? "bg-primary/5 border-primary" : "bg-muted/50"
                  }`}
                >
                  <Checkbox
                    id={`image-${image}`}
                    checked={isSelected}
                    onCheckedChange={(checked) => handleImageSelect(image, checked as boolean)}
                  />
                  <img src={`/images/${image}`} alt={image} className="w-10 h-10 object-cover rounded border" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{image}</p>
                    <div className="flex items-center space-x-2">
                      {hasAnnotations ? (
                        <Badge variant="default" className="text-xs">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          {annotations[image].length} annotations
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <AlertCircle className="mr-1 h-3 w-3" />
                          No annotations
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
          <CardDescription>Configure additional export settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox id="include-images" checked={includeImages} onCheckedChange={setIncludeImages} />
            <Label htmlFor="include-images">Include original images in export</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="include-metadata" checked={includeMetadata} onCheckedChange={setIncludeMetadata} />
            <Label htmlFor="include-metadata">Include metadata and statistics</Label>
          </div>

          {isExporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Exporting...</span>
                <span>{exportProgress}%</span>
              </div>
              <Progress value={exportProgress} className="w-full" />
            </div>
          )}

          <Button
            onClick={handleExport}
            disabled={isExporting || selectedImages.length === 0}
            className="w-full"
            size="lg"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {selectedImages.length} Images
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
