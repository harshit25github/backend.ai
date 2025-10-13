/**
 * Test script for Flight Specialist Agent
 * Tests the conditional API calling logic
 */

import { loadContext, saveContext, flight_search, update_flight_airports, AppContext } from './multiAgentSystem.js';

// Test 1: Missing IATA codes
console.log('='.repeat(60));
console.log('TEST 1: Missing IATA codes');
console.log('='.repeat(60));

const testContext1 = AppContext.parse({
  summary: {
    origin: { city: 'Nellore', iata: null },
    destination: { city: 'Goa', iata: null },
    outbound_date: '2025-12-15',
    pax: 2
  },
  flights: {
    tripType: 'roundtrip',
    cabinClass: 'economy',
    resolvedOrigin: { userCity: 'Nellore', airportIATA: null },
    resolvedDestination: { userCity: 'Goa', airportIATA: null }
  }
});

const mockRunContext1 = { context: testContext1 };

console.log('\n📞 Calling flight_search without IATA codes...');
const result1 = await flight_search.execute({
  origin: 'Nellore',
  destination: 'Goa',
  outbound_date: '2025-12-15',
  pax: 2,
  cabin_class: 'economy',
  trip_type: 'roundtrip',
  return_date: '2025-12-20'
}, mockRunContext1);

console.log('\n✅ Result:', result1);
console.log('\n❓ Should mention: Missing origin_iata, dest_iata');
console.log('❓ Should instruct: Use web_search + update_flight_airports');

// Test 2: After resolving IATA codes
console.log('\n' + '='.repeat(60));
console.log('TEST 2: After resolving IATA codes');
console.log('='.repeat(60));

console.log('\n📞 Calling update_flight_airports...');
const result2 = await update_flight_airports.execute({
  origin_iata: 'TIR',
  origin_name: 'Tirupati Airport',
  origin_distance_km: 120,
  destination_iata: 'GOI',
  destination_name: 'Goa International Airport',
  destination_distance_km: 0
}, mockRunContext1);

console.log('✅ Result:', result2);

console.log('\n📞 Calling flight_search WITH IATA codes...');
const result3 = await flight_search.execute({}, mockRunContext1);

console.log('\n✅ Result:', result3);
console.log('\n❓ Should mention: Successfully found X flight options');
console.log('❓ Should mention: from TIR to GOI');

// Test 3: Context validation
console.log('\n' + '='.repeat(60));
console.log('TEST 3: Context Validation');
console.log('='.repeat(60));

console.log('\n📋 Final Context State:');
console.log('Origin IATA:', testContext1.flights.resolvedOrigin.airportIATA);
console.log('Destination IATA:', testContext1.flights.resolvedDestination.airportIATA);
console.log('Booking Status:', testContext1.flights.bookingStatus);
console.log('Search Results Count:', testContext1.flights.searchResults.length);
console.log('Has Deeplink:', !!testContext1.flights.deeplink);

console.log('\n' + '='.repeat(60));
console.log('✅ ALL TESTS COMPLETED');
console.log('='.repeat(60));
