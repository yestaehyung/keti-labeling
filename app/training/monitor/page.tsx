"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Brain, ArrowLeft, Activity, FileText, Timer, Home, RefreshCw, Trash2, BarChart3 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { apiCall, API_CONFIG } from "@/lib/api-config"

interface TrainingData {
  files: Array<{ id: string; name: string; size: number }>
  config: { modelType: string; epochs: number; learningRate: number; batchSize: number; imgSize?: number; modelName?: string }
  startTime: string
  annotationFilename?: string // legacy support
  annotationFilenames?: string[]
  filesCount?: number
  trainingParameters?: { epochs: number; batch_size: number; img_size: number }
}

interface TrainingStatus {
  job_id: string
  status: "preparing" | "training" | "completed" | "failed" | "cancelled"
  progress: number
  message?: string
  created_at?: string
  completed_at?: string | null
  annotation_filename?: string // legacy support
  annotation_filenames?: string[]
  model_name?: string
  training_parameters?: { epochs: number; batch_size: number; img_size: number }
  processed_images_count?: number
  metrics?: any
  error?: any
}

interface EvaluationSummary {
  overall_performance?: string
  detection_accuracy?: string
  precision_score?: string
  recall_score?: string
  [key: string]: string | undefined
}

interface EvaluationMetricDetail {
  value?: number
  percentage?: string
  grade?: string
  description?: string
  [key: string]: string | number | undefined
}

interface ModelEvaluation {
  model_id: string
  model_name: string
  evaluation_summary?: EvaluationSummary
  detailed_metrics?: Record<string, EvaluationMetricDetail>
  training_info?: {
    annotation_files?: string[]
    training_parameters?: {
      epochs?: number
      batch_size?: number
      img_size?: number
    }
    processed_images?: number
  }
  created_at?: string
}

