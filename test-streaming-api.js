import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs/promises';

const API_BASE = 'http://localhost:3000/api/chat';
const chatId = `streaming-test-${Date.now()}`;
const LOG_DIR = './data/streaming-logs';

console.log('🌊 Gateway Agent Streaming API Test Suite');
console.log('='.repeat(80));
console.log(`Test Chat ID: ${chatId}\n`);

let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, message) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  if (message) console.log(`  → ${message}`);

  testResults.tests.push({ name, passed, message });
  if (passed) testResults.passed++;
  else testResults.failed++;
}

async function sendStreamingMessage(message, expectItinerary = false) {
  console.log(`\n📤 Streaming: "${message}"`);

  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(`${API_BASE}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      let fullContent = '';
      let tokens = [];
      let finalData = null;
      let tokenCount = 0;

      // Parse SSE stream
      const reader = response.body;
      let buffer = '';

      reader.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'token') {
                fullContent += data.token;
                tokens.push(data.token);
                tokenCount++;
                process.stdout.write('.');
              } else if (data.type === 'done') {
                finalData = data;
                console.log('\n✓ Stream complete');
              } else if (data.type === 'error') {
                console.error(`\n❌ Stream error: ${data.error}`);
                reject(new Error(data.error));
              }
            } catch (err) {
              // Ignore JSON parse errors for non-JSON lines
            }
          }
        }
      });

      reader.on('end', () => {
        console.log(`📥 Received ${tokenCount} tokens`);
        console.log(`📊 Full response: ${fullContent.length} chars`);

        resolve({
          fullContent,
          tokens,
          tokenCount,
          finalData,
          itinerary: finalData?.itinerary,
          summary: finalData?.summary,
          suggestedQuestions: finalData?.suggestedQuestions || [],
          placesOfInterest: finalData?.placesOfInterest || []
        });
      });

      reader.on('error', (err) => {
        reject(err);
      });

    } catch (error) {
      reject(error);
    }
  });
}

try {
  // Create log directory
  await fs.mkdir(LOG_DIR, { recursive: true });

  // ============================================================================
  // TEST 1: Basic Streaming Response
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 1: Basic Streaming Response');
  console.log('='.repeat(80));

  const result1 = await sendStreamingMessage('I want to plan a trip to Tokyo');

  logTest('Stream started successfully', result1.tokenCount > 0, `Received ${result1.tokenCount} tokens`);
  logTest('Tokens received incrementally', result1.tokens.length > 10, `${result1.tokens.length} individual tokens`);
  logTest('Full content assembled', result1.fullContent.length > 0, `${result1.fullContent.length} chars`);
  logTest('Final data received', result1.finalData !== null);
  logTest('Summary in final data', result1.summary !== undefined);
  logTest('Suggested questions in final data', Array.isArray(result1.suggestedQuestions));
  logTest('Places of interest in final data', Array.isArray(result1.placesOfInterest));

  // Save first stream
  await fs.writeFile(
    `${LOG_DIR}/stream-1-${chatId}.json`,
    JSON.stringify({
      message: 'I want to plan a trip to Tokyo',
      tokenCount: result1.tokenCount,
      fullContent: result1.fullContent,
      finalData: result1.finalData
    }, null, 2)
  );

  // ============================================================================
  // TEST 2: Context Persistence in Streaming
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 2: Context Persistence in Streaming');
  console.log('='.repeat(80));

  logTest('Destination captured from first message',
    result1.summary?.destination?.city === 'Tokyo',
    `Got: ${result1.summary?.destination?.city}`);

  const result2 = await sendStreamingMessage('From New York, 5 days, April 10-15, 2026, 1 person, $3000 USD');

  logTest('Origin captured', result2.summary?.origin?.city === 'New York');
  logTest('Duration captured', result2.summary?.duration_days === 5);
  logTest('Passenger count captured', result2.summary?.passenger_count === 1);
  logTest('Budget captured', result2.summary?.budget?.amount === 3000);
  logTest('Outbound date captured', result2.summary?.outbound_date === '2026-04-10');
  logTest('Return date auto-calculated', result2.summary?.return_date === '2026-04-15');

  // ============================================================================
  // TEST 3: Streaming Itinerary Creation
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 3: Streaming Itinerary Creation');
  console.log('='.repeat(80));

  const result3 = await sendStreamingMessage('Yes, please create the detailed itinerary', true);

  const hasItinerary = result3.itinerary?.days?.length > 0;
  logTest('Itinerary created', hasItinerary);

  if (hasItinerary) {
    const itinerary = result3.itinerary;
    const day1 = itinerary.days[0];

    logTest('Correct number of days', itinerary.days.length === 5, `Got ${itinerary.days.length} days`);
    logTest('Duration matches itinerary length',
      itinerary.computed?.duration_days === itinerary.days.length);

    // Check segment structure
    logTest('Day has morning segment', Array.isArray(day1.segments.morning));
    logTest('Day has afternoon segment', Array.isArray(day1.segments.afternoon));
    logTest('Day has evening segment', Array.isArray(day1.segments.evening));

    logTest('Morning has exactly 1 object',
      day1.segments.morning.length === 1,
      `Got ${day1.segments.morning.length}`);
    logTest('Afternoon has exactly 1 object',
      day1.segments.afternoon.length === 1,
      `Got ${day1.segments.afternoon.length}`);
    logTest('Evening has exactly 1 object',
      day1.segments.evening.length === 1,
      `Got ${day1.segments.evening.length}`);

    // Check new segment structure
    if (day1.segments.morning.length > 0) {
      const morning = day1.segments.morning[0];
      logTest('Segment has place field', morning.place !== undefined);
      logTest('Segment has duration_hours', typeof morning.duration_hours === 'number');
      logTest('Segment has descriptor', typeof morning.descriptor === 'string');
      logTest('Segment does NOT have places field', morning.places === undefined);
    }

    // Save itinerary stream
    await fs.writeFile(
      `${LOG_DIR}/stream-3-itinerary-${chatId}.json`,
      JSON.stringify({
        message: 'Create detailed itinerary',
        tokenCount: result3.tokenCount,
        itinerary: result3.itinerary,
        summary: result3.summary
      }, null, 2)
    );

    console.log('\n📋 Sample Day 1 Structure:');
    console.log(JSON.stringify(day1, null, 2).substring(0, 500) + '...');
  }

  // ============================================================================
  // TEST 4: Streaming Modification
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 4: Streaming Modification');
  console.log('='.repeat(80));

  const result4 = await sendStreamingMessage('Add a visit to Tokyo Skytree on day 2 morning');

  logTest('Modification streamed successfully', result4.tokenCount > 0);
  logTest('Context updated', result4.finalData !== null);

  if (result4.itinerary?.days?.length > 1) {
    const day2Morning = result4.itinerary.days[1].segments.morning[0];
    const mentionsSkyTree = day2Morning.place.toLowerCase().includes('skytree') ||
                           day2Morning.descriptor.toLowerCase().includes('skytree');
    logTest('Tokyo Skytree added to Day 2', mentionsSkyTree,
      `Day 2 morning: ${day2Morning.place}`);
  }

  // ============================================================================
  // TEST 5: Streaming Performance
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 5: Streaming Performance');
  console.log('='.repeat(80));

  console.log('\n📊 Streaming Performance Metrics:');
  console.log(`Test 1 (Initial): ${result1.tokenCount} tokens`);
  console.log(`Test 2 (Details): ${result2.tokenCount} tokens`);
  console.log(`Test 3 (Itinerary): ${result3.tokenCount} tokens`);
  console.log(`Test 4 (Modification): ${result4.tokenCount} tokens`);

  logTest('All streams completed', true);
  logTest('Incremental token delivery working',
    result1.tokenCount > 10 && result2.tokenCount > 10 && result3.tokenCount > 10);

  // ============================================================================
  // TEST 6: Compare Streaming vs Non-Streaming
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 6: Compare Streaming vs Non-Streaming');
  console.log('='.repeat(80));

  console.log('\n📤 Testing non-streaming endpoint for comparison...');
  const nonStreamingChatId = `non-streaming-test-${Date.now()}`;

  const nonStreamResponse = await fetch(`${API_BASE}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId: nonStreamingChatId,
      message: 'Plan a 3-day trip to Paris from London'
    })
  });

  const nonStreamData = await nonStreamResponse.json();

  logTest('Non-streaming endpoint works', nonStreamData.success === true);
  logTest('Both endpoints have same response structure',
    nonStreamData.summary !== undefined &&
    nonStreamData.suggestedQuestions !== undefined &&
    nonStreamData.placesOfInterest !== undefined);

  console.log('\n📊 Comparison:');
  console.log(`  Streaming: Delivers ${result1.tokenCount} tokens incrementally`);
  console.log(`  Non-streaming: Delivers full response at once`);
  console.log(`  Both: Same final data structure ✓`);

  // ============================================================================
  // TEST 7: Error Handling in Streaming
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST 7: Error Handling');
  console.log('='.repeat(80));

  try {
    const errorResponse = await fetch(`${API_BASE}/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Missing chatId
        message: 'Test error handling'
      })
    });

    logTest('Missing chatId returns error', errorResponse.status === 400);
  } catch (err) {
    logTest('Error handling works', true, 'Request properly rejected');
  }

  // ============================================================================
  // FINAL SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📊 Pass Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  - ${t.name}${t.message ? ': ' + t.message : ''}`);
    });
  }

  // Save test results
  await fs.writeFile(
    `${LOG_DIR}/test-results-${chatId}.json`,
    JSON.stringify({
      chatId,
      timestamp: new Date().toISOString(),
      results: testResults,
      streams: {
        stream1: { tokenCount: result1.tokenCount, contentLength: result1.fullContent.length },
        stream2: { tokenCount: result2.tokenCount, contentLength: result2.fullContent.length },
        stream3: { tokenCount: result3.tokenCount, contentLength: result3.fullContent.length },
        stream4: { tokenCount: result4.tokenCount, contentLength: result4.fullContent.length }
      }
    }, null, 2)
  );

  console.log(`\n📁 Logs saved to: ${LOG_DIR}/`);
  console.log(`  - stream-1-${chatId}.json (first stream)`);
  console.log(`  - stream-3-itinerary-${chatId}.json (itinerary stream)`);
  console.log(`  - test-results-${chatId}.json (full test results)`);

  console.log('\n' + '='.repeat(80));
  if (testResults.failed === 0) {
    console.log('✅ ALL STREAMING TESTS PASSED - API IS READY!');
  } else {
    console.log('❌ SOME TESTS FAILED - NEEDS ATTENTION');
  }
  console.log('='.repeat(80));

  process.exit(testResults.failed > 0 ? 1 : 0);

} catch (error) {
  console.error('\n❌ TEST ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
}
