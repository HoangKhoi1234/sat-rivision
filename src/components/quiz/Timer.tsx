import { Clock, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TimerProps {
  elapsedSeconds: number;
  remainingSeconds?: number;
  showRemaining?: boolean;
}

export const Timer = ({ elapsedSeconds, remainingSeconds = 0, showRemaining = false }: TimerProps) => {
  // Elapsed time display
  const elapsedMm = Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0");
  const elapsedSs = Math.floor(elapsedSeconds % 60)
    .toString()
    .padStart(2, "0");
  
  // Remaining time display  
  const remainingMm = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainingSs = Math.floor(remainingSeconds % 60)
    .toString()
    .padStart(2, "0");
  
  const isLowTime = remainingSeconds < 300; // Less than 5 minutes
  
  return (
    <div className="flex items-center gap-6">
      {/* Elapsed Time */}
      <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-lg font-mono border-border bg-card">
        <Clock className="h-5 w-5" />
        <span className="font-bold">{elapsedMm}:{elapsedSs}</span>
        <span className="text-sm text-muted-foreground">elapsed</span>
      </div>
      
      {/* Remaining Time - only show if showRemaining is true */}
      {showRemaining && (
        <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-lg font-mono ${
          isLowTime ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border bg-card'
        }`}>
          <Clock className="h-5 w-5" />
          <span className="font-bold">{remainingMm}:{remainingSs}</span>
          <span className="text-sm text-muted-foreground">remaining</span>
        </div>
      )}
    </div>
  );
};

export default Timer;
