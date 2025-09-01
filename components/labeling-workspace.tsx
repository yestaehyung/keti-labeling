"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, Moon, Sun, Zap, Target, Trash2, FileText, Play, Square, RotateCcw } from "lucide-react"
import AdvancedPolygonVisualization from "./advanced-polygon-visualization"
import ClassManager, { type ClassDefinition } from "./class-manager"
import { useToast } from "@/hooks/use-toast"
import { apiCall, API_CONFIG } from "@/lib/api-config"
import { useEffect } from "react"

interface LabelingWorkspaceProps {
  selectedImage: string
  onBack: () => void
  uploadedClasses: any[] | null
  isDarkMode: boolean
  toggleDarkMode: () => void
}

export default function LabelingWorkspace({
  selectedImage,
  onBack,
  uploadedClasses,
  isDarkMode,
  toggleDarkMode,
}: LabelingWorkspaceProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  const [polygonData, setPolygonData] = useState<any[] | null>(null)
  const [imageSize, setImageSize] = useState({ width: 800, height: 600 })
  const [rawServerLog, setRawServerLog] = useState<any>(null)
  const [showRawLog, setShowRawLog] = useState(false)
  const [pointsMode, setPointsMode] = useState(false)
  const [selectedPoints, setSelectedPoints] = useState<any[]>([])
  const [pointProcessing, setPointProcessing] = useState<Record<string, string>>({})
  const [clickProcessing, setClickProcessing] = useState(false)
  const [classes, setClasses] = useState<ClassDefinition[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const { toast } = useToast()

  // Load classes from localStorage on mount
  useEffect(() => {
    const savedClasses = localStorage.getItem("ketilabel_classes")
    if (savedClasses) {
      try {
        setClasses(JSON.parse(savedClasses))
      } catch (error) {
        console.error("Failed to load classes:", error)
      }
    }
  }, [])

  // Save classes to localStorage when they change
  useEffect(() => {
    if (classes.length > 0) {
      localStorage.setItem("ketilabel_classes", JSON.stringify(classes))
    }
  }, [classes])

  // Handle image load to get actual dimensions
  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      })
    }
  }

  // Generate mock polygon data for testing
  const generateMockPolygonData = () => {
    const mockPolygons = []
    const numPolygons = Math.floor(Math.random() * 5) + 2
    for (let i = 0; i < numPolygons; i++) {
      const maskWidth = 100
      const maskHeight = 100
      const mask = Array(maskHeight)
        .fill(null)
        .map(() => Array(maskWidth).fill(false))
      const centerX = Math.floor(Math.random() * (maskWidth - 20)) + 10
      const centerY = Math.floor(Math.random() * (maskHeight - 20)) + 10
      const radius = Math.floor(Math.random() * 15) + 5
      for (let y = 0; y < maskHeight; y++) {
        for (let x = 0; x < maskWidth; x++) {
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)
          if (distance < radius) {
            mask[y][x] = true
          }
        }
      }
      const area = mask.flat().filter(Boolean).length
      const bbox = [centerX - radius, centerY - radius, radius * 2, radius * 2]
      mockPolygons.push({
        segmentation: mask,
        area: area,
        bbox: bbox,
        predicted_iou: Math.random() * 0.3 + 0.7,
        point_coords: [[centerX, centerY]],
        stability_score: Math.random() * 0.2 + 0.8,
        crop_box: [0, 0, imageSize.width, imageSize.height],
      })
    }
    return mockPolygons
  }

  // Persist image dimensions to localStorage for export usage
  useEffect(() => {
    if (!selectedImage || !imageSize.width || !imageSize.height) return
    try {
      const key = "ketilabel_image_meta"
      const raw = localStorage.getItem(key)
      const meta = raw ? JSON.parse(raw) : {}
      meta[selectedImage] = { width: imageSize.width, height: imageSize.height }
      localStorage.setItem(key, JSON.stringify(meta))
    } catch (e) {
      console.error("Failed to persist image meta:", e)
    }
  }, [selectedImage, imageSize.width, imageSize.height])

  const handleSamV2Processing = async () => {
    setIsProcessing(true)
    setProcessingStatus("processing")
    setRawServerLog(null)

    toast({
      title: "Processing Started",
      description: "SAM2 AI is analyzing your image...",
    })

    try {
      const response = await apiCall(`${API_CONFIG.ENDPOINTS.GENERATE_POLYGONS}/${selectedImage}`, {
        method: "GET",
      })

      const responseData = await response.json()

      setRawServerLog({
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: responseData,
        timestamp: new Date().toISOString(),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      if (responseData && responseData.masks) {
        if (responseData.image_dimensions) {
          setImageSize({
            width: responseData.image_dimensions.width,
            height: responseData.image_dimensions.height,
          })
        }

        const convertedPolygons = responseData.masks.map((mask: any) => ({
          segmentation: mask.polygons && mask.polygons.length > 0 ? mask.polygons[0] : null, // 첨 번째 polygon 사용
          area: mask.area,
          bbox: mask.bbox,
          predicted_iou: mask.predicted_iou,
          stability_score: mask.stability_score,
          point_coords: [],
          crop_box: [
            0,
            0,
            responseData.image_dimensions?.width || imageSize.width,
            responseData.image_dimensions?.height || imageSize.height,
          ],
          id: mask.id,
        }))
        setPolygonData(convertedPolygons)

        toast({
          title: "Processing Complete",
          description: `Successfully detected ${convertedPolygons.length} objects`,
        })
      } else {
        const mockPolygonResults = generateMockPolygonData()
        setPolygonData(mockPolygonResults)

        toast({
          title: "Processing Complete",
          description: `Generated ${mockPolygonResults.length} mock polygons for demo`,
        })
      }

      setProcessingStatus("completed")
    } catch (error) {
      setProcessingStatus("error")
      console.error("Processing failed:", error)

      setRawServerLog({
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      })

      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: (error as Error).message,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleClearResults = () => {
    setPolygonData(null)
    setProcessingStatus(null)
    setRawServerLog(null)
    setShowRawLog(false)
    setSelectedPoints([])
    setPointProcessing({})
    setPointsMode(false)
    
    toast({
      title: "Results Cleared",
      description: "All detection results have been cleared.",
    })
  }

  // Handle class assignment to polygons
  const handleClassAssign = (polygonId: string, classId: string) => {
    if (!polygonData) return

    const selectedClass = classes.find(cls => cls.id === classId)
    
    const updatedPolygons = polygonData.map(polygon => {
      if (polygon.id === polygonId || `polygon-${polygonData.indexOf(polygon)}` === polygonId) {
        return {
          ...polygon,
          classId: classId || undefined,
          className: selectedClass?.name || undefined,
          classColor: selectedClass?.color || undefined,
          color: selectedClass?.color || polygon.color // Update polygon color to match class
        }
      }
      return polygon
    })

    setPolygonData(updatedPolygons)

    // Save annotations to localStorage
    const annotations = localStorage.getItem("ketilabel_annotations")
    const allAnnotations = annotations ? JSON.parse(annotations) : {}
    allAnnotations[selectedImage] = updatedPolygons
    localStorage.setItem("ketilabel_annotations", JSON.stringify(allAnnotations))

    if (selectedClass) {
      toast({
        title: "Class assigned",
        description: `Polygon assigned to class "${selectedClass.name}".`,
      })
    } else {
      toast({
        title: "Class removed",
        description: "Class assignment removed from polygon.",
      })
    }
  }

  // Calculate polygon counts by class
  const getPolygonCounts = () => {
    const counts: Record<string, number> = {}
    if (polygonData) {
      polygonData.forEach(polygon => {
        if (polygon.classId) {
          counts[polygon.classId] = (counts[polygon.classId] || 0) + 1
        }
      })
    }
    return counts
  }

  const generatePolygonFromPoint = async (x: number, y: number) => {
    console.log("🔄 Starting polygon generation from point:", { x, y })
    setClickProcessing(true)
    
    try {
      const pointData = {
        filename: selectedImage,
        points: [[x, y]],
        labels: [1],
        image_size: [imageSize.width, imageSize.height]
      }

      const apiUrl = API_CONFIG.ENDPOINTS.GENERATE_POLYGONS_WITH_POINTS
      console.log("🌐 API call:", { apiUrl, pointData })

      const response = await apiCall(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pointData),
      })

      console.log("📡 API response status:", response.status, response.statusText)

      const responseData = await response.json()
      console.log("📄 API response data:", responseData)

      if (!response.ok) {
        console.error("❌ API error:", responseData)
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      if (responseData && responseData.masks) {
        console.log("✅ Masks found:", responseData.masks.length)
        if (responseData.image_dimensions) {
          setImageSize({
            width: responseData.image_dimensions.width,
            height: responseData.image_dimensions.height,
          })
        }

        const convertedPolygons = responseData.masks.map((mask: any) => ({
          segmentation: mask.polygons && mask.polygons.length > 0 ? mask.polygons[0] : null,
          area: mask.area,
          bbox: mask.bbox,
          predicted_iou: mask.predicted_iou,
          stability_score: mask.stability_score,
          point_coords: [[x, y]],
          crop_box: [0, 0, imageSize.width, imageSize.height],
        }))

        // Append new polygons to existing ones
        setPolygonData((prev) => prev ? [...prev, ...convertedPolygons] : convertedPolygons)
        setProcessingStatus("completed")

        toast({
          title: "Polygon Created",
          description: `Created ${convertedPolygons.length} polygon(s) from click`,
        })
      }
    } catch (error) {
      console.error("Point polygon generation error:", error)
      toast({
        variant: "destructive",
        title: "Processing Failed",
        description: (error as Error).message,
      })
    } finally {
      setClickProcessing(false)
    }
  }

  const handleImageClick = async (event: React.MouseEvent<HTMLImageElement>) => {
    console.log("🖱️ Image clicked!")
    
    if (clickProcessing || isProcessing) {
      console.log("⏳ Already processing, ignoring click")
      return
    }
    
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    // Calculate real coordinates based on image scaling
    const scaleX = imageSize.width / rect.width
    const scaleY = imageSize.height / rect.height
    const realX = Math.round(x * scaleX)
    const realY = Math.round(y * scaleY)
    
    console.log("📍 Click coordinates:", {
      clientX: event.clientX,
      clientY: event.clientY,
      rectLeft: rect.left,
      rectTop: rect.top,
      rectWidth: rect.width,
      rectHeight: rect.height,
      imageSize,
      scaleX,
      scaleY,
      clickX: x,
      clickY: y,
      realX,
      realY
    })
    
    await generatePolygonFromPoint(realX, realY)
  }

  const handlePointsModeToggle = () => {
    if (pointsMode && selectedPoints.length > 0) {
      const shouldClear = window.confirm(
        `You have ${selectedPoints.length} selected points. Do you want to clear them when exiting Points Mode?`,
      )
      if (shouldClear) {
        setSelectedPoints([])
        setPointProcessing({})
      }
    }
    setPointsMode(!pointsMode)
  }

  const getStatusBadge = () => {
    switch (processingStatus) {
      case "processing":
        return (
          <Badge variant="secondary" className="animate-pulse">
            <div className="mr-2 h-2 w-2 rounded-full bg-yellow-500" />
            Processing with SAM v2...
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="default">
            <div className="mr-2 h-2 w-2 rounded-full bg-green-500" />
            Processing completed! {polygonData ? polygonData.length : 0} polygons detected
          </Badge>
        )
      case "error":
        return (
          <Badge variant="destructive">
            <div className="mr-2 h-2 w-2 rounded-full bg-red-500" />
            Processing failed
          </Badge>
        )
      default:
        return null
    }
  }

  // Keyboard shortcuts removed

  return (
    <div className="min-h-screen bg-background">
      {/* Keyboard shortcuts removed */}

      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Image Labeling</h1>
                <p className="text-sm text-muted-foreground">{selectedImage}</p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {getStatusBadge()}
              <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Image Display Area */}
          <div className="lg:col-span-3">
            <Card>
              <CardContent className="p-6">
                <AdvancedPolygonVisualization
                  imageUrl={`/images/${selectedImage}`}
                  polygonData={polygonData || []}
                  imageWidth={imageSize.width}
                  imageHeight={imageSize.height}
                  uploadedClasses={uploadedClasses}
                  isDarkMode={isDarkMode}
                  isProcessing={isProcessing || clickProcessing}
                  processingMessage={clickProcessing 
                    ? "Creating Polygon from Point" 
                    : "Processing with SAM v2"
                  }
                  processingDescription={clickProcessing 
                    ? "AI is creating polygon from your clicked point..." 
                    : "AI is analyzing your image to detect objects..."
                  }
                  onImageLoad={handleImageLoad}
                  onPointClick={generatePolygonFromPoint}
                  onPolygonSelect={(polygon) => {
                    console.log("Selected polygon:", polygon)
                  }}
                  onPolygonUpdate={(updatedPolygons) => {
                    setPolygonData(updatedPolygons)
                  }}
                  classes={classes}
                  selectedClassId={selectedClassId}
                  onClassAssign={handleClassAssign}
                />
              </CardContent>
            </Card>
          </div>

          {/* Control Panel */}
          <div className="space-y-6">
            {/* AI Processing Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Zap className="mr-2 h-5 w-5 text-primary" />
                  AI Processing
                </CardTitle>
                <CardDescription>Use SAM2 AI to automatically detect objects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleSamV2Processing} disabled={isProcessing} className="w-full" size="lg">
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Start SAM v2 Processing
                    </>
                  )}
                </Button>

                {!polygonData && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm text-muted-foreground text-center">
                      💡 <strong>Tip:</strong> Click directly on the image to create polygons instantly!
                    </p>
                  </div>
                )}
                
                {pointsMode && (
                  <Button
                    variant="outline"
                    onClick={handlePointsModeToggle}
                    disabled={isProcessing}
                    className="w-full bg-transparent"
                  >
                    <Target className="mr-2 h-4 w-4" />
                    Exit Advanced Points Mode
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Results Card */}
            {(polygonData || processingStatus) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Square className="mr-2 h-5 w-5 text-primary" />
                    Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {polygonData && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Polygons Detected</span>
                        <Badge variant="secondary">{polygonData.length}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Image Size</span>
                        <span className="text-sm text-muted-foreground">
                          {imageSize.width} × {imageSize.height}
                        </span>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    {polygonData && (
                      <Button variant="outline" onClick={handleClearResults} className="w-full bg-transparent">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Results
                      </Button>
                    )}

                    {rawServerLog && (
                      <Button variant="outline" onClick={() => setShowRawLog(!showRawLog)} className="w-full">
                        <FileText className="mr-2 h-4 w-4" />
                        {showRawLog ? "Hide" : "Show"} Server Log
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Points Mode Card */}
            {pointsMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Target className="mr-2 h-5 w-5 text-primary" />
                    Selected Points ({selectedPoints.length})
                  </CardTitle>
                  <CardDescription>Click on the image to add points for targeted polygon generation</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedPoints.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Click on the image to add points</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedPoints.map((point, index) => (
                        <div key={point.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold">
                              {index + 1}
                            </div>
                            <span className="text-sm">
                              ({point.x}, {point.y})
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedPoints((prev) => prev.filter((p) => p.id !== point.id))
                              setPointProcessing((prev) => {
                                const newState = { ...prev }
                                delete newState[point.id]
                                return newState
                              })
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        onClick={() => {
                          setSelectedPoints([])
                          setPointProcessing({})
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <RotateCcw className="mr-2 h-3 w-3" />
                        Clear All Points
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Class Manager */}
            <ClassManager
              classes={classes}
              onClassesChange={setClasses}
              onClassSelect={setSelectedClassId}
              selectedClassId={selectedClassId}
              polygonCounts={getPolygonCounts()}
            />
          </div>
        </div>

        {/* Server Log Dialog */}
        <Dialog open={showRawLog} onOpenChange={setShowRawLog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Server Response Log</DialogTitle>
              <DialogDescription>Debug information from the SAM2 processing server</DialogDescription>
            </DialogHeader>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              <pre className="whitespace-pre-wrap">{JSON.stringify(rawServerLog, null, 2)}</pre>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}
