import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3000/api/chat';

async function quickTest() {
  const chatId = `quick-${Date.now()}`;

  console.log('Testing suggestedQuestions and placesOfInterest...\n');

  const response = await fetch(`${API_BASE}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chatId,
      message: 'I want to visit Tokyo for 7 days'
    })
  });

  const data = await response.json();

  console.log('Response:', data.response.substring(0, 200));
  console.log('\nContext Summary:');
  console.log('- placesOfInterest:', data.placesOfInterest?.length || 0);
  console.log('- suggestedQuestions:', data.suggestedQuestions?.length || 0);
  console.log('- pax:', data.summary?.pax);

  if (data.placesOfInterest?.length > 0) {
    console.log('\nPlaces:');
    data.placesOfInterest.forEach((p, i) => console.log(`  ${i+1}. ${p.placeName}`));
  }

  if (data.suggestedQuestions?.length > 0) {
    console.log('\nQuestions:');
    data.suggestedQuestions.forEach((q, i) => console.log(`  ${i+1}. ${q}`));
  }
}

quickTest();
