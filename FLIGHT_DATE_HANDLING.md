# Flight Search Date Handling (Hinglish)

## Overview
Is doc me flight_search tool ka date handling approach aur related code snippet diya hai. Goal ye hai ki user ke date phrases (jaise "next weekend") ko safely normalize kiya ja sake, aur explicit year ho to validation strict rahe.

## Approach (Hinglish)
- **Explicit year detect**: Agar date string me 4-digit year hai, to usko user-provided mana jata hai. Invalid ya window ke bahar ho to user se naya date mangte hain.
- **Relative dates normalize**: "next weekend", "this weekend", "next week", "in N days/weeks" ko tool hi YYYY-MM-DD me convert karta hai.
- **Partial dates normalize**: "15 Dec", "Dec 15" jaise inputs ko next future occurrence me convert kiya jata hai.
- **Silent inference**: Agar year nahi diya aur tool ne date infer/normalize kiya, to user ko bataya nahi jata (jab tak user na pooche).
- **Validation**: Date past me nahi ho sakta, aur 359 days window ke andar hona chahiye. Roundtrip me return date outbound ke baad hona chahiye.
- **Next weekend rule**: "next weekend" ko **following weekend** maana jata hai (immediate weekend nahi).

## Code Snippet (from `src/ai/multiAgentSystem.js`)
```js
const hasExplicitYear = (value) => /\b(19|20)\d{2}\b/.test(String(value || ''));

const normalizePartialDate = (value) => {
  if (!value) return null;
  const trimmed = String(value).trim();
  const partialMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)$|^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!partialMatch) return null;

  const day = partialMatch[1] || partialMatch[4];
  const month = partialMatch[2] || partialMatch[3];
  if (!day || !month) return null;

  const currentYear = new Date().getFullYear();
  const candidateThisYear = new Date(`${month} ${day}, ${currentYear}`);
  if (Number.isNaN(candidateThisYear.getTime())) return null;

  const candidateNextYear = new Date(`${month} ${day}, ${currentYear + 1}`);
  const todayForCompare = new Date();
  todayForCompare.setHours(0, 0, 0, 0);

  const chosen = candidateThisYear > todayForCompare ? candidateThisYear : candidateNextYear;
  return Number.isNaN(chosen.getTime()) ? null : chosen.toISOString().split('T')[0];
};

const normalizeRelativeDate = (value, baseDate) => {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return null;

  const base = new Date(baseDate);
  base.setHours(0, 0, 0, 0);
  const addDays = (days) => {
    const next = new Date(base);
    next.setDate(next.getDate() + days);
    return next;
  };

  if (normalized === 'tomorrow') return toISODate(addDays(1));
  if (normalized === 'next week') return toISODate(addDays(7));

  const inDaysMatch = normalized.match(/^in\s+(\d{1,3})\s+days?$/);
  if (inDaysMatch) {
    const days = Number(inDaysMatch[1]);
    if (Number.isFinite(days) && days > 0) return toISODate(addDays(days));
  }

  const inWeeksMatch = normalized.match(/^in\s+(\d{1,2})\s+weeks?$/);
  if (inWeeksMatch) {
    const weeks = Number(inWeeksMatch[1]);
    if (Number.isFinite(weeks) && weeks > 0) return toISODate(addDays(weeks * 7));
  }

  if (normalized === 'next weekend') {
    const day = base.getDay();
    const daysToSaturday = (6 - day + 7) % 7;
    return toISODate(addDays(daysToSaturday + 7));
  }

  if (normalized === 'this weekend' || normalized === 'weekend') {
    const day = base.getDay();
    const daysToSaturday = (6 - day + 7) % 7;
    const offset = daysToSaturday === 0 ? 7 : daysToSaturday;
    return toISODate(addDays(offset));
  }

  return null;
};

// Outbound normalization
let outboundDate = null;
if (requiredFields.outbound_date) {
  const outboundHasYear = hasExplicitYear(requiredFields.outbound_date);
  if (outboundHasYear) {
    outboundDate = parseDateStrict(requiredFields.outbound_date);
  } else {
    const normalizedRelative = normalizeRelativeDate(requiredFields.outbound_date, today);
    let normalized = normalizedRelative || normalizePartialDate(requiredFields.outbound_date);
    let label = normalizedRelative ? 'relative' : 'partial';
    if (!normalized) {
      const parsedNoYear = parseDateStrict(requiredFields.outbound_date);
      if (parsedNoYear) {
        const adjusted = parsedNoYear <= today ? bumpYear(parsedNoYear) : parsedNoYear;
        normalized = toISODate(adjusted);
        label = 'inferred';
      }
    }
    if (normalized) {
      requiredFields.outbound_date = normalized;
      ctx.summary.outbound_date = normalized;
      outboundDate = parseDateStrict(normalized);
      console.log(`[flight_search] Normalized outbound ${label} date to ${normalized}`);
    }
  }
}

// Return normalization (same logic)
if (requiredFields.return_date) {
  let returnDate = null;
  const returnHasYear = hasExplicitYear(requiredFields.return_date);
  if (returnHasYear) {
    returnDate = parseDateStrict(requiredFields.return_date);
  } else {
    const normalizedRelative = normalizeRelativeDate(requiredFields.return_date, today);
    let normalizedReturn = normalizedRelative || normalizePartialDate(requiredFields.return_date);
    let label = normalizedRelative ? 'relative' : 'partial';
    if (!normalizedReturn) {
      const parsedNoYear = parseDateStrict(requiredFields.return_date);
      if (parsedNoYear) {
        const adjusted = parsedNoYear <= today ? bumpYear(parsedNoYear) : parsedNoYear;
        normalizedReturn = toISODate(adjusted);
        label = 'inferred';
      }
    }
    if (normalizedReturn) {
      requiredFields.return_date = normalizedReturn;
      ctx.summary.return_date = normalizedReturn;
      returnDate = parseDateStrict(normalizedReturn);
      console.log(`[flight_search] Normalized return ${label} date to ${normalizedReturn}`);
    }
  }
}
```

## Quick Examples (Hinglish)
- "next weekend" -> following Saturday
- "this weekend" -> upcoming Saturday
- "in 10 days" -> today + 10
- "15 Dec" -> next future occurrence of Dec 15
- "2020-01-01" -> explicit year past hai, user se new date mangna hoga
