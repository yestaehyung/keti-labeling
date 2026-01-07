"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Activity, FileText, Timer, RefreshCw, Trash2, BarChart3, ChevronDown, Database } from "lucide-react"
import MainHeader from "@/components/main-header"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { apiCall, API_CONFIG } from "@/lib/api-config"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import PostTrainingAutoLabelDialog from "@/components/post-training-auto-label-dialog"

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

interface PerClassMetric {
  class_id: number
  ap50: EvaluationMetricDetail
  ap50_95: EvaluationMetricDetail
  precision: EvaluationMetricDetail
  recall: EvaluationMetricDetail
}

interface ModelEvaluation {
  model_id: string
  model_name: string
  evaluation_summary?: EvaluationSummary
  detailed_metrics?: Record<string, EvaluationMetricDetail>
  per_class_evaluation?: Record<string, PerClassMetric>
  class_names?: string[]
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
  const [data, setData] = useState<TrainingData | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<TrainingStatus | null>(null)
  const [jobs, setJobs] = useState<any[]>([])
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const [evaluation, setEvaluation] = useState<ModelEvaluation | null>(null)
  const [isEvaluationLoading, setIsEvaluationLoading] = useState(false)
  const [evaluationError, setEvaluationError] = useState<string | null>(null)
  const [isDatasetFilesOpen, setIsDatasetFilesOpen] = useState(false)
  const [isTrainingFilesOpen, setIsTrainingFilesOpen] = useState(false)
  const [showAutoLabelDialog, setShowAutoLabelDialog] = useState(false)
  const autoLabelShownRef = useRef<Set<string>>(new Set())

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
      // Simulated progress when no server job
      const interval = setInterval(() => {
        setProgress((p) => Math.min(100, p + Math.random() * 7 + 3))
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
        if (s.status === "completed" || s.status === "failed" || s.status === "cancelled") {
          if (pollingRef.current) clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      } catch (e) {
        console.error("Failed to fetch training status", e)
      }
    }

    poll()
    pollingRef.current = setInterval(poll, 5000)
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [jobId])

  useEffect(() => {
    if (status?.status === "completed" && jobId && !autoLabelShownRef.current.has(jobId)) {
      autoLabelShownRef.current.add(jobId)
      setShowAutoLabelDialog(true)
    }
  }, [status?.status, jobId])

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
      const targetJob = jobs.find(j => j.job_id === id)
      const currentStatus = targetJob?.status || status?.status
      
      if (currentStatus === "preparing" || currentStatus === "training") {
        const stopRes = await apiCall(`${API_CONFIG.ENDPOINTS.TRAINING_JOBS}/${encodeURIComponent(id)}/stop`, { method: "POST" })
        if (!stopRes.ok) {
          console.error("Failed to stop job:", await stopRes.text())
        }
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
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

  const annotationFilenames = useMemo(() => {
    return data?.annotationFilenames || status?.annotation_filenames || []
  }, [data?.annotationFilenames, status?.annotation_filenames])

  const annotationFileCount = useMemo(() => {
    return annotationFilenames.length || (data?.annotationFilename ? 1 : 0) || (status?.annotation_filename ? 1 : 0)
  }, [annotationFilenames, data?.annotationFilename, status?.annotation_filename])

  const annotationSummary = useMemo(() => {
    if (annotationFileCount > 0) {
      return `${annotationFileCount}개 파일`
    }
    return "Local/Test session"
  }, [annotationFileCount])

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
      <MainHeader />

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
              <CardDescription>
                {annotationFileCount > 0 ? (
                  <Collapsible open={isDatasetFilesOpen} onOpenChange={setIsDatasetFilesOpen}>
                    <CollapsibleTrigger className="flex items-center gap-1 hover:text-foreground transition-colors">
                      <span>{annotationSummary}</span>
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDatasetFilesOpen ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 max-h-32 overflow-y-auto text-xs text-muted-foreground bg-muted/50 rounded p-2">
                        {annotationFilenames.length > 0 
                          ? annotationFilenames.join(', ')
                          : data?.annotationFilename || status?.annotation_filename || '-'}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  annotationSummary
                )}
              </CardDescription>
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

                    {evaluation.per_class_evaluation && Object.keys(evaluation.per_class_evaluation).length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-base">클래스별 성능</h4>
                        <div className="border rounded-md overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left p-2 font-medium">Class</th>
                                  <th className="text-center p-2 font-medium">AP50</th>
                                  <th className="text-center p-2 font-medium">AP50-95</th>
                                  <th className="text-center p-2 font-medium">Precision</th>
                                  <th className="text-center p-2 font-medium">Recall</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(evaluation.per_class_evaluation).map(([className, metrics]) => (
                                  <tr key={className} className="border-t">
                                    <td className="p-2 font-medium">{className}</td>
                                    <td className="text-center p-2">
                                      <Badge variant={metrics.ap50.grade === "Excellent" ? "default" : metrics.ap50.grade === "Good" ? "secondary" : "outline"}>
                                        {metrics.ap50.percentage}
                                      </Badge>
                                    </td>
                                    <td className="text-center p-2">
                                      <Badge variant={metrics.ap50_95.grade === "Excellent" ? "default" : metrics.ap50_95.grade === "Good" ? "secondary" : "outline"}>
                                        {metrics.ap50_95.percentage}
                                      </Badge>
                                    </td>
                                    <td className="text-center p-2">
                                      <Badge variant={metrics.precision.grade === "Excellent" ? "default" : metrics.precision.grade === "Good" ? "secondary" : "outline"}>
                                        {metrics.precision.percentage}
                                      </Badge>
                                    </td>
                                    <td className="text-center p-2">
                                      <Badge variant={metrics.recall.grade === "Excellent" ? "default" : metrics.recall.grade === "Good" ? "secondary" : "outline"}>
                                        {metrics.recall.percentage}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    {evaluation.training_info && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-base">학습 정보</h4>
                        {evaluation.training_info.annotation_files && evaluation.training_info.annotation_files.length > 0 && (
                          <Collapsible open={isTrainingFilesOpen} onOpenChange={setIsTrainingFilesOpen}>
                            <CollapsibleTrigger className="flex items-center gap-1 hover:text-foreground transition-colors">
                              <span className="text-xs text-muted-foreground">Annotation files</span>
                              <Badge variant="secondary" className="ml-1">{evaluation.training_info.annotation_files.length}개</Badge>
                              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isTrainingFilesOpen ? 'rotate-180' : ''}`} />
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-1 max-h-32 overflow-y-auto text-xs text-muted-foreground bg-muted/50 rounded p-2">
                                {evaluation.training_info.annotation_files.join(', ')}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
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
                {status?.status === "completed" && (
                  <Link href="/models" className="flex-1">
                    <Button variant="default" className="w-full">
                      <Database className="mr-2 h-4 w-4" /> View in Model Registry
                    </Button>
                  </Link>
                )}
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
                        {Array.isArray(j.annotation_filenames) && j.annotation_filenames.length
                          ? `${j.annotation_filenames.length}개 파일`
                          : j.annotation_filename || '-'}
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


      </main>

      <PostTrainingAutoLabelDialog
        open={showAutoLabelDialog}
        onOpenChange={setShowAutoLabelDialog}
        modelId={jobId || ""}
        modelName={status?.model_name || jobId || "New Model"}
        onComplete={() => {
          refreshJobs()
        }}
      />
    </div>
  )
}
