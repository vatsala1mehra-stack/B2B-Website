/*
 * ============================================================
 *  SITE CONFIG — the only file the business team needs to edit
 * ============================================================
 *
 *  - Keep the structure exactly as it is: quotes around text, commas
 *    between items. A missing comma will stop the page from loading.
 *  - price: a number in INR per month (e.g. 499) or null to show
 *    "Pricing on request".
 *  - category: products with the same category are grouped together
 *    and get a filter chip. Spell categories identically.
 *  - sku: the internal code passed to checkout / the lead form.
 *    The values below are PLACEHOLDERS — replace with real SKUs.
 */

export const CONFIG = {
  // Where "Get started" / "Buy now" buttons send people.
  checkoutUrl: "https://www.airtel.in/business/",

  // URL that receives the lead form as a JSON POST.
  // Leave empty ("") and the form will send people to checkoutUrl instead.
  leadEndpoint: "",

  // Link to the downloadable founder's guide (PDF etc.). Not shown on the page yet.
  guideUrl: "",

  // Where "Talk to sales" goes (a contact page or a tel: link).
  // Leave empty ("") to use checkoutUrl.
  advisorUrl: "",

  // Footer and nav links. Replace with the real Airtel Business pages.
  links: {
    support: "https://www.airtel.in/business/",
    privacy: "https://www.airtel.in/business/",
    terms: "https://www.airtel.in/business/",
  },

  /*
   * ---------------- THE THREE STORIES ----------------
   * Each path is what a visitor picks at the start: set up, expand or switch.
   * beats: exactly 5. title = headline (5 words or fewer), text = one
   *        sentence, get = product names from the catalogue below (shown
   *        as "You get"). The 3D scene for each beat is fixed in story.js.
   * plan:  shown at the end. lines name catalogue products whose SKUs go
   *        to checkout. price: INR per month, or null for "Price shown at checkout".
   */
  paths: {
    setup: {
      label: "Set up a new office",
      short: "Set up",
      intro: "Empty office, first team, nothing connected yet.",
      beats: [
        { title: "Day one. Nothing's connected.", text: "Four people, no work numbers, no Wi-Fi, and no way for customers to call.", get: [] },
        { title: "One plan. Every phone.", text: "Every phone on one business plan: pooled calls and data, one bill, managed from one place.", get: ["Business Postpaid"] },
        { title: "Fibre to every desk.", text: "Office broadband for the team today, a dedicated leased line when you need guaranteed speed.", get: ["Airtel Office Internet", "Internet Leased Line"] },
        { title: "Customers can reach you.", text: "A toll-free number that rings at the front desk, or on anyone's phone, wherever they are.", get: ["Toll-Free Number", "Airtel IQ Business Calling"] },
        { title: "Secured. On one bill.", text: "Email on your own domain, protection for every device, and one person who knows your account.", get: ["Google Workspace", "Cybersecurity Suite", "Dedicated Relationship Manager"] },
      ],
      plan: {
        name: "New office",
        price: null,
        lines: [
          { area: "Phones",    label: "Business postpaid",                  products: ["Business Postpaid"] },
          { area: "Internet",  label: "Airtel Office Internet",             products: ["Airtel Office Internet"] },
          { area: "Workspace", label: "Google Workspace",                   products: ["Google Workspace"] },
          { area: "Customers", label: "Toll-free + Airtel IQ",              products: ["Toll-Free Number", "Airtel IQ Business Calling"] },
          { area: "Security",  label: "Cloud & cybersecurity",              products: ["Cloud Hosting", "Cybersecurity Suite"] },
          { area: "Support",   label: "One bill, one relationship manager", products: ["Dedicated Relationship Manager"] },
        ],
      },
    },
    expand: {
      label: "Expand my office",
      short: "Expand",
      intro: "Team growing, more desks, maybe a second site.",
      beats: [
        { title: "Hiring faster than wiring.", text: "New people start Monday, and the office was set up for four.", get: [] },
        { title: "New joiners, live today.", text: "Add lines to your existing business plan, so new people get a number on day one.", get: ["Business Postpaid", "Managed Mobility"] },
        { title: "More desks. More bandwidth.", text: "Move up to a leased line with dedicated, symmetric speed for everyone in the room.", get: ["Internet Leased Line"] },
        { title: "Second site. Same network.", text: "Your new branch joins the same secure network, managed as one office.", get: ["Multi-Site Networking", "Network Security"] },
        { title: "Grown. Not rebuilt.", text: "Everything added to the same account, the same bill and the same relationship manager.", get: ["Dedicated Relationship Manager"] },
      ],
      plan: {
        name: "Office expansion",
        price: null,
        lines: [
          { area: "New lines", label: "Business postpaid + managed mobility", products: ["Business Postpaid", "Managed Mobility"] },
          { area: "Bandwidth", label: "Internet Leased Line",                 products: ["Internet Leased Line"] },
          { area: "Sites",     label: "Multi-site networking",                products: ["Multi-Site Networking"] },
          { area: "Security",  label: "Network security",                     products: ["Network Security"] },
          { area: "Support",   label: "Same bill, same relationship manager", products: ["Dedicated Relationship Manager"] },
        ],
      },
    },
    shift: {
      label: "Switch to Airtel",
      short: "Switch",
      intro: "Already running, but on too many providers and bills.",
      beats: [
        { title: "Three providers. Three bills.", text: "Phones, internet and customer lines from different companies, and nobody owns the problem when one fails.", get: [] },
        { title: "Keep your numbers.", text: "Move your team's mobile numbers to one Airtel business plan without changing them.", get: ["Business Postpaid"] },
        { title: "Run both. Then switch.", text: "Airtel internet goes in alongside your current line, so you choose when to switch over.", get: ["Airtel Office Internet", "Internet Leased Line"] },
        { title: "Customer lines, moved over.", text: "Your toll-free number and call routing, now on one platform you control.", get: ["Toll-Free Number", "Airtel IQ Business Calling"] },
        { title: "One partner. One bill.", text: "One account, one invoice and one person to call, with security across all of it.", get: ["Cybersecurity Suite", "Dedicated Relationship Manager"] },
      ],
      plan: {
        name: "Switch to Airtel",
        price: null,
        lines: [
          { area: "Phones",    label: "Business postpaid (keep your numbers)", products: ["Business Postpaid"] },
          { area: "Internet",  label: "Office internet or leased line",        products: ["Airtel Office Internet"] },
          { area: "Customers", label: "Toll-free + Airtel IQ",                 products: ["Toll-Free Number", "Airtel IQ Business Calling"] },
          { area: "Security",  label: "Cybersecurity suite",                   products: ["Cybersecurity Suite"] },
          { area: "Support",   label: "One bill, one relationship manager",    products: ["Dedicated Relationship Manager"] },
        ],
      },
    },
  },

  /*
   * ---------------- CREDIBILITY ("Why Airtel") ----------------
   * EVERYTHING HERE IS A PLACEHOLDER. Replace with verified Airtel facts,
   * a real customer quote (with permission) and real certifications before
   * launch. Values in [square brackets] render as visible placeholders.
   */
  proof: {
    headline: "Why businesses run on Airtel",
    stats: [
      { value: "[XX lakh+]", label: "businesses on Airtel" },
      { value: "[XX%]",      label: "of India covered by our network" },
      { value: "[XXX+]",     label: "cities with Airtel fibre" },
      { value: "[24×7]",     label: "business support" },
    ],
    clientLogos: 6,   // number of client logo slots (add the official logo files later)
    quote: {
      text: "[A short, real quote from a founder who set up, expanded or switched with Airtel.]",
      name: "[Customer name]",
      role: "[Role, Company]",
    },
    badges: ["[Certification 1]", "[Certification 2]", "[Uptime SLA]"],
  },

  products: [
    // ---- Mobility ----
    { name: "Business Postpaid", category: "Mobility", sku: "SKU-TBD-POSTPAID", price: null,
      blurb: "Pooled data and calling plans for the whole team, one bill." },
    { name: "Business Number", category: "Mobility", sku: "SKU-TBD-BIZNUM", price: null,
      blurb: "One memorable number that rings across the team’s phones." },
    { name: "Managed Mobility", category: "Mobility", sku: "SKU-TBD-MOBILITY", price: null,
      blurb: "Devices, SIMs and usage policies managed from one console." },

    // ---- Voice & Numbers ----
    { name: "Toll-Free Number", category: "Voice & Numbers", sku: "SKU-TBD-TOLLFREE", price: null,
      blurb: "1800 number so customers can reach you free, from anywhere in India." },
    { name: "Airtel IQ Business Calling", category: "Voice & Numbers", sku: "SKU-TBD-IQCALL", price: null,
      blurb: "Cloud call routing, IVR and call analytics without hardware." },

    // ---- Connectivity ----
    { name: "Airtel Office Internet", category: "Connectivity", sku: "SKU-TBD-OFFICEINT", price: null,
      blurb: "Fibre broadband for small offices, with bundled voice and OTT." },
    { name: "Internet Leased Line", category: "Connectivity", sku: "SKU-TBD-ILL", price: null,
      blurb: "Dedicated, symmetric bandwidth with an uptime SLA." },
    { name: "Multi-Site Networking", category: "Connectivity", sku: "SKU-TBD-MULTISITE", price: null,
      blurb: "Connect offices, stores and warehouses on one secure network." },
    { name: "IoT Connectivity", category: "Connectivity", sku: "SKU-TBD-IOT", price: null,
      blurb: "Managed SIMs and a dashboard for fleets, sensors and devices." },

    // ---- Productivity & Cloud ----
    { name: "Google Workspace", category: "Productivity & Cloud", sku: "SKU-TBD-GWS", price: null,
      blurb: "Business email on your domain, Drive, Meet and Docs, billed by Airtel." },
    { name: "Cloud Hosting", category: "Productivity & Cloud", sku: "SKU-TBD-CLOUD", price: null,
      blurb: "Compute and storage hosted in India, for apps and data that stay local." },

    // ---- Customer Engagement ----
    { name: "Airtel IQ SMS & WhatsApp", category: "Customer Engagement", sku: "SKU-TBD-IQMSG", price: null,
      blurb: "OTPs, alerts and conversations over SMS and WhatsApp APIs." },
    { name: "Airtel IQ Reach", category: "Customer Engagement", sku: "SKU-TBD-IQREACH", price: null,
      blurb: "Reach targeted audiences with consented, compliant campaigns." },

    // ---- Security ----
    { name: "Cybersecurity Suite", category: "Security", sku: "SKU-TBD-CYBER", price: null,
      blurb: "Endpoint, email and threat protection packaged for growing teams." },
    { name: "Network Security", category: "Security", sku: "SKU-TBD-NETSEC", price: null,
      blurb: "Managed firewall and DDoS protection on your connectivity." },

    // ---- Support ----
    { name: "Dedicated Relationship Manager", category: "Support", sku: "SKU-TBD-RM", price: null,
      blurb: "One named person who knows your account and escalates for you." },
  ],
};
