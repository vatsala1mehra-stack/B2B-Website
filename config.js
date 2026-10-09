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

  // Link to the downloadable founder's guide (PDF etc.).
  // Leave empty ("") to hide the guide button.
  guideUrl: "",

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
