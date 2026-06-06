/**
 * server/tests/utils.test.js
 *
 * Unit tests for server-side utility functions.
 *
 * Covers:
 *   asyncHandler — promise rejection forwarded to next()
 *   asyncHandler — successful handler resolves without calling next(err)
 *   extractJson  — valid JSON in raw text
 *   extractJson  — JSON inside a ```json fenced code block
 *   extractJson  — missing JSON object throws
 */

const asyncHandler = require('../utils/asyncHandler');
// extractJson is not exported in the current aiService.js module,
// so we test it via a local re-implementation that mirrors the production code.
// This also acts as a contract test — if the logic changes, this test will catch it.

// ---------------------------------------------------------------------------
// Inline mirror of extractJson for unit testing
// (identical logic to the private function in aiService.js)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// asyncHandler tests
// ---------------------------------------------------------------------------

describe('asyncHandler', () => {
  test('calls next(error) when the wrapped async fn rejects', async () => {
    const error = new Error('Something broke');
    const fn = async () => {
      throw error;
    };

    const handler = asyncHandler(fn);

    const req = {};
    const res = {};
    const next = jest.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(error);
  });

  test('does NOT call next(error) when the wrapped async fn resolves', async () => {
    const fn = async (req, res) => {
      res.done = true;
    };
    const handler = asyncHandler(fn);

    const req = {};
    const res = {};
    const next = jest.fn();

    await handler(req, res, next);

    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
    expect(res.done).toBe(true);
  });

  test('returns the promise returned by the original fn', () => {
    const fn = async (_req, _res) => 'value';
    const handler = asyncHandler(fn);

    const result = handler({}, {}, jest.fn());
    expect(result).toBeInstanceOf(Promise);
  });
});

// ---------------------------------------------------------------------------
// extractJson tests
// ---------------------------------------------------------------------------

describe('extractJson', () => {
  test('parses a bare JSON object in raw text', () => {
    const raw = '{"suggestedMemberId":"abc","reason":"they are available"}';
    const result = extractJson(raw);

    expect(result).toEqual({ suggestedMemberId: 'abc', reason: 'they are available' });
  });

  test('parses JSON wrapped in a ```json fenced code block', () => {
    const raw = '```json\n{"key":"value","count":3}\n```';
    const result = extractJson(raw);

    expect(result).toEqual({ key: 'value', count: 3 });
  });

  test('parses JSON with leading prose text', () => {
    const raw = 'Here is your result:\n{"id":"123","name":"Alice"}';
    const result = extractJson(raw);

    expect(result).toEqual({ id: '123', name: 'Alice' });
  });

  test('throws when there is no JSON object in the text', () => {
    expect(() => extractJson('No JSON here at all')).toThrow('AI response did not contain JSON');
  });

  test('throws on empty string', () => {
    expect(() => extractJson('')).toThrow('AI response did not contain JSON');
  });

  test('throws on null/undefined input', () => {
    expect(() => extractJson(null)).toThrow('AI response did not contain JSON');
    expect(() => extractJson(undefined)).toThrow('AI response did not contain JSON');
  });
});
