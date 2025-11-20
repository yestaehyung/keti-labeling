"use client"

import type React from "react"
import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Brain,
  Upload,
  ArrowLeft,
  FileText,
  Trash2,
  CheckCircle,
  AlertCircle,
  Play,
  Server,
  HardDrive,
  Settings2,
  Info
} from "lucide-react"
import Link from "next/link"
import { useDropzone } from "react-dropzone"
import { useToast } from "@/hooks/use-toast"
import { apiCall, API_CONFIG } from "@/lib/api-config"

interface UploadedFile {
  id: string
  name: string
  size: number
  content: any
  uploadDate: Date
}

interface TrainingConfig {
  modelType: string
  epochs: number
  learningRate: number
  batchSize: number
}

interface ServerAnnotationFile {
  filename: string
  size?: number
  modified_time?: number
}

export default function TrainingPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [serverAnnotationFiles, setServerAnnotationFiles] = useState<ServerAnnotationFile[]>([])
  const [selectedServerAnnotations, setSelectedServerAnnotations] = useState<string[]>([])
  const [loadingServerAnnotations, setLoadingServerAnnotations] = useState(false)
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    modelType: "segmentation",
    epochs: 100,
    learningRate: 0.001,
    batchSize: 16
  })
  const [imgSize, setImgSize] = useState<number>(640)
  const [modelName, setModelName] = useState<string>("my_button_detector")
  const [isValidating, setIsValidating] = useState(false)
  const { toast } = useToast()
  const totalServerAnnotationFiles = serverAnnotationFiles.length
  const allServerAnnotationsSelected =
    totalServerAnnotationFiles > 0 && selectedServerAnnotations.length === totalServerAnnotationFiles
  const hasPartialServerAnnotationSelection =
    selectedServerAnnotations.length > 0 && !allServerAnnotationsSelected

  const handleSelectAllServerAnnotations = useCallback((shouldSelectAll: boolean) => {
    if (shouldSelectAll) {
      setSelectedServerAnnotations(serverAnnotationFiles.map((file) => file.filename))
      return
    }
    setSelectedServerAnnotations([])
  }, [serverAnnotationFiles])

  const validateJsonFile = (content: any): boolean => {
    try {
      if (!content || typeof content !== 'object') return false
      
      // Basic validation for annotation format
      if (Array.isArray(content)) {
        return content.every(item => 
          item.hasOwnProperty('image_id') || 
          item.hasOwnProperty('filename') ||
          item.hasOwnProperty('annotations')
        )
      }
      
      if (content.hasOwnProperty('annotations') || content.hasOwnProperty('images')) {
        return true
      }
      
      return false
    } catch {
      return false
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setIsValidating(true)

    const tasks = acceptedFiles.map((file) =>
      new Promise<void>((resolve) => {
        const reader = new FileReader()

        reader.onload = () => {
          try {
            const content = JSON.parse(reader.result as string)

            if (validateJsonFile(content)) {
              const newFile: UploadedFile = {
                id: Math.random().toString(36).substr(2, 9),
                name: file.name,
                size: file.size,
                content,
                uploadDate: new Date(),
              }

              setUploadedFiles((prev) => [...prev, newFile])

              toast({
                title: "File uploaded successfully",
                description: `${file.name} has been validated and added.`,
              })
            } else {
              toast({
                title: "Invalid JSON format",
                description: `${file.name} is not a valid annotation file.`,
                variant: "destructive",
              })
            }
          } catch (error) {
            toast({
              title: "Failed to parse JSON",
              description: `${file.name} contains invalid JSON.`,
              variant: "destructive",
            })
          } finally {
            resolve()
          }
        }

        reader.onerror = () => {
          toast({
            title: "File read error",
            description: `${file.name} could not be read.`,
            variant: "destructive",
          })
          resolve()
        }

        reader.readAsText(file)
      }),
    )

    Promise.allSettled(tasks).finally(() => setIsValidating(false))
  }, [toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json']
    },
    multiple: true
  })

  // Load server-side annotation filenames
  useEffect(() => {
    const loadAnnotations = async () => {
      setLoadingServerAnnotations(true)
      try {
        const res = await apiCall(API_CONFIG.ENDPOINTS.ANNOTATIONS)
        if (!res.ok) throw new Error(`Failed to load annotations: ${res.status}`)
        const data = await res.json()

        if (Array.isArray(data)) {
          // Backward compatibility: API returned a simple string array
          const normalized = data
            .filter((item: any): item is string => typeof item === "string")
            .map((filename: string) => ({ filename }))
          setServerAnnotationFiles(normalized)
        } else if (Array.isArray(data?.files)) {
          const normalized = data.files
            .filter((item: any): item is ServerAnnotationFile =>
              item && typeof item.filename === "string"
            )
            .map((item) => ({
              filename: item.filename,
              size: typeof item.size === "number" ? item.size : undefined,
              modified_time: typeof item.modified_time === "number" ? item.modified_time : undefined,
            }))
          setServerAnnotationFiles(normalized)
        } else {
          setServerAnnotationFiles([])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoadingServerAnnotations(false)
      }
    }
    loadAnnotations()
  }, [])

  const toggleSelectServerAnnotation = (name: string, checked: boolean) => {
    setSelectedServerAnnotations((prev) =>
      checked ? Array.from(new Set([...prev, name])) : prev.filter((n) => n !== name),
    )
  }

  const importSelectedServerAnnotations = async () => {
    if (selectedServerAnnotations.length === 0) return
    setIsValidating(true)
    try {
      const results = await Promise.allSettled(
        selectedServerAnnotations.map(async (name) => {
          const res = await apiCall(`${API_CONFIG.ENDPOINTS.ANNOTATIONS}/${encodeURIComponent(name)}`)
          if (!res.ok) throw new Error(`Download failed (${res.status})`)
          const content = await res.json()
          if (!validateJsonFile(content)) throw new Error("Invalid annotation JSON")

          const size = new Blob([JSON.stringify(content)]).size
          const newFile: UploadedFile = {
            id: Math.random().toString(36).substr(2, 9),
            name,
            size,
            content,
            uploadDate: new Date(),
          }
          setUploadedFiles((prev) => {
            const exists = prev.some((f) => f.name === name)
            return exists ? prev.map((f) => (f.name === name ? newFile : f)) : [...prev, newFile]
          })
        }),
      )

      const ok = results.filter((r) => r.status === "fulfilled").length
      const fail = results.length - ok
      toast({
        title: "Import completed",
        description: `${ok} imported${fail ? `, ${fail} failed` : ""}`,
      })
    } finally {
      setIsValidating(false)
    }
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
    toast({
      title: "File removed",
      description: "The file has been removed from the upload list.",
    })
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '-'
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatModifiedTime = (epochSeconds?: number): string => {
    if (!epochSeconds) return '-'
    try {
      return new Date(epochSeconds * 1000).toLocaleDateString()
    } catch {
      return '-'
    }
  }

  // Testing mode remains available if no server annotation selected
  const testingMode = true
  const canStartTraining = testingMode || uploadedFiles.length > 0 || selectedServerAnnotations.length > 0

  const handleStartTraining = async () => {
    // If server-side annotation files are selected, initiate real training job
    if (selectedServerAnnotations.length > 0) {
      try {
        const payload = {
          annotation_filenames: selectedServerAnnotations,
          epochs: trainingConfig.epochs,
          batch_size: trainingConfig.batchSize,
          img_size: imgSize,
          model_name: (modelName && modelName.trim().length > 0) ? modelName.trim() : `ketilabel_${Date.now()}`,
        }

        const res = await apiCall(API_CONFIG.ENDPOINTS.TRAIN_START, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        if (!res.ok) throw new Error(`Training start failed (${res.status})`)
        const data = await res.json()

        const serverAnnotationFiles = Array.isArray(data.annotation_filenames) && data.annotation_filenames.length > 0
          ? data.annotation_filenames
          : selectedServerAnnotations

        toast({ title: "Training started", description: data.message || "Job created" })

        // Persist job and config
        localStorage.setItem('ketilabel_training_job_id', data.job_id)
        localStorage.setItem('ketilabel_training_data', JSON.stringify({
          files: uploadedFiles,
          config: { ...trainingConfig, imgSize, modelName: payload.model_name },
          startTime: new Date().toISOString(),
          annotationFilenames: serverAnnotationFiles,
          filesCount: data.files_count,
          trainingParameters: data.training_parameters,
        }))
        window.location.href = '/training/monitor'
        return
      } catch (e) {
        toast({ variant: "destructive", title: "Failed to start training", description: e instanceof Error ? e.message : String(e) })
      }
    }

    // Otherwise fall back to testing mode (no server job)
    if (uploadedFiles.length === 0) {
      toast({
        title: "Testing mode",
        description: "Starting training monitor without uploaded data.",
      })
    }

    localStorage.setItem('ketilabel_training_data', JSON.stringify({
      files: uploadedFiles,
      config: { ...trainingConfig, imgSize, modelName },
      startTime: new Date().toISOString()
    }))
    window.location.href = '/training/monitor'
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-sans tracking-tight">KETIlabel</h1>
                  <p className="text-xs text-muted-foreground font-mono">AI-Powered Annotation</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Labeling
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Model Training</h1>
            <p className="text-muted-foreground text-lg">
              Configure your model parameters and select data to start training.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Data Selection */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border-muted/40 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-primary" />
                    Data Selection
                  </CardTitle>
                  <CardDescription>
                    Choose where your training data comes from.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="local" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="local">
                        <Upload className="h-4 w-4 mr-2" />
                        Local Upload
                      </TabsTrigger>
                      <TabsTrigger value="server">
                        <Server className="h-4 w-4 mr-2" />
                        Server Storage
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="local" className="space-y-4">
                      <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
                          isDragActive
                            ? 'border-primary bg-primary/5 scale-[0.99]'
                            : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center space-y-4">
                          <div className="p-4 rounded-full bg-background shadow-sm ring-1 ring-muted">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-lg font-medium mb-1">
                              {isDragActive
                                ? 'Drop your JSON files here'
                                : 'Drag & Drop JSON files'}
                            </p>
                            <p className="text-sm text-muted-foreground mb-4">
                              or click to browse
                            </p>
                            <Button variant="secondary" size="sm" disabled={isValidating}>
                              {isValidating ? 'Validating...' : 'Select Files'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {uploadedFiles.length > 0 && (
                        <div className="mt-6 space-y-3">
                          <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
                            <span>Uploaded Files ({uploadedFiles.length})</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-0 text-destructive hover:text-destructive"
                              onClick={() => setUploadedFiles([])}
                            >
                              Clear All
                            </Button>
                          </div>
                          <ScrollArea className="h-[200px] rounded-md border p-2">
                            <div className="space-y-2">
                              {uploadedFiles.map((file) => (
                                <div
                                  key={file.id}
                                  className="flex items-center justify-between p-2 rounded-lg bg-muted/40 group hover:bg-muted transition-colors"
                                >
                                  <div className="flex items-center space-x-3 overflow-hidden">
                                    <div className="p-1.5 rounded bg-background shadow-sm">
                                      <FileText className="h-4 w-4 text-primary" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm truncate">{file.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatFileSize(file.size)}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeFile(file.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="server" className="space-y-4">
                      {loadingServerAnnotations ? (
                        <div className="flex items-center justify-center py-12 text-muted-foreground">
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                          Loading files...
                        </div>
                      ) : serverAnnotationFiles.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/20">
                          No annotation files found on server.
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-col gap-2 mb-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">
                                Select files to include in training
                              </span>
                              <Badge variant="secondary">
                                {selectedServerAnnotations.length} selected
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <Label
                                htmlFor="select-all-server-annotations"
                                className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none font-normal"
                              >
                                <Checkbox
                                  id="select-all-server-annotations"
                                  checked={
                                    allServerAnnotationsSelected
                                      ? true
                                      : hasPartialServerAnnotationSelection
                                        ? "indeterminate"
                                        : false
                                  }
                                  onCheckedChange={(checked) => handleSelectAllServerAnnotations(checked === true)}
                                  className="h-4 w-4"
                                />
                                <span>Select all</span>
                              </Label>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => handleSelectAllServerAnnotations(false)}
                                disabled={selectedServerAnnotations.length === 0}
                              >
                                Clear selection
                              </Button>
                            </div>
                          </div>
                          <ScrollArea className="h-[400px] rounded-md border">
                            <div className="p-2 space-y-1">
                              {serverAnnotationFiles.map((file) => {
                                const checked = selectedServerAnnotations.includes(file.filename)
                                return (
                                  <div 
                                    key={file.filename} 
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                                      checked 
                                        ? 'bg-primary/5 border-primary/50' 
                                        : 'bg-card border-transparent hover:bg-muted/50'
                                    }`}
                                    onClick={() => toggleSelectServerAnnotation(file.filename, !checked)}
                                  >
                                    <div className="flex items-center space-x-3 overflow-hidden">
                                      <div className={`flex h-5 w-5 items-center justify-center rounded border ${
                                        checked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground'
                                      }`}>
                                        {checked && <CheckCircle className="h-3.5 w-3.5" />}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm truncate">{file.filename}</p>
                                        <div className="flex items-center text-xs text-muted-foreground space-x-2">
                                          <span>{formatFileSize(file.size)}</span>
                                          <span>•</span>
                                          <span>{formatModifiedTime(file.modified_time)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </ScrollArea>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Configuration */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border-muted/40 shadow-sm h-fit sticky top-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    Training Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Model Settings */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="model-name">Model Name</Label>
                      <Input
                        id="model-name"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                        placeholder="e.g., button_detector_v1"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="model-type">Architecture</Label>
                      <Select
                        value={trainingConfig.modelType}
                        onValueChange={(value) => 
                          setTrainingConfig(prev => ({ ...prev, modelType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="segmentation">Segmentation (Default)</SelectItem>
                          <SelectItem value="yolo-v8">YOLO v8</SelectItem>
                          <SelectItem value="mask-rcnn">Mask R-CNN</SelectItem>
                          <SelectItem value="sam2">SAM2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Hyperparameters */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label htmlFor="epochs">Epochs</Label>
                        <span className="text-sm text-muted-foreground font-mono">{trainingConfig.epochs}</span>
                      </div>
                      <Slider
                        id="epochs"
                        min={1}
                        max={500}
                        step={1}
                        value={[trainingConfig.epochs]}
                        onValueChange={(vals) => setTrainingConfig(prev => ({ ...prev, epochs: vals[0] }))}
                        className="py-2"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <Label htmlFor="batch-size">Batch Size</Label>
                        <span className="text-sm text-muted-foreground font-mono">{trainingConfig.batchSize}</span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {[4, 8, 16, 32, 64].map((size) => (
                          <Button
                            key={size}
                            variant={trainingConfig.batchSize === size ? "default" : "outline"}
                            size="sm"
                            onClick={() => setTrainingConfig(prev => ({ ...prev, batchSize: size }))}
                            className="w-full"
                          >
                            {size}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="learning-rate">Learning Rate</Label>
                        <Input
                          id="learning-rate"
                          type="number"
                          value={trainingConfig.learningRate}
                          onChange={(e) => 
                            setTrainingConfig(prev => ({ 
                              ...prev, 
                              learningRate: parseFloat(e.target.value) || 0.001 
                            }))
                          }
                          step={0.0001}
                          min={0.0001}
                          max={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="img-size">Image Size</Label>
                        <Input
                          id="img-size"
                          type="number"
                          value={imgSize}
                          onChange={(e) => setImgSize(parseInt(e.target.value) || 640)}
                          step={32}
                          min={64}
                          max={2048}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4 pt-2">
                  <Button
                    onClick={handleStartTraining}
                    size="lg"
                    className="w-full text-lg shadow-lg shadow-primary/20"
                    disabled={!canStartTraining}
                  >
                    <Play className="mr-2 h-5 w-5" />
                    Start Training
                  </Button>
                  
                  {uploadedFiles.length === 0 && selectedServerAnnotations.length === 0 && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                      <Info className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>
                        No data selected. Clicking start will enter <strong>Testing Mode</strong> (monitor only).
                      </p>
                    </div>
                  )}
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
