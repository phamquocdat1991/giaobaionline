"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { Submission } from "./types";
import { Award, CheckCircle2, TrendingUp, Users } from "lucide-react";

interface ScoreChartProps {
  submissions: Submission[];
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444"];

export function ScoreDistributionChart({ submissions }: ScoreChartProps) {
  const stats = useMemo(() => {
    if (!submissions.length) return null;

    let gio = 0; // >= 8.5
    let kha = 0; // >= 6.5 and < 8.5
    let tb = 0; // >= 5.0 and < 6.5
    let yeu = 0; // < 5.0
    let totalScore = 0;
    let maxScore = 0;

    submissions.forEach((sub) => {
      const s = sub.score;
      totalScore += s;
      if (s > maxScore) maxScore = s;
      if (s >= 8.5) gio++;
      else if (s >= 6.5) kha++;
      else if (s >= 5.0) tb++;
      else yeu++;
    });

    const average = (totalScore / submissions.length).toFixed(1);
    const passRate = Math.round(((gio + kha + tb) / submissions.length) * 100);

    const chartData = [
      { name: "Giỏi (8.5 - 10)", count: gio, fill: COLORS[0] },
      { name: "Khá (6.5 - 8.4)", count: kha, fill: COLORS[1] },
      { name: "TB (5.0 - 6.4)", count: tb, fill: COLORS[2] },
      { name: "Chưa đạt (< 5)", count: yeu, fill: COLORS[3] },
    ];

    return {
      average,
      maxScore,
      passRate,
      chartData,
      totalCount: submissions.length,
    };
  }, [submissions]);

  if (!stats) return null;

  return (
    <div className="stats-analytics-section my-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
            <TrendingUp className="text-primary" size={18} /> Phân Tích Phổ Điểm & Chất Lượng Bài Làm
          </h3>
          <p className="text-xs text-muted-foreground">
            Thống kê dựa trên {stats.totalCount} lượt nộp bài của học sinh
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-semibold text-foreground">
            <Users size={14} className="text-primary" /> {stats.totalCount} bài nộp
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 font-semibold text-foreground">
            <Award size={14} className="text-amber-500" /> Điểm TB: {stats.average}/10
          </span>
          <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Đạt yêu cầu: {stats.passRate}%
          </span>
        </div>
      </div>

      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: unknown) => [`${value} học sinh`, "Số lượng"]}
              contentStyle={{
                borderRadius: "10px",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card)",
                color: "var(--foreground)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                fontSize: "13px",
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {stats.chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
