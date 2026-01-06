"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertTriangle, Clock, RefreshCw, Settings, Zap, Play, Pause } from "lucide-react"
import Link from "next/link"
import MainHeader from "@/components/main-header"

interface PipelineComponent {
  id: string
  name: string
  status: "active" | "idle" | "error"
  description: string
  lastRun: string
  details?: any
}

export default function PipelineStatusPage() {
  const [components, setComponents] = useState<PipelineComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    loadPipelineStatus()
    if (autoRefresh) {
      const interval = setInterval(loadPipelineStatus, 5000)  // 5초마다 갱신
      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const loadPipelineStatus = async () => {
    try {
      setLoading(true)
      // TODO: 실제 API 연결
      const mockComponents: PipelineComponent[] = [
        {
          id: "coldstart",
          name: "Cold-start Labeling",
          status: "active",
          description: "LLM (Gemini) + SAM2 통합 파이프라인 활성화. 이미지 업로드 시 자동 객체 탐지 및 세그멘테이션.",
          lastRun: "2026-01-05T09:15:00",
          details: {
            method: "gemini-2.5-flash + sam2-hiera-t",
            prompt_template: "custom + spatial_reasoning",
            confidence_threshold: 0.3
          }
        },
        {
          id: "distillation",
          name: "Knowledge Distillation",
          status: "idle",
          description: "YOLOv8 학습 및 mAP@0.7 검증. 최신 모델 v1.0 (mAP=0.781) 프로덕션 배포 완료.",
          lastRun: "2026-01-05T11:00:00",
          details: {
            current_model: "hilips_v1.0",
            map70: 0.781,
            version: 3,
            production: true
          }
        },
        {
          id: "refinement",
          name: "Iterative Refinement",
          status: "active",
          description: "Active Learning service 활성화. Confidence < 0.8인 객체 자동으로 'needs-review' 큐 추가. 24시간마다 auto-annotate 실행.",
          lastRun: "2026-01-05T13:30:00",
          details: {
            confidence_threshold: 0.8,
            review_queue_size: 12,
            auto_labeled_ratio: 0.73
          }
        }
      ]
      setComponents(mockComponents)
      setLoading(false)
    } catch (error) {
      console.error("Failed to load pipeline status:", error)
      setLoading(false)
    }
  }

  const getStatusBadge = (status: PipelineComponent["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300 animate-pulse">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case "idle":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <Clock className="w-3 h-3 mr-1" />
            Idle
          </Badge>
        )
      case "error":
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        )
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const getStatusProgress = (component: PipelineComponent) => {
    if (component.status === "active") return 100
    if (component.status === "idle") return 50
    return 0
  }

  return (
    <div className="min-h-screen bg-background">
      <MainHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">HILIPS Pipeline Status</h1>
            <p className="text-sm text-muted-foreground">
              논문 3단계 방법론의 실시간 상태 모니터링 및 관리
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="gap-2"
            >
              {autoRefresh ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {autoRefresh ? "Auto Refresh" : "Paused"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadPipelineStatus}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Pipeline Overview */}
        {loading ? (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading pipeline status...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stage 1: Cold-start Labeling */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-md">
                      <Zap className="h-5 w-5 text-blue-600" />
                    </div>
                    <span>Phase 1: Cold-start Labeling</span>
                  </CardTitle>
                  {getStatusBadge(components[0]?.status)}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4 text-base">
                  멀티모달 LLM (Gemini-2.5)과 SAM2를 결합한 초기 레이블링 시스템
                </CardDescription>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">LLM Model</div>
                      <div className="font-semibold text-sm">Gemini-2.5-flash</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">SAM2 Model</div>
                      <div className="font-semibold text-sm">SAM2-Hiera-T</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Confidence Threshold</div>
                      <div className="font-semibold text-sm">≥ 0.3</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Last Run: {new Date(components[0]?.lastRun).toLocaleString('ko-KR')}
                    </span>
                    <Link href="/">
                      <Button variant="outline" size="sm">
                        Open Labeling Workspace
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stage 2: Knowledge Distillation */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-md">
                      <Settings className="h-5 w-5 text-purple-600" />
                    </div>
                    <span>Phase 2: Knowledge Distillation</span>
                  </CardTitle>
                  {getStatusBadge(components[1]?.status)}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4 text-base">
                  YOLOv8 기반 경량 모델 학습 및 mAP@0.7 검증 시스템
                </CardDescription>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Current Model</div>
                      <div className="font-semibold text-sm">{components[1]?.details?.current_model || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">mAP@0.7</div>
                      <div className={`font-semibold text-sm ${components[1]?.details?.map70 >= 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {components[1]?.details?.map70?.toFixed(4) || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Status</div>
                      <div className="font-semibold text-sm">
                        {components[1]?.details?.production ? (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800">Production</Badge>
                        ) : (
                          <Badge variant="secondary">Training</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Last Run: {new Date(components[1]?.lastRun).toLocaleString('ko-KR')}
                    </span>
                    <Link href="/training">
                      <Button variant="outline" size="sm">
                        Open Distillation Console
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stage 3: Iterative Refinement */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-md">
                      <RefreshCw className="h-5 w-5 text-green-600" />
                    </div>
                    <span>Phase 3: Iterative Refinement</span>
                  </CardTitle>
                  {getStatusBadge(components[2]?.status)}
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-4 text-base">
                  Active Learning 기반 자동화 워크플로우 및 confidence 기반 레이블링 분류
                </CardDescription>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Confidence Threshold</div>
                      <div className="font-semibold text-sm">&lt; 0.8 (Review)</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Auto-Label</div>
                      <div className="font-semibold text-sm">≥ 0.8</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Review Queue</div>
                      <div className="font-semibold text-sm text-amber-600">
                        {components[2]?.details?.review_queue_size || 0} images
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Last Run: {new Date(components[2]?.lastRun).toLocaleString('ko-KR')}
                    </span>
                    <Link href="/training/monitor">
                      <Button variant="outline" size="sm">
                        View Active Learning
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pipeline Legend */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <h3 className="font-semibold text-sm mb-3">Status Legend</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="flex items-start gap-2">
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                  <span className="text-muted-foreground">현재 실행 중인 파이프라인</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                    <Clock className="w-3 h-3 mr-1" />
                    Idle
                  </Badge>
                  <span className="text-muted-foreground">대기 중 또는 정상 중지된 상태</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-red-100 text-red-800 border-red-300">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Error
                  </Badge>
                  <span className="text-muted-foreground">오류 발생 상태, 수동 개입 필요</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
