import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Play, HelpCircle, X, Highlighter, ChevronDown, Flag } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useExplanation } from "@/hooks/useExplanation";
import AnnotatableText from "@/components/quiz/AnnotatableText";
import ReviewMenu from "@/components/quiz/ReviewMenu";
import Timer from "@/components/quiz/Timer";
import { formatSatInline } from "@/lib/formatText";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

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

interface ShuffledQuestion extends Question {
  shuffledAnswers: Array<{ option: string; text: string }>;
}

type QuizState = "setup" | "quiz" | "results";

const RevisionQuiz = () => {
  const [quizState, setQuizState] = useState<QuizState>("setup");
  const [numberOfQuestions, setNumberOfQuestions] = useState<string>("27");
  const [selectedQuestionNumbers] = useState<Set<number>>(new Set());
  const [questions, setQuestions] = useState<ShuffledQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  // Annotations & tools
  const [annotateEnabled, setAnnotateEnabled] = useState(false);
  const [annotateColor, setAnnotateColor] = useState<"green" | "yellow" | "red">("yellow");
  const [annotateMode, setAnnotateMode] = useState<"highlight" | "underline">("underline");
  const [lineMode, setLineMode] = useState(false);

  // Per-question states
  const [passageHtmlMap, setPassageHtmlMap] = useState<Record<number, string>>({});
  const [questionHtmlMap, setQuestionHtmlMap] = useState<Record<number, string>>({});
  const [linedOptionsMap, setLinedOptionsMap] = useState<Record<number, Set<string>>>({});
  const [incorrectSelectionsMap, setIncorrectSelectionsMap] = useState<Record<number, Set<string>>>({});
  const [finalizedMap, setFinalizedMap] = useState<Record<number, boolean>>({});
  const [hadWrongAttemptMap, setHadWrongAttemptMap] = useState<Record<number, boolean>>({});

  // Timing
  const [perQuestionTime, setPerQuestionTime] = useState<Record<number, number>>({}); // ms
  const [quizStart, setQuizStart] = useState<number | null>(null);
  const [questionStart, setQuestionStart] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Review menu
  const [reviewOpen, setReviewOpen] = useState(false);

  // Report dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [reportType, setReportType] = useState<string>("incorrect-answer");
  const [reportMessage, setReportMessage] = useState<string>("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Review question in results
  const [reviewingQuestion, setReviewingQuestion] = useState<number | null>(null);

  const { toast } = useToast();
  const { isLoading: explanationLoading, explanation, fetchExplanation, resetExplanation } = useExplanation();


  // Timer ticker per-question while in quiz
  useEffect(() => {
    if (quizState !== "quiz" || !questionStart) return;
    setElapsedSeconds(0);
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - questionStart) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [quizState, questionStart]);


  const shuffleAnswers = (question: Question): ShuffledQuestion => {
    const answers = [
      { option: "A", text: question["answer A"] },
      { option: "B", text: question["answer B"] },
      { option: "C", text: question["answer C"] },
      { option: "D", text: question["answer D"] }
    ];
    
    // Shuffle the answers
    const shuffled = [...answers].sort(() => 0.5 - Math.random());
    
    return {
      ...question,
      shuffledAnswers: shuffled
    };
  };

  const startPracticeTest = async () => {
    setIsLoading(true);
    try {
      // Fetch ALL question ids (newest first)
      const { data: idsData, error: idsError } = await supabase
        .from("sat")
        .select("id")
        .order("created_at", { ascending: false });

      if (idsError) throw idsError;

      const ids = (idsData ?? []).map((r: { id: number }) => r.id);
      if (!ids || ids.length === 0) {
        toast({
          title: "No Questions Found",
          description: "No questions available in the database.",
          variant: "destructive",
        });
        return;
      }

      // Sample random questions
      const need = Math.min(parseInt(numberOfQuestions) || 27, ids.length);
      const pool = [...ids];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const chosen = pool.slice(0, need);

      // Fetch the chosen questions
      const { data: rows, error: rowsError } = await supabase
        .from("sat")
        .select("*")
        .in("id", chosen);

      if (rowsError) throw rowsError;

      if (rows && rows.length > 0) {
        const randomQuestions = [...rows]
          .sort(() => 0.5 - Math.random())
          .map((q) => shuffleAnswers(q));

        setQuestions(randomQuestions);
        setQuizState("quiz");
        setCurrentQuestionIndex(0);
        setScore(0);
        setSelectedAnswer(null);
        setShowFeedback(false);

        // initialize per-question maps
        const len = randomQuestions.length;
        const inc: Record<number, Set<string>> = {};
        const lined: Record<number, Set<string>> = {};
        const fin: Record<number, boolean> = {};
        const wrong: Record<number, boolean> = {};
        const pHtml: Record<number, string> = {};
        const qHtml: Record<number, string> = {};
        const times: Record<number, number> = {};
        for (let i = 0; i < len; i++) {
          inc[i] = new Set();
          lined[i] = new Set();
          fin[i] = false;
          wrong[i] = false;
          pHtml[i] = "";
          qHtml[i] = "";
          times[i] = 0;
        }
        setIncorrectSelectionsMap(inc);
        setLinedOptionsMap(lined);
        setFinalizedMap(fin);
        setHadWrongAttemptMap(wrong);
        setPassageHtmlMap(pHtml);
        setQuestionHtmlMap(qHtml);
        setPerQuestionTime(times);
        setQuizStart(Date.now());
        setQuestionStart(Date.now());
        setElapsedSeconds(0);
        setAnnotateEnabled(false);
        setLineMode(false);
      } else {
        toast({
          title: "No Questions Found",
          description: "No questions available in the database.",
          variant: "destructive",
        });
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

  const handleAnswerSelect = (option: string) => {
    const idx = currentQuestionIndex;
    if (finalizedMap[idx]) return;
    const currentQuestion = questions[idx];
    setSelectedAnswer(option);

    if (option === currentQuestion["correct answer"]) {
      // finalize question and increment score once
      setFinalizedMap({ ...finalizedMap, [idx]: true });
      setShowFeedback(true);
      setScore((s) => s + 1);
    } else {
      // record incorrect attempt and allow another try
      setIncorrectSelectionsMap((prev) => {
        const set = new Set(prev[idx] ?? new Set<string>());
        set.add(option);
        return { ...prev, [idx]: set };
      });
      setHadWrongAttemptMap({ ...hadWrongAttemptMap, [idx]: true });
    }
  };

  const handleSubmitAnswer = () => {
    // no-op: immediate feedback mode
  };

  const navigateToQuestion = (nextIndex: number) => {
    const now = Date.now();
    if (questionStart !== null) {
      const delta = now - questionStart;
      setPerQuestionTime((prev) => ({
        ...prev,
        [currentQuestionIndex]: (prev[currentQuestionIndex] || 0) + delta,
      }));
    }
    setCurrentQuestionIndex(nextIndex);
    setSelectedAnswer(null);
    const fin = finalizedMap[nextIndex] ?? false;
    setShowFeedback(fin);
    setShowExplanation(false);
    resetExplanation();
    setQuestionStart(Date.now());
    setElapsedSeconds(0);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      navigateToQuestion(currentQuestionIndex + 1);
    } else {
      const now = Date.now();
      if (questionStart !== null) {
        const delta = now - questionStart;
        setPerQuestionTime((prev) => ({
          ...prev,
          [currentQuestionIndex]: (prev[currentQuestionIndex] || 0) + delta,
        }));
      }
      setQuizState("results");
    }
  };
  const handleExplanationClick = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    setShowExplanation(true);

    // Build payload using the displayed (shuffled) answers so it matches what the user saw
    const displayedCorrectIndex = currentQuestion.shuffledAnswers.findIndex(
      (a) => a.option === currentQuestion["correct answer"]
    );
    const displayedCorrectLetter = ["A", "B", "C", "D"][displayedCorrectIndex] ?? currentQuestion["correct answer"];

    const displayPayload = {
      passage: currentQuestion.passage || "",
      question: currentQuestion.question,
      "answer A": currentQuestion.shuffledAnswers[0]?.text || "",
      "answer B": currentQuestion.shuffledAnswers[1]?.text || "",
      "answer C": currentQuestion.shuffledAnswers[2]?.text || "",
      "answer D": currentQuestion.shuffledAnswers[3]?.text || "",
      "correct answer": displayedCorrectLetter,
    };

    await fetchExplanation(displayPayload);
  };

  const handleCloseExplanation = () => {
    setShowExplanation(false);
    resetExplanation();
  };

  const startNewQuiz = () => {
    setQuizState("setup");
    setCurrentQuestionIndex(0);
    setScore(0);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setShowExplanation(false);
    setQuestions([]);
    setIncorrectSelectionsMap({});
    setLinedOptionsMap({});
    setFinalizedMap({});
    setHadWrongAttemptMap({});
    setPassageHtmlMap({});
    setQuestionHtmlMap({});
    setPerQuestionTime({});
    setElapsedSeconds(0);
    setQuizStart(null);
    setQuestionStart(null);
    resetExplanation();
  };

  const getAnswerVariant = (option: string) => {
    const idx = currentQuestionIndex;
    const currentQuestion = questions[idx];
    const isCorrect = option === currentQuestion["correct answer"];
    const finalized = finalizedMap[idx] ?? false;
    const incorrectSet = incorrectSelectionsMap[idx] ?? new Set<string>();

    if (finalized) {
      if (isCorrect) return "quiz-correct";
      if (incorrectSet.has(option)) return "quiz-incorrect";
      return "outline";
    }

    if (incorrectSet.has(option)) return "quiz-incorrect";
    return "outline";
  };

  const handleSubmitReport = async () => {
    if (!reportMessage.trim()) {
      toast({
        title: "Message Required",
        description: "Please provide details about the issue.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingReport(true);
    try {
      const currentQuestion = questions[currentQuestionIndex];
      const reportData = {
        type: reportType,
        message: reportMessage,
        question: currentQuestion.question,
        passage: currentQuestion.passage || "",
        answers: {
          A: currentQuestion["answer A"],
          B: currentQuestion["answer B"],
          C: currentQuestion["answer C"],
          D: currentQuestion["answer D"],
        },
        correctAnswer: currentQuestion["correct answer"],
        questionId: currentQuestion.id,
      };

      const response = await fetch("https://n8n.makexyz.site/webhook/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit report");
      }

      toast({
        title: "Report Submitted",
        description: "Thank you for your feedback. We'll review your report.",
      });

      setReportOpen(false);
      setReportMessage("");
      setReportType("incorrect-answer");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingReport(false);
    }
  };
  if (quizState === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/20 dark:via-blue-950/20 to-background p-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          
          <Card className="border-l-4 border-l-blue-400 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-blue-50/50 dark:from-blue-950/50 to-cyan-50/50 dark:to-cyan-950/50">
              <CardTitle className="text-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center">
                  <Play className="h-5 w-5 text-white" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  SAT Revision Quiz
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 py-12">
              <div className="text-center space-y-6">
                <h3 className="text-xl font-semibold">Ready for your practice test?</h3>
                <div className="flex flex-col items-center gap-2">
                  <label className="text-sm font-medium">Number of questions:</label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={numberOfQuestions}
                    onChange={(e) => setNumberOfQuestions(e.target.value)}
                    className="w-32 text-center"
                    placeholder="27"
                  />
                </div>
                <Button 
                  onClick={startPracticeTest} 
                  disabled={isLoading || !numberOfQuestions || parseInt(numberOfQuestions) < 1}
                  size="lg"
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white shadow-lg px-12"
                >
                  {isLoading ? "Loading..." : "Start Practice Test"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (quizState === "quiz") {
    const currentQuestion = questions[currentQuestionIndex];
    const finalized = finalizedMap[currentQuestionIndex] ?? false;
    const incorrectSet = incorrectSelectionsMap[currentQuestionIndex] ?? new Set<string>();
    const lined = linedOptionsMap[currentQuestionIndex] ?? new Set<string>();
    const passageHtml = passageHtmlMap[currentQuestionIndex] ?? "";
    const questionHtml = questionHtmlMap[currentQuestionIndex] ?? "";

    return (
      <div className="h-screen bg-gray-50 flex flex-col">
        {reviewOpen && (
          <ReviewMenu
            open={reviewOpen}
            onOpenChange={setReviewOpen}
            questionsCount={questions.length}
            getStatus={(index) => {
              const isFinalized = finalizedMap[index];
              const hadWrong = hadWrongAttemptMap[index];
              if (!isFinalized) return "unanswered";
              return hadWrong ? "incorrect" : "correct";
            }}
            onSelectQuestion={navigateToQuestion}
          />
        )}

        {showExplanation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Explanation</h3>
                <Button variant="ghost" size="sm" onClick={handleCloseExplanation}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {explanationLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : explanation ? (
                  <div 
                    className="prose prose-sm max-w-none text-gray-900"
                    dangerouslySetInnerHTML={{ __html: explanation.replace(/\n/g, '<br/>') }}
                  />
                ) : (
                  <p className="text-gray-500">No explanation available.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Report an Issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Issue Type</Label>
                <RadioGroup value={reportType} onValueChange={setReportType}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="incorrect-answer" id="incorrect-answer" />
                    <Label htmlFor="incorrect-answer" className="font-normal cursor-pointer">
                      Incorrect Answer
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="question-display" id="question-display" />
                    <Label htmlFor="question-display" className="font-normal cursor-pointer">
                      Question Display Issue
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bug" id="bug" />
                    <Label htmlFor="bug" className="font-normal cursor-pointer">
                      Bug
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="others" id="others" />
                    <Label htmlFor="others" className="font-normal cursor-pointer">
                      Others
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="message">Details</Label>
                <Textarea
                  id="message"
                  placeholder="Please describe the issue..."
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  className="min-h-[120px]"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setReportOpen(false)}
                  disabled={isSubmittingReport}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReport}
                  disabled={isSubmittingReport}
                >
                  {isSubmittingReport ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Header Bar */}
        <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-bold text-gray-900">
              Quiz
            </h1>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                  Directions <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80 bg-white border border-gray-200 shadow-lg z-50">
                <DropdownMenuItem className="text-sm p-4 text-gray-700">
                  Read each passage carefully and answer the questions based on the information provided. Select the best answer choice for each question.
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-4">
                  <Timer 
                    elapsedSeconds={elapsedSeconds} 
                    showRemaining={false}
                  />
          </div>

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAnnotateEnabled(!annotateEnabled)}
              className={`${annotateEnabled ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'}`}
            >
              <Highlighter className="h-4 w-4 mr-2" />
              Highlights
            </Button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 min-h-0">
          {/* Left Panel - Passage */}
          <div className="flex-1 bg-white border-r border-gray-200 flex flex-col">
            <div className="flex-1 overflow-hidden p-8">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm h-full overflow-y-auto">
                {currentQuestion.passage ? (
                  <AnnotatableText
                    initialText={currentQuestion.passage}
                    htmlValue={passageHtml}
                    onChange={(html) => setPassageHtmlMap({ ...passageHtmlMap, [currentQuestionIndex]: html })}
                    enabled={annotateEnabled}
                    color="yellow"
                    mode={annotateMode}
                    className="font-serif text-base leading-7 text-gray-900 text-left"
                    variant="passage"
                  />
                ) : (
                  <div className="text-gray-500 text-center py-12 font-serif">
                    No passage for this question
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Question */}
          <div className="flex-1 bg-white flex flex-col">
            <div className="flex-1 overflow-hidden p-8">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm h-full overflow-y-auto">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Question {currentQuestionIndex + 1}
                  </h2>
                  <div className="font-semibold text-gray-900 mb-6">
                    <AnnotatableText
                      initialText={currentQuestion.question}
                      htmlValue={questionHtml}
                      onChange={(html) => setQuestionHtmlMap({ ...questionHtmlMap, [currentQuestionIndex]: html })}
                      enabled={annotateEnabled}
                      color="yellow"
                      mode={annotateMode}
                      className="text-base leading-6"
                      variant="inline"
                    />
                  </div>
                </div>

                {/* Answer Choices */}
                <div className="space-y-3">
                  {currentQuestion.shuffledAnswers.map(({ option, text }, idx) => {
                    const displayLetter = ["A", "B", "C", "D"][idx];
                    const isSelected = selectedAnswer === option;
                    const isIncorrect = incorrectSet.has(option);
                    const isCorrect = finalized && option === currentQuestion["correct answer"];
                    const isLinedOut = lined.has(option);

                    return (
                      <button
                        key={option}
                        onClick={() => handleAnswerSelect(option)}
                        disabled={finalized}
                        className={`
                          w-full p-4 rounded-lg border-2 text-left transition-all duration-150 font-sans
                          ${isCorrect 
                            ? 'border-green-500 bg-green-50 text-green-900' 
                            : isIncorrect 
                              ? 'border-red-500 bg-red-50 text-red-900'
                              : isSelected
                                ? 'border-blue-500 bg-blue-50 text-blue-900'
                                : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400 hover:bg-gray-50'
                          }
                          ${finalized ? 'cursor-not-allowed' : 'cursor-pointer'}
                          ${isLinedOut ? 'line-through opacity-60' : ''}
                        `}
                      >
                        <div className="flex items-start gap-4">
                          <span className="font-bold text-lg flex-shrink-0 text-gray-900">
                            {displayLetter}
                          </span>
                          <span className="text-base leading-6">
                            {text}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-gray-200 flex-shrink-0">
          {/* Progress Bar */}
          <div className="h-2 bg-gray-200">
            <div className="flex h-full">
              {questions.map((_, idx) => {
                const isCompleted = finalizedMap[idx];
                const hasWrongAttempt = hadWrongAttemptMap[idx];
                const isCurrent = idx === currentQuestionIndex;
                
                return (
                  <div
                    key={idx}
                    className={`flex-1 h-full border-r border-white last:border-r-0 ${
                      isCurrent
                        ? 'bg-blue-500'
                        : isCompleted
                          ? hasWrongAttempt
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                          : 'bg-gray-300'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between px-6 py-4">
            <div className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {questions.length}
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReportOpen(true)}
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                <Flag className="h-4 w-4 mr-1" />
                Report
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setReviewOpen(true)}
                className="text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                Review Menu
              </Button>
              
              {showFeedback && finalized && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExplanationClick}
                  disabled={explanationLoading}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  {explanationLoading ? "Loading..." : "Explanation"}
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToQuestion(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
                className="px-6 text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                Previous
              </Button>
              
              <Button
                onClick={handleNextQuestion}
                size="sm"
                className="px-6 bg-blue-600 hover:bg-blue-700 text-white border-0"
              >
                {currentQuestionIndex === questions.length - 1 ? "Finish Quiz" : "Next"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results view with chart
  const totalTime = Object.values(perQuestionTime).reduce((sum, time) => sum + time, 0);
  const avgTime = totalTime / questions.length;

  // Prepare chart data
  const chartData = questions.map((q, idx) => {
    const isCorrect = finalizedMap[idx] && !hadWrongAttemptMap[idx];
    const timeInSeconds = (perQuestionTime[idx] || 0) / 1000;
    return {
      questionNum: idx + 1,
      time: timeInSeconds,
      isCorrect,
      question: q,
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-green-50/20 dark:via-green-950/20 to-background p-4">
      <div className="max-w-6xl mx-auto">
        {/* Review Dialog */}
        <Dialog open={reviewingQuestion !== null} onOpenChange={() => setReviewingQuestion(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Question {reviewingQuestion !== null ? reviewingQuestion + 1 : ""} Review</DialogTitle>
            </DialogHeader>
            {reviewingQuestion !== null && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">Passage</h3>
                  <p className="text-sm">{questions[reviewingQuestion].passage || "No passage"}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">Question</h3>
                  <p className="text-sm">{questions[reviewingQuestion].question}</p>
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">Answer Choices</h3>
                  <div className="space-y-2">
                    {["A", "B", "C", "D"].map((letter) => {
                      const isCorrect = letter === questions[reviewingQuestion]["correct answer"];
                      return (
                        <div
                          key={letter}
                          className={`p-3 rounded-lg border-2 ${
                            isCorrect ? "bg-green-50 border-green-500" : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <span className="font-bold mr-2">{letter}.</span>
                          {questions[reviewingQuestion][`answer ${letter}` as keyof Question]}
                          {isCorrect && <span className="ml-2 text-green-600 font-semibold">✓ Correct</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                  <p className="text-sm">
                    <span className="font-semibold">Time spent:</span> {Math.round((perQuestionTime[reviewingQuestion] || 0) / 1000)}s
                  </p>
                  <p className="text-sm">
                    <span className="font-semibold">Your result:</span>{" "}
                    {finalizedMap[reviewingQuestion] && !hadWrongAttemptMap[reviewingQuestion] ? (
                      <span className="text-green-600 font-semibold">Correct ✓</span>
                    ) : (
                      <span className="text-red-600 font-semibold">Incorrect (had retry attempts)</span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card className="border-l-4 border-l-green-400 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-green-50/50 dark:from-green-950/50 to-emerald-50/50 dark:to-emerald-950/50">
            <CardTitle className="text-2xl flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Quiz Complete!
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">Final Score</h3>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {score}/{questions.length}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  {Math.round((score / questions.length) * 100)}% correct
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Total Time</h3>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {Math.floor(totalTime / 60000)}:{Math.floor((totalTime % 60000) / 1000).toString().padStart(2, "0")}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  {Math.floor(avgTime / 1000)}s avg per question
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Performance</h3>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                  {score === questions.length ? "Perfect!" : score >= questions.length * 0.8 ? "Great!" : score >= questions.length * 0.6 ? "Good" : "Keep Studying"}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                  {Object.values(hadWrongAttemptMap).filter(Boolean).length} had retry attempts
                </p>
              </div>
            </div>

            {/* Performance Graph */}
            <div className="bg-white dark:bg-gray-950 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-semibold mb-4">Time Per Question</h3>
              <p className="text-sm text-muted-foreground mb-4">Click on any point to review that question</p>
              <div className="w-full h-[400px]">
                <div className="flex flex-col h-full">
                  <div className="flex-1 relative">
                    <svg width="100%" height="100%" className="overflow-visible">
                      <defs>
                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                      {(() => {
                        const padding = { left: 50, right: 30, top: 20, bottom: 50 };
                        const svgWidth = 1000;
                        const svgHeight = 400;
                        const chartWidth = svgWidth - padding.left - padding.right;
                        const chartHeight = svgHeight - padding.top - padding.bottom;
                        
                        const maxTime = Math.max(...chartData.map(d => d.time), 1);
                        const xStep = chartWidth / (chartData.length - 1 || 1);
                        
                        // Generate path
                        const pathData = chartData.map((d, i) => {
                          const x = padding.left + i * xStep;
                          const y = padding.top + chartHeight - (d.time / maxTime) * chartHeight;
                          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                        }).join(' ');
                        
                        return (
                          <g>
                            {/* Grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const y = padding.top + chartHeight * (1 - ratio);
                              return (
                                <g key={ratio}>
                                  <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={padding.left + chartWidth}
                                    y2={y}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                  />
                                  <text
                                    x={padding.left - 10}
                                    y={y + 5}
                                    textAnchor="end"
                                    className="text-xs fill-gray-500"
                                  >
                                    {Math.round(maxTime * ratio)}s
                                  </text>
                                </g>
                              );
                            })}
                            
                            {/* Line */}
                            <path
                              d={pathData}
                              fill="none"
                              stroke="url(#lineGradient)"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            
                            {/* Points */}
                            {chartData.map((d, i) => {
                              const x = padding.left + i * xStep;
                              const y = padding.top + chartHeight - (d.time / maxTime) * chartHeight;
                              
                              return (
                                <g key={i}>
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r="8"
                                    fill={d.isCorrect ? "#10b981" : "#ef4444"}
                                    stroke="white"
                                    strokeWidth="2"
                                    className="cursor-pointer hover:r-10 transition-all"
                                    onClick={() => setReviewingQuestion(i)}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  {/* X-axis labels */}
                                  {i % Math.ceil(chartData.length / 15) === 0 && (
                                    <text
                                      x={x}
                                      y={padding.top + chartHeight + 20}
                                      textAnchor="middle"
                                      className="text-xs fill-gray-500"
                                    >
                                      Q{d.questionNum}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                            
                            {/* Axes */}
                            <line
                              x1={padding.left}
                              y1={padding.top + chartHeight}
                              x2={padding.left + chartWidth}
                              y2={padding.top + chartHeight}
                              stroke="#374151"
                              strokeWidth="2"
                            />
                            <line
                              x1={padding.left}
                              y1={padding.top}
                              x2={padding.left}
                              y2={padding.top + chartHeight}
                              stroke="#374151"
                              strokeWidth="2"
                            />
                          </g>
                        );
                      })()}
                    </svg>
                  </div>
                  <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-500"></div>
                      <span>Correct</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500"></div>
                      <span>Incorrect (had retry)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={startNewQuiz} className="flex-1">
                Start New Quiz
              </Button>
              <Link to="/" className="flex-1">
                <Button variant="outline" className="w-full">
                  Back to Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RevisionQuiz;