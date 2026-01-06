"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Brain } from "lucide-react";
import MainHeader from "@/components/main-header";

export default function KnowledgeDistillationPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("darkMode", isDarkMode.toString());
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <MainHeader isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />

      <main className="container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Knowledge Distillation</h2>
            <p className="text-sm text-muted-foreground">
              YOLOv8 기반 경량 모델 학습 및 mAP@0.7 검증
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Knowledge Distillation Console
              </CardTitle>
              <CardDescription>
                Cold-start Labeling으로 생성된 데이터셋을 활용하여 경량 모델 학습
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-1">
                  <h4 className="font-medium">Ready to train?</h4>
                  <p className="text-sm text-muted-foreground">
                    Ensure your dataset is labeled before starting a Knowledge Distillation job.
                  </p>
                </div>
                <Link href="/training">
                  <Button>
                    Open Distillation Console
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Phase 2 Overview</CardTitle>
              <CardDescription>
                Knowledge Distillation 단계 상세 설명
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">목적</h4>
                  <p className="text-sm text-muted-foreground">
                    LLM의 추론 결과를 현장에서 실시간으로 실행 가능한 크기의 모델로 압축
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">학습 데이터</h4>
                  <p className="text-sm text-muted-foreground">
                    이미지와 해당 이미지의 annotation (mask, bounding box, 레이블)
                  </p>
                </div>
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">기준 성능</h4>
                  <p className="text-sm text-muted-foreground">
                    mAP@0.7 ≥ 0.7 달성 시 프로덕션 배포 가능
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 gap-4">
            <Link href="/training">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-medium mb-2">Start Training</h3>
                  <p className="text-sm text-muted-foreground">
                    새로운 YOLOv8 모델 학습 시작
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/training/monitor">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="bg-primary/10 p-3 rounded-full mb-4">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-medium mb-2">Training Monitor</h3>
                  <p className="text-sm text-muted-foreground">
                    진행 중인 학습 작업 모니터링
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
