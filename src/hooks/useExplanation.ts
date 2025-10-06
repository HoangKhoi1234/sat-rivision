import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface Question {
  passage?: string;
  question: string;
  "answer A": string;
  "answer B": string;
  "answer C": string;
  "answer D": string;
  "correct answer": string;
}

export const useExplanation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchExplanation = async (question: Question) => {
    setIsLoading(true);
    setExplanation(null); // Clear previous explanation immediately
    try {
      const payload = {
        passage: question.passage || "",
        question: question.question,
        "answer A": question["answer A"],
        "answer B": question["answer B"],
        "answer C": question["answer C"],
        "answer D": question["answer D"],
        "correct answer": question["correct answer"]
      };

      const response = await fetch("https://n8n.makexyz.site/webhook/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch explanation");
      }

      const data = await response.json();
      const explanationText = data[0]?.output || "No explanation available";
      setExplanation(explanationText);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch explanation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetExplanation = () => {
    setExplanation(null);
  };

  return {
    isLoading,
    explanation,
    fetchExplanation,
    resetExplanation,
  };
};