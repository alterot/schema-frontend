// Schedule Agent - Tool Orchestration Layer
// Manages the conversation loop with Claude API and executes tool calls

import { CLAUDE_API_URL, USE_MOCK_MODE, API_ENDPOINTS } from '../config.js';
import { getToolsForClaudeAPI, buildSystemPrompt } from './toolDefinitions.js';
import {
  fetchSchedule,
  proposeChanges,
  simulateImpact,
  applyChanges,
} from './backend.js';
import { loadStaffData, loadRequirements } from '../utils/storage.js';

// Maximum number of tool-calling iterations to prevent infinite loops
const MAX_ITERATIONS = 10;

// ── Kontextdata-cache (hämtas en gång per session) ──
let cachedContext = null;

/**
 * Hämta all kontextdata (personal, bemanningsbehov, regler).
 * Försöker localStorage först via storage.js, sedan backend API.
 * Cachas i minnet så att efterföljande anrop är gratis.
 */
async function loadContext() {
  if (cachedContext) {
    console.log('[Context] Använder cachad kontextdata');
    return cachedContext;
  }

  console.log('[Context] Hämtar kontextdata...');

  const [personal, bemanningsbehov, regler] = await Promise.all([
    loadStaffData(),
    loadRequirements(),
    fetchRegler(),
  ]);

  console.log(`[Context] Personal: ${personal.length} st, Behov: ${bemanningsbehov ? 'OK' : 'saknas'}, Regler: ${regler ? 'OK' : 'saknas'}`);

  cachedContext = { personal, bemanningsbehov, regler };
  return cachedContext;
}

/**
 * Hämta regler från backend API.
 */
async function fetchRegler() {
  try {
    const response = await fetch(API_ENDPOINTS.regler);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    console.warn('[Context] Kunde inte hämta regler:', e.message);
    return null;
  }
}

/**
 * Invalidera kontextcachen (anropas om användaren ändrar inställningar).
 */
export function invalidateContextCache() {
  cachedContext = null;
}

/**
 * Execute a tool call based on tool name and input
 *
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} toolInput - Input parameters for the tool
 * @returns {Promise<Object>} - Tool execution result
 */
async function executeTool(toolName, toolInput) {
  switch (toolName) {
    case 'read_schedule':
      return await fetchSchedule(toolInput.period, {
        regenerate: true,
        constraint_overrides: toolInput.constraint_overrides,
      });

    case 'propose_changes':
      return await proposeChanges(toolInput.problem);

    case 'simulate_impact':
      return await simulateImpact(toolInput.changes);

    case 'apply_changes':
      return await applyChanges(toolInput.schema, toolInput.confirmed);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Call Claude API with messages and tools
 *
 * @param {Array} messages - Conversation messages
 * @param {string} systemPrompt - Dynamic system prompt with full context
 * @returns {Promise<Object>} - Claude API response
 */
async function callClaudeAPI(messages, systemPrompt) {
  console.log(`[ClaudeAPI] POST ${CLAUDE_API_URL} (${messages.length} messages, prompt ${systemPrompt.length} chars)`);
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      tools: getToolsForClaudeAPI(),
      messages: messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    console.error(`[ClaudeAPI] Error ${response.status}:`, error);
    throw new Error(error.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  console.log(`[ClaudeAPI] Response: stop_reason=${data.stop_reason}, content blocks=${data.content?.length}`);
  return data;
}

/**
 * Main function to generate a schedule based on user input
 * Orchestrates the tool-calling loop with Claude API
 *
 * @param {string} userInput - Natural language input from user
 * @param {string} period - Schedule period (YYYY-MM format)
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Object>} - Final result with tolkadInput, konflikter, schema, etc.
 */
export async function runScheduleAgent(userInput, period, onProgress) {
  // Hämta kontextdata och bygg system prompt
  if (onProgress) {
    onProgress({ iteration: 0, status: 'loading_context' });
  }
  const ctx = await loadContext();
  const systemPrompt = buildSystemPrompt(ctx.personal, ctx.bemanningsbehov, ctx.regler);
  console.log(`[ScheduleAgent] System prompt byggt (${systemPrompt.length} tecken, ${ctx.personal.length} personal)`);

  const messages = [
    {
      role: 'user',
      content: `PERIOD: ${period}

ANVÄNDARENS INSTRUKTIONER:
${userInput}

Analysera instruktionerna ovan mot personallistan och bemanningsbehoven i din kontext. Identifiera vilka personer som påverkas, vilka datum det gäller, och om det uppstår konflikter med bemanningskraven. Börja med att läsa aktuellt schema för perioden.`,
    },
  ];

  let iterations = 0;
  let finalResponse = null;

  // Tool-calling loop
  while (iterations < MAX_ITERATIONS) {
    iterations++;

    if (onProgress) {
      onProgress({ iteration: iterations, status: 'calling_claude' });
    }

    // Call Claude API
    const response = await callClaudeAPI(messages, systemPrompt);

    // Check stop reason
    if (response.stop_reason === 'end_turn') {
      // Claude is done - extract final text response
      finalResponse = response;
      break;
    }

    if (response.stop_reason === 'tool_use') {
      // Claude wants to use tools - execute them
      const assistantMessage = {
        role: 'assistant',
        content: response.content,
      };
      messages.push(assistantMessage);

      // Find all tool use blocks
      const toolUseBlocks = response.content.filter(
        (block) => block.type === 'tool_use'
      );

      // Execute each tool and collect results
      const toolResults = [];
      for (const toolUse of toolUseBlocks) {
        if (onProgress) {
          onProgress({
            iteration: iterations,
            status: 'executing_tool',
            toolName: toolUse.name,
          });
        }

        try {
          const result = await executeTool(toolUse.name, toolUse.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: error.message }),
            is_error: true,
          });
        }
      }

      // Add tool results to messages
      messages.push({
        role: 'user',
        content: toolResults,
      });
    } else {
      // Unexpected stop reason
      finalResponse = response;
      break;
    }
  }

  if (!finalResponse) {
    throw new Error('Max iterations reached without final response');
  }

  // Extract text from final response
  const textBlocks = finalResponse.content.filter(
    (block) => block.type === 'text'
  );
  const responseText = textBlocks.map((block) => block.text).join('\n');

  return {
    text: responseText,
    messages: messages,
    iterations: iterations,
  };
}