export default function TrainingMonitorPage() {
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [data, setData] = useState<TrainingData | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<TrainingStatus | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const [evaluation, setEvaluation] = useState<ModelEvaluation | null>(null)
  const [isEvaluationLoading, setIsEvaluationLoading] = useState(false)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)

  // Load stored training data and job id
  useEffect(() => {
    try {
      const raw = localStorage.getItem("ketilabel_training_data")
      if (raw) setData(JSON.parse(raw))
      const storedJobId = localStorage.getItem("ketilabel_training_job_id")
      if (storedJobId) setJobId(storedJobId)
    } catch {}
  }, [])

  // Poll job status if jobId exists; else simulate
  useEffect(() => {
    if (!jobId) {
      // Simulated progress and logs when no server job
      const interval = setInterval(() => {
        setProgress((p) => Math.min(100, p + Math.random() * 7 + 3))
        setLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] Step completed. Loss=${(Math.random() * 0.5 + 0.1).toFixed(3)} Acc=${(Math.random() * 0.2 + 0.7).toFixed(3)}`,
          ...prev,
        ].slice(0, 100))
      }, 1200)
      return () => clearInterval(interval)
    }

    const poll = async () => {
      try {
        const res = await apiCall(`${API_CONFIG.ENDPOINTS.TRAINING_STATUS}/${encodeURIComponent(jobId)}`)
        if (!res.ok) throw new Error(`Status ${res.status}`)
        const s: TrainingStatus = await res.json()
        setStatus(s)
        setProgress(s.progress ?? 0)
        setLogs((prev) => {
          const entries: string[] = []
          const timestamp = new Date().toLocaleTimeString()

          if (s.message) {
            entries.push(`[${timestamp}] ${s.message}`)
          }

          if (s.metrics && typeof s.metrics === "object") {
            const metricsEntries = Object.entries(s.metrics)
              .map(([key, value]) => `${key}: ${typeof value === "number" ? value.toFixed(4) : value}`)
            if (metricsEntries.length > 0) {
              entries.push(`[${timestamp}] Metrics → ${metricsEntries.join(", ")}`)
            }
          }

          if (typeof s.error === "string" && s.error.trim().length > 0) {
            entries.push(`[${timestamp}] ⚠️ Error → ${s.error.trim()}`)
          }

          if (s.annotation_filenames && s.annotation_filenames.length > 0) {
            entries.push(`[${timestamp}] Files → ${s.annotation_filenames.join(", ")}`)
          }

          if (typeof s.processed_images_count === "number") {
            entries.push(`[${timestamp}] Processed Images → ${s.processed_images_count}`)
          }

          if (entries.length === 0) return prev.slice(0, 300)
          return [...entries, ...prev].slice(0, 300)
        })
        if (s.status === "completed" || s.status === "failed" || s.status === "cancelled") {
          if (pollingRef.current) clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } catch (e) {
        const timestamp = new Date().toLocaleTimeString()
        setLogs((prev) => [`[${timestamp}] Failed to fetch status`, ...prev].slice(0, 300))
      }
    }

    poll()
    pollingRef.current = setInterval(poll, 5000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [jobId])

  // Load jobs list
  const refreshJobs = useCallback(async () => {
    try {
      const res = await apiCall(API_CONFIG.ENDPOINTS.TRAINING_JOBS)
      if (!res.ok) throw new Error(`Jobs ${res.status}`)
      const body = await res.json()
      setJobs(Array.isArray(body.jobs) ? body.jobs : [])
    } catch {}
  }, [])

  useEffect(() => {
    refreshJobs()
  }, [refreshJobs])

  const deleteJob = async (id: string) => {
    try {
      const res = await apiCall(`${API_CONFIG.ENDPOINTS.TRAINING_JOBS}/${encodeURIComponent(id)}`, { method: "DELETE" })
      if (res.ok) {
        if (jobId === id) {
          localStorage.removeItem("ketilabel_training_job_id")
          setJobId(null)
          setStatus(null)
          setProgress(0)
        }
        refreshJobs()
      }
    } catch {}
  }

  const startedAt = useMemo(() => (data?.startTime ? new Date(data.startTime) : status?.created_at ? new Date(status.created_at) : null), [data?.startTime, status?.created_at])

  const annotationSummary = useMemo(() => {
    const fromData = data?.annotationFilenames?.length
      ? data.annotationFilenames.join(', ')
      : data?.annotationFilename

    const fromStatus = status?.annotation_filenames?.length
      ? status.annotation_filenames.join(', ')
      : status?.annotation_filename

    return fromData || fromStatus || "Local/Test session"
  }, [data?.annotationFilenames, data?.annotationFilename, status?.annotation_filenames, status?.annotation_filename])

  const fetchEvaluation = useCallback(async () => {
    if (!jobId) return
    setIsEvaluationLoading(true)
    setEvaluationError(null)

    try {
      const response = await apiCall(`/api/models/${encodeURIComponent(jobId)}/evaluation`)
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `Evaluation request failed (${response.status})`)
      }
      const evaluationData: ModelEvaluation = await response.json()
      setEvaluation(evaluationData)
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : "Unknown evaluation error")
    } finally {
      setIsEvaluationLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    if (!jobId) return
    if (status?.status !== "completed") return
    if (isEvaluationLoading) return
    if (evaluation) return
    fetchEvaluation()
  }, [jobId, status?.status, evaluation, isEvaluationLoading, fetchEvaluation])

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
                <p className="text-xs text-muted-foreground font-mono">{jobId ? `Job: ${jobId}` : "Testing mode"}</p>
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
            <CardDescription>{jobId ? (status?.status ?? "-") : "Simulated for testing"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Progress</span>
              <Badge variant={progress >= 100 ? "default" : "secondary"}>{Math.floor(progress)}%</Badge>
            </div>
            <Progress value={progress} />
            {status?.metrics && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                {Object.entries(status.metrics).map(([k, v]) => (
                  <div key={k} className="p-2 border rounded">{k}: <strong>{String(v)}</strong></div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary and Jobs */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-2 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Dataset & Config
              </CardTitle>
              <CardDescription>{annotationSummary}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm">
                <div className="flex items-center justify-between">
                  <span>Files</span>
                  <Badge variant="secondary">{data?.files?.length ?? data?.filesCount ?? 0}</Badge>
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
                  <div className="text-muted-foreground">No local files (server job or testing)</div>
                )}
              </div>

              <div className="text-sm">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  <div className="p-2 border rounded">Epochs: <strong>{status?.training_parameters?.epochs ?? data?.trainingParameters?.epochs ?? data?.config?.epochs ?? 100}</strong></div>
                  <div className="p-2 border rounded">LR: <strong>{data?.config?.learningRate ?? 0.001}</strong></div>
                  <div className="p-2 border rounded">Batch: <strong>{status?.training_parameters?.batch_size ?? data?.trainingParameters?.batch_size ?? data?.config?.batchSize ?? 16}</strong></div>
                  <div className="p-2 border rounded">Img: <strong>{status?.training_parameters?.img_size ?? data?.trainingParameters?.img_size ?? data?.config?.imgSize ?? 640}</strong></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {(status?.status === "completed" || evaluation || evaluationError) && (
            <Card className="lg:col-span-3 xl:col-span-3">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5 text-primary" />
                  Model Evaluation
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchEvaluation}
                  disabled={!jobId || isEvaluationLoading}
                  className="flex items-center space-x-1"
                >
                  <RefreshCw className={`h-4 w-4 ${isEvaluationLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </Button>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {evaluationError && (
                  <Alert variant="destructive">
                    <AlertDescription>평가 정보를 불러오지 못했습니다: {evaluationError}</AlertDescription>
                  </Alert>
                )}

                {isEvaluationLoading && !evaluation ? (
                  <div className="text-muted-foreground">평가 정보를 불러오는 중입니다...</div>
                ) : evaluation ? (
                  <div className="space-y-4">
                    {evaluation.evaluation_summary && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-base">요약</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {Object.entries(evaluation.evaluation_summary).map(([key, value]) => (
                            <div key={key} className="p-3 border rounded-md">
                              <div className="text-xs uppercase text-muted-foreground">{key.replace(/_/g, ' ')}</div>
                              <div className="text-sm font-medium">{value ?? '-'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {evaluation.detailed_metrics && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-base">세부 지표</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.entries(evaluation.detailed_metrics).map(([key, metric]) => (
                            <div key={key} className="border rounded-md p-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{key.toUpperCase()}</span>
                                {metric.percentage && <Badge variant="secondary">{metric.percentage}</Badge>}
                              </div>
                              {typeof metric.value === "number" && (
                                <div className="text-xs text-muted-foreground">Value: {metric.value.toFixed(4)}</div>
                              )}
                              {metric.grade && (
                                <div className="text-xs text-muted-foreground">Grade: {metric.grade}</div>
                              )}
                              {metric.description && (
                                <div className="text-xs text-muted-foreground">{metric.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {evaluation.training_info && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-base">학습 정보</h4>
                        {evaluation.training_info.annotation_files && evaluation.training_info.annotation_files.length > 0 && (
                          <div>
                            <span className="text-xs text-muted-foreground">Annotation files</span>
                            <div className="text-sm">{evaluation.training_info.annotation_files.join(', ')}</div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 border rounded">Epochs: <strong>{evaluation.training_info.training_parameters?.epochs ?? '-'}</strong></div>
                          <div className="p-2 border rounded">Batch: <strong>{evaluation.training_info.training_parameters?.batch_size ?? '-'}</strong></div>
                          <div className="p-2 border rounded">Img: <strong>{evaluation.training_info.training_parameters?.img_size ?? '-'}</strong></div>
                          <div className="p-2 border rounded">Processed: <strong>{evaluation.training_info.processed_images ?? '-'}</strong></div>
                        </div>
                      </div>
                    )}

                    {evaluation.created_at && (
                      <div className="text-xs text-muted-foreground">평가 생성: {new Date(evaluation.created_at).toLocaleString()}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-muted-foreground">평가 정보가 아직 준비되지 않았습니다.</div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="lg:col-span-5">
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
                <Button variant="outline" onClick={() => { setLogs([]); }} className="flex-1">
                  Clear Logs
                </Button>
                {jobId && (
                  <Button variant="secondary" onClick={() => deleteJob(jobId)} className="flex-1">
                    <Trash2 className="mr-2 h-4 w-4" /> Cancel/Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">Jobs <Button variant="ghost" size="sm" onClick={refreshJobs}><RefreshCw className="h-4 w-4" /></Button></CardTitle>
            <CardDescription>Pick a job to monitor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {jobs.length === 0 ? (
                <div className="text-sm text-muted-foreground">No jobs</div>
              ) : (
                jobs.map((j) => (
                  <div key={j.job_id} className={`p-2 border rounded flex items-center justify-between ${jobId === j.job_id ? 'bg-primary/5 border-primary' : ''}`}>
                    <div className="text-sm truncate pr-2">
                      <div className="font-medium">{j.model_name || j.job_id}</div>
                      <div className="text-xs text-muted-foreground">
                        {(Array.isArray(j.annotation_filenames) && j.annotation_filenames.length
                          ? j.annotation_filenames.join(', ')
                          : j.annotation_filename) || '-'}
                        {' '}• {j.status} • {j.progress}%
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => { localStorage.setItem('ketilabel_training_job_id', j.job_id); setJobId(j.job_id) }}>Monitor</Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteJob(j.job_id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

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
