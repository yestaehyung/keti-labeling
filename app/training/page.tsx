"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Brain,
  Upload,
  ArrowLeft,
  FileText,
  Trash2,
  CheckCircle,
  AlertCircle,
  Play
} from "lucide-react"
import Link from "next/link"
import { useDropzone } from "react-dropzone"
import { useToast } from "@/hooks/use-toast"

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

export default function TrainingPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>({
    modelType: "segmentation",
    epochs: 100,
    learningRate: 0.001,
    batchSize: 16
  })
  const [isValidating, setIsValidating] = useState(false)
  const { toast } = useToast()

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

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
    toast({
      title: "File removed",
      description: "The file has been removed from the upload list.",
    })
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Testing mode: allow starting without uploaded JSON files
  const testingMode = true
  const canStartTraining = testingMode || uploadedFiles.length > 0

  const handleStartTraining = () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "Testing mode",
        description: "Starting training monitor without uploaded data.",
      })
    }

    // Store training data and config in localStorage
    localStorage.setItem('ketilabel_training_data', JSON.stringify({
      files: uploadedFiles,
      config: trainingConfig,
      startTime: new Date().toISOString()
    }))

    // Navigate to training monitor
    window.location.href = '/training/monitor'
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
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-sans">KETIlabel</h1>
                  <p className="text-xs text-muted-foreground font-mono">AI-Powered Annotation</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Labeling
                </Button>
              </Link>
              <Button className="font-medium">
                <Upload className="mr-2 h-4 w-4" />
                Upload Images
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Model Training</h1>
            <p className="text-muted-foreground">
              Upload your labeled JSON files to start training your segmentation model.
            </p>
          </div>

          {/* Upload Section */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Upload Labeled Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 rounded-full bg-muted">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-medium mb-1">
                      {isDragActive
                        ? 'Drop your JSON files here'
                        : 'Drag & Drop your JSON files here'}
                    </p>
                    <p className="text-muted-foreground mb-4">or</p>
                    <Button variant="secondary" disabled={isValidating}>
                      {isValidating ? 'Validating...' : 'Browse Files'}
                    </Button>
                    <p className="text-sm text-muted-foreground mt-2">
                      Supports: JSON
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Uploaded Files</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded bg-green-100 dark:bg-green-900/20">
                          <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Training Configuration */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Training Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="model-type">Model Type</Label>
                  <Select
                    value={trainingConfig.modelType}
                    onValueChange={(value) => 
                      setTrainingConfig(prev => ({ ...prev, modelType: value }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="segmentation">Segmentation</SelectItem>
                      <SelectItem value="yolo-v8">YOLO v8</SelectItem>
                      <SelectItem value="mask-rcnn">Mask R-CNN</SelectItem>
                      <SelectItem value="sam2">SAM2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="epochs">Number of Epochs</Label>
                  <Input
                    id="epochs"
                    type="number"
                    value={trainingConfig.epochs}
                    onChange={(e) => 
                      setTrainingConfig(prev => ({ 
                        ...prev, 
                        epochs: parseInt(e.target.value) || 100 
                      }))
                    }
                    min={1}
                    max={1000}
                    className="mt-2"
                  />
                </div>

                <div>
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
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="batch-size">Batch Size</Label>
                  <Select
                    value={trainingConfig.batchSize.toString()}
                    onValueChange={(value) => 
                      setTrainingConfig(prev => ({ 
                        ...prev, 
                        batchSize: parseInt(value) 
                      }))
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="8">8</SelectItem>
                      <SelectItem value="16">16</SelectItem>
                      <SelectItem value="32">32</SelectItem>
                      <SelectItem value="64">64</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Start Training Button */}
          <div className="text-center">
            <Button
              onClick={handleStartTraining}
              size="lg"
              className="px-8"
            >
              <Play className="mr-2 h-5 w-5" />
              Start Training
            </Button>
            {uploadedFiles.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                Testing mode enabled: You can start without uploads
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
