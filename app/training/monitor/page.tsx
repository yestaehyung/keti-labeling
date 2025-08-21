"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Brain,
  ArrowLeft,
  Play,
  Pause,
  Square,
  Download,
  Activity,
  CheckCircle,
  AlertCircle,
  Clock,
  Cpu,
  HardDrive
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

interface TrainingMetrics {
  epoch: number
  trainLoss: number
  trainAccuracy: number
  valLoss: number
  valAccuracy: number
  learningRate: number
}

interface TrainingData {
  files: any[]
  config: any
  startTime: string
}

export default function TrainingMonitorPage() {
  const [trainingData, setTrainingData] = useState<TrainingData | null>(null)
  const [isTraining, setIsTraining] = useState(false)
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [currentEpoch, setCurrentEpoch] = useState(0)
  const [trainingMetrics, setTrainingMetrics] = useState<TrainingMetrics[]>([])
  const [trainingStatus, setTrainingStatus] = useState<"idle" | "training" | "paused" | "completed" | "error">("idle")
  const [logs, setLogs] = useState<string[]>([])
  const { toast } = useToast()

  // Load training data on mount
  useEffect(() => {
    const savedData = localStorage.getItem('ketilabel_training_data')
    if (savedData) {
      try {
        const data = JSON.parse(savedData)
        setTrainingData(data)
        addLog("Training data loaded successfully")
        addLog(`Uploaded files: ${data.files.length}`)
        addLog(`Model: ${data.config.modelType}`)
        addLog(`Epochs: ${data.config.epochs}, Batch Size: ${data.config.batchSize}`)
        addLog(`Learning Rate: ${data.config.learningRate}`)
      } catch (error) {
        toast({
          title: "Failed to load training data",
          description: "Please go back and upload your files again.",
          variant: "destructive"
        })
      }
    } else {
      toast({
        title: "No training data found",
        description: "Please upload training data first.",
        variant: "destructive"
      })
    }
  }, [toast])

  // Simulate training progress
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTraining && trainingStatus === "training" && trainingData) {
      interval = setInterval(() => {
        setCurrentEpoch(prev => {
          const newEpoch = prev + 1
          if (newEpoch >= trainingData.config.epochs) {
            setIsTraining(false)
            setTrainingStatus("completed")
            addLog(`Training completed after ${trainingData.config.epochs} epochs`)
            return trainingData.config.epochs
          }
          
          const progress = (newEpoch / trainingData.config.epochs) * 100
          setTrainingProgress(progress)
          
          // Generate mock metrics
          const trainLoss = 0.8 * Math.exp(-newEpoch * 0.02) + Math.random() * 0.1
          const valLoss = 0.9 * Math.exp(-newEpoch * 0.015) + Math.random() * 0.1
          const trainAccuracy = Math.min(0.95, 0.6 + (newEpoch * 0.005) + Math.random() * 0.02)
          const valAccuracy = Math.min(0.92, 0.55 + (newEpoch * 0.004) + Math.random() * 0.02)
          
          setTrainingMetrics(prev => [...prev, {
            epoch: newEpoch,
            trainLoss,
            trainAccuracy,
            valLoss,
            valAccuracy,
            learningRate: trainingData.config.learningRate * Math.pow(0.95, newEpoch / 10)
          }])
          
          addLog(`Epoch ${newEpoch}/${trainingData.config.epochs} - Loss: ${trainLoss.toFixed(4)} - Acc: ${trainAccuracy.toFixed(4)} - Val_Loss: ${valLoss.toFixed(4)} - Val_Acc: ${valAccuracy.toFixed(4)}`)
          
          return newEpoch
        })
      }, 300) // Simulate fast training for demo
    }
    
    return () => clearInterval(interval)
  }, [isTraining, trainingStatus, trainingData])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-20), `[${timestamp}] ${message}`])
  }

  const startTraining = () => {
    if (!trainingData) {
      toast({
        title: "No training data",
        description: "Please upload training data first.",
        variant: "destructive"
      })
      return
    }

    setIsTraining(true)
    setTrainingStatus("training")
    setCurrentEpoch(0)
    setTrainingProgress(0)
    setTrainingMetrics([])
    addLog("Starting training...")
  }

  const pauseTraining = () => {
    setIsTraining(false)
    setTrainingStatus("paused")
    addLog("Training paused")
  }

  const resumeTraining = () => {
    setIsTraining(true)
    setTrainingStatus("training")
    addLog("Training resumed")
  }

  const stopTraining = () => {
    setIsTraining(false)
    setTrainingStatus("idle")
    setCurrentEpoch(0)
    setTrainingProgress(0)
    addLog("Training stopped")
  }

  const getStatusColor = () => {
    switch (trainingStatus) {
      case "training": return "bg-blue-500"
      case "paused": return "bg-yellow-500"
      case "completed": return "bg-green-500"
      case "error": return "bg-red-500"
      default: return "bg-gray-500"
    }
  }

  const getStatusIcon = () => {
    switch (trainingStatus) {
      case "training": return <Activity className="h-4 w-4" />
      case "completed": return <CheckCircle className="h-4 w-4" />
      case "error": return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  if (!trainingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Training Data</CardTitle>
            <CardDescription>
              Please upload training data to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/training">
              <Button className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Upload
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
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
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold font-sans">KETIlabel</h1>
                  <p className="text-xs text-muted-foreground font-mono">Training Monitor</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className={`${getStatusColor()} text-white`}>
                {getStatusIcon()}
                <span className="ml-2 capitalize">{trainingStatus}</span>
              </Badge>
              <Link href="/training">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Upload
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Training Info & Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Training Info */}
            <Card>
              <CardHeader>
                <CardTitle>Training Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Model Type:</span>
                  <span className="font-medium capitalize">{trainingData.config.modelType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Epochs:</span>
                  <span className="font-medium">{trainingData.config.epochs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Batch Size:</span>
                  <span className="font-medium">{trainingData.config.batchSize}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Learning Rate:</span>
                  <span className="font-medium">{trainingData.config.learningRate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Training Files:</span>
                  <span className="font-medium">{trainingData.files.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Training Controls */}
            <Card>
              <CardHeader>
                <CardTitle>Training Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {trainingStatus === "idle" && (
                  <Button onClick={startTraining} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Start Training
                  </Button>
                )}
                
                {trainingStatus === "training" && (
                  <div className="space-y-2">
                    <Button onClick={pauseTraining} variant="secondary" className="w-full">
                      <Pause className="h-4 w-4 mr-2" />
                      Pause Training
                    </Button>
                    <Button onClick={stopTraining} variant="destructive" className="w-full">
                      <Square className="h-4 w-4 mr-2" />
                      Stop Training
                    </Button>
                  </div>
                )}
                
                {trainingStatus === "paused" && (
                  <div className="space-y-2">
                    <Button onClick={resumeTraining} className="w-full">
                      <Play className="h-4 w-4 mr-2" />
                      Resume Training
                    </Button>
                    <Button onClick={stopTraining} variant="destructive" className="w-full">
                      <Square className="h-4 w-4 mr-2" />
                      Stop Training
                    </Button>
                  </div>
                )}
                
                {trainingStatus === "completed" && (
                  <div className="space-y-2">
                    <Button onClick={startTraining} className="w-full">
                      <Play className="h-4 w-4 mr-2" />
                      Start New Training
                    </Button>
                    <Button variant="secondary" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download Model
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Cpu className="h-5 w-5 mr-2" />
                  System Resources
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground flex items-center">
                      <Cpu className="h-4 w-4 mr-1" />
                      CPU
                    </span>
                    <span className="text-sm font-medium">
                      {isTraining ? `${(75 + Math.random() * 20).toFixed(1)}%` : "15.2%"}
                    </span>
                  </div>
                  <Progress value={isTraining ? 75 + Math.random() * 20 : 15} className="h-2" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground flex items-center">
                      <Brain className="h-4 w-4 mr-1" />
                      GPU
                    </span>
                    <span className="text-sm font-medium">
                      {isTraining ? `${(85 + Math.random() * 10).toFixed(1)}%` : "0%"}
                    </span>
                  </div>
                  <Progress value={isTraining ? 85 + Math.random() * 10 : 0} className="h-2" />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground flex items-center">
                      <HardDrive className="h-4 w-4 mr-1" />
                      Memory
                    </span>
                    <span className="text-sm font-medium">
                      {isTraining ? `${(60 + Math.random() * 25).toFixed(1)}%` : "25.3%"}
                    </span>
                  </div>
                  <Progress value={isTraining ? 60 + Math.random() * 25 : 25} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Training Monitor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Training Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Training Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Epoch {currentEpoch} / {trainingData.config.epochs}</span>
                    <span>{trainingProgress.toFixed(1)}%</span>
                  </div>
                  <Progress value={trainingProgress} className="h-3" />
                </div>
                
                {trainingMetrics.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Train Loss</span>
                      <p className="font-semibold text-lg">
                        {trainingMetrics[trainingMetrics.length - 1]?.trainLoss.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Train Accuracy</span>
                      <p className="font-semibold text-lg">
                        {(trainingMetrics[trainingMetrics.length - 1]?.trainAccuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Val Loss</span>
                      <p className="font-semibold text-lg">
                        {trainingMetrics[trainingMetrics.length - 1]?.valLoss.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Val Accuracy</span>
                      <p className="font-semibold text-lg">
                        {(trainingMetrics[trainingMetrics.length - 1]?.valAccuracy * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Training Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Training Logs</CardTitle>
                <CardDescription>Real-time training output</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-black rounded p-4 h-64 overflow-y-auto font-mono text-sm">
                  {logs.length === 0 ? (
                    <p className="text-green-400">Waiting for training to start...</p>
                  ) : (
                    logs.map((log, idx) => (
                      <div key={idx} className="text-green-400 mb-1">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}