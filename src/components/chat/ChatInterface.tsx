import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { ConversationStarter } from "./ConversationStarter";
import { QuoteSheet } from "./QuoteSheet";
import { ConversationProgress } from "./ConversationProgress";
import { TypingIndicator } from "./TypingIndicator";
import { InlineProgressCard } from "./InlineProgressCard";
import { SmartScroll } from "./SmartScroll";
import { ConversationHistory } from "./ConversationHistory";
import { HelpCollapsible } from "./HelpCollapsible";
import { CustomerQuickSelect } from "@/components/CustomerQuickSelect";
import { TemplateQuickAccess } from "@/components/TemplateQuickAccess";
import { Loader2, RotateCcw, Sparkles, ChevronDown, ChevronUp, User } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  conversationFeedback?: any;
  readiness?: any;
  quickReplies?: Array<{ label: string; action: string }>;
}

interface ChatInterfaceProps {
  onQuoteGenerated: (quote: any) => void;
  isGenerating: boolean;
  onConversationUpdate?: (data: { 
    summary?: any; 
    liveExtraction?: any;
  }) => void; // P1: Send updates to parent for live preview
}

export const ChatInterface = ({ onQuoteGenerated, isGenerating, onConversationUpdate }: ChatInterfaceProps) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [generatedQuote, setGeneratedQuote] = useState<any>(null);
  const [conversationFeedback, setConversationFeedback] = useState<any>(null);
  const [readiness, setReadiness] = useState<any>(null);
  const [showProactivePrompt, setShowProactivePrompt] = useState(false);
  const [showQuoteSheet, setShowQuoteSheet] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [currentQuoteId, setCurrentQuoteId] = useState<string | null>(null);
  const [previousQuoteTotal, setPreviousQuoteTotal] = useState<number | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState<string>("");
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null);
  const [isDraftQuote, setIsDraftQuote] = useState(false); // FAS 22: Track if current quote is draft
  
  // P1: Progress tracking
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [maxQuestions, setMaxQuestions] = useState(4);
  const [answeredCategories, setAnsweredCategories] = useState<string[]>([]);
  const [totalCategories, setTotalCategories] = useState(5);
  
  // P1: Live extraction for preview
  const [liveExtraction, setLiveExtraction] = useState<any>({});
  const [lastAIQuestion, setLastAIQuestion] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const askedQuestions = useRef<Set<string>>(new Set());
  const { toast } = useToast();
  
  // P3: Message feedback tracking
  const handleMessageFeedback = async (messageId: string, helpful: boolean) => {
    console.log(`Message ${messageId} marked as ${helpful ? 'helpful' : 'unhelpful'}`);
    // Could save to database for learning purposes
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    getUser();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    const createSession = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('manage-conversation', {
          body: { action: 'create_session' }
        });
        if (error) throw error;
        if (data?.session?.id) {
          setSessionId(data.session.id);
        }
      } catch (error) {
        console.error('Error creating session:', error);
        toast({
          title: "Fel",
          description: "Kunde inte starta konversation. Försök igen.",
          variant: "destructive"
        });
      }
    };
    createSession();
  }, [toast]);

  const handleSendMessage = async (content: string, images?: string[], intent?: string, retryCount = 0) => {
    if (!sessionId) {
      // Try to recreate session
      try {
        const { data, error } = await supabase.functions.invoke('manage-conversation', {
          body: { action: 'create_session' }
        });
        if (error) throw error;
        if (data?.session?.id) {
          setSessionId(data.session.id);
          toast({
            title: "Session återställd",
            description: "Försöker igen..."
          });
          // Retry the message send
          return handleSendMessage(content, images, intent, retryCount);
        }
      } catch (error) {
        toast({
          title: "Fel",
          description: "Kunde inte skapa session. Ladda om sidan.",
          variant: "destructive"
        });
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    
    // P1: Extract data from user message for live preview
    const extractData = (text: string) => {
      const data: any = {};
      const lowerText = text.toLowerCase();
      
      // Extract project type
      if (lowerText.includes('badrum')) data.projectType = 'Badrumsrenovering';
      else if (lowerText.includes('kök')) data.projectType = 'Köksrenovering';
      else if (lowerText.includes('målning') || lowerText.includes('måla')) data.projectType = 'Målning';
      
      // Extract area
      const areaMatch = text.match(/(\d+)\s*(kvm|m2|kvadratmeter)/i);
      if (areaMatch) data.area = `${areaMatch[1]} kvm`;
      
      // Extract rooms
      const roomMatch = text.match(/(\d+)\s*rum/i);
      if (roomMatch) data.rooms = `${roomMatch[1]} rum`;
      
      // Extract materials
      const materials = [];
      if (lowerText.includes('kakel')) materials.push('Kakel');
      if (lowerText.includes('klinker')) materials.push('Klinker');
      if (lowerText.includes('parkett')) materials.push('Parkett');
      if (lowerText.includes('bänkskiva')) materials.push('Bänkskiva');
      if (materials.length > 0) data.materials = materials;
      
      return data;
    };
    
    const extracted = extractData(content);
    if (Object.keys(extracted).length > 0) {
      setLiveExtraction((prev: any) => {
        const newExtraction = { ...prev, ...extracted };
        // P1: Send to parent for live preview
        if (onConversationUpdate) {
          onConversationUpdate({ liveExtraction: newExtraction });
        }
        return newExtraction;
      });
    }

    try {
      const startTime = Date.now();
      
      // Step 1: Analyze images (if present)
      let imageAnalysis = null;
      if (images && images.length > 0) {
        toast({
          title: "📸 Steg 1/3: Analyserar bilder...",
          description: "Extraherar mått och detaljer"
        });

        try {
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-images', {
            body: { images, description: content }
          });

          if (analysisError) {
            console.error('Image analysis error:', analysisError);
            toast({
              title: "⚠️ Bildanalys hoppades över",
              description: "Fortsätter med textbeskrivning",
              variant: "default"
            });
          } else {
            imageAnalysis = analysisData;
            console.log('Image analysis:', imageAnalysis);
            
            if (imageAnalysis?.confidence === 'low') {
              toast({
                title: "⚠️ Osäker bildanalys",
                description: "Lägg gärna till mer detaljer",
                variant: "default"
              });
            } else {
              toast({
                title: "✅ Bildanalys klar",
                description: "Bilder analyserade"
              });
            }
          }
        } catch (error) {
          console.error('Image analysis exception:', error);
          toast({
            title: "⚠️ Bildanalys hoppades över",
            description: "Fortsätter med textbeskrivning"
          });
        }
      }

      // Step 2: Save user message and check readiness
      const saveResult = await supabase.functions.invoke('manage-conversation', {
        body: {
          action: 'save_message',
          sessionId,
          message: { role: 'user', content }
        }
      });

      // FAS 20: Handle draft quote readiness
      if (saveResult.data?.readyForDraftQuote) {
        console.log('📄 FAS 20: Ready for draft quote, generating...');
        // Fall through to generate draft quote
      }
      
      // FIX 1: If AI wants to ask questions, show them INSTEAD of generating quote
      if (saveResult.data?.suggestedQuestions && saveResult.data.suggestedQuestions.length > 0) {
        console.log('🤔 AI vill ställa frågor först, hoppar över offertgenerering');
        
        const questionsText = saveResult.data.suggestedQuestions
          .map((q: string, i: number) => `${i + 1}. ${q}`)
          .join('\n\n');

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `För att ge dig en exakt offert behöver jag veta:\n\n${questionsText}\n\nSvara gärna i fritext eller besvara frågorna en i taget! 📝`,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, aiMessage]);
        
        // P1: Store last AI question for dynamic placeholder
        if (saveResult.data.suggestedQuestions.length > 0) {
          setLastAIQuestion(saveResult.data.suggestedQuestions[0]);
        }
        
        // Save AI message
        await supabase.functions.invoke('manage-conversation', {
          body: {
            action: 'save_message',
            sessionId,
            message: { 
              role: 'assistant', 
              content: aiMessage.content,
              aiQuestions: saveResult.data.suggestedQuestions
            }
          }
        });
        
        // FAS 20: Show progress with categories answered
        if (saveResult.data?.answeredCategories !== undefined) {
          // P1: Update progress state
          setQuestionsAsked(saveResult.data.questionsAsked || 0);
          setMaxQuestions(saveResult.data.maxQuestions || 4);
          setAnsweredCategories(saveResult.data.answeredCategoryNames || []);
          setTotalCategories(saveResult.data.totalCategories || 5);
          
          toast({
            title: `📊 Progress: ${saveResult.data.answeredCategories}/${saveResult.data.totalCategories} kategorier`,
            description: `${saveResult.data.questionsAsked}/${saveResult.data.maxQuestions} frågor ställda`
          });
        }
        
        setIsTyping(false);
        return; // STOP here, don't generate quote yet
      }

      // FAS 4: Display suggested question if available (legacy support)
      if (saveResult.data?.suggestedQuestion) {
        setSuggestedQuestion(saveResult.data.suggestedQuestion);
      }

      // Step 3: Generate quote (only if no questions needed)
      toast({
        title: imageAnalysis ? "🧮 Steg 2/3: Beräknar..." : "🧮 Steg 1/2: Beräknar...",
        description: "Analyserar projekt och kostnader"
      });

      // ÅTGÄRD 1: Inkludera senaste user-meddelandet direkt i conversation_history
      const conversationHistory = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const { data, error } = await supabase.functions.invoke('generate-quote', {
          body: {
            description: content,
            conversation_history: conversationHistory,
            sessionId: sessionId,
            detailLevel: 'standard',
            deductionType: 'auto',
            numberOfRecipients: 1,
            imageAnalysis: imageAnalysis,
            intent: intent,
            previous_quote_id: currentQuoteId, // SPRINT 1.5: Enable delta mode
            isDraft: saveResult.data?.isDraft || false // FAS 20: Draft mode
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (error) {
          console.error('Generate quote error:', error);
          
          // Check for rate limit or payment errors (402/429)
          if (error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit')) {
            throw new Error('För många förfrågningar. Vänta en stund och försök igen.');
          }
          if (error.message?.includes('402') || error.message?.toLowerCase().includes('payment')) {
            throw new Error('AI-krediter är slut. Fyll på krediter i Settings → Workspace → Usage.');
          }
          
          // Check for specific error types
          if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
            throw new Error('NETWORK_ERROR');
          }
          throw error;
        }

        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Quote generated in ${elapsedTime}s`);

        console.log('Generate quote response:', data);

        // Hantera olika response-typer
        if (data?.type === 'clarification') {
          // ÅTGÄRD 2: Filtrera bort dubblettfrågor innan visning
          const normalizeQuestion = (q: string) => 
            q.trim().toLowerCase().replace(/[.!?]+$/, '');
          
          const newQuestions = data.questions.filter((q: string) => {
            const normalized = normalizeQuestion(q);
            return !askedQuestions.current.has(normalized);
          });
          
          // Lägg till nya frågor i set
          newQuestions.forEach((q: string) => {
            askedQuestions.current.add(normalizeQuestion(q));
          });
          
          // Om inga nya frågor, hoppa över detta steg
          if (newQuestions.length === 0) {
            console.log('⚠️ Alla frågor redan ställda, hoppar över');
            setIsTyping(false);
            return;
          }
          
          // AI:n behöver mer info
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: newQuestions.join('\n\n'),
            timestamp: new Date(),
            conversationFeedback: data.conversationFeedback,
            readiness: data.readiness
          };
          setMessages(prev => [...prev, aiMessage]);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          // SPRINT 1: Spara AI-frågor med tracking för att förhindra repetition
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { 
                role: 'assistant', 
                content: aiMessage.content,
                aiQuestions: newQuestions // Track questions to prevent asking again
              }
            }
          });
          
        } else if (data?.type === 'context_confirmation') {
          // ÅTGÄRD 1: Visa sammanfattning och be om bekräftelse
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
            conversationFeedback: data.conversationFeedback,
            readiness: data.readiness,
            quickReplies: data.quickReplies
          };
          setMessages(prev => [...prev, aiMessage]);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          // Spara AI-svar
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
          
        } else if (data?.type === 'conversation_review') {
          // ÅTGÄRD 4: Visa tre valmöjligheter för användaren
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
            conversationFeedback: data.conversationFeedback,
            readiness: data.readiness,
            quickReplies: data.quickReplies
          };
          setMessages(prev => [...prev, aiMessage]);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          // Spara AI-svar
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
          
        } else if (data?.type === 'proactive_ready') {
          // PROBLEM #6: PROACTIVE SIGNALING
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message,
            timestamp: new Date(),
            conversationFeedback: data.conversationFeedback,
            readiness: data.readiness
          };
          setMessages(prev => [...prev, aiMessage]);
          setShowProactivePrompt(true);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          // Spara AI-svar
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
          
        } else if (data?.type === 'complete_quote') {
          // ÅTGÄRD 3: Validera att offerten är giltig innan vi visar den
          if (!data.quote || !data.quote.summary) {
            console.error('❌ Invalid quote received:', data);
            toast({
              title: "Fel i offerten",
              description: "Offerten kunde inte genereras korrekt. Försök igen eller kontakta support.",
              variant: "destructive"
            });
            return;
          }
          
          // STEG 4: Visa tidsbesparing om tillgänglig
          if (data.timeSaved && data.timeSaved > 0) {
            toast({
              title: "Offert klar!",
              description: `⏱️ Du sparade ~${data.timeSaved} minuter jämfört med manuell offert`,
            });
          }

          // Validera att alla kritiska fält finns och är giltiga nummer
          const hasValidSummary = 
            typeof data.quote.summary.totalBeforeVAT === 'number' &&
            typeof data.quote.summary.totalWithVAT === 'number' &&
            !isNaN(data.quote.summary.totalBeforeVAT) &&
            !isNaN(data.quote.summary.totalWithVAT) &&
            data.quote.summary.totalBeforeVAT >= 0 &&
            data.quote.summary.totalWithVAT >= 0;

          if (!hasValidSummary) {
            console.error('❌ Quote summary has invalid values:', data.quote.summary);
            toast({
              title: "Fel i beräkningar",
              description: "Offerten innehåller felaktiga beräkningar. Försök igen.",
              variant: "destructive"
            });
            return;
          }

          const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
          
          // SPRINT 1: Visa antaganden om de finns
          if (data.assumptions && data.assumptions.length > 0) {
            console.log('🧠 AI gjorde följande antaganden:', data.assumptions);
            toast({
              title: "⚠️ Antaganden gjorda",
              description: `AI:n gjorde ${data.assumptions.length} antagande${data.assumptions.length > 1 ? 'n' : ''} i offerten. Se offerten för detaljer.`,
              variant: "default"
            });
          }
          
          // Show success with timing
          toast({
            title: "✅ Offert genererad!",
            description: `Klar på ${elapsedTime} sekunder${data.usedFallback ? ' (snabbt läge)' : ''}`
          });

          // Komplett offert genererad - visa i sheet
          setShowProactivePrompt(false);
          setGeneratedQuote(data.quote);
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          setShowQuoteSheet(true);
          setIsDraftQuote(data.isDraft || false); // FAS 22: Track if draft quote
          
          // SPRINT 1.5: Track delta mode state
          if (data.is_delta_mode) {
            setPreviousQuoteTotal(data.previous_quote_total);
          }
          
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.is_delta_mode 
              ? '✅ Jag har uppdaterat offerten med dina ändringar!' 
              : '✅ Här är din offert! Du kan skicka den till kunden, spara som utkast eller redigera den.',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiMessage]);
          
          // FAS 4: Show validation warnings if present
          if (data.validationWarnings?.length > 0) {
            const criticalIssues = data.validationWarnings.filter((w: any) => 
              w.severity === 'CRITICAL' || w.severity === 'ERROR'
            );
            if (criticalIssues.length > 0) {
              toast({
                title: "⚠️ Kvalitetsvarningar",
                description: `${criticalIssues.length} problem hittades i offerten. Se detaljer nedan.`,
                variant: "destructive"
              });
            }
          }
          
          // SPRINT 1.5: Show warnings if consistency issues detected
          if (data.warnings?.length > 0) {
            const warningMessage: Message = {
              id: (Date.now() + 2).toString(),
              role: 'assistant',
              content: '⚠️ Observera:\n' + data.warnings.map((w: string) => `• ${w}`).join('\n'),
              timestamp: new Date()
            };
            setMessages(prev => [...prev, warningMessage]);
          }
          
          // Spara AI-svar
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
        } else if (data.type === 'edit_prompt') {
          // Handle edit prompt (legacy support)
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: data.message || 'Vad vill du ändra?',
            timestamp: new Date(),
            quickReplies: data.quickReplies
          };
          setMessages(prev => [...prev, aiMessage]);
          
          setConversationFeedback(data.conversationFeedback);
          setReadiness(data.readiness);
          
          await supabase.functions.invoke('manage-conversation', {
            body: {
              action: 'save_message',
              sessionId,
              message: { role: 'assistant', content: aiMessage.content }
            }
          });
        } else if (data.type === 'error') {
          // Handle error response
          throw new Error(data.message || 'Ett fel uppstod på servern');
        } else {
          // Okänd response-typ eller fel struktur
          console.error('Unexpected response format:', data);
          throw new Error(data.message || 'Oväntat response-format från servern');
        }
      } catch (invokeError: any) {
        clearTimeout(timeoutId);
        
        if (invokeError.name === 'AbortError') {
          throw new Error('Offertgenereringen tog för lång tid (>120s). Försök igen.');
        }
        throw invokeError;
      }
      
    } catch (error: any) {
      console.error('Error:', error);
      
      // Retry logic for network errors
      if (error.message === 'NETWORK_ERROR' && retryCount < 2) {
        const backoffTime = retryCount === 0 ? 1500 : 3000;
        toast({
          title: "⏳ Nätverksfel",
          description: `Försöker igen om ${backoffTime/1000}s...`
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return handleSendMessage(content, images, intent, retryCount + 1);
      }
      
      toast({
        title: "Fel",
        description: error instanceof Error ? error.message : "Något gick fel. Försök igen.",
        variant: "destructive"
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleNewConversation = async () => {
    if (sessionId) {
      try {
        await supabase.functions.invoke('manage-conversation', {
          body: { action: 'update_status', sessionId, status: 'completed' }
        });
      } catch (error) {
        console.error('Error updating session status:', error);
      }
    }
    
    // Skapa ny session
    try {
      const { data, error } = await supabase.functions.invoke('manage-conversation', {
        body: { action: 'create_session' }
      });
      
      if (error) throw error;
      
      if (data?.session?.id) {
        setSessionId(data.session.id);
        setMessages([]);
        setGeneratedQuote(null);
        setConversationFeedback(null);
        setReadiness(null);
        setShowProactivePrompt(false);
        setCurrentQuoteId(null);
        setPreviousQuoteTotal(null);
        setIsDraftQuote(false); // FAS 22: Reset draft flag
        askedQuestions.current.clear();
        toast({
          title: "Ny konversation",
          description: "Börja om med en ny offertförfrågan."
        });
      }
    } catch (error) {
      console.error('Error creating new session:', error);
      toast({
        title: "Fel",
        description: "Kunde inte starta ny konversation.",
        variant: "destructive"
      });
    }
  };

  // FAS 22: Handle refinement request (triggers Stage 2 questions)
  const handleRequestRefinement = async () => {
    if (!sessionId) return;
    
    try {
      const { error } = await supabase.functions.invoke('manage-conversation', {
        body: { action: 'request_refinement', sessionId }
      });
      
      if (error) throw error;
      
      setShowQuoteSheet(false);
      setIsDraftQuote(false);
      
      toast({
        title: "🔧 Förfiningar begärda",
        description: "Jag ställer nu fördjupande frågor för att förbättra offerten."
      });
      
      await handleSendMessage("Jag vill förfina offerten");
    } catch (error: any) {
      console.error('Error requesting refinement:', error);
      toast({
        title: "Fel",
        description: "Kunde inte begära förfining",
        variant: "destructive"
      });
    }
  };

  const handleSendQuote = async () => {
    if (!generatedQuote) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Användaren är inte inloggad');
      
      // Extract deduction type from quote
      const deductionType = generatedQuote.deductionType || 
                           generatedQuote.summary?.deduction?.type?.toLowerCase() || 
                           'none';
      
      const { data: savedQuote, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: generatedQuote.title || 'Offert',
          description: messages.find(m => m.role === 'user')?.content || '',
          generated_quote: generatedQuote,
          deduction_type: deductionType,
          status: 'draft',
          customer_id: null
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setShowQuoteSheet(false);
      
      toast({
        title: "✅ Offert sparad!",
        description: "Nu kan du välja mottagare och skicka."
      });
      
      navigate('/quotes');
      
    } catch (error: any) {
      console.error('Error saving quote:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte spara offert",
        variant: "destructive"
      });
    }
  };

  const handleSaveAsDraft = async () => {
    if (!generatedQuote) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Användaren är inte inloggad');
      
      // Extract deduction type from quote
      const deductionType = generatedQuote.deductionType || 
                           generatedQuote.summary?.deduction?.type?.toLowerCase() || 
                           'none';
      
      const { data, error } = await supabase
        .from('quotes')
        .insert({
          user_id: user.id,
          title: generatedQuote.title || 'Offert',
          description: messages.find(m => m.role === 'user')?.content || '',
          generated_quote: generatedQuote,
          deduction_type: deductionType,
          status: 'draft',
          customer_id: null
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Save the quote ID for delta mode
      if (data?.id) {
        setCurrentQuoteId(data.id);
        setPreviousQuoteTotal(parseFloat(generatedQuote.summary?.customerPays || '0'));
      }
      
      toast({
        title: "✅ Offert sparad!",
        description: "Offerten finns nu i dina utkast."
      });
      
      setShowQuoteSheet(false);
      
    } catch (error: any) {
      console.error('Error saving quote:', error);
      toast({
        title: "Fel",
        description: error.message || "Kunde inte spara offert",
        variant: "destructive"
      });
    }
  };

  const handleEditQuote = () => {
    if (!generatedQuote) return;
    setShowQuoteSheet(false);
    onQuoteGenerated(generatedQuote);
  };

  const handleStarterClick = (text: string) => {
    handleSendMessage(text);
  };

  const handleGenerateQuote = () => {
    handleSendMessage("Generera en offert baserat på vår konversation");
    setShowProactivePrompt(false);
  };

  return (
    <>
      <Card className="overflow-hidden">
        <div 
          ref={chatContainerRef}
          className="flex flex-col min-h-[500px] max-h-[calc(100vh-200px)] md:min-h-[600px] md:max-h-[calc(100vh-150px)] bg-background relative"
        >
          {/* AI Processing Banner - Compact */}
          {isTyping && (
            <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 via-blue-500/10 to-purple-500/10 border-b border-primary/20 px-4 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-sm font-medium text-foreground">
                  AI:n analyserar...
                </p>
              </div>
            </div>
          )}

          {/* Compact Help Collapsible */}
          {messages.length > 0 && !generatedQuote && (
            <HelpCollapsible 
              currentMessageCount={messages.length}
              autoHideAfterMessages={3}
            />
          )}

          {/* Proactive Ready Banner - Sticky at top */}
          {showProactivePrompt && readiness && readiness.readiness_score >= 85 && (
            <div className="sticky top-0 z-10 bg-gradient-to-r from-green-500/10 via-primary/10 to-blue-500/10 border-b border-primary/20 px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      🎉 Redo att generera offert!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Jag har tillräckligt med information ({readiness.readiness_score}% beredskap)
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => setShowProactivePrompt(false)}
                    className="flex-shrink-0"
                  >
                    Fortsätt konversation
                  </Button>
                  <Button 
                    size="sm"
                    onClick={handleGenerateQuote}
                    className="flex-shrink-0 gap-2"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generera offert
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Compact Readiness Panel */}
          {readiness && readiness.readiness_score < 85 && !generatedQuote && messages.length > 0 && (
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b px-4 py-2">
              <div 
                className="cursor-pointer select-none"
                onClick={() => setFeedbackExpanded(!feedbackExpanded)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <Progress value={readiness.readiness_score} className="h-2" />
                    </div>
                    <span className="text-xs font-bold tabular-nums flex-shrink-0">
                      {readiness.readiness_score}%
                    </span>
                  </div>
                  {feedbackExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              </div>

              {/* Expandable details */}
              {feedbackExpanded && conversationFeedback && (
                <div className="mt-3 space-y-2 pt-2 border-t">
                  {/* Understood items */}
                  {conversationFeedback.understood && Object.keys(conversationFeedback.understood).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                        ✅ Förstått
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(conversationFeedback.understood).map(([key, val]) => (
                          <Badge 
                            key={key} 
                            variant="secondary" 
                            className="text-xs bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                          >
                            {key}: {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Critical missing items */}
                  {readiness.critical_missing && readiness.critical_missing.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-destructive mb-1 flex items-center gap-1">
                        ❌ Behövs för offert
                      </p>
                      <div className="space-y-0.5">
                        {readiness.critical_missing.map((item: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-destructive">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Optional missing items */}
                  {readiness.optional_missing && readiness.optional_missing.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-amber-600 dark:text-amber-500 mb-1 flex items-center gap-1">
                        💡 Kan förbättras
                      </p>
                      <div className="space-y-0.5">
                        {readiness.optional_missing.map((item: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <span className="text-amber-600 dark:text-amber-500">•</span>
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Floating Action Button for Skip Questions */}
          {readiness && readiness.readiness_score >= 50 && readiness.readiness_score < 85 && !generatedQuote && messages.length > 0 && (
            <Button
              size="sm"
              className="fixed bottom-24 right-6 z-20 shadow-lg gap-2 animate-in fade-in-0 slide-in-from-bottom-4"
              onClick={() => handleSendMessage("Generera offert med nuvarande information")}
            >
              <Sparkles className="h-4 w-4" />
              Generera nu
            </Button>
          )}

          {/* Header med "Ny konversation"-knapp */}
          {messages.length > 0 && (
            <div className="border-b bg-muted/30 px-4 py-2 flex justify-end">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleNewConversation}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Ny konversation
              </Button>
            </div>
          )}
          
          {/* P1: Progress Indicator */}
          {messages.length > 0 && questionsAsked > 0 && questionsAsked < maxQuestions && !generatedQuote && (
            <div className="px-4 pt-4">
              <ConversationProgress
                currentQuestion={questionsAsked}
                totalQuestions={maxQuestions}
                answeredCategories={answeredCategories}
                totalCategories={totalCategories}
              />
            </div>
          )}
          
          {/* Messages Area */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  Beskriv ditt projekt
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Jag hjälper dig skapa en professionell offert
                </p>
              </div>
              
              {/* Customer Quick Select */}
              {userId && (
                <div className="w-full max-w-md space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Välj en kund (valfritt)</span>
                  </div>
                  <CustomerQuickSelect
                    onSelect={(customer) => {
                      setSelectedCustomer(customer);
                      toast({
                        title: "Kund vald",
                        description: `${customer.name} - information autofylls i offerten`
                      });
                    }}
                    selectedCustomerId={selectedCustomer?.id}
                  />
                </div>
              )}
              
              <ConversationStarter onStarterClick={handleStarterClick} />
              
              {/* Template Quick Access */}
              {userId && userMessage.length > 20 && (
                <div className="w-full max-w-2xl">
                  <TemplateQuickAccess
                    description={userMessage}
                    userId={userId}
                    onSelectTemplate={(template) => {
                      const templateText = template.template_data?.description || template.description;
                      setUserMessage(templateText);
                      handleSendMessage(templateText);
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* P2: Collapsible History */}
              {messages.length > 10 && (
                <ConversationHistory
                  messages={messages}
                  currentMessageIndex={messages.length}
                  onSendMessage={handleSendMessage}
                  isTyping={isTyping}
                />
              )}
              
              {messages.slice(messages.length > 10 ? -10 : 0).map((message, index) => (
                <div key={message.id} className="space-y-3">
                  <MessageBubble 
                    message={message} 
                    onSendMessage={handleSendMessage}
                    isTyping={isTyping}
                    onFeedback={handleMessageFeedback}
                  />
                  {/* P1: Show inline progress card after user messages */}
                  {message.role === 'user' && index === messages.length - 1 && Object.keys(liveExtraction).length > 0 && (
                    <InlineProgressCard data={liveExtraction} />
                  )}
                </div>
              ))}
              
              {/* P0: Typing Indicator */}
              {isTyping && <TypingIndicator />}
              
              {/* Quote generated - show button to open sheet */}
              {generatedQuote && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 animate-in fade-in-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">Offert genererad!</p>
                        <p className="text-xs text-muted-foreground">
                          Klicka för att granska och skicka
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => setShowQuoteSheet(true)}
                      className="gap-2"
                    >
                      Visa offert
                    </Button>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
          
          {/* P2: Smart Scroll Button */}
          <SmartScroll
            messages={messages}
            isTyping={isTyping}
            containerRef={chatContainerRef}
          />
        </div>
        
        {/* Input Area - Sticky Bottom */}
        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur-sm px-4 py-4 z-10 space-y-3">
          {/* Show selected customer context */}
          {selectedCustomer && (
            <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedCustomer.name}</span>
                {selectedCustomer.property_designation && (
                  <span className="text-muted-foreground">• {selectedCustomer.property_designation}</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
                className="h-7"
              >
                Ta bort
              </Button>
            </div>
          )}
          
          <ChatInput 
            onSendMessage={(message, images, intent) => {
              setUserMessage(message);
              handleSendMessage(message, images, intent);
            }} 
            disabled={isTyping}
            dynamicPlaceholder={
              lastAIQuestion 
                ? lastAIQuestion.includes('storlek') || lastAIQuestion.includes('yta')
                  ? 'Ex: 50 kvm eller 3 rum...'
                  : lastAIQuestion.includes('material')
                  ? 'Ex: Standard, mellanklass eller premium...'
                  : lastAIQuestion.includes('budget')
                  ? 'Ex: 150 000 kr eller 100-200 tkr...'
                  : undefined
                : undefined
            }
          />
        </div>
      </div>
    </Card>

    {/* Quote Sheet Modal */}
    <QuoteSheet
      open={showQuoteSheet}
      onOpenChange={setShowQuoteSheet}
      quote={generatedQuote}
      onSend={handleSendQuote}
      onSaveAsDraft={handleSaveAsDraft}
      onEdit={handleEditQuote}
      isDraft={isDraftQuote}
      onRefine={handleRequestRefinement}
    />
  </>
  );
};
