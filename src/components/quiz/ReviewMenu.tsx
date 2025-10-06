import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ReviewStatus = "unanswered" | "correct" | "incorrect";

interface ReviewMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionsCount: number;
  getStatus: (index: number) => ReviewStatus;
  onSelectQuestion: (index: number) => void;
}

export const ReviewMenu = ({
  open,
  onOpenChange,
  questionsCount,
  getStatus,
  onSelectQuestion,
}: ReviewMenuProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review Questions</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: questionsCount }).map((_, i) => {
            const status = getStatus(i);
            const classes =
              status === "correct"
                ? "bg-primary text-primary-foreground"
                : status === "incorrect"
                ? "bg-destructive text-destructive-foreground"
                : "bg-background text-foreground border-2 border-primary";
            const label = i + 1;
            return (
              <Button
                key={i}
                className={`h-10 w-10 p-0 ${classes}`}
                onClick={() => {
                  onOpenChange(false);
                  onSelectQuestion(i);
                }}
              >
                {label}
              </Button>
            );
          })}
        </div>
          <div className="text-xs text-muted-foreground mt-4 space-y-1">
            <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded bg-primary" /> Correct</div>
            <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded bg-destructive" /> Incorrect (had wrong attempts)</div>
            <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded bg-background border-2 border-primary" /> Not answered</div>
          </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReviewMenu;
