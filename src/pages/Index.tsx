import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Plus, Library, Sparkles, LogIn, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-accent/5 to-background p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-gradient-to-r from-pink-400/20 to-red-400/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-gradient-to-r from-green-400/20 to-blue-400/20 rounded-full blur-xl animate-pulse delay-2000"></div>
        <div className="absolute bottom-20 right-1/3 w-28 h-28 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 rounded-full blur-xl animate-pulse delay-500"></div>
      </div>
      
      <div className="max-w-6xl mx-auto relative z-10">
        {/* Auth Button */}
        <div className="flex justify-end mb-4">
          {user ? (
            <Button onClick={handleSignOut} variant="outline" className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          ) : (
            <Button asChild className="gap-2">
              <Link to="/auth">
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            </Button>
          )}
        </div>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center animate-pulse shadow-2xl shadow-purple-500/25">
              <BookOpen className="h-8 w-8 text-white drop-shadow-lg" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 via-pink-600 to-orange-600 bg-clip-text text-transparent drop-shadow-sm">
              SAT Revision Hub
            </h1>
          </div>
          <p className="text-xl text-muted-foreground mb-4">
            Add new SAT questions and practice with interactive quizzes
          </p>
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary/10 to-accent/10 rounded-full border border-primary/20 backdrop-blur-sm">
              <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
              <span className="text-sm text-muted-foreground">Your complete SAT preparation toolkit</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 rounded-full border border-blue-200/50 dark:border-blue-800/50">
                <div className="w-1.5 h-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-pulse"></div>
                AI explanations in seconds
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-full border border-purple-200/50 dark:border-purple-800/50">
                <div className="w-1.5 h-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-pulse"></div>
                Fun real SAT test experience
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-full border border-green-200/50 dark:border-green-800/50">
                <div className="w-1.5 h-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full animate-pulse"></div>
                Instant feedback & scoring
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 border-l-4 border-l-green-400 bg-gradient-to-br from-card to-green-50/20 dark:to-green-950/20 hover:shadow-green-500/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/25">
                  <Plus className="h-4 w-4 text-white drop-shadow-sm" />
                </div>
                <span className="bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 bg-clip-text text-transparent font-semibold">
                  Submit New SAT Question
                </span>
              </CardTitle>
              <CardDescription>
                Submit new SAT questions to help expand the question pool
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 shadow-lg shadow-green-500/25 border-0">
                <Link to="/add-question">
                  Submit Question
                </Link>
              </Button>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 border-l-4 border-l-blue-400 bg-gradient-to-br from-card to-blue-50/20 dark:to-blue-950/20 hover:shadow-blue-500/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <BookOpen className="h-4 w-4 text-white drop-shadow-sm" />
                </div>
                <span className="bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent font-semibold">
                  Revision Quiz
                </span>
              </CardTitle>
              <CardDescription>
                Practice with randomized SAT questions designed like the real SAT test. Fun, engaging, and challenging!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300">
                <Link to="/revision-quiz">
                  Start Quiz
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 border-l-4 border-l-purple-400 bg-gradient-to-br from-card to-purple-50/20 dark:to-purple-950/20 hover:shadow-purple-500/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <Library className="h-4 w-4 text-white drop-shadow-sm" />
                </div>
                <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-700 bg-clip-text text-transparent font-semibold">
                  View All Questions
                </span>
              </CardTitle>
              <CardDescription>
                Browse all SAT questions with correct answers and AI-generated explanations delivered in seconds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full border-purple-300 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20 hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300">
                <Link to="/all-questions">
                  View Questions
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Additional Features Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-full border border-indigo-200/50 dark:border-indigo-800/50 backdrop-blur-sm">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Complete SAT Preparation Ecosystem
            </span>
          </div>
        </div>
        
        {/* Designer Credit */}
        <div className="text-center mt-12 pt-8 border-t border-border/30">
          <p className="text-sm text-muted-foreground">
            Designed by{" "}
            <span className="font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Mai Hoang Khoi
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
