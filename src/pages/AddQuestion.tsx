import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const AddQuestion = () => {
  const [questionText, setQuestionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!questionText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a question before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("https://n8n.makexyz.site/webhook/sat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: questionText }),
      });

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Your SAT question has been submitted and will be reviewed before being added to the question pool.",
        });
        setQuestionText("");
      } else {
        throw new Error("Failed to submit question");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit question. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-green-50/20 dark:via-green-950/20 to-background p-4">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        
        <Card className="border-l-4 border-l-green-400 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-green-50/50 dark:from-green-950/50 to-emerald-50/50 dark:to-emerald-950/50">
            <CardTitle className="text-2xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Submit New SAT Question
              </span>
            </CardTitle>
            <div className="flex items-start gap-3 mt-2">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              <p className="text-muted-foreground">
                Help expand the question pool by submitting new SAT questions. Paste the entire text below, including the passage, question, all four options (A, B, C, D), and the correct answer.
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder="Paste your SAT question here..."
                className="min-h-[300px] resize-none border-green-200 focus-visible:ring-green-500"
                disabled={isSubmitting}
              />
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Adding Question...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Submit Question for Review
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AddQuestion;