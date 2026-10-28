"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LeaderboardChart, type LeaderboardPoint } from "./leaderboard-chart";
import { ShowMoreToggle } from "./show-more";

interface Props {
  title: string;
  data: LeaderboardPoint[];
  initialCount?: number;
}

export function LeaderboardChartCard({ title, data, initialCount = 5 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? data : data.slice(0, initialCount);
  const hidden = Math.max(0, data.length - initialCount);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-sm text-muted-foreground gap-2">
            <FileSpreadsheet className="w-6 h-6" />
            No posts uploaded yet for this period.
          </div>
        ) : (
          <Tabs defaultValue="avgReach">
            <TabsList>
              <TabsTrigger value="avgReach">Avg reach / post</TabsTrigger>
              <TabsTrigger value="avgImpressions">Avg impressions / post</TabsTrigger>
            </TabsList>
            <TabsContent value="avgReach">
              <LeaderboardChart data={visible} metric="avgReach" label="Avg reach" />
            </TabsContent>
            <TabsContent value="avgImpressions">
              <LeaderboardChart
                data={visible}
                metric="avgImpressions"
                label="Avg impressions"
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      <ShowMoreToggle
        expanded={expanded}
        hiddenCount={hidden}
        itemLabel="employees"
        onToggle={() => setExpanded((e) => !e)}
        className="border-t-0"
      />
    </Card>
  );
}
