function createPromptContext(value) {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

/**
 * Core AI caller — tries Gemini first, falls back to Groq.
 * @param {string} prompt
 * @param {number} maxTokens
 * @returns {Promise<string>}
 */
async function callAI(prompt, maxTokens = 1024) {
  if (process.env.AI_ENABLED === 'false') {
    throw new Error('AI features are disabled (AI_ENABLED=false)');
  }

  // --- Try Gemini first (skip if quota exhausted or key missing) ---
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const res = await ai.models.generateContent({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        contents: prompt,
        config: { maxOutputTokens: maxTokens }
      });
      // @google/genai v2: res.text is a getter returning the full text string
      const text = res.text;
      if (text && String(text).trim()) return String(text).trim();
      throw new Error('Empty Gemini response');
    } catch (geminiErr) {
      // eslint-disable-next-line no-console
      console.warn('[AI] Gemini unavailable, falling back to Groq:', geminiErr.message);
    }
  }

  // --- Groq fallback ---
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    throw new Error(
      'No AI API keys configured. Set GEMINI_API_KEY or GROQ_API_KEY in your environment.'
    );
  }

  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: groqKey });
  const groqRes = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: maxTokens
  });

  const groqText = groqRes.choices?.[0]?.message?.content || '';
  return String(groqText).trim();
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not contain JSON');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Generates a comprehensive AI sprint report detailing completions, bottlenecks, and velocity.
 *
 * @param {Object} boardData - The board data and aggregated metrics for the sprint.
 * @param {string} weekStart - The start date of the sprint (e.g., 'YYYY-MM-DD').
 * @param {string} weekEnd - The end date of the sprint.
 * @returns {Promise<string>} Markdown formatted sprint retrospective report.
 */
async function generateSprintReport(boardData, weekStart, weekEnd) {
  const prompt = `You are a project manager writing a sprint report.
Generate a professional sprint summary for a software team.

Board: ${boardData.boardName}
Period: ${weekStart} to ${weekEnd}
Tasks completed: ${boardData.tasksCompleted.length} — ${boardData.tasksCompleted.map((task) => task.title).join('; ') || 'None'}
Tasks added: ${boardData.tasksCreated.length} — ${boardData.tasksCreated.map((task) => task.title).join('; ') || 'None'}
Still in progress: ${boardData.tasksInProgress.length} — ${boardData.tasksInProgress.map((task) => task.title).join('; ') || 'None'}
Blocked/overdue: ${boardData.blockedTasks.map((task) => `${task.title} (${task.assignee || 'unassigned'})`).join('; ') || 'None'}
Most active members: ${boardData.memberActivity.map((member) => `${member.name} (${member.count})`).join('; ') || 'None'}

Write a sprint report with these exact sections:
## Summary
(2-3 sentences overall assessment)

## Accomplishments
(bullet list of completed tasks, grouped by theme if possible)

## In Progress
(what's carrying over to next sprint)

## Blockers
(specific items at risk and why)

## Recommendations
(2-3 specific actionable suggestions for next sprint)

Be specific and technical. Use task titles directly.`;

  return callAI(prompt, 1400);
}

/**
 * Generates an AI daily standup summary for a specific member based on recent activity.
 *
 * @param {Object} memberActivity - Aggregated tasks and comments belonging to the member.
 * @param {string} memberName - The name of the member.
 * @returns {Promise<string>} Markdown formatted daily standup briefing.
 */
async function generateStandup(memberActivity, memberName) {
  const prompt = `Generate a daily standup update for ${memberName}.

Their activity in the last 24 hours:
Tasks completed: ${memberActivity.tasksCompleted.join('; ') || 'None'}
Tasks worked on (moved/updated): ${memberActivity.tasksWorkedOn.join('; ') || 'None'}
Newly assigned tasks: ${memberActivity.tasksAssigned.join('; ') || 'None'}
Comments posted on: ${memberActivity.commentsPosted.join('; ') || 'None'}

Write a standup in exactly this format:
**Yesterday:** [what was done]
**Today:** [what to continue, based on in-progress tasks]
**Blockers:** [any overdue tasks or blocked items, else 'None']

Keep it concise — 2-3 bullet points per section max.
Use task titles directly. Be specific, not generic.`;

  return callAI(prompt, 800);
}

/**
 * Suggests the best team member to assign to a task based on current workloads and context.
 *
 * @param {Object} task - The task details (title, description, priority).
 * @param {Array<Object>} members - A list of workspace members and their active workloads.
 * @returns {Promise<Object>} An object containing the suggestedMemberId, name, and reason.
 */
async function suggestAssignee(task, members) {
  const prompt = `Suggest the best team member to assign this task.

Task: ${task.title}
Description: ${task.description || 'None'}
Priority: ${task.priority || 'medium'}
Labels: ${(task.labels || []).join(', ') || 'None'}

Team members and their current workload:
${members.map((member) => `- ${member.id}: ${member.name} | currentTaskCount=${member.currentTaskCount} | recentActivity=${member.recentActivity} | completedThisWeek=${member.completedThisWeek}`).join('\n')}

Return ONLY a JSON object:
{
  "suggestedMemberId": "id",
  "suggestedMemberName": "name",
  "reason": "one sentence explanation"
}
No other text.`;

  const raw = await callAI(prompt, 400);
  const parsed = extractJson(raw);

  return {
    suggestedMemberId: parsed.suggestedMemberId || '',
    suggestedMemberName: parsed.suggestedMemberName || '',
    reason: parsed.reason || ''
  };
}

/**
 * Generates an AI-driven task description based on an input prompt and board context.
 *
 * @param {string} taskTitle - The user-provided title for the task.
 * @param {Object} boardContext - Context regarding existing tasks and the board's purpose.
 * @returns {Promise<string>} The generated task description text.
 */
async function generateTaskDescription(taskTitle, boardContext) {
  const prompt = `Write a brief task description for a software project.

Task title: ${taskTitle}
Project context: ${createPromptContext(boardContext)}

Write 2-3 sentences describing:
1. What needs to be done
2. Acceptance criteria (when is it done)

Keep it technical and actionable.
Return only the description text.`;

  return callAI(prompt, 600);
}

module.exports = {
  callAI,
  generateSprintReport,
  generateStandup,
  suggestAssignee,
  generateTaskDescription
};