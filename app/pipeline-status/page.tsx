"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  CheckCircle, AlertTriangle, Clock, RefreshCw, Settings, Zap, Play, Pause,
  ArrowRight, TrendingUp, Users, Bot, Brain, RotateCcw
} from "lucide-react"
import Link from "next/link"
import MainHeader from "@/components/main-header"
import { useWorkflowStatus } from "@/hooks/use-workflow-status"

const PHASE_CONFIGS = {
  1: {
    name: "Cold-start Labeling",
    description: "LLM (Gemini) + SAM2를 사용한 초기 레이블링",
    icon: Zap,
    color: "blue",
    route: "/",
  },
  2: {
    name: "Knowledge Distillation", 
    description: "YOLOv8 모델 학습 및 mAP@0.7 검증",
    icon: Brain,
    color: "purple",
    route: "/training",
  },
  3: {
    name: "Iterative Refinement",
    description: "자동 레이블링 + 사람 검토 → 재학습 순환",
    icon: RotateCcw,
    color: "green",
    route: "/?filter=needs-review",
  },
}

export default function PipelineStatusPage() {
  const { 
    summary, 
    scheduler, 
    loading, 
    error,
    refresh,
    triggerAutoAnnotate,
    triggerDistillation,
  } = useWorkflowStatus(5000)

  const [triggering, setTriggering] = useState<string | null>(null)

  const handleTriggerAutoAnnotate = async () => {
    setTriggering("auto")
    await triggerAutoAnnotate()
    setTriggering(null)
  }

  const handleTriggerDistillation = async () => {
    setTriggering("distill")
    await triggerDistillation()
    setTriggering(null)
  }

  const getPhaseStatus = (phase: number) => {
    if (!summary) return "idle"
    if (summary.current_phase === phase) return "active"
    if (summary.current_phase > phase) return "completed"
    return "idle"
  }

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300 animate-pulse">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Done
          </Badge>
        )
      case "idle":
        return (
          <Badge className="bg-gray-100 text-gray-600 border-gray-300">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        )
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const renderPhaseCard = (phaseNum: 1 | 2 | 3) => {
    const config = PHASE_CONFIGS[phaseNum]
    const status = getPhaseStatus(phaseNum)
    const Icon = config.icon
    const isCurrentPhase = summary?.current_phase === phaseNum

    const borderColorClass = {
      blue: "border-l-blue-500",
      purple: "border-l-purple-500",
      green: "border-l-green-500",
    }[config.color]

    const bgColorClass = {
      blue: "bg-blue-100",
      purple: "bg-purple-100",
      green: "bg-green-100",
    }[config.color]

    const iconColorClass = {
      blue: "text-blue-600",
      purple: "text-purple-600",
      green: "text-green-600",
    }[config.color]

    return (
      <Card className={`border-l-4 ${borderColorClass} ${isCurrentPhase ? 'ring-2 ring-primary/20' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3">
              <div className={`${bgColorClass} p-2 rounded-md`}>
                <Icon className={`h-5 w-5 ${iconColorClass}`} />
              </div>
              <span>Phase {phaseNum}: {config.name}</span>
            </CardTitle>
            {renderStatusBadge(status)}
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4 text-base">
            {config.description}
          </CardDescription>
          
          {phaseNum === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">LLM Model</div>
                <div className="font-semibold text-sm">Gemini-2.5-flash</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">SAM2 Model</div>
                <div className="font-semibold text-sm">SAM2-Hiera-T</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                <div className="font-semibold text-sm">≥ 0.3</div>
              </div>
            </div>
          )}

          {phaseNum === 2 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Model</div>
                <div className="font-semibold text-sm">YOLOv8</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">mAP@0.7 Threshold</div>
                <div className="font-semibold text-sm">≥ 0.7</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Last mAP</div>
                <div className={`font-semibold text-sm ${(summary?.training.last_map70 ?? 0) >= 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {summary?.training.last_map70?.toFixed(4) ?? 'N/A'}
                </div>
              </div>
            </div>
          )}

          {phaseNum === 3 && summary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Review Queue</div>
                <div className="font-semibold text-sm text-amber-600">
                  {summary.queues.review_queue_size} images
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Auto-Labeled</div>
                <div className="font-semibold text-sm text-green-600">
                  {summary.queues.auto_label_queue_size} images
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Ready for Retrain</div>
                <div className="font-semibold text-sm">
                  {summary.queues.reviewed_since_last_train} reviewed
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end">
            <Link href={config.route}>
              <Button variant="outline" size="sm">
                {isCurrentPhase ? "Continue" : "Go to"} {config.name.split(" ")[0]}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <MainHeader />
        <main className="container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
            <p className="mt-4 text-muted-foreground">Failed to load pipeline status</p>
            <p className="text-sm text-destructive">{error}</p>
            <Button onClick={refresh} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </main>
      </div>
    )
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
            <Badge variant="outline" className="gap-1">
              <TrendingUp className="h-3 w-3" />
              Iteration {summary?.current_iteration ?? 0}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {loading && !summary ? (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 animate-spin mx-auto" />
            <p className="mt-4 text-muted-foreground">Loading pipeline status...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {summary?.next_action && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-full">
                        <ArrowRight className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{summary.next_action.title}</p>
                        <p className="text-sm text-muted-foreground">{summary.next_action.description}</p>
                      </div>
                    </div>
                    <Link href={summary.next_action.route}>
                      <Button>
                        {summary.next_action.cta}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}

            {renderPhaseCard(1)}
            {renderPhaseCard(2)}
            {renderPhaseCard(3)}

            {summary?.automation_trend && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Automation Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {summary.automation_trend.message}
                  </p>
                  {summary.automation_trend.improvement_percent !== null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Improvement:</span>
                      <Badge className={summary.automation_trend.improvement_percent >= 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                        {summary.automation_trend.improvement_percent >= 0 ? '+' : ''}
                        {summary.automation_trend.improvement_percent.toFixed(1)}%
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Manual Triggers
                </CardTitle>
                <CardDescription>
                  수동으로 파이프라인 작업 트리거
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleTriggerAutoAnnotate}
                    disabled={triggering !== null}
                  >
                    {triggering === "auto" ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bot className="h-4 w-4 mr-2" />
                    )}
                    Run Auto-Annotate
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleTriggerDistillation}
                    disabled={triggering !== null}
                  >
                    {triggering === "distill" ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4 mr-2" />
                    )}
                    Trigger Distillation
                  </Button>
                  <Link href="/training">
                    <Button variant="outline">
                      <Play className="h-4 w-4 mr-2" />
                      Start Training
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 bg-muted/50 rounded-lg border">
              <h3 className="font-semibold text-sm mb-3">Status Legend</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="flex items-start gap-2">
                  <Badge className="bg-green-100 text-green-800 border-green-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                  <span className="text-muted-foreground">현재 진행 중인 Phase</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Done
                  </Badge>
                  <span className="text-muted-foreground">완료된 Phase</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-gray-100 text-gray-600 border-gray-300">
                    <Clock className="w-3 h-3 mr-1" />
                    Pending
                  </Badge>
                  <span className="text-muted-foreground">아직 시작하지 않은 Phase</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
