/**
 * CONFIRMED FESTIVAL FACTS: only what the organisers have supplied, plus sourced venue identity.
 * Anything not yet announced is `null` and the UI renders an intentional "on transmission" state.
 */
export const FESTIVAL = {
  name: 'Milky Way',
  organiser: "Masters' Union",
  descriptor: 'Undergraduate Youth Cultural Fest',
  theme: 'Deep Space',
  venue: {
    name: 'Yashobhoomi',
    city: 'New Delhi',
    // sourced: https://iiccl.dpiit.gov.in/about-us, https://en.wikipedia.org/wiki/Yashobhoomi
    formal: 'India International Convention & Expo Centre',
    locality: 'Dwarka',
  },
  /** ISO dates once announced, e.g. ['2027-02-12', '2027-02-14'] */
  dates: null as null | [string, string],
  /** Official channels once supplied */
  contact: {
    email: null as null | string,
    instagram: null as null | string,
  },
  registration: {
    /**
     * preview: form works end-to-end but issues a clearly labelled PREVIEW pass (no seat is reserved)
     * open:    submissions are stored in Supabase (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, server env);
     *          REGISTRATION_WEBHOOK_URL, if set, also receives a copy
     * closed:  form hidden, message shown
     */
    status: 'open' as 'preview' | 'open' | 'closed',
    externalUrl: null as null | string,
  },
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://milkyway.example',
} as const

export const TBA = 'On transmission'
