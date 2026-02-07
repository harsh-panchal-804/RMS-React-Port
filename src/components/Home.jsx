import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Database, Shield, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-8 p-6">
      <div className="space-y-4 text-center max-w-4xl">
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">Harsh Panchal</h1>
          <p className="text-2xl text-muted-foreground">
            MVP for Streamlit Frontend Port to React
          </p>
          <p className="text-lg text-muted-foreground">
            Better UI/UX and Performance
          </p>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Real Data from Database
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg">
              The data shown here is real and is fetched from the DB and not dummy data.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              No Backend Modifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">
              In making of this, I haven't made any changes to any API or DB so our original Streamlit app is not modified in any way.
            </p>
            <p className="text-lg">
              All features originally present in Streamlit app have been ported to React in these pages.
            </p>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-base">
            <strong>Backend Setup:</strong> The backend currently runs on Harsh Panchal's local machine via a dev tunnel and no POST APIs are allowed so even if you play around the website, nothing would be changed in DB and our original Streamlit app.
          </AlertDescription>
        </Alert>

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2 text-lg font-semibold">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span>So explore this website and review it.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
