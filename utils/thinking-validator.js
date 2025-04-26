/**
 * Thinking Validator
 * 
 * Provides functionality for validating logical connections between thinking steps.
 * This utility handles:
 * - Checking for logical consistency between steps
 * - Validating reasoning against evidence
 * - Detecting common reasoning failures
 * - Providing validation scores and issues
 */

export class ThinkingValidator {
  constructor() {
    // Reasoning failure patterns to check for
    this.reasoningFailurePatterns = [
      {
        name: 'circular_reasoning',
        description: 'Circular reasoning',
        check: this.checkCircularReasoning.bind(this)
      },
      {
        name: 'insufficient_evidence',
        description: 'Insufficient evidence',
        check: this.checkInsufficientEvidence.bind(this)
      },
      {
        name: 'logical_leap',
        description: 'Logical leap',
        check: this.checkLogicalLeap.bind(this)
      },
      {
        name: 'inconsistency',
        description: 'Inconsistency with previous steps',
        check: this.checkInconsistency.bind(this)
      },
      {
        name: 'unsupported_conclusion',
        description: 'Unsupported conclusion',
        check: this.checkUnsupportedConclusion.bind(this)
      }
    ];
  }
  
  /**
   * Validate a step in a thinking chain
   * 
   * @param {Object} step - Current step to validate
   * @param {Object} previousStep - Previous step in the chain
   * @param {Object} chain - Complete chain data
   * @returns {Object} Validation results with score and issues
   */
  async validateStep(step, previousStep, chain) {
    const issues = [];
    let score = 1.0; // Start with a perfect score
    
    // Run all validation checks
    for (const pattern of this.reasoningFailurePatterns) {
      const result = await pattern.check(step, previousStep, chain);
      
      if (!result.valid) {
        issues.push(result.issue);
        score *= result.factor; // Reduce score by factor
      }
    }
    
    // Round to 2 decimal places
    score = Math.round(score * 100) / 100;
    
    return {
      valid: issues.length === 0,
      score,
      issues
    };
  }
  
  /**
   * Check for circular reasoning
   * 
   * @param {Object} step - Current step to check
   * @param {Object} previousStep - Previous step in the chain
   * @param {Object} chain - Complete chain data
   * @returns {Object} Check result
   * @private
   */
  async checkCircularReasoning(step, previousStep, chain) {
    // No previous step, can't be circular
    if (!previousStep) {
      return { valid: true, factor: 1.0 };
    }
    
    // Check if the current step reasoning is too similar to previous step reasoning
    const similarity = this.calculateTextSimilarity(
      step.reasoning,
      previousStep.reasoning
    );
    
    if (similarity > 0.8) {
      return {
        valid: false,
        factor: 0.5,
        issue: 'Circular reasoning detected: This step appears to restate the previous step without adding new insights.'
      };
    }
    
    // Also check for similarity with problem statement
    const problemSimilarity = this.calculateTextSimilarity(
      step.reasoning,
      chain.problem
    );
    
    if (problemSimilarity > 0.8) {
      return {
        valid: false,
        factor: 0.6,
        issue: 'Circular reasoning detected: This step appears to merely restate the problem without adding analysis.'
      };
    }
    
    return { valid: true, factor: 1.0 };
  }
  
  /**
   * Check for insufficient evidence
   * 
   * @param {Object} step - Current step to check
   * @param {Object} previousStep - Previous step in the chain
   * @param {Object} chain - Complete chain data
   * @returns {Object} Check result
   * @private
   */
  async checkInsufficientEvidence(step, previousStep, chain) {
    // If the confidence is high but no evidence provided, flag as an issue
    if (step.confidence > 0.7 && (!step.evidence || step.evidence.trim() === '')) {
      return {
        valid: false,
        factor: 0.7,
        issue: 'Insufficient evidence: High confidence claim with no supporting evidence provided.'
      };
    }
    
    // Check if the reasoning contains claims that need evidence
    const containsClaims = this.containsClaimsThatNeedEvidence(step.reasoning);
    
    if (containsClaims && (!step.evidence || step.evidence.trim() === '')) {
      return {
        valid: false,
        factor: 0.8,
        issue: 'Insufficient evidence: Claims are made that would benefit from supporting evidence.'
      };
    }
    
    return { valid: true, factor: 1.0 };
  }
  
  /**
   * Check for logical leaps
   * 
   * @param {Object} step - Current step to check
   * @param {Object} previousStep - Previous step in the chain
   * @param {Object} chain - Complete chain data
   * @returns {Object} Check result
   * @private
   */
  async checkLogicalLeap(step, previousStep, chain) {
    // No previous step, can't check for logical leaps
    if (!previousStep) {
      return { valid: true, factor: 1.0 };
    }
    
    // Check if there's a big conceptual gap between steps
    const connectionStrength = this.evaluateConnectionStrength(
      previousStep.description,
      previousStep.reasoning,
      step.description,
      step.reasoning
    );
    
    if (connectionStrength < 0.3) {
      return {
        valid: false,
        factor: 0.6,
        issue: 'Logical leap detected: There appears to be a significant gap between this step and the previous one.'
      };
    }
    
    return { valid: true, factor: 1.0 };
  }
  
