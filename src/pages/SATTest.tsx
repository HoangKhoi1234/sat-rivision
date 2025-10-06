import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Play, Clock, ChevronRight, Shuffle, HelpCircle, X, Highlighter, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useExplanation } from "@/hooks/useExplanation";
import AnnotatableText from "@/components/quiz/AnnotatableText";
import ReviewMenu from "@/components/quiz/ReviewMenu";
import Timer from "@/components/quiz/Timer";
import { formatSatInline } from "@/lib/formatText";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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

type TestState = "setup" | "module1" | "module2" | "results";

const SATTest = () => {
  const [testState, setTestState] = useState<TestState>("setup");
  const [currentModule, setCurrentModule] = useState<1 | 2>(1);
  const [questions, setQuestions] = useState<ShuffledQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState({ module1: 0, module2: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  
  // Timer state
  const TEST_DURATION = 32 * 60; // 32 minutes in seconds
  const [remainingSeconds, setRemainingSeconds] = useState(TEST_DURATION);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [testStart, setTestStart] = useState<number | null>(null);

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

  // Review menu
  const [reviewOpen, setReviewOpen] = useState(false);

  const { toast } = useToast();
  const { isLoading: explanationLoading, explanation, fetchExplanation, resetExplanation } = useExplanation();

  // Timer effects
  useEffect(() => {
    if (!timerRunning || testState === "setup" || testState === "results") return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      if (testStart) {
        const elapsed = Math.floor((now - testStart) / 1000);
        setElapsedSeconds(elapsed);
        setRemainingSeconds(Math.max(0, TEST_DURATION - elapsed));
        
        if (elapsed >= TEST_DURATION) {
          setTestState("results");
          setTimerRunning(false);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerRunning, testState, testStart, TEST_DURATION]);

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

  const fetchQuestions = async (count: number = 54) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("sat")
        .select("*")
        .limit(count + 10); // Get a few extra questions to ensure we have enough

      if (error) throw error;

      if (data && data.length >= count) {
        // Shuffle and take required number, then shuffle answers
        const shuffled = [...data].sort(() => 0.5 - Math.random()).slice(0, count).map(q => shuffleAnswers(q));
        setQuestions(shuffled);
        return true;
      } else {
        toast({
          title: "Insufficient Questions",
          description: `Need at least ${count} questions. Found ${data?.length || 0}.`,
          variant: "destructive",
        });
        return false;
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch questions. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const startTest = async () => {
    const success = await fetchQuestions(54); // 27 questions per module
    if (success) {
      setTestState("module1");
      setCurrentModule(1);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
      setScore({ module1: 0, module2: 0 });
      setTestStart(Date.now());
      setElapsedSeconds(0);
      setRemainingSeconds(TEST_DURATION);
      setTimerRunning(true);

      // Initialize per-question maps for 54 questions total
      const len = 54;
      const inc: Record<number, Set<string>> = {};
      const lined: Record<number, Set<string>> = {};
      const fin: Record<number, boolean> = {};
      const wrong: Record<number, boolean> = {};
      const pHtml: Record<number, string> = {};
      const qHtml: Record<number, string> = {};
      for (let i = 0; i < len; i++) {
        inc[i] = new Set();
        lined[i] = new Set();
        fin[i] = false;
        wrong[i] = false;
        pHtml[i] = "";
        qHtml[i] = "";
      }
      setIncorrectSelectionsMap(inc);
      setLinedOptionsMap(lined);
      setFinalizedMap(fin);
      setHadWrongAttemptMap(wrong);
      setPassageHtmlMap(pHtml);
      setQuestionHtmlMap(qHtml);
      setAnnotateEnabled(false);
      setLineMode(false);
    }
  };

  const handleAnswerSelect = (option: string) => {
    const idx = currentQuestionIndex;
    const moduleQuestions = getModuleQuestions();
    const currentQuestion = moduleQuestions[idx];
    
    if (finalizedMap[idx]) return;
    
    const startIndex = currentModule === 1 ? 0 : 27;
    const globalIndex = startIndex + idx;
    
    // Find original answer option for this shuffled answer
    const selectedAnswerObj = currentQuestion.shuffledAnswers.find(a => a.option === option);
    const originalAnswer = Object.keys(currentQuestion).find(key => 
      key.startsWith("answer ") && currentQuestion[key as keyof Question] === selectedAnswerObj?.text
    );
    const originalOption = originalAnswer?.split(" ")[1];
    
    setSelectedAnswers(prev => ({
      ...prev,
      [globalIndex]: originalOption || option
    }));

    if (originalOption === currentQuestion["correct answer"]) {
      // Finalize question
      setFinalizedMap({ ...finalizedMap, [idx]: true });
      setShowFeedback(true);
    } else {
      // Record incorrect attempt
      setIncorrectSelectionsMap((prev) => {
        const set = new Set(prev[idx] ?? new Set<string>());
        set.add(option);
        return { ...prev, [idx]: set };
      });
      setHadWrongAttemptMap({ ...hadWrongAttemptMap, [idx]: true });
    }
  };

  const handleExplanationClick = async () => {
    const moduleQuestions = getModuleQuestions();
    const currentQuestion = moduleQuestions[currentQuestionIndex];
    setShowExplanation(true);

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

  const getModuleQuestions = () => {
    // Each module has exactly 27 questions
    if (currentModule === 1) {
      return questions.slice(0, 27);
    } else {
      return questions.slice(27, 54);
    }
  };

  const finishModule = () => {
    const moduleQuestions = getModuleQuestions();
    const startIndex = currentModule === 1 ? 0 : 27;
    
    let correctCount = 0;
    moduleQuestions.forEach((q, idx) => {
      const globalIndex = startIndex + idx;
      if (selectedAnswers[globalIndex] === q["correct answer"]) {
        correctCount++;
      }
    });

    if (currentModule === 1) {
      setScore(prev => ({ ...prev, module1: correctCount }));
      setTestState("module2");
      setCurrentModule(2);
      setCurrentQuestionIndex(0);
    } else {
      setScore(prev => ({ ...prev, module2: correctCount }));
      setTestState("results");
      setTimerRunning(false);
    }
  };

  const resetTest = () => {
    setTestState("setup");
    setCurrentModule(1);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setScore({ module1: 0, module2: 0 });
    setElapsedSeconds(0);
    setRemainingSeconds(TEST_DURATION);
    setTimerRunning(false);
    setTestStart(null);
  };

  if (testState === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-orange-50/20 dark:via-orange-950/20 to-background p-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          
          <Card className="border-l-4 border-l-orange-400 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-orange-50/50 dark:from-orange-950/50 to-yellow-50/50 dark:to-yellow-950/50">
              <CardTitle className="text-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center">
                  <Play className="h-5 w-5 text-white" />
                </div>
                <span className="bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
                  SAT Practice Test
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-950/30 dark:to-yellow-950/30 rounded-full">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span className="font-semibold text-orange-700 dark:text-orange-300">32 Minutes • 54 Questions</span>
                </div>
                
                <div className="grid md:grid-cols-2 gap-4 mt-6">
                  <div className="p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
                    <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">Module 1</h3>
                    <p className="text-sm text-blue-600 dark:text-blue-400">27 questions</p>
                  </div>
                  <div className="p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                    <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">Module 2</h3>
                    <p className="text-sm text-purple-600 dark:text-purple-400">27 questions</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <Button 
                  onClick={startTest}
                  disabled={isLoading}
                  className="px-8 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white font-semibold rounded-lg shadow-lg"
                >
                  {isLoading ? "Loading..." : "Begin Test"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (testState === "results") {
    const totalQuestions = questions.length;
    const totalScore = score.module1 + score.module2;
    const percentage = Math.round((totalScore / totalQuestions) * 100);
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-green-50/20 dark:via-green-950/20 to-background p-4">
        <div className="max-w-4xl mx-auto">
          <Card className="border-l-4 border-l-green-400 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-50/50 dark:from-green-950/50 to-emerald-50/50 dark:to-emerald-950/50">
              <CardTitle className="text-2xl flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Test Complete!
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{score.module1}</div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">Module 1 Score</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                  <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{score.module2}</div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">Module 2 Score</div>
                </div>
                <div className="text-center p-4 border rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">{percentage}%</div>
                  <div className="text-sm text-green-600 dark:text-green-400">Overall Score</div>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <p className="text-lg">
                  You scored <span className="font-bold">{totalScore}</span> out of <span className="font-bold">{totalQuestions}</span> questions
                </p>
                <div className="flex justify-center gap-4">
                  <Button onClick={resetTest} variant="outline">
                    Take Another Test
                  </Button>
                  <Button asChild>
                    <Link to="/">Back to Home</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Test in progress (Module 1 or 2)
  const moduleQuestions = getModuleQuestions();
  const currentQuestion = moduleQuestions[currentQuestionIndex];
  const startIndex = currentModule === 1 ? 0 : 27;
  const globalQuestionIndex = startIndex + currentQuestionIndex;

  if (!currentQuestion) return null;

  const getAnswerVariant = (option: string) => {
    const idx = currentQuestionIndex;
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

  const handleNextQuestion = () => {
    if (currentQuestionIndex < moduleQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowFeedback(false);
      setShowExplanation(false);
      resetExplanation();
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setShowFeedback(finalizedMap[currentQuestionIndex - 1] ?? false);
      setShowExplanation(false);
      resetExplanation();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-blue-50/20 dark:via-blue-950/20 to-background p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Exit Test
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-full border">
              <span className="font-semibold">Module {currentModule}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-sm">Question {currentQuestionIndex + 1} of {moduleQuestions.length}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
                <Timer 
                  elapsedSeconds={elapsedSeconds} 
                  remainingSeconds={remainingSeconds}
                  showRemaining={true}
                />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReviewOpen(true)}
            >
              Review Menu
            </Button>
          </div>
        </div>

        {/* Main Content - 50/50 split with bottom navigation */}
        <div className="flex flex-col h-[calc(100vh-160px)]">
          {/* Content Area */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left - Passage */}
            {currentQuestion.passage && (
              <div className="flex flex-col">
                <Card className="flex-1 flex flex-col">
                  <CardHeader className="pb-3 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Reading Passage</CardTitle>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Highlighter className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setAnnotateEnabled(!annotateEnabled)}>
                              {annotateEnabled ? "Disable" : "Enable"} Annotations
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto">
                    <AnnotatableText
                      initialText={currentQuestion.passage}
                      htmlValue={passageHtmlMap[currentQuestionIndex]}
                      onChange={(html) => setPassageHtmlMap(prev => ({ ...prev, [currentQuestionIndex]: html }))}
                      enabled={annotateEnabled}
                      color={annotateColor}
                      mode={annotateMode}
                      className="prose prose-sm max-w-none text-sm leading-relaxed cursor-text"
                      variant="passage"
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Right - Question */}
            <div className={currentQuestion.passage ? "flex flex-col" : "col-span-2 flex flex-col"}>
              <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-3 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      Module {currentModule} • Question {currentQuestionIndex + 1}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {showFeedback && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleExplanationClick}
                          disabled={explanationLoading}
                          className="text-xs"
                        >
                          <HelpCircle className="h-4 w-4 mr-1" />
                          {explanationLoading ? "Loading..." : "Explain"}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto space-y-4">
                  <AnnotatableText
                    initialText={currentQuestion.question}
                    htmlValue={questionHtmlMap[currentQuestionIndex]}
                    onChange={(html) => setQuestionHtmlMap(prev => ({ ...prev, [currentQuestionIndex]: html }))}
                    enabled={annotateEnabled}
                    color={annotateColor}
                    mode={annotateMode}
                    className="prose prose-sm max-w-none"
                    variant="inline"
                  />
                  
                  {/* Answer Options */}
                  <div className="space-y-3">
                    {currentQuestion.shuffledAnswers.map((answerObj) => {
                      const { option, text } = answerObj;
                      const variant = getAnswerVariant(option);
                      const lined = linedOptionsMap[currentQuestionIndex]?.has(option) ?? false;
                      
                      return (
                        <Button
                          key={option}
                          variant={variant as any}
                          className={`w-full justify-start text-left h-auto p-4 relative ${
                            lined ? "after:absolute after:left-0 after:right-0 after:top-1/2 after:h-px after:bg-red-500" : ""
                          }`}
                          onClick={() => handleAnswerSelect(option)}
                          disabled={finalizedMap[currentQuestionIndex]}
                        >
                          <span className="font-semibold mr-3 shrink-0">{option}.</span>
                          <span className="text-wrap">{text}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Bottom Navigation - Fixed at bottom */}
          <div className="mt-6 flex justify-between items-center">
            <Button
              variant="outline"
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>

            <div className="flex gap-2">
              {currentQuestionIndex === moduleQuestions.length - 1 ? (
                <Button onClick={finishModule} className="bg-gradient-to-r from-primary to-accent">
                  {currentModule === 1 ? "Finish Module 1" : "Finish Test"}
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleNextQuestion} variant="outline">
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Explanation Modal */}
        {showExplanation && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader className="bg-gradient-to-r from-blue-50/50 dark:from-blue-950/50 to-purple-50/50 dark:to-purple-950/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      AI Explanation
                    </span>
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleCloseExplanation}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {explanationLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: explanation || "No explanation available." }} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Review Menu */}
        <ReviewMenu
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          questionsCount={moduleQuestions.length}
          getStatus={(index) => {
            if (finalizedMap[index]) return "correct";
            if (hadWrongAttemptMap[index]) return "incorrect";
            return "unanswered";
          }}
          onSelectQuestion={(index) => {
            setCurrentQuestionIndex(index);
            setReviewOpen(false);
            setShowFeedback(finalizedMap[index] ?? false);
            setShowExplanation(false);
            resetExplanation();
          }}
        />
      </div>
    </div>
  );
};

export default SATTest;