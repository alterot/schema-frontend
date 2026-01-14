// Schedule Agent - Tool Orchestration Layer
// Manages the conversation loop with Claude API and executes tool calls

import { CLAUDE_API_URL } from '../config.js';
import { getToolsForClaudeAPI, SYSTEM_PROMPT } from './toolDefinitions.js';
import {
  fetchSchedule,
  proposeChanges,
  simulateImpact,
  applyChanges,
} from './backend.js';

// Maximum number of tool-calling iterations to prevent infinite loops
const MAX_ITERATIONS = 10;

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
      return await fetchSchedule(toolInput.period);

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
 * @returns {Promise<Object>} - Claude API response
 */
async function callClaudeAPI(messages) {
  const response = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: getToolsForClaudeAPI(),
      messages: messages,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Claude API error: ${response.status}`);
  }

  return response.json();
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
  const messages = [
    {
      role: 'user',
      content: `Jag vill schemalägga för period ${period}. Här är mina instruktioner:\n\n${userInput}\n\nBörja med att läsa aktuellt schema för perioden och analysera sedan mina instruktioner.`,
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
    const response = await callClaudeAPI(messages);

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
    /(?:konflikt|problem|varning)[er]?[:\s]*\n((?:[-*•⚠️]\s*.+\n?)+)/i
  );
  if (konfliktMatch) {
    result.konflikter = konfliktMatch[1]
      .split('\n')
      .map((line) => line.replace(/^[-*•⚠️]\s*/, '').trim())
      .filter((line) => line.length > 0);
  }

  // Try to extract rekommendationer
  const rekMatch = responseText.match(
    /(?:rekommend|förslag|åtgärd)[er]?[:\s]*\n((?:[-*•✅]\s*.+\n?)+)/i
  );
  if (rekMatch) {
    result.rekommendationer = rekMatch[1]
      .split('\n')
      .map((line) => line.replace(/^[-*•✅]\s*/, '').trim())
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
  try {
    const agentResult = await runScheduleAgent(userInput, period, onProgress);
    const parsed = parseScheduleResponse(agentResult.text);

    return {
      success: true,
      tolkadInput: parsed.tolkadInput.length > 0
        ? parsed.tolkadInput
        : [`Period: ${period}`, `Input: ${userInput.substring(0, 100)}...`],
      konflikter: parsed.konflikter.map((desc, index) => ({
        datum: `${period}-01`,
        pass: 'dag',
        beskrivning: desc,
        typ: 'info',
      })),
      rekommendationer: parsed.rekommendationer,
      agentResponse: agentResult.text,
      iterations: agentResult.iterations,
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