  /**
   * Check for inconsistency with previous steps
   * 
   * @param {Object} step - Current step to check
   * @param {Object} previousStep - Previous step in the chain
   * @param {Object} chain - Complete chain data
   * @returns {Object} Check result
   * @private
   */
  async checkInconsistency(step, previousStep, chain) {
    // No previous step, can't check for inconsistency
    if (!previousStep) {
      return { valid: true, factor: 1.0 };
    }
    
    // Look for contradictory statements between steps
    const containsContradiction = this.detectContradiction(
      previousStep.reasoning,
      step.reasoning
    );
    
    if (containsContradiction) {
      return {
        valid: false,
        factor: 0.5,
        issue: 'Inconsistency detected: This step appears to contradict a previous step.'
      };
    }
    
    return { valid: true, factor: 1.0 };
  }
  
  /**
   * Check for unsupported conclusions
   * 
   * @param {Object} step - Current step to check
   * @param {Object} previousStep - Previous step in the chain
   * @param {Object} chain - Complete chain data
   * @returns {Object} Check result
   * @private
   */
  async checkUnsupportedConclusion(step, previousStep, chain) {
    // Check if this is a conclusion step (likely the last step)
    const isLastStep = chain.steps.indexOf(step) === chain.steps.length - 1;
    const hasConclusion = step.description.toLowerCase().includes('conclusion') ||
                          step.reasoning.toLowerCase().includes('in conclusion') ||
                          step.reasoning.toLowerCase().includes('therefore') ||
                          step.reasoning.toLowerCase().includes('thus');
    
    if ((isLastStep || hasConclusion) && step.confidence > 0.6) {
      // Get all previous steps' reasoning
      const previousReasoning = chain.steps
        .slice(0, chain.steps.indexOf(step))
        .map(s => s.reasoning)
        .join(' ');
      
      // Check if conclusion is supported by previous reasoning
      const supportStrength = this.evaluateSupportStrength(
        previousReasoning,
        step.reasoning
      );
      
      if (supportStrength < 0.4) {
        return {
          valid: false,
          factor: 0.6,
          issue: 'Unsupported conclusion: The conclusion does not appear to be sufficiently supported by the previous reasoning steps.'
        };
      }
    }
    
    return { valid: true, factor: 1.0 };
  }
  
  /**
   * Calculate text similarity between two strings
   * 
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {number} Similarity score (0-1)
   * @private
   */
  calculateTextSimilarity(text1, text2) {
    // Simple implementation - in a real system, this would use more sophisticated NLP
    if (!text1 || !text2) return 0;
    
    // Normalize texts
    const t1 = text1.toLowerCase().replace(/[^\w\s]/g, '');
    const t2 = text2.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Get words
    const words1 = t1.split(/\s+/).filter(w => w.length > 3);
    const words2 = t2.split(/\s+/).filter(w => w.length > 3);
    
    // Count common words
    const commonWords = words1.filter(word => words2.includes(word));
    
    // Calculate Jaccard similarity
    const uniqueWords = new Set([...words1, ...words2]);
    
    return uniqueWords.size === 0 ? 0 : commonWords.length / uniqueWords.size;
  }
  
  /**
   * Evaluate connection strength between two steps
   * 
   * @param {string} prevDescription - Previous step description
   * @param {string} prevReasoning - Previous step reasoning
   * @param {string} currDescription - Current step description
   * @param {string} currReasoning - Current step reasoning
   * @returns {number} Connection strength (0-1)
   * @private
   */
  evaluateConnectionStrength(prevDescription, prevReasoning, currDescription, currReasoning) {
    // Simple implementation - in a real system, this would use more sophisticated NLP
    // Combine previous step text
    const prevText = `${prevDescription} ${prevReasoning}`.toLowerCase();
    
    // Get key terms from previous step
    const prevTerms = this.extractKeyTerms(prevText);
    
    // Combine current step text
    const currText = `${currDescription} ${currReasoning}`.toLowerCase();
    
    // Count how many key terms from previous step are in current step
    const matchedTerms = prevTerms.filter(term => currText.includes(term));
    
    return prevTerms.length === 0 ? 0.5 : matchedTerms.length / prevTerms.length;
  }
  
