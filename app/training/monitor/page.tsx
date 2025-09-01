"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Brain, ArrowLeft, Activity, FileText, Timer, Home } from "lucide-react"

interface TrainingData {
  files: Array<{ id: string; name: string; size: number }>
  config: { modelType: string; epochs: number; learningRate: number; batchSize: number }
  startTime: string
}

export default function TrainingMonitorPage() {
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [data, setData] = useState<TrainingData | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ketilabel_training_data")
      if (raw) {
        setData(JSON.parse(raw))
      }
    } catch {}
  }, [])

  useEffect(() => {
    // Simulated progress and logs for testing
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + Math.random() * 7 + 3)
        if (next >= 100) clearInterval(interval)
        return next
      })
      setLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] Step completed. Loss=${(Math.random() * 0.5 + 0.1).toFixed(3)} Acc=${(Math.random() * 0.2 + 0.7).toFixed(3)}`,
        ...prev,
      ].slice(0, 100))
    }, 1200)
    return () => clearInterval(interval)
  }, [])

  const startedAt = useMemo(() => (data?.startTime ? new Date(data.startTime) : null), [data?.startTime])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Brain className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-sans">Training Monitor</h1>
                <p className="text-xs text-muted-foreground font-mono">Real-time training progress</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Link href="/training">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Training
                </Button>
              </Link>
              <Link href="/">
                <Button variant="secondary">
                  <Home className="mr-2 h-4 w-4" />
                  Labeling
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="mr-2 h-5 w-5 text-primary" />
              Training Progress
            </CardTitle>
            <CardDescription>Simulated progress for testing</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Progress</span>
              <Badge variant={progress >= 100 ? "default" : "secondary"}>{Math.floor(progress)}%</Badge>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>

        {/* Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Dataset & Config
              </CardTitle>
              <CardDescription>Loaded from local storage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span>Files</span>
                  <Badge variant="secondary">{data?.files?.length ?? 0}</Badge>
                </div>
                <Separator className="my-2" />
                {data?.files?.length ? (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {data.files.map((f) => (
                      <div key={f.id} className="flex items-center justify-between p-2 border rounded">
                        <span className="truncate pr-2">{f.name}</span>
                        <Badge variant="outline">{(f.size / 1024).toFixed(1)} KB</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">No files provided (testing mode)</div>
                )}
              </div>

              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span>Model Type</span>
                  <Badge>{data?.config?.modelType ?? "segmentation"}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="p-2 border rounded">Epochs: <strong>{data?.config?.epochs ?? 100}</strong></div>
                  <div className="p-2 border rounded">LR: <strong>{data?.config?.learningRate ?? 0.001}</strong></div>
                  <div className="p-2 border rounded">Batch: <strong>{data?.config?.batchSize ?? 16}</strong></div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Timer className="mr-2 h-5 w-5" />
                Session
              </CardTitle>
              <CardDescription>Timing & controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Started</span>
                <span className="text-muted-foreground">{startedAt ? startedAt.toLocaleString() : "-"}</span>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setProgress(0)
                    setLogs([])
                  }}
                  className="flex-1"
                >
                  Reset
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    localStorage.removeItem("ketilabel_training_data")
                    setData(null)
                  }}
                  className="flex-1"
                >
                  Clear Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
            <CardDescription>Recent training events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto font-mono text-xs whitespace-pre-wrap space-y-1">
              {logs.length ? logs.map((l, i) => <div key={i}>{l}</div>) : <div className="text-muted-foreground">Waiting for logs…</div>}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

