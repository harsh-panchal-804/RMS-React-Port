import React from "react";
import { LoaderThree } from "@/components/ui/loader";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

export function LoaderThreeDemo() {
  return (
    <div className="min-h-screen w-full bg-background p-6 flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-center min-h-[200px]">
            <LoaderThree />
          </div>
          <div className="space-y-2 text-center">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
          </div>
          <Progress value={33} className="w-full" />
          <p className="text-center text-muted-foreground">Loading data from API...</p>
        </CardContent>
      </Card>
    </div>
  );
}