  /**
   * Extract key terms from text
   * 
   * @param {string} text - Text to extract terms from
   * @returns {Array<string>} Array of key terms
   * @private
   */
  extractKeyTerms(text) {
    if (!text) return [];
    
    // Split into words
    const words = text.toLowerCase().split(/\s+/);
    
    // Remove common words and short words
    const commonWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
      'at', 'from', 'in', 'on', 'for', 'to', 'with', 'by', 'about', 'as',
      'into', 'like', 'through', 'after', 'before', 'between', 'during',
      'of', 'that', 'this', 'these', 'those', 'it', 'its', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
      'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should',
      'may', 'might', 'must', 'we', 'you', 'they', 'i', 'he', 'she'
    ]);
    
    return words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .slice(0, 10); // Take top 10 terms
  }
  
  /**
   * Detect contradictions between texts
   * 
   * @param {string} text1 - First text
   * @param {string} text2 - Second text
   * @returns {boolean} Whether contradiction was detected
   * @private
   */
  detectContradiction(text1, text2) {
    // Simple implementation - in a real system, this would use more sophisticated NLP
    if (!text1 || !text2) return false;
    
    // Look for common contradiction patterns
    const negationTerms = ['not', 'no', 'never', 'isn\'t', 'aren\'t', 'wasn\'t',
                          'weren\'t', 'don\'t', 'doesn\'t', 'didn\'t', 'cannot',
                          'can\'t', 'won\'t', 'wouldn\'t', 'shouldn\'t'];
    
    // Check if text2 contains negation of key phrases from text1
    const text1Lower = text1.toLowerCase();
    const text2Lower = text2.toLowerCase();
    
    // Extract phrases from text1
    const phrases = this.extractPhrases(text1Lower);
    
    for (const phrase of phrases) {
      // Check if any of the phrases are negated in text2
      for (const negation of negationTerms) {
        if (text2Lower.includes(`${negation} ${phrase}`)) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Extract phrases from text
   * 
   * @param {string} text - Text to extract phrases from
   * @returns {Array<string>} Array of phrases
   * @private
   */
  extractPhrases(text) {
    if (!text) return [];
    
    // Split text into sentences
    const sentences = text.split(/[.!?]+/);
    
    // Extract noun phrases (simplified approach)
    const phrases = [];
    
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      
      // Extract 2-3 word phrases
      for (let i = 0; i < words.length - 1; i++) {
        if (words[i].length > 3 && words[i + 1].length > 3) {
          phrases.push(`${words[i]} ${words[i + 1]}`);
        }
        
        if (i < words.length - 2 && words[i].length > 3 && words[i + 2].length > 3) {
          phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
        }
      }
    }
    
    return phrases;
  }
  
  /**
   * Check if text contains claims that need evidence
   * 
   * @param {string} text - Text to check
   * @returns {boolean} Whether text contains claims
   * @private
   */
  containsClaimsThatNeedEvidence(text) {
    if (!text) return false;
    
    // Common indicators of claims that need evidence
    const claimIndicators = [
      'proves', 'demonstrates', 'shows', 'indicates', 'confirms',
      'establishes', 'suggests', 'implies', 'means that', 'reveals',
      'is clear that', 'is evident that', 'is obvious that',
      'studies show', 'research indicates', 'data suggests',
      'according to', 'evidence suggests', 'statistics show',
      'experts believe', 'scientists agree', 'it is known that',
      'clearly', 'obviously', 'undoubtedly', 'certainly', 'definitely',
      'always', 'never', 'all', 'none', 'every', 'best', 'worst',
      'most important', 'significant', 'crucial', 'essential',
      'substantial', 'considerable', 'dramatic', 'remarkable'
    ];
    
    const textLower = text.toLowerCase();
    
    // Check for claim indicators
    for (const indicator of claimIndicators) {
      if (textLower.includes(indicator)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Evaluate how well a conclusion is supported by previous reasoning
   * 
   * @param {string} previousReasoning - Previous reasoning steps combined
   * @param {string} conclusion - Conclusion text
   * @returns {number} Support strength (0-1)
   * @private
   */
  evaluateSupportStrength(previousReasoning, conclusion) {
    if (!previousReasoning || !conclusion) return 0;
    
    // Extract key terms from both
    const prevTerms = this.extractKeyTerms(previousReasoning);
    const conclusionTerms = this.extractKeyTerms(conclusion);
    
    // Calculate how many conclusion terms are supported by previous reasoning
    const supportedTerms = conclusionTerms.filter(term => 
      previousReasoning.toLowerCase().includes(term)
    );
    
    // Check for common conclusion indicators
    const conclusionLower = conclusion.toLowerCase();
    const conclusionIndicators = [
      'therefore', 'thus', 'hence', 'consequently', 'as a result',
      'so', 'accordingly', 'it follows that', 'this shows that',
      'this demonstrates', 'we can conclude', 'in conclusion',
      'this suggests', 'this indicates', 'this proves'
    ];
    
    const hasIndicator = conclusionIndicators.some(indicator => 
      conclusionLower.includes(indicator)
    );
    
    // Calculate support score
    const termSupport = conclusionTerms.length === 0 ? 
      0.5 : supportedTerms.length / conclusionTerms.length;
    
    // If it has proper conclusion indicators, give it a boost
    return hasIndicator ? Math.min(1, termSupport + 0.2) : termSupport;
  }
}
