"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { apiCall } from "@/lib/api-config"
import { useToast } from "@/hooks/use-toast"
import { Loader2, RefreshCw, ArrowLeft, FileChartLine, Scale } from "lucide-react"

interface ModelMetrics {
  map50?: number
  map50_95?: number
  precision?: number
  recall?: number
  [key: string]: number | undefined
}

interface TrainingInfo {
  epochs?: number
  batch_size?: number
  dataset_name?: string
  annotation_files?: string[]
  [key: string]: unknown
}

interface ModelWeightItem {
  model_id: string
  filename: string
  filepath?: string
  size_mb?: number
  created_at?: string
  status?: string
  type?: string
  dataset_id?: string
  metrics?: ModelMetrics
  training_info?: TrainingInfo
}

interface ModelDetail extends ModelWeightItem {}

interface CompareResponse {
  models: ModelWeightItem[]
  comparison: Record<string, unknown>
}

const formatNumber = (value?: number, digits = 2) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-"
  return value.toFixed(digits)
}

const formatDateTime = (iso?: string) => {
  if (!iso) return "-"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function ModelsPage() {
  const { toast } = useToast()

  const [models, setModels] = useState<ModelWeightItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ModelDetail | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([])
  const [compareResult, setCompareResult] = useState<CompareResponse | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await apiCall("/api/models/weights")
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `Failed to fetch models (${response.status})`)
      }
      const data = await response.json()
      const list: ModelWeightItem[] = Array.isArray(data?.models) ? data.models : []
      setModels(list)
      if (list.length > 0 && !selectedModelId) {
        setSelectedModelId(list[0].model_id)
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unknown error while loading models")
    } finally {
      setIsLoading(false)
    }
  }, [selectedModelId])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  useEffect(() => {
    if (!selectedModelId) {
      setDetail(null)
      return
    }

    const fetchDetail = async () => {
      setIsDetailLoading(true)
      setDetailError(null)
      try {
        const response = await apiCall(`/api/models/weights/${encodeURIComponent(selectedModelId)}`)
        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(errorText || `Failed to fetch model detail (${response.status})`)
        }
        const data: ModelDetail = await response.json()
        setDetail(data)
      } catch (error) {
        setDetailError(error instanceof Error ? error.message : "Unknown error while loading model detail")
      } finally {
        setIsDetailLoading(false)
      }
    }

    fetchDetail()
  }, [selectedModelId])

  const toggleCompareSelection = (modelId: string) => {
    setCompareResult(null)
    setCompareError(null)
    setSelectedForCompare((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId)
      }
      return [...prev, modelId]
    })
  }

  const handleCompare = async () => {
    if (selectedForCompare.length < 2) {
      toast({
        variant: "destructive",
        title: "모델 선택 필요",
        description: "비교하려면 최소 두 개 이상의 모델을 선택하세요.",
      })
      return
    }

    setIsComparing(true)
    setCompareError(null)
    try {
      const response = await apiCall("/api/models/weights/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedForCompare),
      })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || `Comparison failed (${response.status})`)
      }
      const data: CompareResponse = await response.json()
      setCompareResult(data)
    } catch (error) {
      setCompareError(error instanceof Error ? error.message : "Unknown comparison error")
    } finally {
      setIsComparing(false)
    }
  }

  const selectedDetails = useMemo(() => detail ?? models.find((m) => m.model_id === selectedModelId) ?? null, [detail, models, selectedModelId])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileChartLine className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Model Weights</h1>
                <p className="text-xs text-muted-foreground font-mono">Manage trained model artifacts</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={fetchModels} disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Link href="/training">
                <Button variant="secondary">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Training
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Models</span>
              <span className="text-sm text-muted-foreground">{models.length} items</span>
            </CardTitle>
            <CardDescription>View your trained weights, inspect details, and compare performance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadError && (
              <Alert variant="destructive">
                <AlertDescription>모델 목록을 불러오지 못했습니다: {loadError}</AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                비교할 모델을 선택한 뒤 Compare 버튼을 눌러주세요.
              </div>
              <Button
                size="sm"
                onClick={handleCompare}
                disabled={selectedForCompare.length < 2 || isComparing}
                className="flex items-center space-x-2"
              >
                <Scale className="h-4 w-4" />
                <span>{isComparing ? "Comparing..." : `Compare (${selectedForCompare.length})`}</span>
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <ScrollArea className="h-[360px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[48px]" />
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>mAP50</TableHead>
                      <TableHead>Precision</TableHead>
                      <TableHead>Recall</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                          <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading models...
                        </TableCell>
                      </TableRow>
                    ) : models.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                          등록된 모델이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      models.map((model) => {
                        const isSelectedRow = model.model_id === selectedModelId
                        const isChecked = selectedForCompare.includes(model.model_id)
                        return (
                          <TableRow
                            key={model.model_id}
                            className={`cursor-pointer transition-colors ${isSelectedRow ? "bg-primary/5" : "hover:bg-muted"}`}
                            onClick={() => setSelectedModelId(model.model_id)}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => toggleCompareSelection(model.model_id)}
                                aria-label={`Select ${model.filename} for comparison`}
                                onClick={(event) => event.stopPropagation()}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium">{model.filename}</div>
                                <div className="text-xs text-muted-foreground">{model.model_id}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="capitalize">
                                {model.status ?? "unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatNumber(model.metrics?.map50)}</TableCell>
                            <TableCell>{formatNumber(model.metrics?.precision)}</TableCell>
                            <TableCell>{formatNumber(model.metrics?.recall)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDateTime(model.created_at)}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-1">
            <CardHeader>
              <CardTitle>Model Detail</CardTitle>
              <CardDescription>선택한 모델의 세부 정보를 확인하세요.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {isDetailLoading && (
                <div className="text-muted-foreground flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 세부 정보를 불러오는 중입니다...
                </div>
              )}

              {detailError && (
                <Alert variant="destructive">
                  <AlertDescription>세부 정보를 불러오지 못했습니다: {detailError}</AlertDescription>
                </Alert>
              )}

              {selectedDetails ? (
                <div className="space-y-4">
                  <div>
                    <div className="font-semibold">{selectedDetails.filename}</div>
                    <div className="text-xs text-muted-foreground">{selectedDetails.filepath}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 border rounded">Size: <strong>{selectedDetails.size_mb ? `${selectedDetails.size_mb.toFixed(2)} MB` : '-'}</strong></div>
                    <div className="p-2 border rounded">Status: <strong className="capitalize">{selectedDetails.status ?? '-'}</strong></div>
                    <div className="p-2 border rounded">Created: <strong>{formatDateTime(selectedDetails.created_at)}</strong></div>
                    <div className="p-2 border rounded">Type: <strong>{selectedDetails.type ?? '-'}</strong></div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Metrics</h4>
                    {selectedDetails.metrics ? (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(selectedDetails.metrics).map(([key, value]) => (
                          <div key={key} className="p-2 border rounded">
                            {key.toUpperCase()}: <strong>{formatNumber(typeof value === "number" ? value : undefined)}</strong>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No metrics available.</div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Training Info</h4>
                    {selectedDetails.training_info ? (
                      <div className="space-y-2 text-xs">
                        {selectedDetails.training_info.dataset_name && (
                          <div>Dataset: <strong>{selectedDetails.training_info.dataset_name}</strong></div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 border rounded">Epochs: <strong>{selectedDetails.training_info.epochs ?? '-'}</strong></div>
                          <div className="p-2 border rounded">Batch: <strong>{selectedDetails.training_info.batch_size ?? '-'}</strong></div>
                        </div>
                        {selectedDetails.training_info.annotation_files && selectedDetails.training_info.annotation_files.length > 0 && (
                          <div>
                            <div className="text-muted-foreground">Annotation Files</div>
                            <div className="text-xs">{selectedDetails.training_info.annotation_files.join(', ')}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">No training metadata.</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">모델을 선택하면 세부 정보가 표시됩니다.</div>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Comparison Result</CardTitle>
              <CardDescription>
                선택한 모델을 비교하면 주요 지표와 파일 크기를 분석해 보여줍니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {compareError && (
                <Alert variant="destructive">
                  <AlertDescription>비교 데이터를 불러오지 못했습니다: {compareError}</AlertDescription>
                </Alert>
              )}

              {isComparing && !compareResult ? (
                <div className="flex items-center text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 비교 결과를 계산하는 중입니다...
                </div>
              ) : compareResult ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-base">Top Metrics</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {Object.entries(compareResult.comparison)
                        .filter(([key]) => key.startsWith("best_"))
                        .map(([key, value]) => {
                          const metric = value as { model_id?: string; value?: number }
                          return (
                            <div key={key} className="p-3 border rounded">
                              <div className="uppercase text-muted-foreground">{key.replace("best_", "")}</div>
                              <div className="font-medium">{formatNumber(metric.value)}</div>
                              <div className="text-xs">Model: {metric.model_id ?? '-'}</div>
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {Array.isArray((compareResult.comparison as { model_sizes?: [string, number][] })?.model_sizes) && (
                    <div>
                      <h4 className="font-semibold text-base">Model Sizes</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {((compareResult.comparison as { model_sizes?: [string, number][] }).model_sizes ?? []).map(
                          ([modelId, size]) => (
                            <div key={`${modelId}-${size}`} className="p-3 border rounded">
                              <div className="font-medium">{modelId}</div>
                              <div>{formatNumber(size)} MB</div>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {compareResult.models?.length ? (
                    <div className="space-y-2">
                      <h4 className="font-semibold text-base">Compared Models</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {compareResult.models.map((model) => (
                          <div key={model.model_id} className="p-3 border rounded space-y-1">
                            <div className="font-medium">{model.filename}</div>
                            <div className="text-muted-foreground">{model.model_id}</div>
                            <div className="grid grid-cols-2 gap-1">
                              <div>mAP50: <strong>{formatNumber(model.metrics?.map50)}</strong></div>
                              <div>mAP50-95: <strong>{formatNumber(model.metrics?.map50_95)}</strong></div>
                              <div>Precision: <strong>{formatNumber(model.metrics?.precision)}</strong></div>
                              <div>Recall: <strong>{formatNumber(model.metrics?.recall)}</strong></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-muted-foreground">비교 결과가 없습니다. 모델을 선택하여 Compare를 눌러보세요.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}

