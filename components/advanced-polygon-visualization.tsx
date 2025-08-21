"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, Download, Layers, Settings, ChevronUp, ChevronDown, Hand, Target, Tag } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { apiCall, API_CONFIG } from "@/lib/api-config"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ClassDefinition } from "./class-manager"

interface PolygonData {
  id?: string
  segmentation: number[] | number[][]
  area: number
  bbox: number[]
  predicted_iou: number
  stability_score: number
  point_coords: number[][]
  crop_box: number[]
  label?: string
  color?: string
  visible?: boolean
  classId?: string
  className?: string
  classColor?: string
}

interface AdvancedPolygonVisualizationProps {
  imageUrl: string
  polygonData: PolygonData[]
  imageWidth: number
  imageHeight: number
  uploadedClasses: any[] | null
  isDarkMode: boolean
  isProcessing?: boolean
  processingMessage?: string
  processingDescription?: string
  onImageLoad?: () => void
  onPointClick?: (x: number, y: number) => void
  onPolygonSelect?: (polygon: PolygonData) => void
  onPolygonUpdate?: (polygons: PolygonData[]) => void
  classes?: ClassDefinition[]
  selectedClassId?: string | null
  onClassAssign?: (polygonId: string, classId: string) => void
}

export default function AdvancedPolygonVisualization({
  imageUrl,
  polygonData,
  imageWidth,
  imageHeight,
  uploadedClasses,
  isDarkMode,
  isProcessing = false,
  processingMessage = "Processing...",
  processingDescription = "Please wait...",
  onImageLoad,
  onPointClick,
  onPolygonSelect,
  onPolygonUpdate,
  classes = [],
  selectedClassId,
  onClassAssign,
}: AdvancedPolygonVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [selectedPolygon, setSelectedPolygon] = useState<string | null>(null)
  const [selectedPolygons, setSelectedPolygons] = useState<Set<string>>(new Set())
  const [polygons, setPolygons] = useState<PolygonData[]>([])
  const [showLabels, setShowLabels] = useState(true)
  const [opacity, setOpacity] = useState([0.3])
  const [polygonDisplayMode, setPolygonDisplayMode] = useState<'all' | 'selected'>('all')
  const [segmentationVisible, setSegmentationVisible] = useState(true)
  const [isPanning, setIsPanning] = useState(false)
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 })
  const [interactionMode, setInteractionMode] = useState<'pan' | 'point'>('point')
  const { toast } = useToast()

  // Initialize polygons with enhanced properties
  useEffect(() => {
    if (polygonData.length === 0) {
      setPolygons([])
      return
    }

    const enhancedPolygons = polygonData.map((polygon, index) => {
      // Use class color if polygon has a class assigned, otherwise use default color
      const assignedClass = classes.find(cls => cls.id === polygon.classId)
      const polygonColor = assignedClass ? assignedClass.color : (polygon.color || getPolygonColor(index))
      
      return {
        ...polygon,
        id: polygon.id || `polygon-${index}`,
        visible: polygon.visible !== undefined ? polygon.visible : true,
        color: polygonColor,
        classColor: assignedClass?.color,
        className: assignedClass?.name || polygon.className,
        label: polygon.label || `Object ${index + 1}`,
      }
    })

    // Only update polygons if they actually changed
    setPolygons(prev => {
      if (prev.length !== enhancedPolygons.length) return enhancedPolygons
      
      const hasChanged = enhancedPolygons.some((newPoly, idx) => {
        const oldPoly = prev[idx]
        return !oldPoly || 
               newPoly.color !== oldPoly.color ||
               newPoly.classId !== oldPoly.classId ||
               newPoly.className !== oldPoly.className ||
               newPoly.visible !== oldPoly.visible
      })
      
      return hasChanged ? enhancedPolygons : prev
    })
  }, [polygonData, classes])

  // Handle polygon selection separately to avoid unnecessary re-renders
  useEffect(() => {
    if (polygons.length > 0 && !selectedPolygon) {
      setSelectedPolygon(polygons[0].id!)
      onPolygonSelect?.(polygons[0])
    }
  }, [polygons.length, selectedPolygon, onPolygonSelect])


  // Handle wheel event for zooming
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault()
    const delta = event.deltaY > 0 ? 0.9 : 1.1
    setZoom((prev) => Math.max(0.1, Math.min(5, prev * delta)))
  }, [])

  // Handle keyboard shortcuts for class assignment
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle shortcuts when in the labeling workspace and a polygon is selected
    if (!selectedPolygon || !onClassAssign) return
    
    const key = event.key
    
    // Handle number keys 1-9 for button_1 to button_9
    if (key >= '1' && key <= '9') {
      event.preventDefault()
      const classIndex = parseInt(key) - 1
      const targetClass = classes[classIndex]
      
      if (targetClass) {
        onClassAssign(selectedPolygon, targetClass.id)
        toast({
          title: "Class assigned",
          description: `Assigned "${targetClass.name}" to selected polygon using shortcut ${key}.`,
        })
      }
    }
    
    // Handle 0 for button_10
    if (key === '0') {
      event.preventDefault()
      const targetClass = classes[9] // button_10 is at index 9
      
      if (targetClass) {
        onClassAssign(selectedPolygon, targetClass.id)
        toast({
          title: "Class assigned",
          description: `Assigned "${targetClass.name}" to selected polygon using shortcut ${key}.`,
        })
      }
    }
    
    // Handle Backspace to remove class assignment
    if (key === 'Backspace') {
      event.preventDefault()
      onClassAssign(selectedPolygon, '')
      toast({
        title: "Class removed",
        description: "Removed class assignment from selected polygon.",
      })
    }
  }, [selectedPolygon, onClassAssign, classes, toast])

  // Add wheel event listener to canvas with passive: false
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleWheel, handleKeyDown])

  const getPolygonColor = (index: number) => {
    const colors = [
      "#0891b2", // primary cyan
      "#ef4444", // red
      "#10b981", // green
      "#f59e0b", // yellow
      "#8b5cf6", // purple
      "#ec4899", // pink
      "#06b6d4", // cyan
      "#84cc16", // lime
    ]
    return colors[index % colors.length]
  }

  const drawVisualization = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    const containerRect = container.getBoundingClientRect()
    canvas.width = containerRect.width
    canvas.height = containerRect.height

    // Calculate base scaling
    const baseScaleX = canvas.width / imageWidth
    const baseScaleY = canvas.height / imageHeight
    const baseScale = Math.min(baseScaleX, baseScaleY)
    const scale = baseScale * zoom

    // Calculate image position with pan
    const scaledImageWidth = imageWidth * scale
    const scaledImageHeight = imageHeight * scale
    const offsetX = (canvas.width - scaledImageWidth) / 2 + pan.x
    const offsetY = (canvas.height - scaledImageHeight) / 2 + pan.y

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Load and draw image
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      // Call onImageLoad callback if provided
      onImageLoad?.()
      
      // Draw image
      ctx.drawImage(img, offsetX, offsetY, scaledImageWidth, scaledImageHeight)

      // Draw polygons
      polygons.forEach((polygon) => {
        if (!polygon.visible) return

        const isSelected = selectedPolygon === polygon.id
        const color = polygon.color || "#0891b2"

        // Set polygon segmentation style
        const segmentationOpacity = opacity[0]
        ctx.strokeStyle = color
        ctx.fillStyle =
          color +
          Math.floor(segmentationOpacity * 255)
            .toString(16)
            .padStart(2, "0")
        ctx.lineWidth = isSelected ? 3 : 2
        
        // Add subtle glow for segmentation
        ctx.shadowColor = color
        ctx.shadowBlur = isSelected ? 8 : 4

        ctx.setLineDash([])
        ctx.globalCompositeOperation = 'source-over'

        // Draw polygon segmentation based on display mode
        const shouldShowSegmentation = segmentationVisible && 
                                      (polygonDisplayMode === 'all' || 
                                       (polygonDisplayMode === 'selected' && isSelected))
        
        // Draw actual segmentation polygon from SAM v2
        if (shouldShowSegmentation && polygon.segmentation) {
          console.log('=== SEGMENTATION RENDER START ===', {
            id: polygon.id,
            segmentation: polygon.segmentation,
            bbox: polygon.bbox,
            shouldShowSegmentation,
            color,
            opacity: opacity[0]
          })
          
          ctx.save()
          
          // Handle different segmentation data formats
          if (Array.isArray(polygon.segmentation)) {
            // Check if it's 2D mask format (mock data)
            if (polygon.segmentation.length > 0 && 
                Array.isArray(polygon.segmentation[0]) && 
                typeof polygon.segmentation[0][0] === 'boolean') {
              // 2D boolean mask - draw filled pixels
              const mask = polygon.segmentation as boolean[][]
              const [bboxX, bboxY, bboxWidth, bboxHeight] = polygon.bbox
              
              for (let y = 0; y < mask.length; y++) {
                for (let x = 0; x < mask[y].length; x++) {
                  if (mask[y][x]) {
                    const pixelX = offsetX + (bboxX + (x / mask[0].length) * bboxWidth) * scale
                    const pixelY = offsetY + (bboxY + (y / mask.length) * bboxHeight) * scale
                    const pixelSize = Math.max(2, (scale * bboxWidth) / mask[0].length)
                    
                    ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize)
                  }
                }
              }
              
            } else {
              // Standard polygon coordinates
              ctx.beginPath()
              let hasValidPath = false
              
              if (typeof polygon.segmentation[0] === 'number') {
                // Flat coordinate array [x1, y1, x2, y2, ...]
                for (let i = 0; i < polygon.segmentation.length; i += 2) {
                  if (i + 1 < polygon.segmentation.length) {
                    const x = offsetX + (polygon.segmentation[i] as number) * scale
                    const y = offsetY + (polygon.segmentation[i + 1] as number) * scale
                    if (i === 0) {
                      ctx.moveTo(x, y)
                    } else {
                      ctx.lineTo(x, y)
                    }
                    hasValidPath = true
                  }
                }
              } else if (Array.isArray(polygon.segmentation[0])) {
                console.log('Drawing coordinate pairs:', polygon.segmentation)
                // Array of coordinate pairs [[x1, y1], [x2, y2], ...]
                polygon.segmentation.forEach((point: any, i: number) => {
                  if (Array.isArray(point) && point.length >= 2) {
                    const x = offsetX + point[0] * scale
                    const y = offsetY + point[1] * scale
                    console.log(`Point ${i}: (${point[0]}, ${point[1]}) -> canvas (${x}, ${y})`)
                    if (i === 0) {
                      ctx.moveTo(x, y)
                    } else {
                      ctx.lineTo(x, y)
                    }
                    hasValidPath = true
                  }
                })
              }
              
              if (hasValidPath) {
                console.log('Closing path and filling/stroking')
                ctx.closePath()
                ctx.fill()
                ctx.stroke()
                
                // Add outline for selected
                if (isSelected) {
                  ctx.strokeStyle = 'white'
                  ctx.lineWidth = 1
                  ctx.shadowBlur = 0
                  ctx.stroke()
                }
                console.log('=== SEGMENTATION RENDER COMPLETE ===')
              } else {
                console.log('No valid path found!')
              }
            }
          }
          
          ctx.restore()
        } else if (shouldShowSegmentation && polygon.bbox) {
          // Fallback: fill entire bbox if no segmentation data
          const [x, y, width, height] = polygon.bbox
          const scaledX = offsetX + x * scale
          const scaledY = offsetY + y * scale
          const scaledWidth = width * scale
          const scaledHeight = height * scale

          ctx.save()
          ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight)
          ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight)
          ctx.restore()
        }
        
        if (false && shouldShowSegmentation && polygon.segmentation) {
          ctx.save()
          
          // Convert mask to polygon if needed
          if (Array.isArray(polygon.segmentation) && Array.isArray(polygon.segmentation[0]) && 
              typeof polygon.segmentation[0][0] === 'boolean') {
            // 2D mask format - convert to filled shape using bbox
            const mask = polygon.segmentation as boolean[][]
            const [bboxX, bboxY, bboxWidth, bboxHeight] = polygon.bbox
            
            // Simply fill the entire bbox area for mask data
            const scaledX = offsetX + bboxX * scale
            const scaledY = offsetY + bboxY * scale
            const scaledWidth = bboxWidth * scale
            const scaledHeight = bboxHeight * scale
            
            // Create a circular/oval shape within bbox
            const centerX = scaledX + scaledWidth / 2
            const centerY = scaledY + scaledHeight / 2
            const radiusX = scaledWidth / 2.5
            const radiusY = scaledHeight / 2.5
            
            ctx.beginPath()
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
            
          } else if (Array.isArray(polygon.segmentation)) {
            // Standard polygon coordinate format
            ctx.beginPath()
            let hasValidPath = false

            if (typeof polygon.segmentation[0] === "number" && polygon.segmentation.length >= 6) {
              // Flat array format [x1, y1, x2, y2, ...]
              for (let i = 0; i < polygon.segmentation.length; i += 2) {
                if (i + 1 < polygon.segmentation.length) {
                  const x = offsetX + (polygon.segmentation[i] as number) * scale
                  const y = offsetY + (polygon.segmentation[i + 1] as number) * scale
                  if (i === 0) {
                    ctx.moveTo(x, y)
                  } else {
                    ctx.lineTo(x, y)
                  }
                  hasValidPath = true
                }
              }
            } else if (Array.isArray(polygon.segmentation[0]) && polygon.segmentation.length >= 3) {
              // Array of coordinate pairs [[x1, y1], [x2, y2], ...]
              polygon.segmentation.forEach((point: number[], i: number) => {
                if (Array.isArray(point) && point.length >= 2) {
                  const x = offsetX + point[0] * scale
                  const y = offsetY + point[1] * scale
                  if (i === 0) {
                    ctx.moveTo(x, y)
                  } else {
                    ctx.lineTo(x, y)
                  }
                  hasValidPath = true
                }
              })
            }

            if (hasValidPath) {
              ctx.closePath()
              
              // Fill segmentation area
              ctx.fill()
              
              // Stroke segmentation outline
              ctx.stroke()
              
              // Add white outline for better visibility when selected
              if (isSelected) {
                ctx.strokeStyle = 'white'
                ctx.lineWidth = 1
                ctx.shadowBlur = 0
                ctx.stroke()
              }
            }
          }
          
          ctx.restore()
        }

        // Bounding box drawing removed per user request
        const shouldDrawBbox = false
        
        if (polygon.bbox && shouldDrawBbox) {
          const [x, y, width, height] = polygon.bbox
          const scaledX = offsetX + x * scale
          const scaledY = offsetY + y * scale
          const scaledBboxWidth = width * scale
          const scaledBboxHeight = height * scale

          // Save current context state
          ctx.save()
          
          // Set bbox-specific styles
          ctx.strokeStyle = color
          ctx.lineWidth = isSelected ? 4 : 3
          ctx.fillStyle = 'transparent'
          ctx.shadowColor = color
          ctx.shadowBlur = isSelected ? 12 : 6
          
          // Draw white outline first for better contrast
          ctx.strokeStyle = 'white'
          ctx.lineWidth = (isSelected ? 4 : 3) + 2
          ctx.shadowBlur = 0
          ctx.strokeRect(scaledX - 1, scaledY - 1, scaledBboxWidth + 2, scaledBboxHeight + 2)
          
          // Draw main bbox rectangle
          ctx.strokeStyle = color
          ctx.lineWidth = isSelected ? 4 : 3
          ctx.shadowColor = color
          ctx.shadowBlur = isSelected ? 12 : 6
          ctx.strokeRect(scaledX, scaledY, scaledBboxWidth, scaledBboxHeight)
          
          // Draw corner indicators for better visibility
          const cornerSize = Math.min(20, Math.min(scaledBboxWidth, scaledBboxHeight) / 4)
          ctx.lineWidth = 2
          ctx.shadowBlur = 0
          
          // Top-left corner
          ctx.beginPath()
          ctx.moveTo(scaledX, scaledY + cornerSize)
          ctx.lineTo(scaledX, scaledY)
          ctx.lineTo(scaledX + cornerSize, scaledY)
          ctx.stroke()
          
          // Top-right corner
          ctx.beginPath()
          ctx.moveTo(scaledX + scaledBboxWidth - cornerSize, scaledY)
          ctx.lineTo(scaledX + scaledBboxWidth, scaledY)
          ctx.lineTo(scaledX + scaledBboxWidth, scaledY + cornerSize)
          ctx.stroke()
          
          // Bottom-left corner
          ctx.beginPath()
          ctx.moveTo(scaledX, scaledY + scaledBboxHeight - cornerSize)
          ctx.lineTo(scaledX, scaledY + scaledBboxHeight)
          ctx.lineTo(scaledX + cornerSize, scaledY + scaledBboxHeight)
          ctx.stroke()
          
          // Bottom-right corner
          ctx.beginPath()
          ctx.moveTo(scaledX + scaledBboxWidth - cornerSize, scaledY + scaledBboxHeight)
          ctx.lineTo(scaledX + scaledBboxWidth, scaledY + scaledBboxHeight)
          ctx.lineTo(scaledX + scaledBboxWidth, scaledY + scaledBboxHeight - cornerSize)
          ctx.stroke()
          
          // Restore context
          ctx.restore()
        }

        // Draw label based on display mode  
        const shouldShowLabel = showLabels && 
                               (polygonDisplayMode === 'all' || 
                                (polygonDisplayMode === 'selected' && isSelected))
        
        if (shouldShowLabel && polygon.bbox) {
          const [x, y] = polygon.bbox
          const labelX = offsetX + x * scale
          const labelY = offsetY + y * scale - 8

          // Subtle label styling
          ctx.font = "11px sans-serif"  // 더 작고 일반 폰트
          const textMetrics = ctx.measureText(polygon.label || "")
          const padding = 3  // 더 작은 패딩
          const labelWidth = textMetrics.width + padding * 2
          const labelHeight = 13  // 더 낮은 높이
          
          // Semi-transparent dark background for subtlety
          ctx.fillStyle = "rgba(0, 0, 0, 0.6)"  // 반투명 검은 배경
          ctx.fillRect(labelX - padding, labelY - labelHeight + 3, labelWidth, labelHeight)

          // Subtle white text with minimal shadow
          ctx.fillStyle = "white"
          ctx.shadowColor = "rgba(0, 0, 0, 0.8)"
          ctx.shadowBlur = 1  // 더 연한 그림자
          ctx.shadowOffsetX = 0.5
          ctx.shadowOffsetY = 0.5
          ctx.fillText(polygon.label || "", labelX, labelY)
          
          // Reset shadow
          ctx.shadowColor = "transparent"
          ctx.shadowBlur = 0
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
        }

        // IoU info box removed
      })

      // Reset shadow and context
      ctx.shadowBlur = 0
      ctx.shadowColor = 'transparent'
      ctx.globalCompositeOperation = 'source-over'
    }

    img.src = imageUrl
  }, [imageUrl, polygons, imageWidth, imageHeight, zoom, pan, selectedPolygon, showLabels, opacity])

  // Trigger drawing when dependencies change, but with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      drawVisualization()
    }, 16) // ~60fps
    
    return () => clearTimeout(timeoutId)
  }, [imageUrl, polygons, zoom, pan, selectedPolygon, showLabels, opacity])

  // Handle canvas interactions - mode-based
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Only handle point selection in point mode
    if (interactionMode !== 'point' || isProcessing || !onPointClick) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const clickX = event.clientX - rect.left
    const clickY = event.clientY - rect.top

    // Calculate real coordinates in image space
    const baseScaleX = canvas.width / imageWidth
    const baseScaleY = canvas.height / imageHeight
    const baseScale = Math.min(baseScaleX, baseScaleY)
    const scale = baseScale * zoom

    const scaledImageWidth = imageWidth * scale
    const scaledImageHeight = imageHeight * scale
    const offsetX = (canvas.width - scaledImageWidth) / 2 + pan.x
    const offsetY = (canvas.height - scaledImageHeight) / 2 + pan.y

    // Convert click coordinates to image coordinates
    const imageX = (clickX - offsetX) / scale
    const imageY = (clickY - offsetY) / scale

    // Check if click is within image bounds
    if (imageX >= 0 && imageX <= imageWidth && imageY >= 0 && imageY <= imageHeight) {
      const realX = Math.round(imageX)
      const realY = Math.round(imageY)
      
      console.log("🖱️ Canvas clicked for point segmentation:", { realX, realY })
      onPointClick(realX, realY)
    }
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (interactionMode === 'pan' && event.button === 0) {
      // Left click for panning in pan mode
      setIsPanning(true)
      setLastPanPoint({ x: event.clientX, y: event.clientY })
      event.preventDefault()
    } else if (event.button === 1 || event.ctrlKey) {
      // Middle mouse or Ctrl+click for panning (fallback)
      setIsPanning(true)
      setLastPanPoint({ x: event.clientX, y: event.clientY })
      event.preventDefault()
    }
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const deltaX = event.clientX - lastPanPoint.x
      const deltaY = event.clientY - lastPanPoint.y
      setPan((prev) => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
      setLastPanPoint({ x: event.clientX, y: event.clientY })
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setSelectedPolygon(null)
  }

  const togglePolygonVisibility = useCallback((polygonId: string) => {
    setPolygons((prev) => {
      const updated = prev.map((p) => (p.id === polygonId ? { ...p, visible: !p.visible } : p))
      // Schedule the update for next render cycle
      setTimeout(() => onPolygonUpdate?.(updated), 0)
      return updated
    })
  }, [onPolygonUpdate])

  const selectPreviousPolygon = useCallback(() => {
    if (polygons.length === 0) return
    
    const currentIndex = selectedPolygon 
      ? polygons.findIndex(p => p.id === selectedPolygon)
      : -1
    
    const previousIndex = currentIndex <= 0 ? polygons.length - 1 : currentIndex - 1
    const previousPolygon = polygons[previousIndex]
    
    setSelectedPolygon(previousPolygon.id!)
    onPolygonSelect?.(previousPolygon)
  }, [polygons, selectedPolygon, onPolygonSelect])

  const selectNextPolygon = useCallback(() => {
    if (polygons.length === 0) return
    
    const currentIndex = selectedPolygon 
      ? polygons.findIndex(p => p.id === selectedPolygon)
      : -1
    
    const nextIndex = currentIndex >= polygons.length - 1 ? 0 : currentIndex + 1
    const nextPolygon = polygons[nextIndex]
    
    setSelectedPolygon(nextPolygon.id!)
    onPolygonSelect?.(nextPolygon)
  }, [polygons, selectedPolygon, onPolygonSelect])

  const togglePolygonSelection = useCallback((polygonId: string) => {
    setSelectedPolygons(prev => {
      const newSet = new Set(prev)
      if (newSet.has(polygonId)) {
        newSet.delete(polygonId)
      } else {
        newSet.add(polygonId)
      }
      return newSet
    })
  }, [])

  const selectAllPolygons = useCallback(() => {
    setSelectedPolygons(new Set(polygons.map(p => p.id!)))
  }, [polygons])

  const deselectAllPolygons = useCallback(() => {
    setSelectedPolygons(new Set())
  }, [])

  const exportToCoco = async () => {
    if (selectedPolygons.size === 0) {
      toast({
        variant: "destructive",
        title: "No Polygons Selected",
        description: "Please select at least one polygon to export.",
      })
      return
    }

    const selectedPolygonsList = polygons.filter(p => selectedPolygons.has(p.id!))
    
    try {
      // Prepare data for API call
      const requestData = {
        image: {
          width: imageWidth,
          height: imageHeight,
          url: imageUrl,
        },
        polygons: selectedPolygonsList
          .filter((p) => p.visible)
          .map((p) => ({
            id: p.id,
            label: p.label,
            segmentation: p.segmentation,
            bbox: p.bbox,
            area: p.area,
            predicted_iou: p.predicted_iou,
            stability_score: p.stability_score,
          })),
        metadata: {
          exported_at: new Date().toISOString(),
          total_polygons: selectedPolygonsList.filter((p) => p.visible).length,
          selected_polygons: selectedPolygons.size,
        },
      }

      toast({
        title: "Converting to COCO",
        description: "Sending data to server for COCO conversion...",
      })

      // Call API
      const response = await apiCall(API_CONFIG.ENDPOINTS.CONVERT_TO_COCO, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      const cocoData = await response.json()

      // Download COCO JSON
      const blob = new Blob([JSON.stringify(cocoData, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `coco_annotations_${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "COCO Export Successful",
        description: `Exported ${requestData.polygons.length} polygons in COCO format`,
      })
    } catch (error) {
      console.error("COCO conversion error:", error)
      toast({
        variant: "destructive",
        title: "COCO Conversion Failed",
        description: (error as Error).message,
      })
    }
  }

  const exportAnnotations = () => {
    const selectedPolygonsList = polygons.filter(p => selectedPolygons.has(p.id!))
    const annotations = {
      image: {
        width: imageWidth,
        height: imageHeight,
        url: imageUrl,
      },
      polygons: selectedPolygonsList
        .filter((p) => p.visible)
        .map((p) => ({
          id: p.id,
          label: p.label,
          segmentation: p.segmentation,
          bbox: p.bbox,
          area: p.area,
          predicted_iou: p.predicted_iou,
          stability_score: p.stability_score,
          classId: p.classId,
          className: p.className,
          classColor: p.classColor,
        })),
      metadata: {
        exported_at: new Date().toISOString(),
        total_polygons: selectedPolygonsList.filter((p) => p.visible).length,
        selected_polygons: selectedPolygons.size,
        classes: classes.map(cls => ({
          id: cls.id,
          name: cls.name,
          color: cls.color,
          count: selectedPolygonsList.filter(p => p.visible && p.classId === cls.id).length
        })).filter(cls => cls.count > 0),
      },
    }

    const blob = new Blob([JSON.stringify(annotations, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `annotations-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "Selected Annotations Exported",
      description: `Exported ${annotations.polygons.length} selected polygons to JSON file`,
    })
  }

  return (
    <div className="space-y-4">
      {/* Visualization Canvas */}
      <div ref={containerRef} className="relative w-full h-[600px] bg-muted rounded-lg overflow-hidden border">
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full ${
            isPanning 
              ? 'cursor-grabbing' 
              : interactionMode === 'pan' 
                ? 'cursor-grab' 
                : 'cursor-crosshair'
          }`}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ imageRendering: "pixelated" }}
        />

        {/* Interaction Mode Controls */}
        <div className="absolute top-4 left-4 flex flex-col space-y-2">
          <Button
            size="sm"
            variant={interactionMode === 'pan' ? 'default' : 'secondary'}
            onClick={() => setInteractionMode('pan')}
            title="Pan mode - Drag to move image"
          >
            <Hand className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={interactionMode === 'point' ? 'default' : 'secondary'}
            onClick={() => setInteractionMode('point')}
            title="Point mode - Click to create polygons"
          >
            <Target className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2">
          <Button size="sm" variant="secondary" onClick={() => setZoom((prev) => Math.min(5, prev * 1.2))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setZoom((prev) => Math.max(0.1, prev * 0.8))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="secondary" onClick={resetView}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Processing Overlay */}
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
            <div className="text-center p-8">
              <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-primary/10 rounded-full">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{processingMessage}</h3>
              <p className="text-sm text-muted-foreground mb-4">{processingDescription}</p>
              <div className="flex items-center justify-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Display Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              Display Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Segmentation Controls */}
            <div className="space-y-3 pb-3 border-b">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-segmentation" className="text-sm font-medium">Segmentation</Label>
                <Switch id="show-segmentation" checked={segmentationVisible} onCheckedChange={setSegmentationVisible} />
              </div>
              {segmentationVisible && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Opacity: {Math.round(opacity[0] * 100)}%</Label>
                  <Slider value={opacity} onValueChange={setOpacity} max={1} min={0.05} step={0.05} className="w-full" />
                </div>
              )}
            </div>

            {/* Polygon Display Mode Controls */}
            <div className="space-y-3 pb-3 border-b">
              <Label className="text-sm font-medium">Polygon Display</Label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  size="sm"
                  variant={polygonDisplayMode === 'all' ? 'default' : 'outline'}
                  onClick={() => setPolygonDisplayMode('all')}
                  className="text-xs"
                >
                  All Polygons
                </Button>
                <Button
                  size="sm"
                  variant={polygonDisplayMode === 'selected' ? 'default' : 'outline'}
                  onClick={() => setPolygonDisplayMode('selected')}
                  className="text-xs"
                >
                  Selected Only
                </Button>
              </div>
            </div>

            {/* Other Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-labels" className="text-sm">Labels</Label>
                <Switch id="show-labels" checked={showLabels} onCheckedChange={setShowLabels} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={exportAnnotations} 
                  className="bg-transparent"
                  disabled={selectedPolygons.size === 0}
                  title={selectedPolygons.size === 0 ? "Select polygons to export" : `Export ${selectedPolygons.size} selected polygons as JSON`}
                >
                  <Download className="mr-1 h-3 w-3" />
                  JSON ({selectedPolygons.size})
                </Button>
                <Button 
                  size="sm" 
                  variant="default" 
                  onClick={exportToCoco} 
                  disabled={selectedPolygons.size === 0}
                  title={selectedPolygons.size === 0 ? "Select polygons to export" : `Export ${selectedPolygons.size} selected polygons as COCO`}
                >
                  <Download className="mr-1 h-3 w-3" />
                  COCO ({selectedPolygons.size})
                </Button>
              </div>
              <Button size="sm" variant="outline" onClick={resetView} className="w-full bg-transparent">
                <RotateCcw className="mr-2 h-3 w-3" />
                Reset View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Polygon List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Layers className="mr-2 h-4 w-4" />
                Polygons ({polygons.length})
              </div>
              {polygons.length > 1 && (
                <div className="flex items-center space-x-1 bg-muted/30 rounded-md px-2 py-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={selectPreviousPolygon}
                    className="h-6 w-6 p-0"
                    title="Previous polygon"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1 min-w-[30px] text-center">
                    {selectedPolygon ? polygons.findIndex(p => p.id === selectedPolygon) + 1 : 1}/{polygons.length}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={selectNextPolygon}
                    className="h-6 w-6 p-0"
                    title="Next polygon"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardTitle>
            {polygons.length > 0 && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="select-all-polygons"
                    checked={selectedPolygons.size === polygons.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        selectAllPolygons()
                      } else {
                        deselectAllPolygons()
                      }
                    }}
                  />
                  <Label htmlFor="select-all-polygons" className="text-xs">
                    Select All ({selectedPolygons.size}/{polygons.length})
                  </Label>
                </div>
                {selectedPolygons.size > 0 && (
                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={exportAnnotations}
                      className="text-xs h-7"
                    >
                      <Download className="mr-1 h-3 w-3" />
                      JSON
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={exportToCoco}
                      className="text-xs h-7"
                    >
                      <Download className="mr-1 h-3 w-3" />
                      COCO
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {polygons.map((polygon) => (
                <div
                  key={polygon.id}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                    selectedPolygon === polygon.id ? "bg-primary/10 border-primary" : "bg-muted/50 hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedPolygons.has(polygon.id!)}
                      onCheckedChange={() => togglePolygonSelection(polygon.id!)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div 
                      className="w-4 h-4 rounded border-2 cursor-pointer" 
                      style={{ backgroundColor: polygon.color }}
                      onClick={() => {
                        setSelectedPolygon(polygon.id!)
                        onPolygonSelect?.(polygon)
                      }}
                    />
                    <div 
                      className="cursor-pointer flex-1"
                      onClick={() => {
                        setSelectedPolygon(polygon.id!)
                        onPolygonSelect?.(polygon)
                      }}
                    >
                      <div className="text-sm font-medium">{polygon.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {polygon.className ? (
                          <span className="flex items-center">
                            <Tag className="h-3 w-3 mr-1" />
                            {polygon.className} • {Math.round(polygon.area || 0)}px²
                          </span>
                        ) : (
                          <>Area: {Math.round(polygon.area || 0)}px²</>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {classes.length > 0 && (
                      <Select
                        value={polygon.classId || "no-class"}
                        onValueChange={(classId) => {
                          const actualClassId = classId === "no-class" ? "" : classId
                          onClassAssign?.(polygon.id!, actualClassId)
                        }}
                      >
                        <SelectTrigger className="h-6 w-20 text-xs">
                          <SelectValue placeholder="Class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no-class">No class</SelectItem>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              <div className="flex items-center space-x-2">
                                <div 
                                  className="w-3 h-3 rounded border"
                                  style={{ backgroundColor: cls.color }}
                                />
                                <span>{cls.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Badge variant="secondary" className="text-xs">
                      {Math.round(polygon.area || 0)}px
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePolygonVisibility(polygon.id!)
                      }}
                    >
                      {polygon.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
