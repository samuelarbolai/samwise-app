import type { Contact, Template } from "./_types";

type SeedContact = Omit<Contact, "id" | "createdAt" | "updatedAt">;
type SeedTemplate = Omit<Template, "id" | "createdAt" | "locked" | "retired" | "version" | "parentVersionId"> & {
  body: string;
};

export const SEED_CONTACTS: SeedContact[] = [
  // — Pipeline rows (sheet, second table) merged with the contacts table.
  {
    name: "Samuel Giraldo Concha",
    occupation: "Entrepreneur",
    source: "Personal",
    step: "Prospecting",
    blocker: "He does not want to speak with a therapist. He wants to handle this himself with AI.",
    recommendationStatus: "Not asked",
    ritualsOwned: [
      "samwise - not_going_to_bed - Samuel",
      "samwise - develop_videos - Samuel Giraldo Concha",
      "science-skills (bio-computing)",
      "asteroid-mining",
    ],
  },
  {
    name: "Sarah Coral",
    phone: "+57 314 7415116",
    occupation: "Entrepreneur",
    source: "Personal",
    step: "Optimization",
    blocker:
      "No existe una forma sexy y fácil de recomendarnos: directamente a otra persona, en sus redes, como testimonio en nuestra página.",
    nextAction: "Make an evaluation of the protection ritual in the morning and the call.",
    inBacklog: false,
    recommendationStatus: "Not asked",
    ritualsOwned: ["Samwise - Sarah Coral"],
  },
  {
    name: "Isabela Cuai",
    phone: "+57 319 4444939",
    occupation: "Comms Designer",
    source: "Personal",
    step: "Disqualified",
    blocker: "I do not have any behaviour that I want to change.",
    nextAction: "Add information to buyer persona to filter out cases like hers.",
    inBacklog: true,
    recommendationStatus: "Not asked",
    ritualsOwned: ["Narya - Isa Cuai"],
  },
  {
    name: "Thomas Owen",
    phone: "+57 318 2063927",
    occupation: "Student",
    source: "Personal",
    step: "Dead",
    blocker: "I took too long to set up the agent, so he lost interest.",
    nextAction: "Make automatic agent setup.",
    inBacklog: true,
    recommendationStatus: "Not asked",
    ritualsOwned: ["Narya - Thomas Owen"],
  },
  {
    name: "Tomás Giraldo Concha",
    source: "Personal",
    step: "Disqualified",
    blocker: '"No lo sentí sagrado." "Se tiene que sentir más preparado."',
    nextAction:
      "We need to make the fit assessment call feel reliable and prepared as fuck.",
    inBacklog: true,
    recommendationStatus: "Not asked",
  },
  {
    name: "Daniel Santibañez",
    phone: "+57 315 3696869",
    occupation: "Marketer",
    source: "Personal",
    step: "Fit Assessment",
    nextAction: "Tener reu el lunes.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Daniel Salcedo",
    phone: "+57 310 3074424",
    source: "Personal",
    step: "Prospecting",
    nextAction: "Ask for feedback. Ask for recommendation.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Javier Galeano",
    source: "Personal",
    step: "Recommendation",
    blocker: "Haven't defined who to recommend us with.",
    nextAction: "Push for recommendation.",
    recommendationStatus: "Asked",
  },
  {
    name: "Leandra Concha",
    source: "Personal",
    step: "Fit Assessment",
    nextAction: "Tener reu el lunes.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Diego Echecopar",
    source: "Personal",
    step: "Prospecting",
    nextAction: "Ask for feedback. Ask for recommendation.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Santiago Ortiz",
    source: "Personal",
    step: "Prospecting",
    blocker: "Quedó en agendar, no lo ha hecho.",
    nextAction: "Ask for feedback. Ask for recommendation.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Jorge Mario Plazas",
    source: "Personal",
    step: "Prospecting",
    nextAction: "Ask for feedback. Ask for recommendation.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Andrew McCarthy",
    source: "Personal",
    step: "Prospecting",
    blocker: "Lo va a hacer el lunes.",
    nextAction: "Llamar a recordar a partir del lunes.",
    recommendationStatus: "Not asked",
  },
  {
    name: "David Mejía",
    source: "Personal",
    step: "Recommendation",
    blocker: "Llamar a confirmar que nos recomendó.",
    nextAction:
      "Push him to confirm the recommendations. Do it on Saturday, as he said he will bring this up Friday at a family dinner.",
    recommendationStatus: "Promised",
  },
  {
    name: "David Castañeda",
    source: "Personal",
    step: "Fit Assessment",
    nextAction: "Tener reu del sábado y domingo.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Maria Lucía Lopez",
    source: "Personal",
    step: "Fit Assessment",
    recommendationStatus: "Not asked",
  },
  {
    name: "Juan Pablo Albán",
    source: "Personal",
    step: "Prospecting",
    blocker: "Quedó en agendar, no lo ha hecho.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Esteban Vasquez",
    source: "Personal",
    step: "Prospecting",
    blocker: "Quedó en agendar, no lo ha hecho.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Pablo Córdoba",
    source: "Personal",
    step: "Prospecting",
    blocker: "Quedó en agendar, no lo ha hecho.",
    nextAction: "Llamar a joder hoy viernes en la noche.",
    recommendationStatus: "Not asked",
  },
  {
    name: "David Zuluaga",
    source: "Personal",
    step: "Fit Assessment",
    nextAction:
      "Ir a Palmetto con él el martes a las 5pm. Espera ponernos al día; yo espero hacer la demo call.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Andrés Fonnegra",
    source: "Personal",
    step: "Prospecting",
    blocker: "Quedó en agendar.",
    nextAction:
      "Llamar a joder el lunes. Pidió explícitamente no ser jodido el fin de semana.",
    recommendationStatus: "Not asked",
  },
  {
    name: "Simón Montoya",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
  // — Contacts-only table (no pipeline entry yet)
  {
    name: "Martin Giraldo",
    phone: "+57 318 2345862",
    occupation: "Jr Engineer",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
  {
    name: "Maximiliano Lara",
    phone: "+57 310 7382800",
    occupation: "Sr Engineer",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
  {
    name: "GianLuca",
    phone: "+57 319 4076939",
    occupation: "Marketer",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
  {
    name: "Sebastian Herrera",
    phone: "+57 314 6083541",
    occupation: "Entrepreneur — Lawyer",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
  {
    name: "Daniel Hurtado",
    phone: "+57 310 6258961",
    occupation: "Engineer — Entrepreneur",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
    ritualsOwned: ["narya - Daniel Hurtado"],
  },
  {
    name: "Gabriel Hernandez",
    phone: "+1 (661) 502-7964",
    occupation: "Engineer — Entrepreneur",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
  {
    name: "Juan Alejandro Garcia Betancur",
    phone: "+49 1522 3415500",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
  {
    name: "Amaranta Grandi",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
    ritualsOwned: ["Narya - Amaranta Grandi"],
  },
  {
    name: "Valery Pabón",
    phone: "+57 318 7810326",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
  {
    name: "Francisco Tafur",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
    ritualsOwned: ["Samwise - Francisco Tafur"],
  },
  {
    name: "Andres Gonzalez",
    phone: "+57 314 411 7217",
    occupation: "Customer Service Executive",
    source: "Personal",
    step: "Queued",
    recommendationStatus: "Not asked",
  },
];

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    name: "Tier 1 — cold LinkedIn (problem-aware customer)",
    audience: "T1",
    body: `Hey [Name] — saw your post about [specific thing they wrote]. That line about [specific phrase from their post] hit me because I'm building something for exactly that experience.

I'm a founder visiting NYC Jun 9–17, building a behavioral product for ambitious people fighting screen distraction (porn, social, gaming — anything that's actively pulling them off the goal they say matters most).

Not pitching. I want 20 minutes of your perspective on what's actually helped and what's been useless. Free coffee on me, anywhere convenient for you.

3 slots I'm holding: [Cal.com link]`,
  },
  {
    name: "Tier 2 — cold LinkedIn (distribution ally)",
    audience: "T2",
    body: `Hey [Name] — I run a startup building behavioral tools for screen addiction (focused on the ambitious people whose careers are slipping because they can't put their phone down). You've been working with [audience / community / problem] for a while, and I'd love your read on what we're getting right and wrong.

I'm in NYC Jun 9–17. 30 min, coffee on me. If we click, I'd ask for one specific intro at the end — and if we don't, you get a free coffee and I get a sharper roadmap.

[one-pager link] for context. Slots here: [Cal.com link]`,
  },
  {
    name: "Follow-up — 5 days no reply",
    audience: "T1",
    body: `Bumping this — I'd really value 20 min if you can squeeze it in. If not, no worries; would love to stay in touch.`,
  },
  {
    name: "Phone-list / WhatsApp warm contact",
    audience: "Phone",
    body: `[Name], I'll be in NYC Jun 9–17 building out the first NYC users of [company]. Want to grab a coffee? I'd also love to know if anyone in your network is the ambitious-but-stuck-on-their-phone type — that's exactly who I'm trying to talk to.`,
  },
];
