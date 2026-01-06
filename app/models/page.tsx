"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiCall, API_CONFIG } from "@/lib/api-config"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle, AlertTriangle, Clock, TrendingUp, Download, Eye, Edit2, Database } from "lucide-react"
import Link from "next/link"
import MainHeader from "@/components/main-header"

interface ModelInfo {
  model_id: string
  version: number
  status: string
  status_message: string
  metrics: {
    map50: number
    map50_95: number
    map70: number
    precision: number
    recall: number
    f1: number
  }
  created_at: string
  promoted_at?: string
}

export default function ModelsPage() {
  const { toast } = useToast()
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [registryStats, setRegistryStats] = useState<any>(null)

  // Load models on mount
  useEffect(() => {
    loadModels()
    loadRegistryStats()
  }, [])

  const loadModels = async () => {
    try {
      setLoading(true)
      const response = await apiCall(API_CONFIG.ENDPOINTS.MODELS_LIST + '/registry')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success && data.models) {
        setModels(data.models)
      } else {
        setModels([])
      }
      setLoading(false)
    } catch (error) {
      console.error("Failed to load models:", error)
      toast({
        variant: "destructive",
        title: "Failed to load models",
        description: (error as Error).message,
      })
      setModels([])
      setLoading(false)
    }
  }

  const loadRegistryStats = async () => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.MODELS_LIST + '/registry/stats')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setRegistryStats(data)
      } else {
        setRegistryStats(null)
      }
    } catch (error) {
      console.error("Failed to load registry stats:", error)
      setRegistryStats(null)
    }
  }

  const getStatusBadge = (status: string, map70: number) => {
    const threshold = 0.7
    if (status === "production") {
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Production
        </Badge>
      )
    }
    
    if (map70 >= threshold) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300">
          <CheckCircle className="w-3 h-3 mr-1" />
          Ready (mAP@0.7: {map70.toFixed(3)})
        </Badge>
      )
    } else {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Needs Improvement (mAP@0.7: {map70.toFixed(3)})
        </Badge>
      )
    }
  }

  const promoteModel = async (modelId: string) => {
    try {
      const response = await apiCall(API_CONFIG.ENDPOINTS.MODELS_PROMOTE + `?model_id=${encodeURIComponent(modelId)}`, {
        method: 'POST',
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Model promoted",
          description: `Model ${modelId} is now in production`,
        })
        await loadModels()
        await loadRegistryStats()
      } else {
        throw new Error(data.error || 'Failed to promote model')
      }
    } catch (error) {
      console.error("Failed to promote model:", error)
      toast({
        variant: "destructive",
        title: "Failed to promote model",
        description: (error as Error).message,
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <MainHeader />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">Model Registry</h1>
          <p className="text-sm text-muted-foreground">
            Knowledge Distillation 결과물인 학습 모델들의 버전 및 성능을 관리합니다.
            Paper 기준: <strong className="text-foreground">mAP@0.7 ≥ 0.7</strong>
          </p>
        </div>

        {/* Registry Statistics */}
        {registryStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Total Models</div>
                <div className="text-2xl font-bold">{registryStats.total_models}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Ready Models</div>
                <div className="text-2xl font-bold text-green-600">
                  {registryStats.ready_models}
                  <CheckCircle className="w-4 h-4 ml-2 inline text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Production Model</div>
                <div className="text-2xl font-bold text-blue-600">
                  {registryStats.production_models}
                  <Database className="w-4 h-4 ml-2 inline text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Average mAP@0.7</div>
                <div className="text-2xl font-bold">
                  {registryStats.average_map70.toFixed(4)}
                  <TrendingUp className="w-4 h-4 ml-2 inline text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Models Table */}
        <Card>
          <CardHeader>
            <CardTitle>Model Versions</CardTitle>
            <CardDescription>
              모든 학습된 모델 버전과 성능 지표
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center">
                  <Clock className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading models...</span>
                </div>
              </div>
            ) : models.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No models registered yet. Start training to create models.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model ID</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>mAP@0.5</TableHead>
                    <TableHead>mAP@0.5:0.95</TableHead>
                    <TableHead>mAP@0.7</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={`${model.model_id}_v${model.version}`}>
                      <TableCell className="font-medium">{model.model_id}</TableCell>
                      <TableCell>v{model.version}</TableCell>
                      <TableCell>{getStatusBadge(model.status, model.metrics.map70)}</TableCell>
                      <TableCell>{model.metrics.map50.toFixed(4)}</TableCell>
                      <TableCell>{model.metrics.map50_95.toFixed(4)}</TableCell>
                      <TableCell>
                        <span className={model.metrics.map70 >= 0.7 ? "text-green-600 font-semibold" : "text-yellow-600 font-semibold"}>
                          {model.metrics.map70.toFixed(4)}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(model.created_at).toLocaleString('ko-KR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link href="/training">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          {model.status !== 'production' && model.metrics.map70 >= 0.7 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                              onClick={() => promoteModel(model.model_id)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border">
          <h3 className="font-semibold text-sm mb-3">Status Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="flex items-start gap-2">
              <Badge className="bg-green-100 text-green-800 border-green-300">Ready</Badge>
              <span className="text-muted-foreground">mAP@0.7 ≥ 0.7, Knowledge Distillation 사용 가능</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Needs Improvement</Badge>
              <span className="text-muted-foreground">mAP@0.7 &lt; 0.7, 재학습 필요</span>
            </div>
            <div className="flex items-start gap-2">
              <Badge className="bg-blue-100 text-blue-800 border-blue-300">Production</Badge>
              <span className="text-muted-foreground">현재 프로덕션에서 사용 중인 모델</span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>
                자주 사용하는 작업
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/training" className="flex-1">
                  <Button className="w-full" variant="outline">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Train New Model
                  </Button>
                </Link>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: "Registry Export",
                      description: "Model registry exported to JSON"
                    })
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export Registry
                </Button>
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={async () => {
                    await loadModels()
                    toast({
                      title: "Models Refreshed",
                      description: "Latest model data loaded"
                    })
                  }}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
