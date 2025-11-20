/**
 * TEMP FILE: Clean end section after Pipeline Orchestrator
 * This replaces lines 5150-6313 in index.ts
 */

// This is the clean version that should replace the duplicated logic
// after Pipeline Orchestrator runs

/*

    // ============================================================================
    // FAS 6B: USE PIPELINE ORCHESTRATOR RESULT - NO DUPLICATED LOGIC
    // ============================================================================
    
    console.log('✅ FAS 6B: Using Pipeline Orchestrator result directly');
    
    // Pipeline Orchestrator has already done:
    // - Merge Engine (slår ihop dubbletter)
    // - Formula Engine (beräknar allt korrekt)
    // - Domain Validation (validerar mot jobbtyps-regler)
    // - Math Guard (verifierar matematik)
    // - ROT/RUT calculations
    
    // Use the quote from Pipeline Orchestrator (already mathematically perfect)
    quote = pipelineResult.quote;
    
    // SPRINT 2: Generate smart auto-title (only thing we add)
    const smartTitle = generateQuoteTitle(conversationFeedback, description);
    quote.title = smartTitle;
    console.log(`📝 Generated title: "${smartTitle}"`);

    // SPRINT 1.5: Validate quote consistency if in delta mode
    let consistencyWarnings: string[] = [];
    if (isDeltaMode && previousQuoteTotal > 0) {
      console.log('🔍 SPRINT 1.5: Validating quote consistency...');
      const lastUserMsg = actualConversationHistory.filter(m => m.role === 'user').slice(-1)[0];
      const consistencyValidation = validateQuoteConsistency(
        previousQuote,
        quote,
        lastUserMsg?.content || description
      );
      
      if (!consistencyValidation.isConsistent) {
        console.error('❌ INCONSISTENCY DETECTED:', consistencyValidation.warnings);
        consistencyWarnings = consistencyValidation.warnings;
      } else {
        console.log('✅ Quote consistency validated - price logic is correct');
      }
    }

    // ============================================
    // CALCULATE CONFIDENCE SCORE
    // ============================================
    
    console.log('📊 Calculating confidence score...');
    const confidenceScore = calculateConfidenceScore(
      quote,
      description,
      conversation_history,
      hourlyRates || [],
      similarQuotes
    );

    console.log(`📊 Confidence: ${Math.round(confidenceScore.overall * 100)}%`);
    
    if (confidenceScore.missingInfo.length > 0) {
      console.log(`⚠️ Missing info: ${confidenceScore.missingInfo.join(', ')}`);
    }

    // ============================================
    // DELTA ENGINE (if delta mode)
    // ============================================
    let deltaWarnings: string[] = [];
    
    if (isDeltaMode && previousQuote && previousQuoteTotal > 0) {
      console.log('🔄 Applying Delta Engine validation...');
      
      const lastUserMsg = actualConversationHistory.filter(m => m.role === 'user').slice(-1)[0];
      const userMessage = lastUserMsg?.content || description;
      
      const deltaChanges = detectDeltaChanges(userMessage, previousQuote);
      console.log(`🔍 Detected ${deltaChanges.length} delta changes:`, deltaChanges);
      
      const deltaValidation = validatePriceDelta(
        previousQuote,
        quote,
        deltaChanges,
        userMessage
      );
      
      if (!deltaValidation.valid) {
        console.error('⚠️ DELTA VALIDATION WARNINGS:', deltaValidation.warnings);
        deltaWarnings = deltaValidation.warnings;
      } else {
        console.log(`✅ Delta validation passed - price change: ${deltaValidation.priceChange > 0 ? '+' : ''}${deltaValidation.priceChange.toLocaleString('sv-SE')} kr`);
      }
    }
    
    // ============================================
    // RISK MARGIN (Optional for large projects)
    // ============================================
    const lowConfidenceAssumptions = (quote.assumptions || []).filter((a: any) => a.confidence < 60).length;
    const projectValue = quote.summary?.totalWithVAT || 0;
    
    if (projectValue > 100000 && lowConfidenceAssumptions > 3) {
      const riskMarginAmount = Math.round(projectValue * 0.05);
      console.log(`⚠️ Adding 5% risk margin (${riskMarginAmount} kr) due to ${lowConfidenceAssumptions} low-confidence assumptions`);
      
      quote.riskMargin = {
        amount: riskMarginAmount,
        percentage: 5,
        reason: `Projektet innehåller ${lowConfidenceAssumptions} osäkra antaganden och är värt över 100 000 kr`,
        applied: true
      };
      
      quote.summary.totalWithVAT += riskMarginAmount;
      quote.summary.customerPays = quote.summary.totalWithVAT - (quote.summary.rotRutDeduction?.actualDeduction || quote.summary.deductionAmount || 0);
    }

    // ============================================
    // SAVE TO DATABASE
    // ============================================

    console.log('💾 Saving quote to database...');
    
    let savedQuote;
    
    if (isDraft && previous_quote_id) {
      const { data: updated, error: updateError } = await supabaseClient
        .from('quotes')
        .update({
          edited_quote: quote,
          is_edited: true,
          title: quote.title,
          updated_at: new Date().toISOString(),
          conversation_session_id: conversation_session_id || sessionId,
          project_type: quote.projectType || 'other'
        })
        .eq('id', previous_quote_id)
        .eq('user_id', user_id)
        .select()
        .single();
      
      if (updateError) {
        console.error('❌ Error updating draft:', updateError);
        throw new Error('Failed to update draft quote');
      }
      
      savedQuote = updated;
      console.log('✅ Updated draft quote:', savedQuote.id);
    } else {
      const { data: inserted, error: saveError } = await supabaseClient
        .from('quotes')
        .insert({
          user_id: user_id,
          title: quote.title,
          description: description,
          generated_quote: quote,
          status: 'draft',
          unique_token: crypto.randomUUID(),
          conversation_session_id: conversation_session_id || sessionId,
          project_type: quote.projectType || 'other'
        })
        .select()
        .single();

      if (saveError) {
        console.error('❌ Error saving quote:', saveError);
        throw new Error('Failed to save quote');
      }
      
      savedQuote = inserted;
      console.log('✅ Created new quote:', savedQuote.id);
    }

    // ============================================
    // UPDATE SESSION
    // ============================================
    
    let timeSaved = null;
    if (sessionId) {
      try {
        await supabaseClient
          .from('conversation_sessions')
          .update({
            completed_at: new Date().toISOString(),
            conversation_stage: 'quote_generated'
          })
          .eq('id', sessionId);
        
        const { data: session } = await supabaseClient
          .from('conversation_sessions')
          .select('created_at')
          .eq('id', sessionId)
          .single();
        
        if (session) {
          const startTime = new Date(session.created_at);
          const endTime = new Date();
          const actualMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
          const manualEstimate = 20;
          timeSaved = Math.max(0, manualEstimate - actualMinutes);
          
          console.log(`⏱️ Time saved: ${timeSaved} minutes`);
        }
      } catch (error) {
        console.error('Error calculating time saved:', error);
      }
    }

    // ============================================
    // FINAL RETURN
    // ============================================

    console.log('✅ Quote generation complete');

    return new Response(
      JSON.stringify({
        type: 'complete_quote',
        quote,
        deductionType: finalDeductionType,
        projectType: conversationFeedback?.understood?.project_type || 'övrigt',
        confidence: confidenceScore,
        conversationFeedback,
        readiness,
        needsReview: confidenceScore.overall < 0.7,
        assumptions: quote.assumptions || [],
        deltaWarnings: deltaWarnings.length > 0 ? deltaWarnings : undefined,
        consistencyWarnings: consistencyWarnings.length > 0 ? consistencyWarnings : undefined,
        timeSaved: timeSaved,
        is_delta_mode: isDeltaMode,
        previous_quote_total: previousQuoteTotal || undefined,
        pipelineResult: {
          jobDefinition: pipelineResult.jobDefinition?.jobType,
          flags: pipelineResult.flags,
          corrections: pipelineResult.corrections,
          appliedFallbacks: pipelineResult.appliedFallbacks
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

*/
