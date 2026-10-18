/* ------------------------------------------------------------------
 *  Mock guidance feed for the Adult flow's guidance/advertisement page.
 *
 *  The page must work fully offline, so the content is bundled here.
 *  `getGuidanceItems()` keeps the shape a real content API will return —
 *  when the API lands, replace its body with a fetch and keep everything
 *  else unchanged (the page already consumes this async contract).
 *
 *  Content framing: residents in a disaster need to know what to do NEXT
 *  to return to normal life. Each item is a recovery insight (rebuilding,
 *  livelihoods, health, school, wellbeing, assistance) presented as a
 *  helpful guide — the natural home for sponsor/programme messages.
 * ------------------------------------------------------------------ */

export const MOCK_GUIDANCE = [
  {
    id: 'rebuild',
    icon: 'home',
    tag: 'Rebuilding',
    title: 'Ready to rebuild? Safer homes start here',
    subtitle: 'Get your home checked before you pick up a hammer.',
    points: [
      'Free structural checks at the Zone desk — book a slot any morning.',
      'Tarpaulins, nails and timber kits are issued from the materials point.',
      'Volunteer build teams visit the most damaged plots first.',
    ],
    program: 'Camp Recovery Hub · Materials desk',
  },
  {
    id: 'livelihoods',
    icon: 'work',
    tag: 'Livelihoods',
    title: 'Get back to earning this week',
    subtitle: 'Small grants and day-work are open for affected families.',
    points: [
      'One-time starter grants for small shops, carts and home businesses.',
      'Paid clean-up and repair crews recruit daily at the main gate.',
      'Skills workshops — sewing, electrical repair, mobile servicing.',
    ],
    program: 'Back to Work programme · Registration tent',
  },
  {
    id: 'health',
    icon: 'health',
    tag: 'Health',
    title: 'Health comes first — clinic hours extended',
    subtitle: 'Stay well while you rebuild.',
    points: [
      'Mobile clinic runs 8:00–18:00 near the water point, no appointment.',
      'Free water tablets and hygiene kits at the hygiene station.',
      'Booster vaccinations for children and elders every Wednesday.',
    ],
    program: 'District Health Team · Mobile clinic',
  },
  {
    id: 'school',
    icon: 'school',
    tag: 'Education',
    title: 'School can start again now',
    subtitle: 'Temporary learning rooms are open for every grade.',
    points: [
      'Enrol in 10 minutes at the learning centre — bring any old school report.',
      'Exercise books, uniforms and bags are provided free.',
      'Daily transport shuttle to reopened schools in the area.',
    ],
    program: 'Learning Again programme · Education tent',
  },
  {
    id: 'wellbeing',
    icon: 'mind',
    tag: 'Wellbeing',
    title: "It's okay to talk — you're not alone",
    subtitle: 'Shared experiences help families recover faster.',
    points: [
      'Daily group circles for adults and teens, 30 minutes, all languages.',
      'Private counselling available every evening by the quiet tent.',
      'Sleep and stress tips from trained community counsellors.',
    ],
    program: 'Stronger Together · Psychosocial support',
  },
  {
    id: 'assistance',
    icon: 'support',
    tag: 'Assistance',
    title: 'Register once, receive every update',
    subtitle: 'One registration covers all relief and recovery support.',
    points: [
      'Register at the help desk to unlock cash assistance and insurance claims.',
      'SMS alerts for distributions, weather warnings and transport.',
      'Track your family\'s entitlements on this screen any time.',
    ],
    program: 'Relief Registration · Main help desk',
  },
];

/**
 * Guidance items for the page. Offline-safe: returns bundled mock data.
 * When a content API is available, swap the body for e.g.:
 *   const res = await fetch(`${API}/api/guidance`);
 *   if (res.ok) return res.json();
 * and fall back to MOCK_GUIDANCE when the device is offline.
 */
export async function getGuidanceItems() {
  return MOCK_GUIDANCE;
}
