"use client";

import { useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import { Camera, CameraOff, CheckCircle, Loader2 } from "lucide-react";
import { markAttendance } from "@/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export function AttendanceBanner({ alreadyMarked }: { alreadyMarked: boolean }) {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(alreadyMarked);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const router = useRouter();

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
    } catch {
      toast.error("Camera access denied. Check your browser permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
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

  async function submitAttendance() {
    setPending(true);
    const formData = new FormData();
    if (captured) {
      formData.set("selfie", new File([captured], "selfie.jpg", { type: "image/jpeg" }));
    }
    const result = await markAttendance(formData);
    if (!result.ok) {
      toast.error(result.message);
      setPending(false);
      return;
    }
    toast.success(result.message);
    setDone(true);
    setPending(false);
    stopCamera();
    router.refresh();
  }

  if (done) return null;

  return (
    <Card className="border-accent/40 bg-accent/5 shadow-sm">
      <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <CheckCircle className="h-6 w-6 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-semibold">Mark Today&apos;s Attendance</p>
            <p className="text-sm text-muted-foreground">Take a quick selfie to check in for the day.</p>
          </div>
        </div>

        {!showCamera && !captured && (
          <Button onClick={startCamera} variant="outline" className="shrink-0">
            <Camera className="h-4 w-4" /> Open Camera
          </Button>
        )}

        {showCamera && (
          <div className="w-full space-y-3">
            <div className="relative overflow-hidden rounded-lg bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-64 object-contain" />
              <canvas ref={canvasRef} className="hidden" />
              {captured && (
                <img src={URL.createObjectURL(captured)} alt="Captured" className="absolute inset-0 w-full h-full object-contain" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!captured ? (
                <Button onClick={capturePhoto}><Camera className="h-4 w-4" /> Capture</Button>
              ) : (
                <>
                  <Button onClick={() => setCaptured(null)} variant="outline">Retake</Button>
                  <Button onClick={submitAttendance} disabled={pending}>
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    {pending ? "Submitting..." : "Confirm & Check In"}
                  </Button>
                </>
              )}
              <Button onClick={stopCamera} variant="ghost" size="sm"><CameraOff className="h-4 w-4" /> Close</Button>
            </div>
            {!captured && <p className="text-xs text-muted-foreground">Position your face in the frame and click Capture.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
