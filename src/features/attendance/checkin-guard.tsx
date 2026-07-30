"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Camera, Loader2, CheckCircle, Clock, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { markAttendance, checkOutAttendance } from "@/actions/attendance";

export function CheckInGuard({
  alreadyMarked,
  checkedOut,
  withinWindow,
  children
}: {
  alreadyMarked: boolean;
  checkedOut: boolean;
  withinWindow: boolean;
  children: React.ReactNode;
}) {
  const [view, setView] = useState<"idle" | "checkin" | "checkout" | "blocked">(
    !alreadyMarked ? (withinWindow ? "checkin" : "blocked") : !checkedOut ? "checkout" : "idle"
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(alreadyMarked);
  const router = useRouter();

  useEffect(() => {
    if (view === "checkin" && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [view, stream]);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } });
      setStream(mediaStream);
    } catch {
      toast.error("Camera access denied. Check your browser permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setCaptured(null);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) setCaptured(blob);
    }, "image/jpeg", 0.8);
  }, []);

  async function submitCheckIn() {
    setPending(true);
    const formData = new FormData();
    if (captured) formData.set("selfie", new File([captured], "selfie.jpg", { type: "image/jpeg" }));
    const result = await markAttendance(formData);
    if (!result.ok) { toast.error(result.message); setPending(false); return; }
    toast.success(result.message);
    setDone(true);
    setCaptured(null);
    stopCamera();
    setView(checkedOut ? "idle" : "checkout");
    router.refresh();
  }

  async function submitCheckOut() {
    setPending(true);
    const result = await checkOutAttendance();
    if (!result.ok) { toast.error(result.message); setPending(false); return; }
    toast.success(result.message);
    setView("idle");
    router.refresh();
  }

  function closeApp() {
    window.close();
  }

  if (view === "idle") return <>{children}</>;

  if (view === "blocked") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <Card className="max-w-md text-center shadow-lg">
          <CardHeader>
            <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
            <CardTitle className="mt-2">Check-in Not Available Yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Check-in is only allowed between <strong>8:00 AM</strong> and <strong>midnight</strong> (Nepal time).
            </p>
            <p className="text-xs text-muted-foreground">Please come back during check-in hours.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (view === "checkin") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4">
        <Card className="w-full max-w-lg shadow-lg">
          <CardHeader className="text-center">
            <Camera className="mx-auto h-10 w-10 text-primary" />
            <CardTitle className="mt-2">Mark Today&apos;s Attendance</CardTitle>
            <p className="text-sm text-muted-foreground">Take a selfie to check in. This is required to use the app.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!stream && (
              <Button onClick={startCamera} className="w-full">
                <Camera className="h-5 w-5" /> Open Camera
              </Button>
            )}
            {stream && (
              <>
                <div className="relative overflow-hidden rounded-lg bg-black">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-72 object-contain" />
                  <canvas ref={canvasRef} className="hidden" />
                  {captured && <img src={URL.createObjectURL(captured)} alt="Captured" className="absolute inset-0 h-full w-full object-contain" />}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!captured ? (
                    <Button onClick={capturePhoto} className="flex-1"><Camera className="h-4 w-4" /> Capture</Button>
                  ) : (
                    <>
                      <Button onClick={() => setCaptured(null)} variant="outline" className="flex-1">Retake</Button>
                      <Button onClick={submitCheckIn} disabled={pending} className="flex-1">
                        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        {pending ? "Submitting..." : "Confirm & Check In"}
                      </Button>
                    </>
                  )}
                  <Button onClick={() => { stopCamera(); closeApp(); }} variant="ghost" size="sm"><LogOut className="h-4 w-4" /> Close</Button>
                </div>
                {!captured && <p className="text-center text-xs text-muted-foreground">Position your face in the frame and click Capture.</p>}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-primary/30 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <CheckCircle className="h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">You&apos;re checked in</p>
              <p className="text-sm text-muted-foreground">Don&apos;t forget to check out at the end of your shift.</p>
            </div>
          </div>
          <Button onClick={submitCheckOut} disabled={pending} variant="outline" className="shrink-0">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {pending ? "Checking out..." : "Check Out"}
          </Button>
        </CardContent>
      </Card>
      {children}
    </div>
  );
}