/**
 * Parse Claude's response to extract structured data
 * Attempts to find tolkadInput, konflikter, etc. from the response
 *
 * @param {string} responseText - Text response from Claude
 * @returns {Object} - Parsed schedule data
 */
export function parseScheduleResponse(responseText) {
  // Default structure
  const result = {
    tolkadInput: [],
    konflikter: [],
    rekommendationer: [],
  };

  // Try to extract tolkadInput (look for bullet points or numbered lists)
  const tolkadMatch = responseText.match(
    /(?:tolkade?|förstod|identifierade)[:\s]*\n((?:[-*•]\s*.+\n?)+)/i
  );
  if (tolkadMatch) {
    result.tolkadInput = tolkadMatch[1]
      .split('\n')
      .map((line) => line.replace(/^[-*•]\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  // Try to extract konflikter
  const konfliktMatch = responseText.match(
    /(?:konflikt|problem|varning)[er]?[:\s]*\n((?:[-*\u2022\u26A0]\s*.+\n?)+)/i
  );
  if (konfliktMatch) {
    result.konflikter = konfliktMatch[1]
      .split('\n')
      .map((line) => line.replace(/^[-*\u2022\u26A0]+\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  // Try to extract rekommendationer
  const rekMatch = responseText.match(
    /(?:rekommend|förslag|åtgärd)[er]?[:\s]*\n((?:[-*\u2022\u2705]\s*.+\n?)+)/i
  );
  if (rekMatch) {
    result.rekommendationer = rekMatch[1]
      .split('\n')
      .map((line) => line.replace(/^[-*\u2022\u2705]\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  return result;
}

/**
 * Simplified wrapper that returns a structure similar to mockSchema
 * For easier integration with existing UI
 *
 * @param {string} userInput - Natural language input
 * @param {string} period - Period in YYYY-MM format
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Result compatible with existing UI
 */
export async function generateSchedule(userInput, period, onProgress) {
  console.log(`[ScheduleAgent] USE_MOCK_MODE: ${USE_MOCK_MODE}`);
  console.log(`[ScheduleAgent] CLAUDE_API_URL: ${CLAUDE_API_URL}`);
  console.log(`[ScheduleAgent] Input: "${userInput}", Period: ${period}`);

  // Mock mode - simulera utan API-anrop
  if (USE_MOCK_MODE) {
    console.log("[ScheduleAgent] -> MOCK path (inga API-anrop)");

    // Simulera progress callbacks (samma format som real mode)
    if (onProgress) {
      onProgress({ iteration: 1, status: 'calling_claude' });
      await new Promise(r => setTimeout(r, 500));
      onProgress({ iteration: 1, status: 'executing_tool', toolName: 'read_schedule' });
      await new Promise(r => setTimeout(r, 500));
      onProgress({ iteration: 2, status: 'calling_claude' });
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Mock response
    return {
      success: true,
      tolkadInput: [
        "Period: " + period,
        "Input: " + userInput,
        "Mock mode aktiverat - inga verkliga API-anrop"
      ],
      konflikter: [
        {
          datum: `${period}-15`,
          pass: 'natt',
          beskrivning: 'Mock: Saknar 1 undersköterska',
          typ: 'undermanning'
        }
      ],
      rekommendationer: [
        "Mock: Överväg att omfördela personal från dagpass",
        "Mock: Kontakta vikariepool för nattpassen"
      ],
      agentResponse: "Mock AI Agent: Jag har analyserat din input och genererat ett simulerat schema. Detta är mock-data för att spara API-tokens under utveckling.",
      iterations: 1
    };
  }

  // Real mode - faktiska API-anrop
  console.log(`[ScheduleAgent] -> REAL path: Anropar Claude API at ${CLAUDE_API_URL}`);
  try {
    const agentResult = await runScheduleAgent(userInput, period, onProgress);
    console.log(`[ScheduleAgent] API svar mottaget (${agentResult.iterations} iterationer)`);
    console.log(`[ScheduleAgent] Response text:`, agentResult.text?.substring(0, 200) + '...');
    const parsed = parseScheduleResponse(agentResult.text);
    console.log(`[ScheduleAgent] Parsed result:`, parsed);

    return {
      success: true,
      tolkadInput: parsed.tolkadInput.length > 0
        ? parsed.tolkadInput
        : [`Period: ${period}`, `Input: ${userInput.substring(0, 100)}...`],
      konflikter: parsed.konflikter.map((desc) => ({
        datum: `${period}-01`,
        pass: 'dag',
        beskrivning: desc,
        typ: 'info',
      })),
      rekommendationer: parsed.rekommendationer,
      agentResponse: agentResult.text,
      iterations: agentResult.iterations,
      messages: agentResult.messages,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      tolkadInput: [],
      konflikter: [{
        datum: `${period}-01`,
        pass: 'dag',
        beskrivning: `Fel: ${error.message}`,
        typ: 'error',
      }],
      rekommendationer: [],
    };
  }
}

/**
 * Continue an existing conversation with a follow-up message.
 * Reuses the existing messages array from a previous generateSchedule call.
 *
 * @param {Array} existingMessages - Messages array from previous agent result
 * @param {string} followUpText - User's follow-up input
 * @param {string} period - Schedule period (YYYY-MM)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Result compatible with existing UI
 */
export async function continueConversation(existingMessages, followUpText, period, onProgress) {
  console.log(`[ScheduleAgent] Continue conversation: "${followUpText}"`);

  if (onProgress) {
    onProgress({ iteration: 0, status: 'loading_context' });
  }

  const ctx = await loadContext();
  const systemPrompt = buildSystemPrompt(ctx.personal, ctx.bemanningsbehov, ctx.regler);

  // Append follow-up to existing conversation
  const messages = [...existingMessages, { role: 'user', content: followUpText }];

  let iterations = 0;
  let finalResponse = null;

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    if (onProgress) {
      onProgress({ iteration: iterations, status: 'calling_claude' });
    }

    const response = await callClaudeAPI(messages, systemPrompt);

    if (response.stop_reason === 'end_turn') {
      finalResponse = response;
      break;
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        if (onProgress) {
          onProgress({ iteration: iterations, status: 'executing_tool', toolName: toolUse.name });
        }
        try {
          const result = await executeTool(toolUse.name, toolUse.input);
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
        } catch (error) {
          toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify({ error: error.message }), is_error: true });
        }
      }

      messages.push({ role: 'user', content: toolResults });
    } else {
      finalResponse = response;
      break;
    }
  }

  if (!finalResponse) {
    throw new Error('Max iterations reached without final response');
  }

  const textBlocks = finalResponse.content.filter((b) => b.type === 'text');
  const responseText = textBlocks.map((b) => b.text).join('\n');
  const parsed = parseScheduleResponse(responseText);

  return {
    success: true,
    tolkadInput: parsed.tolkadInput.length > 0 ? parsed.tolkadInput : [],
    konflikter: parsed.konflikter.map((desc) => ({
      datum: `${period}-01`, pass: 'dag', beskrivning: desc, typ: 'info',
    })),
    rekommendationer: parsed.rekommendationer,
    agentResponse: responseText,
    iterations: iterations,
    messages: messages,
  };
}
