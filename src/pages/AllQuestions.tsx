import { useState, useEffect } from "react";
import { formatSatText, formatSatInline } from "@/lib/formatText";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, Target, HelpCircle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useExplanation } from "@/hooks/useExplanation";

interface Question {
  id: number;
  question: string;
  passage?: string;
  "answer A": string;
  "answer B": string;
  "answer C": string;
  "answer D": string;
  "correct answer": string;
}

const AllQuestions = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuestionForExplanation, setSelectedQuestionForExplanation] = useState<number | null>(null);
  const { toast } = useToast();
  const { isLoading: explanationLoading, explanation, fetchExplanation, resetExplanation } = useExplanation();

  useEffect(() => {
    fetchAllQuestions();
  }, []);

  const fetchAllQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from("sat")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      if (data) {
        setQuestions(data);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplanationClick = async (question: Question, questionIndex: number) => {
    setSelectedQuestionForExplanation(questionIndex);
    await fetchExplanation(question);
    
    // Scroll to the explanation button to maintain consistent positioning
    setTimeout(() => {
      const button = document.querySelector(`[data-question-index="${questionIndex}"]`);
      if (button) {
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const handleCloseExplanation = () => {
    setSelectedQuestionForExplanation(null);
    resetExplanation();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/5 to-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                All SAT Questions
              </h1>
            </div>
            <p className="text-xl text-muted-foreground mb-2">
              Complete collection of SAT questions with correct answers
            </p>
            <Badge variant="secondary" className="text-sm">
              {questions.length} Questions Available
            </Badge>
          </div>
        </div>

        <div className="space-y-6">
          {questions.map((question, index) => (
            <Card key={question.id} className="overflow-hidden border-l-4 border-l-primary hover:shadow-lg transition-all duration-300 hover:scale-[1.02]">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-accent/5">
                <CardTitle className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                  <span className="text-lg">Question {index + 1}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {question.passage && (
                  <div className="bg-muted/30 rounded-lg p-4 border-l-4 border-l-blue-400">
                    <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Reading Passage
                    </h4>
                    <div
                      className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: formatSatText(question.passage || "") }}
                    />
                  </div>
                )}
                
                <div className="space-y-3">
                  <div
                    className="text-lg font-semibold leading-relaxed"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: formatSatInline(question.question) }}
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { option: "A", text: question["answer A"] },
                      { option: "B", text: question["answer B"] },
                      { option: "C", text: question["answer C"] },
                      { option: "D", text: question["answer D"] }
                    ].map((answer) => (
                      <div
                        key={answer.option}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          answer.option === question["correct answer"]
                            ? "border-green-400 bg-green-50 dark:bg-green-950/30"
                            : "border-border bg-card hover:bg-accent/20"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Badge 
                            variant={answer.option === question["correct answer"] ? "default" : "outline"}
                            className={answer.option === question["correct answer"] 
                              ? "bg-green-500 hover:bg-green-600" 
                              : ""
                            }
                          >
                            {answer.option}
                          </Badge>
                          <span
                            className="text-sm leading-relaxed flex-1"
                            // eslint-disable-next-line react/no-danger
                            dangerouslySetInnerHTML={{ __html: formatSatInline(answer.text) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border-l-4 border-l-blue-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Target className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-sm text-blue-700 dark:text-blue-300 mb-1">
                            Correct Answer: {question["correct answer"]}
                          </h4>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleExplanationClick(question, index)}
                        disabled={explanationLoading && selectedQuestionForExplanation === index}
                        variant="outline"
                        size="sm"
                        className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
                        data-question-index={index}
                      >
                        {explanationLoading && selectedQuestionForExplanation === index ? (
                          <>
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                            Loading...
                          </>
                        ) : (
                          <>
                            <HelpCircle className="h-4 w-4 mr-2" />
                            Explanation
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {selectedQuestionForExplanation === index && explanation && (
                      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h5 className="font-semibold text-sm text-blue-700 dark:text-blue-300">
                            Explanation:
                          </h5>
                          <Button
                            onClick={handleCloseExplanation}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-blue-500 hover:text-blue-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="bg-white dark:bg-blue-950/50 rounded-md p-3 border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {explanation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AllQuestions;